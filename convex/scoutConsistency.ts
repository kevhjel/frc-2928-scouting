import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type ScoutResult = {
  userId: string;
  displayName: string;
  entryCount: number;
  uniqueTeams: number;
  overallDeviation: number;
  fieldDeviations: Record<string, number>;
};

export const getScoutConsistency = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }): Promise<ScoutResult[]> => {
    const entries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();

    if (entries.length === 0) return [];

    const config = await ctx.db
      .query("scoutingConfigs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();

    const numericFieldIds = new Set(
      (config?.matchFields ?? [])
        .filter(
          (f) =>
            f.aggregatable &&
            (f.type === "number" || f.type === "counter" || f.type === "rating"),
        )
        .map((f) => f.id),
    );

    // Group values by team -> field -> per-scout
    const teamFieldValues: Record<
      number,
      Record<string, Array<{ scoutUserId: Id<"users">; value: number }>>
    > = {};

    for (const entry of entries) {
      if (!teamFieldValues[entry.teamNumber]) {
        teamFieldValues[entry.teamNumber] = {};
      }
      for (const fieldId of numericFieldIds) {
        const raw = entry.data[fieldId];
        if (typeof raw !== "number") continue;
        if (!teamFieldValues[entry.teamNumber][fieldId]) {
          teamFieldValues[entry.teamNumber][fieldId] = [];
        }
        teamFieldValues[entry.teamNumber][fieldId].push({
          scoutUserId: entry.scoutUserId,
          value: raw,
        });
      }
    }

    // Compute consensus average per team+field (only where ≥2 scouts)
    const consensus: Record<number, Record<string, number>> = {};
    for (const [teamNum, fields] of Object.entries(teamFieldValues)) {
      const tn = Number(teamNum);
      consensus[tn] = {};
      for (const [fieldId, vals] of Object.entries(fields)) {
        if (vals.length < 2) continue;
        consensus[tn][fieldId] = vals.reduce((s, v) => s + v.value, 0) / vals.length;
      }
    }

    // Accumulate per-scout deviation stats
    const scoutIds: Id<"users">[] = [];
    const scoutStatsMap = new Map<
      string,
      {
        id: Id<"users">;
        entryCount: number;
        uniqueTeams: Set<number>;
        devSum: number;
        devCount: number;
        fieldDevSum: Record<string, number>;
        fieldDevCount: Record<string, number>;
      }
    >();

    for (const entry of entries) {
      const sid = entry.scoutUserId;
      const key = sid as string;
      if (!scoutStatsMap.has(key)) {
        scoutIds.push(sid);
        scoutStatsMap.set(key, {
          id: sid,
          entryCount: 0,
          uniqueTeams: new Set(),
          devSum: 0,
          devCount: 0,
          fieldDevSum: {},
          fieldDevCount: {},
        });
      }
      const s = scoutStatsMap.get(key)!;
      s.entryCount++;
      s.uniqueTeams.add(entry.teamNumber);

      const teamConsensus = consensus[entry.teamNumber] ?? {};
      for (const fieldId of numericFieldIds) {
        const consensusVal = teamConsensus[fieldId];
        if (consensusVal === undefined) continue;
        const raw = entry.data[fieldId];
        if (typeof raw !== "number") continue;
        const dev = Math.abs(raw - consensusVal);
        s.devSum += dev;
        s.devCount++;
        s.fieldDevSum[fieldId] = (s.fieldDevSum[fieldId] ?? 0) + dev;
        s.fieldDevCount[fieldId] = (s.fieldDevCount[fieldId] ?? 0) + 1;
      }
    }

    // Load profiles
    const profiles = await Promise.all(
      scoutIds.map((uid) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", uid))
          .unique(),
      ),
    );
    const displayNames: Record<string, string> = {};
    for (const p of profiles) {
      if (p) displayNames[p.userId as string] = p.displayName;
    }

    const results: ScoutResult[] = [];
    for (const [key, s] of scoutStatsMap.entries()) {
      const overallDeviation = s.devCount > 0 ? s.devSum / s.devCount : 0;
      const fieldDeviations: Record<string, number> = {};
      for (const fid of Object.keys(s.fieldDevSum)) {
        fieldDeviations[fid] = s.fieldDevSum[fid] / s.fieldDevCount[fid];
      }
      results.push({
        userId: key,
        displayName: displayNames[key] ?? "Unknown",
        entryCount: s.entryCount,
        uniqueTeams: s.uniqueTeams.size,
        overallDeviation,
        fieldDeviations,
      });
    }

    return results.sort((a, b) => b.overallDeviation - a.overallDeviation);
  },
});
