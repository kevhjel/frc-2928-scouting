import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getAssignmentsForEvent = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("matchAssignments")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const getMyNextAssignment = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const assignments = await ctx.db
      .query("matchAssignments")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", userId),
      )
      .collect();
    if (assignments.length === 0) return null;
    const entries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_scoutUser", (q) => q.eq("scoutUserId", userId))
      .filter((q) => q.eq(q.field("eventKey"), eventKey))
      .collect();
    const scoutedMatchKeys = new Set(entries.map((e) => e.matchKey));
    const upcoming = assignments.filter((a) => !scoutedMatchKeys.has(a.matchKey));
    if (upcoming.length === 0) return null;
    const matches = await Promise.all(
      upcoming.map((a) =>
        ctx.db
          .query("matches")
          .withIndex("by_eventKey_matchKey", (q) =>
            q.eq("eventKey", eventKey).eq("matchKey", a.matchKey),
          )
          .unique(),
      ),
    );
    const sorted = upcoming
      .map((a, i) => ({ assignment: a, match: matches[i] }))
      .filter((x) => x.match && x.match.status !== "completed")
      .sort(
        (a, b) =>
          (a.match?.predictedTime ?? 0) - (b.match?.predictedTime ?? 0),
      );
    return sorted[0]
      ? { ...sorted[0].assignment, match: sorted[0].match }
      : null;
  },
});

export const getCoverageMap = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const assignments = await ctx.db
      .query("matchAssignments")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const entries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const scoutedSet = new Set(
      entries.map((e) => `${e.matchKey}:${e.alliance}:${e.alliancePosition}`),
    );
    return assignments.map((a) => ({
      ...a,
      isScouted: scoutedSet.has(`${a.matchKey}:${a.alliance}:${a.position}`),
    }));
  },
});

export const assignScout = mutation({
  args: {
    eventKey: v.string(),
    matchKey: v.string(),
    userId: v.id("users"),
    alliance: v.union(v.literal("red"), v.literal("blue")),
    position: v.union(v.literal(1), v.literal(2), v.literal(3)),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("matchAssignments")
      .withIndex("by_matchKey", (q) => q.eq("matchKey", args.matchKey))
      .filter((q) =>
        q.and(
          q.eq(q.field("alliance"), args.alliance),
          q.eq(q.field("position"), args.position),
        ),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { userId: args.userId });
    } else {
      await ctx.db.insert("matchAssignments", args);
    }
  },
});

export const getMyAssignments = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const assignments = await ctx.db
      .query("matchAssignments")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", userId),
      )
      .collect();
    const withMatches = await Promise.all(
      assignments.map(async (a) => {
        const match = await ctx.db
          .query("matches")
          .withIndex("by_eventKey_matchKey", (q) =>
            q.eq("eventKey", eventKey).eq("matchKey", a.matchKey),
          )
          .unique();
        return { ...a, match };
      }),
    );
    return withMatches
      .filter((x) => x.match && x.match.status !== "completed")
      .sort((a, b) => (a.match?.predictedTime ?? 0) - (b.match?.predictedTime ?? 0));
  },
});

export const getMyAssignmentsFull = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const assignments = await ctx.db
      .query("matchAssignments")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", userId),
      )
      .collect();

    const scoutedEntries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_scoutUser", (q) => q.eq("scoutUserId", userId))
      .filter((q) => q.eq(q.field("eventKey"), eventKey))
      .collect();
    const scoutedMatchKeys = new Set(scoutedEntries.map((e) => e.matchKey));

    const withDetails = await Promise.all(
      assignments.map(async (a) => {
        const match = await ctx.db
          .query("matches")
          .withIndex("by_eventKey_matchKey", (q) =>
            q.eq("eventKey", eventKey).eq("matchKey", a.matchKey),
          )
          .unique();

        const teamNumber = match
          ? (a.alliance === "red" ? match.redAlliance : match.blueAlliance)[a.position - 1]
          : undefined;

        const team = teamNumber != null
          ? await ctx.db
              .query("teams")
              .withIndex("by_eventKey_teamNumber", (q) =>
                q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
              )
              .unique()
          : null;

        const robotPhotoUrl =
          team?.robotPhotoUrl ??
          (team?.pitPhotoStorageId
            ? await ctx.storage.getUrl(team.pitPhotoStorageId)
            : null);

        return {
          ...a,
          match,
          isScouted: scoutedMatchKeys.has(a.matchKey),
          teamNumber: teamNumber ?? null,
          teamNickname: team?.nickname ?? null,
          robotPhotoUrl,
        };
      }),
    );

    return withDetails
      .filter((x) => x.match !== null)
      .sort((a, b) => (a.match?.predictedTime ?? 0) - (b.match?.predictedTime ?? 0));
  },
});

export const removeAssignment = mutation({
  args: { assignmentId: v.id("matchAssignments") },
  handler: async (ctx, { assignmentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.delete(assignmentId);
  },
});

export const clearAssignmentsForEvent = mutation({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");

    let deleted = 0;
    while (true) {
      const batch = await ctx.db
        .query("matchAssignments")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
        .take(100);
      if (batch.length === 0) break;
      for (const doc of batch) await ctx.db.delete(doc._id);
      deleted += batch.length;
    }
    return deleted;
  },
});

export const bulkReassign = mutation({
  args: {
    eventKey: v.string(),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
  },
  handler: async (ctx, { eventKey, fromUserId, toUserId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");

    const futureMatches = await ctx.db
      .query("matches")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .filter((q) => q.neq(q.field("status"), "completed"))
      .collect();
    const futureMatchKeys = new Set(futureMatches.map((m) => m.matchKey));

    const assignments = await ctx.db
      .query("matchAssignments")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", fromUserId),
      )
      .collect();

    let count = 0;
    for (const a of assignments) {
      if (futureMatchKeys.has(a.matchKey)) {
        await ctx.db.patch(a._id, { userId: toUserId });
        count++;
      }
    }
    return count;
  },
});
