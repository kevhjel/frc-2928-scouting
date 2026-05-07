import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getEmailForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password"),
      )
      .unique();
    return account?.providerAccountId ?? null;
  },
});

export const getProfileRole = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.role ?? null;
  },
});

export const getResetToken = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const storeResetToken = internalMutation({
  args: { email: v.string(), tokenHash: v.string(), expiresAt: v.number() },
  handler: async (ctx, { email, tokenHash, expiresAt }) => {
    const existing = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("passwordResetTokens", { email, tokenHash, expiresAt });
  },
});

export const deleteResetToken = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existing = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const updateAccountSecret = internalMutation({
  args: { email: v.string(), secret: v.string() },
  handler: async (ctx, { email, secret }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!account) throw new Error("Account not found");
    await ctx.db.patch(account._id, { secret });
  },
});
