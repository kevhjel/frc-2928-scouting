import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile?.role !== "admin") throw new Error("Unauthorized");
    const profiles = await ctx.db.query("userProfiles").collect();
    const users = await Promise.all(
      profiles.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return { ...p, email: (user as any)?.email };
      }),
    );
    return users;
  },
});

export const ensureProfile = mutation({
  args: { displayName: v.optional(v.string()) },
  handler: async (ctx, { displayName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existing) {
      const allProfiles = await ctx.db.query("userProfiles").collect();
      const role = allProfiles.length === 0 ? "admin" : "scout";
      const user = await ctx.db.get(userId);
      const fallbackName = (user as any)?.email?.split("@")[0] ?? "User";
      await ctx.db.insert("userProfiles", {
        userId,
        displayName: displayName || fallbackName,
        role,
      });
    }
  },
});

export const adminUpdateDisplayName = mutation({
  args: { profileId: v.id("userProfiles"), displayName: v.string() },
  handler: async (ctx, { profileId, displayName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.patch(profileId, { displayName });
  },
});

export const updateMyProfile = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, { displayName });
  },
});

export const updateUserRole = mutation({
  args: {
    profileId: v.id("userProfiles"),
    role: v.union(v.literal("scout"), v.literal("analyst"), v.literal("admin")),
  },
  handler: async (ctx, { profileId, role }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.patch(profileId, { role });
  },
});

export const createBotAccount = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    // Insert a bare users row — no email, no authAccounts entry → can never authenticate
    const userId = await ctx.db.insert("users", {} as any);
    await ctx.db.insert("userProfiles", {
      userId,
      displayName,
      role: "scout",
      isBot: true,
    });
  },
});

export const deleteBotAccount = mutation({
  args: { profileId: v.id("userProfiles") },
  handler: async (ctx, { profileId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    const target = await ctx.db.get(profileId);
    if (!target) throw new Error("Profile not found");
    if (!target.isBot) throw new Error("Cannot delete non-bot accounts this way");
    // Delete all match assignments for this bot across all events
    const assignments = await ctx.db
      .query("matchAssignments")
      .filter((q) => q.eq(q.field("userId"), target.userId))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);
    await ctx.db.delete(profileId);
    await ctx.db.delete(target.userId);
  },
});

export const setAssignedTeams = mutation({
  args: {
    profileId: v.id("userProfiles"),
    teamNumbers: v.array(v.number()),
  },
  handler: async (ctx, { profileId, teamNumbers }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (myProfile?.role !== "admin") throw new Error("Unauthorized");
    await ctx.db.patch(profileId, { assignedTeamNumbers: teamNumbers });
  },
});
