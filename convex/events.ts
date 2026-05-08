import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getActiveEvent = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("events")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();
  },
});

export const getActiveEventKey = internalQuery({
  args: {},
  handler: async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();
    // Skip TBA sync for mock events
    if (!event || event.isMock) return null;
    return event.eventKey;
  },
});

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("events").order("desc").collect();
  },
});

export const upsertEvent = mutation({
  args: {
    eventKey: v.string(),
    name: v.string(),
    year: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db
      .query("events")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return ctx.db.insert("events", { ...args, isActive: false });
  },
});

export const setActiveEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    const current = await ctx.db
      .query("events")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();
    if (current) await ctx.db.patch(current._id, { isActive: false });
    await ctx.db.patch(eventId, { isActive: true });
  },
});

export const markTbaSynced = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await ctx.db.patch(eventId, { tbaLastSynced: Date.now() });
  },
});
