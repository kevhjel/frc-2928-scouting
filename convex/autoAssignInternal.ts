import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getAutoAssignData = internalQuery({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const allMatches = await ctx.db
      .query("matches")
      .withIndex("by_eventKey_compLevel", (q) =>
        q.eq("eventKey", eventKey).eq("compLevel", "qm"),
      )
      .collect();

    const matches = allMatches
      .filter((m) => m.status !== "completed")
      .sort((a, b) => (a.predictedTime ?? 0) - (b.predictedTime ?? 0));

    const allProfiles = await ctx.db.query("userProfiles").collect();
    const scouts = allProfiles
      .filter((p) => p.role === "scout")
      .map((p) => ({ userId: p.userId, displayName: p.displayName }));

    const allAvailability = await ctx.db
      .query("scoutAvailability")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const availability = allAvailability.filter((a) => a.available);

    return { matches, scouts, availability };
  },
});

export const bulkInsertAssignments = internalMutation({
  args: {
    assignments: v.array(
      v.object({
        eventKey: v.string(),
        matchKey: v.string(),
        userId: v.id("users"),
        alliance: v.union(v.literal("red"), v.literal("blue")),
        position: v.union(v.literal(1), v.literal(2), v.literal(3)),
      }),
    ),
  },
  handler: async (ctx, { assignments }) => {
    for (const a of assignments) {
      await ctx.db.insert("matchAssignments", a);
    }
    return assignments.length;
  },
});

export const internalClearAssignments = internalMutation({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    while (true) {
      const batch = await ctx.db
        .query("matchAssignments")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
        .take(100);
      if (batch.length === 0) break;
      for (const doc of batch) await ctx.db.delete(doc._id);
    }
  },
});

export const recordGenerated = internalMutation({
  args: { eventKey: v.string(), generatedBy: v.id("users"), shiftSize: v.number() },
  handler: async (ctx, { eventKey, generatedBy, shiftSize }) => {
    const existing = await ctx.db
      .query("autoAssignConfig")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        shiftSize,
        lastGeneratedAt: Date.now(),
        lastGeneratedBy: generatedBy,
      });
    } else {
      await ctx.db.insert("autoAssignConfig", {
        eventKey,
        shiftSize,
        lastGeneratedAt: Date.now(),
        lastGeneratedBy: generatedBy,
      });
    }
  },
});
