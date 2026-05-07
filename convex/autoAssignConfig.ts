import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getAutoAssignConfig = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("autoAssignConfig")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
  },
});

export const upsertAutoAssignConfig = mutation({
  args: { eventKey: v.string(), shiftSize: v.number() },
  handler: async (ctx, { eventKey, shiftSize }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("autoAssignConfig")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { shiftSize });
    } else {
      await ctx.db.insert("autoAssignConfig", { eventKey, shiftSize });
    }
  },
});

export const markGenerated = mutation({
  args: { eventKey: v.string(), generatedBy: v.id("users") },
  handler: async (ctx, { eventKey, generatedBy }) => {
    const existing = await ctx.db
      .query("autoAssignConfig")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastGeneratedAt: Date.now(),
        lastGeneratedBy: generatedBy,
      });
    }
  },
});
