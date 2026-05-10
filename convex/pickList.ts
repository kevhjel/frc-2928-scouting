import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

const rankedTeamValidator = v.object({
  teamNumber: v.number(),
  rank: v.number(),
  notes: v.optional(v.string()),
  dnp: v.optional(v.boolean()),
});

export const getMyPickList = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("pickLists")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", userId),
      )
      .unique();
  },
});

export const getAllPickLists = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") return [];
    return ctx.db
      .query("pickLists")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const upsertMyPickList = mutation({
  args: {
    eventKey: v.string(),
    rankedTeams: v.array(rankedTeamValidator),
  },
  handler: async (ctx, { eventKey, rankedTeams }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db
      .query("pickLists")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { rankedTeams, updatedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("pickLists", {
      eventKey,
      userId,
      rankedTeams,
      isSubmitted: false,
      updatedAt: Date.now(),
    });
  },
});

export const setPickListReady = mutation({
  args: { eventKey: v.string(), isReady: v.boolean() },
  handler: async (ctx, { eventKey, isReady }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db
      .query("pickLists")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { isSubmitted: isReady, updatedAt: Date.now() });
    } else if (isReady) {
      // Create an empty list marked ready if none exists yet
      const teams: Array<{ teamNumber: number }> = await ctx.db
        .query("teams")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
        .collect();
      const sorted = [...teams].sort((a, b) => a.teamNumber - b.teamNumber);
      await ctx.db.insert("pickLists", {
        eventKey,
        userId,
        rankedTeams: sorted.map((t, i) => ({ teamNumber: t.teamNumber, rank: i + 1 })),
        isSubmitted: true,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getConsensusPickList = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("consensusPickLists")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
  },
});

export const calculateConsensusPickList = action({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const allLists: Array<{ _id: any; isSubmitted: boolean; rankedTeams: Array<{ teamNumber: number; rank: number; dnp?: boolean }> }> =
      await ctx.runQuery(api.pickList.getAllPickLists, { eventKey });
    const readyLists = allLists.filter((l: any) => l.isSubmitted);

    const teams: Array<{ teamNumber: number; epa?: number | null }> =
      await ctx.runQuery(api.teams.getTeamsForEvent, { eventKey });
    const allTeamNumbers = teams.map((t) => t.teamNumber);
    const epaMap = new Map<number, number>(
      teams.map((t) => [t.teamNumber, t.epa ?? 0]),
    );

    const scores = new Map<number, { rankSum: number; count: number; dnpCount: number }>();
    for (const t of allTeamNumbers) scores.set(t, { rankSum: 0, count: 0, dnpCount: 0 });

    for (const list of readyLists) {
      for (const entry of list.rankedTeams) {
        const s = scores.get(entry.teamNumber);
        if (s) {
          // DNP entries count as the worst rank (= total teams) rather than being excluded
          s.rankSum += entry.dnp ? allTeamNumbers.length : entry.rank;
          s.count += 1;
          if (entry.dnp) s.dnpCount += 1;
        }
      }
    }

    const rankedTeams = allTeamNumbers
      .map((teamNumber) => {
        const s = scores.get(teamNumber)!;
        const avgRank = s.count > 0 ? s.rankSum / s.count : allTeamNumbers.length + 1;
        return {
          teamNumber,
          bordaScore: 0,
          averageRank: avgRank,
          submissionCount: s.count,
          dnpCount: s.dnpCount,
          isConfirmed: false,
        };
      })
      .sort((a, b) => {
        const rankDiff = a.averageRank - b.averageRank;
        if (rankDiff !== 0) return rankDiff;
        // EPA tiebreaker: higher EPA ranks first
        return (epaMap.get(b.teamNumber) ?? 0) - (epaMap.get(a.teamNumber) ?? 0);
      });

    await ctx.runMutation(api.pickList.saveConsensusPickList, {
      eventKey,
      rankedTeams,
      algorithm: "average_rank",
      calculatedFromListIds: readyLists.map((l: any) => l._id),
    });
  },
});

export const saveConsensusPickList = mutation({
  args: {
    eventKey: v.string(),
    rankedTeams: v.array(
      v.object({
        teamNumber: v.number(),
        bordaScore: v.number(),
        averageRank: v.number(),
        submissionCount: v.number(),
        dnpCount: v.number(),
        isConfirmed: v.boolean(),
      }),
    ),
    algorithm: v.union(v.literal("borda"), v.literal("average_rank")),
    calculatedFromListIds: v.array(v.id("pickLists")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("consensusPickLists")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        rankedTeams: args.rankedTeams,
        algorithm: args.algorithm,
        lastCalculatedAt: Date.now(),
        calculatedFromListIds: args.calculatedFromListIds,
      });
    } else {
      await ctx.db.insert("consensusPickLists", {
        ...args,
        lastCalculatedAt: Date.now(),
      });
    }
  },
});

export const updateConsensusPickList = mutation({
  args: {
    eventKey: v.string(),
    rankedTeams: v.array(
      v.object({
        teamNumber: v.number(),
        bordaScore: v.number(),
        averageRank: v.number(),
        submissionCount: v.number(),
        dnpCount: v.number(),
        isConfirmed: v.boolean(),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { eventKey, rankedTeams }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("consensusPickLists")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { rankedTeams });
  },
});
