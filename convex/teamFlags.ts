import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const PRESET_TAGS = [
  "Tip Risk",
  "Strong Defense",
  "Consistent Auto",
  "Mechanical Issues",
  "Standout",
  "DNP",
] as const;

export const getFlagsForTeam = query({
  args: { eventKey: v.string(), teamNumber: v.number() },
  handler: async (ctx, { eventKey, teamNumber }) => {
    return ctx.db
      .query("teamFlags")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .collect();
  },
});

export const getAllFlags = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("teamFlags")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const addFlag = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    tag: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return ctx.db.insert("teamFlags", {
      ...args,
      flaggedBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const removeFlag = mutation({
  args: { flagId: v.id("teamFlags") },
  handler: async (ctx, { flagId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const flag = await ctx.db.get(flagId);
    if (!flag) return;
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (flag.flaggedBy !== userId && myProfile?.role !== "admin")
      throw new Error("Unauthorized");
    await ctx.db.delete(flagId);
  },
});
