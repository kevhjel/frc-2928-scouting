import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const insertMockEvent = internalMutation({
  args: {
    eventKey: v.string(),
    name: v.string(),
    year: v.number(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.insert("events", {
      ...args,
      location: "Mock Competition",
      isActive: false,
      isMock: true,
    });
  },
});

export const bulkInsertMockTeams = internalMutation({
  args: {
    teams: v.array(
      v.object({
        eventKey: v.string(),
        teamNumber: v.number(),
        teamKey: v.string(),
        nickname: v.string(),
      }),
    ),
  },
  handler: async (ctx, { teams }): Promise<number> => {
    for (const team of teams) {
      await ctx.db.insert("teams", team);
    }
    return teams.length;
  },
});

export const bulkInsertMockMatches = internalMutation({
  args: {
    matches: v.array(
      v.object({
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
        predictedTime: v.number(),
        status: v.union(
          v.literal("upcoming"),
          v.literal("in_progress"),
          v.literal("completed"),
        ),
      }),
    ),
  },
  handler: async (ctx, { matches }): Promise<number> => {
    for (const match of matches) {
      await ctx.db.insert("matches", match);
    }
    return matches.length;
  },
});

export const deleteMockEventData = internalMutation({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }): Promise<void> => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    if (!event) throw new Error("Event not found");
    if (!event.isMock) throw new Error("Can only delete mock events this way");

    // Delete matches in batches
    while (true) {
      const batch = await ctx.db
        .query("matches")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
        .take(100);
      if (batch.length === 0) break;
      for (const m of batch) await ctx.db.delete(m._id);
    }
    // Delete teams in batches
    while (true) {
      const batch = await ctx.db
        .query("teams")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
        .take(100);
      if (batch.length === 0) break;
      for (const t of batch) await ctx.db.delete(t._id);
    }
    // Delete match assignments
    while (true) {
      const batch = await ctx.db
        .query("matchAssignments")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
        .take(100);
      if (batch.length === 0) break;
      for (const a of batch) await ctx.db.delete(a._id);
    }
    await ctx.db.delete(event._id);
  },
});
