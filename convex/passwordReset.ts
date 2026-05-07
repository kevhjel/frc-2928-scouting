"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import crypto from "crypto";
import { Scrypt } from "lucia";

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export const generateResetCode = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ code: string; email: string }> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");
    const myProfile: string | null = await ctx.runQuery(internal.passwordResetInternal.getProfileRole, { userId: callerId });
    if (myProfile !== "admin") throw new Error("Unauthorized");

    const email: string | null = await ctx.runQuery(internal.passwordResetInternal.getEmailForUser, { userId });
    if (!email) throw new Error("No password account found for this user");

    const code = generateCode();
    const tokenHash = hashCode(code);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.runMutation(internal.passwordResetInternal.storeResetToken, { email, tokenHash, expiresAt });
    return { code, email };
  },
});

export const resetPasswordWithCode = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { email, code, newPassword }): Promise<void> => {
    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");

    const token: { tokenHash: string; expiresAt: number } | null = await ctx.runQuery(internal.passwordResetInternal.getResetToken, { email });
    if (!token) throw new Error("No reset code found for this email");
    if (Date.now() > token.expiresAt) throw new Error("Reset code has expired");
    if (hashCode(code.toUpperCase()) !== token.tokenHash) throw new Error("Invalid reset code");

    const secret = await new Scrypt().hash(newPassword);
    await ctx.runMutation(internal.passwordResetInternal.updateAccountSecret, { email, secret });
    await ctx.runMutation(internal.passwordResetInternal.deleteResetToken, { email });
  },
});
