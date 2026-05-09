import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const entryDataValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
);

export const submitMatchEntry = mutation({
  args: {
    eventKey: v.string(),
    matchKey: v.string(),
    teamNumber: v.number(),
    configId: v.id("scoutingConfigs"),
    alliance: v.union(v.literal("red"), v.literal("blue")),
    alliancePosition: v.union(v.literal(1), v.literal(2), v.literal(3)),
    data: entryDataValidator,
    notes: v.optional(v.string()),
    isOfflineEntry: v.optional(v.boolean()),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    // Idempotency: if this clientId was already inserted, return the existing id
    if (args.clientId) {
      const existing = await ctx.db
        .query("matchScoutingEntries")
        .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
        .unique();
      if (existing) return existing._id;
    }
    return ctx.db.insert("matchScoutingEntries", {
      ...args,
      scoutUserId: userId,
      submittedAt: Date.now(),
    });
  },
});

export const updateMatchEntry = mutation({
  args: {
    id: v.id("matchScoutingEntries"),
    data: entryDataValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, data, notes }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Entry not found");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (entry.scoutUserId !== userId && myProfile?.role !== "admin")
      throw new Error("Unauthorized");
    await ctx.db.patch(id, { data, notes });
  },
});

export const deleteMatchEntry = mutation({
  args: { id: v.id("matchScoutingEntries") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.delete(id);
  },
});

export const purgeExactDuplicates = mutation({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");

    const entries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();

    const groups = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = `${e.matchKey}:${e.teamNumber}`;
      const group = groups.get(key) ?? [];
      group.push(e);
      groups.set(key, group);
    }

    let deleted = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const firstData = JSON.stringify(group[0].data);
      const allIdentical = group.every((e) => JSON.stringify(e.data) === firstData);
      if (!allIdentical) continue;
      // Keep the earliest submission, delete the rest
      const sorted = [...group].sort((a, b) => a.submittedAt - b.submittedAt);
      for (const e of sorted.slice(1)) {
        await ctx.db.delete(e._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

export const getEntriesForMatch = query({
  args: { matchKey: v.string() },
  handler: async (ctx, { matchKey }) => {
    return ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_matchKey_teamNumber", (q) => q.eq("matchKey", matchKey))
      .collect();
  },
});

export const getEntriesForTeam = query({
  args: { eventKey: v.string(), teamNumber: v.number() },
  handler: async (ctx, { eventKey, teamNumber }) => {
    return ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .collect();
  },
});

export const getEntriesForEvent = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const getMyEntriesForEvent = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    return all.filter((e) => e.scoutUserId === userId);
  },
});

export const getScoutingCoverage = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const entries = await ctx.db
      .query("matchScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const scoutedSet = new Set(
      entries.map((e) => `${e.matchKey}:${e.teamNumber}`),
    );
    const coverage: {
      matchKey: string;
      teamNumber: number;
      alliance: "red" | "blue";
      position: number;
      isScouted: boolean;
    }[] = [];
    for (const match of matches) {
      for (let i = 0; i < match.redAlliance.length; i++) {
        const t = match.redAlliance[i];
        coverage.push({
          matchKey: match.matchKey,
          teamNumber: t,
          alliance: "red",
          position: i + 1,
          isScouted: scoutedSet.has(`${match.matchKey}:${t}`),
        });
      }
      for (let i = 0; i < match.blueAlliance.length; i++) {
        const t = match.blueAlliance[i];
        coverage.push({
          matchKey: match.matchKey,
          teamNumber: t,
          alliance: "blue",
          position: i + 1,
          isScouted: scoutedSet.has(`${match.matchKey}:${t}`),
        });
      }
    }
    return coverage;
  },
});
