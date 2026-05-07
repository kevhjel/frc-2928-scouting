import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getMatchesForEvent = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("matches")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const getMatchesForTeam = query({
  args: { eventKey: v.string(), teamNumber: v.number() },
  handler: async (ctx, { eventKey, teamNumber }) => {
    const all = await ctx.db
      .query("matches")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    return all.filter(
      (m) =>
        m.redAlliance.includes(teamNumber) ||
        m.blueAlliance.includes(teamNumber),
    );
  },
});

export const getUpcomingMatches = query({
  args: { eventKey: v.string(), count: v.optional(v.number()) },
  handler: async (ctx, { eventKey, count }) => {
    const upcoming = await ctx.db
      .query("matches")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .filter((q) => q.eq(q.field("status"), "upcoming"))
      .collect();
    const sorted = upcoming.sort(
      (a, b) => (a.predictedTime ?? 0) - (b.predictedTime ?? 0),
    );
    return count ? sorted.slice(0, count) : sorted;
  },
});

export const upsertMatch = mutation({
  args: {
    eventKey: v.string(),
    matchKey: v.string(),
    compLevel: v.union(
      v.literal("qm"),
      v.literal("ef"),
      v.literal("qf"),
      v.literal("sf"),
      v.literal("f"),
    ),
    matchNumber: v.number(),
    setNumber: v.number(),
    redAlliance: v.array(v.number()),
    blueAlliance: v.array(v.number()),
    redScore: v.optional(v.number()),
    blueScore: v.optional(v.number()),
    predictedTime: v.optional(v.number()),
    actualTime: v.optional(v.number()),
    status: v.union(
      v.literal("upcoming"),
      v.literal("in_progress"),
      v.literal("completed"),
    ),
    videoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("matches")
      .withIndex("by_eventKey_matchKey", (q) =>
        q.eq("eventKey", args.eventKey).eq("matchKey", args.matchKey),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("matches", args);
    }
  },
});
