import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
