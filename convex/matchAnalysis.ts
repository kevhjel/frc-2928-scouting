import { v } from "convex/values";
import { query } from "./_generated/server";

const FIELD_CONDITIONS: Record<string, string> = {
  tele_defense_quality: "tele_defense",
  tele_defense_handling: "tele_was_defended",
};

type NumericStats = { type: "numeric"; avg: number; max: number; count: number };
type BooleanStats = { type: "boolean"; truePercent: number; trueCount: number; count: number };
type SelectStats = { type: "select"; distribution: Record<string, number>; count: number };
type FieldStats = NumericStats | BooleanStats | SelectStats;

type TeamAnalysis = {
  teamNumber: number;
  nickname: string;
  opr: number | null;
  epa: number | null;
  robotPhotoUrl: string | null;
  fieldStats: Record<string, FieldStats>;
  matchNotes: string | null;
  pitNotes: string | null;
  matchCount: number;
};

type MatchField = {
  id: string;
  label: string;
  type: string;
  higherIsBetter?: boolean;
  aggregatable: boolean;
};

type MatchAnalysisResult = {
  match: {
    matchKey: string;
    matchNumber: number;
    redAlliance: number[];
    blueAlliance: number[];
    redScore: number | null;
    blueScore: number | null;
    status: string;
    predictedTime: number | null;
  };
  matchFields: MatchField[];
  redTeams: TeamAnalysis[];
  blueTeams: TeamAnalysis[];
} | null;

function computeFieldStats(
  values: (string | number | boolean | null)[],
  fieldType: string,
): FieldStats {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  if (fieldType === "boolean") {
    const trueCount = nonNull.filter((v) => v === true).length;
    return {
      type: "boolean",
      trueCount,
      truePercent: nonNull.length > 0 ? (trueCount / nonNull.length) * 100 : 0,
      count: nonNull.length,
    };
  }
  if (fieldType === "select" || fieldType === "text" || fieldType === "multiselect") {
    const dist: Record<string, number> = {};
    for (const v of nonNull) {
      const key = String(v);
      dist[key] = (dist[key] ?? 0) + 1;
    }
    return { type: "select", distribution: dist, count: nonNull.length };
  }
  const nums = nonNull.map(Number).filter((n) => !isNaN(n));
  if (nums.length === 0) return { type: "numeric", avg: 0, max: 0, count: 0 };
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const max = Math.max(...nums);
  return { type: "numeric", avg, max, count: nums.length };
}

async function buildTeamAnalysis(
  ctx: any,
  eventKey: string,
  matchKey: string,
  teamNumber: number,
  matchFields: MatchField[],
): Promise<TeamAnalysis> {
  const team = await ctx.db
    .query("teams")
    .withIndex("by_eventKey_teamNumber", (q: any) =>
      q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
    )
    .unique();

  const robotPhotoUrl =
    team?.robotPhotoUrl ??
    (team?.pitPhotoStorageId ? await ctx.storage.getUrl(team.pitPhotoStorageId) : null);

  const allEntries = await ctx.db
    .query("matchScoutingEntries")
    .withIndex("by_eventKey_teamNumber", (q: any) =>
      q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
    )
    .collect();

  const matchEntry = allEntries.find((e: any) => e.matchKey === matchKey) ?? null;

  const pitEntry = await ctx.db
    .query("pitScoutingEntries")
    .withIndex("by_eventKey_teamNumber", (q: any) =>
      q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
    )
    .unique();

  const fieldStats: Record<string, FieldStats> = {};
  for (const field of matchFields) {
    if (!field.aggregatable) continue;
    const conditionalOn = (field as any).conditionalOnField ?? FIELD_CONDITIONS[field.id];
    const relevant = conditionalOn
      ? allEntries.filter((e: any) => e.data[conditionalOn] === true)
      : allEntries;
    const values = relevant.map((e: any) => e.data[field.id] ?? null);
    fieldStats[field.id] = computeFieldStats(values, field.type);
  }

  return {
    teamNumber,
    nickname: team?.nickname ?? `Team ${teamNumber}`,
    opr: team?.opr ?? null,
    epa: team?.epa ?? null,
    robotPhotoUrl,
    fieldStats,
    matchNotes: matchEntry?.notes ?? null,
    pitNotes: pitEntry?.notes ?? null,
    matchCount: allEntries.length,
  };
}

export const getMatchAnalysisData = query({
  args: {
    eventKey: v.string(),
    matchKey: v.string(),
    configId: v.id("scoutingConfigs"),
  },
  handler: async (ctx, { eventKey, matchKey, configId }): Promise<MatchAnalysisResult> => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_eventKey_matchKey", (q) =>
        q.eq("eventKey", eventKey).eq("matchKey", matchKey),
      )
      .unique();
    if (!match) return null;

    const config = await ctx.db.get(configId);
    if (!config) return null;

    const matchFields: MatchField[] = config.matchFields.filter((f) => f.aggregatable);

    const [redTeams, blueTeams] = await Promise.all([
      Promise.all(
        match.redAlliance.map((tn) =>
          buildTeamAnalysis(ctx, eventKey, matchKey, tn, matchFields),
        ),
      ),
      Promise.all(
        match.blueAlliance.map((tn) =>
          buildTeamAnalysis(ctx, eventKey, matchKey, tn, matchFields),
        ),
      ),
    ]);

    return {
      match: {
        matchKey: match.matchKey,
        matchNumber: match.matchNumber,
        redAlliance: match.redAlliance,
        blueAlliance: match.blueAlliance,
        redScore: match.redScore ?? null,
        blueScore: match.blueScore ?? null,
        status: match.status,
        predictedTime: match.predictedTime ?? null,
      },
      matchFields,
      redTeams,
      blueTeams,
    };
  },
});
