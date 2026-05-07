import { v } from "convex/values";
import { query } from "./_generated/server";

export type FieldStats =
  | { type: "numeric"; avg: number; max: number; min: number; stddev: number; count: number }
  | { type: "boolean"; trueCount: number; falseCount: number; truePercent: number }
  | { type: "select"; distribution: Record<string, number>; count: number };

export interface TeamStats {
  teamNumber: number;
  nickname: string;
  opr: number | null;
  dpr: number | null;
  ccwm: number | null;
  epa: number | null;
  epaRank: number | null;
  matchCount: number;
  fieldStats: Record<string, FieldStats>;
  robotPhotoUrl: string | null;
  pitPhotoUrl: string | null;
  avgMatchBalls: number | null;
  maxMatchBalls: number | null;
}

function computeMatchBalls(entries: { data: Record<string, string | number | boolean | null> }[]) {
  if (entries.length === 0) return { avg: null, max: null };
  const totals = entries.map((e) => {
    const auto = (Number(e.data.auto_avg_balls_cycle) || 0) * (Number(e.data.auto_shoot_cycles) || 0);
    const tele = (Number(e.data.tele_avg_balls_shot) || 0) * (Number(e.data.tele_shoot_cycles) || 0);
    return auto + tele;
  });
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const max = Math.max(...totals);
  return { avg, max };
}

function computeFieldStats(values: (string | number | boolean | null)[], fieldType: string): FieldStats {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  if (fieldType === "boolean") {
    const trueCount = nonNull.filter((v) => v === true).length;
    return {
      type: "boolean",
      trueCount,
      falseCount: nonNull.length - trueCount,
      truePercent: nonNull.length > 0 ? (trueCount / nonNull.length) * 100 : 0,
    };
  }
  if (fieldType === "select" || fieldType === "text") {
    const dist: Record<string, number> = {};
    for (const v of nonNull) {
      const key = String(v);
      dist[key] = (dist[key] ?? 0) + 1;
    }
    return { type: "select", distribution: dist, count: nonNull.length };
  }
  const nums = nonNull.map(Number).filter((n) => !isNaN(n));
  if (nums.length === 0)
    return { type: "numeric", avg: 0, max: 0, min: 0, stddev: 0, count: 0 };
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const variance = nums.reduce((a, b) => a + (b - avg) ** 2, 0) / nums.length;
  return { type: "numeric", avg, max, min, stddev: Math.sqrt(variance), count: nums.length };
}

export const getTeamStats = query({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    configId: v.id("scoutingConfigs"),
  },
  handler: async (ctx, { eventKey, teamNumber, configId }): Promise<TeamStats | null> => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
    if (!team) return null;
    const config = await ctx.db.get(configId);
    if (!config) return null;
    const entries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .collect();
    const fieldStats: Record<string, FieldStats> = {};
    for (const field of config.matchFields) {
      if (!field.aggregatable) continue;
      const values = entries.map((e) => e.data[field.id] ?? null);
      fieldStats[field.id] = computeFieldStats(values, field.type);
    }
    const pitPhotoUrl = team.pitPhotoStorageId
      ? await ctx.storage.getUrl(team.pitPhotoStorageId)
      : null;
    const balls = computeMatchBalls(entries);
    return {
      teamNumber,
      nickname: team.nickname,
      opr: team.opr ?? null,
      dpr: team.dpr ?? null,
      ccwm: team.ccwm ?? null,
      epa: team.epa ?? null,
      epaRank: team.epaRank ?? null,
      matchCount: entries.length,
      fieldStats,
      robotPhotoUrl: team.robotPhotoUrl ?? null,
      pitPhotoUrl,
      avgMatchBalls: balls.avg,
      maxMatchBalls: balls.max,
    };
  },
});

export const getAllTeamStats = query({
  args: {
    eventKey: v.string(),
    configId: v.id("scoutingConfigs"),
  },
  handler: async (ctx, { eventKey, configId }): Promise<TeamStats[]> => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const config = await ctx.db.get(configId);
    if (!config) return [];
    const allEntries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const byTeam = new Map<number, typeof allEntries>();
    for (const entry of allEntries) {
      const arr = byTeam.get(entry.teamNumber) ?? [];
      arr.push(entry);
      byTeam.set(entry.teamNumber, arr);
    }
    return Promise.all(
      teams.map(async (team) => {
        const entries = byTeam.get(team.teamNumber) ?? [];
        const fieldStats: Record<string, FieldStats> = {};
        for (const field of config.matchFields) {
          if (!field.aggregatable) continue;
          const values = entries.map((e) => e.data[field.id] ?? null);
          fieldStats[field.id] = computeFieldStats(values, field.type);
        }
        const pitPhotoUrl = team.pitPhotoStorageId
          ? await ctx.storage.getUrl(team.pitPhotoStorageId)
          : null;
        const balls = computeMatchBalls(entries);
        return {
          teamNumber: team.teamNumber,
          nickname: team.nickname,
          opr: team.opr ?? null,
          dpr: team.dpr ?? null,
          ccwm: team.ccwm ?? null,
          epa: team.epa ?? null,
          epaRank: team.epaRank ?? null,
          matchCount: entries.length,
          fieldStats,
          robotPhotoUrl: team.robotPhotoUrl ?? null,
          pitPhotoUrl,
          avgMatchBalls: balls.avg,
          maxMatchBalls: balls.max,
        };
      }),
    );
  },
});
