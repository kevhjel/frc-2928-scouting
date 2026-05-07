import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getAvailabilityForEvent = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("scoutAvailability")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const setAvailability = mutation({
  args: {
    eventKey: v.string(),
    userId: v.id("users"),
    date: v.string(),
    available: v.boolean(),
  },
  handler: async (ctx, { eventKey, userId, date, available }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("scoutAvailability")
      .withIndex("by_eventKey_userId", (q) =>
        q.eq("eventKey", eventKey).eq("userId", userId),
      )
      .filter((q) => q.eq(q.field("date"), date))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { available });
    } else {
      await ctx.db.insert("scoutAvailability", { eventKey, userId, date, available });
    }
  },
});
