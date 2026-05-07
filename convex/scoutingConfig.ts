import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const fieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("number"),
    v.literal("boolean"),
    v.literal("select"),
    v.literal("multiselect"),
    v.literal("text"),
    v.literal("counter"),
    v.literal("rating"),
  ),
  options: v.optional(v.array(v.string())),
  section: v.string(),
  defaultValue: v.optional(v.union(v.string(), v.number(), v.boolean())),
  aggregatable: v.boolean(),
  higherIsBetter: v.optional(v.boolean()),
  required: v.optional(v.boolean()),
  increment: v.optional(v.number()),
});

export const getActiveConfig = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("scoutingConfigs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();
  },
});

export const getConfigById = query({
  args: { id: v.id("scoutingConfigs") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const listConfigs = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("scoutingConfigs").order("desc").collect();
  },
});

export const createConfig = mutation({
  args: {
    year: v.number(),
    name: v.string(),
    matchFields: v.array(fieldValidator),
    pitFields: v.array(fieldValidator),
    matchSections: v.array(v.string()),
    pitSections: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    const now = Date.now();
    return ctx.db.insert("scoutingConfigs", {
      ...args,
      isActive: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateConfig = mutation({
  args: {
    id: v.id("scoutingConfigs"),
    name: v.optional(v.string()),
    matchFields: v.optional(v.array(fieldValidator)),
    pitFields: v.optional(v.array(fieldValidator)),
    matchSections: v.optional(v.array(v.string())),
    pitSections: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const deleteConfig = mutation({
  args: { id: v.id("scoutingConfigs") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile?.role !== "admin") throw new Error("Unauthorized");
    const config = await ctx.db.get(id);
    if (config?.isActive) throw new Error("Cannot delete the active config");
    await ctx.db.delete(id);
  },
});

export const setActiveConfig = mutation({
  args: { id: v.id("scoutingConfigs") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    const current = await ctx.db
      .query("scoutingConfigs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();
    if (current) await ctx.db.patch(current._id, { isActive: false });
    await ctx.db.patch(id, { isActive: true });
  },
});
