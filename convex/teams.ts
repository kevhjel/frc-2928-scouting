import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const getTeamsForEvent = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("teams")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const getTeam = query({
  args: { eventKey: v.string(), teamNumber: v.number() },
  handler: async (ctx, { eventKey, teamNumber }) => {
    return ctx.db
      .query("teams")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
  },
});

export const upsertTeam = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    teamKey: v.string(),
    nickname: v.string(),
    city: v.optional(v.string()),
    stateMprovince: v.optional(v.string()),
    country: v.optional(v.string()),
    rookieYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", args.eventKey).eq("teamNumber", args.teamNumber),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("teams", args);
    }
  },
});

// Batch upsert teams with OPR merged in — one call replaces N upsertTeam + N updateTeamOpr calls.
// Fetches all existing teams in one read, only patches documents that actually changed.
export const batchUpsertTeams = internalMutation({
  args: {
    eventKey: v.string(),
    teams: v.array(v.object({
      teamNumber: v.number(),
      teamKey: v.string(),
      nickname: v.string(),
      city: v.optional(v.string()),
      stateMprovince: v.optional(v.string()),
      country: v.optional(v.string()),
      rookieYear: v.optional(v.number()),
      opr: v.optional(v.number()),
      dpr: v.optional(v.number()),
      ccwm: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { eventKey, teams }) => {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const byNum = new Map(existing.map((t) => [t.teamNumber, t]));
    for (const team of teams) {
      const ex = byNum.get(team.teamNumber);
      const payload = { eventKey, ...team };
      if (!ex) {
        await ctx.db.insert("teams", payload);
        continue;
      }
      const changed = (Object.keys(team) as (keyof typeof team)[]).some(
        (k) => team[k] !== (ex as any)[k],
      );
      if (changed) await ctx.db.patch(ex._id, payload);
    }
  },
});

export const updateTeamOpr = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    opr: v.number(),
    dpr: v.number(),
    ccwm: v.number(),
  },
  handler: async (ctx, { eventKey, teamNumber, opr, dpr, ccwm }) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
    if (team) await ctx.db.patch(team._id, { opr, dpr, ccwm });
  },
});

export const updateTeamPhoto = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    photoUrl: v.string(),
  },
  handler: async (ctx, { eventKey, teamNumber, photoUrl }) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
    if (team) await ctx.db.patch(team._id, { robotPhotoUrl: photoUrl });
  },
});

export const updateTeamEpa = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    epa: v.number(),
    epaRank: v.optional(v.number()),
  },
  handler: async (ctx, { eventKey, teamNumber, epa, epaRank }) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
    if (team)
      await ctx.db.patch(team._id, {
        epa,
        epaRank,
        statboticsLastSynced: Date.now(),
      });
  },
});

// Batch EPA update — one call replaces N updateTeamEpa calls.
// Only patches teams whose EPA value actually changed.
export const batchUpdateEpa = internalMutation({
  args: {
    eventKey: v.string(),
    updates: v.array(v.object({
      teamNumber: v.number(),
      epa: v.number(),
      epaRank: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { eventKey, updates }) => {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const byNum = new Map(existing.map((t) => [t.teamNumber, t]));
    for (const { teamNumber, epa, epaRank } of updates) {
      const team = byNum.get(teamNumber);
      if (!team) continue;
      if (team.epa === epa && team.epaRank === epaRank) continue;
      await ctx.db.patch(team._id, { epa, epaRank, statboticsLastSynced: Date.now() });
    }
  },
});
