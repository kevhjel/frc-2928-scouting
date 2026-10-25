import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

async function requireAdmin(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (profile?.role !== "admin") throw new Error("Unauthorized");
  return userId;
}

async function getBoard(ctx: QueryCtx, eventKey: string) {
  return ctx.db
    .query("allianceSelections")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
    .unique();
}

export const getAllianceSelection = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return getBoard(ctx, eventKey);
  },
});

/**
 * Start (or restart) the board from the current Team List. Falls back to EPA
 * order when no Team List has been generated. Picks are cleared only when
 * `clearPicked` is true, so refreshing the order mid-selection keeps them.
 */
export const startFromTeamList = mutation({
  args: { eventKey: v.string(), clearPicked: v.boolean() },
  handler: async (ctx, { eventKey, clearPicked }) => {
    const userId = await requireAdmin(ctx);

    const consensus = await ctx.db
      .query("consensusPickLists")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();

    const order: number[] = consensus
      ? consensus.rankedTeams.map((t) => t.teamNumber)
      : [];
    const seen = new Set(order);
    // Teams missing from the Team List go to the bottom, best EPA first
    for (const t of [...teams].sort((a, b) => (b.epa ?? 0) - (a.epa ?? 0))) {
      if (!seen.has(t.teamNumber)) order.push(t.teamNumber);
    }

    const existing = await getBoard(ctx, eventKey);
    if (existing) {
      await ctx.db.patch(existing._id, {
        order,
        picked: clearPicked ? [] : existing.picked,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
      return existing._id;
    }
    return ctx.db.insert("allianceSelections", {
      eventKey,
      order,
      picked: [],
      updatedAt: Date.now(),
      updatedBy: userId,
    });
  },
});

export const setOrder = mutation({
  args: { eventKey: v.string(), order: v.array(v.number()) },
  handler: async (ctx, { eventKey, order }) => {
    const userId = await requireAdmin(ctx);
    const existing = await getBoard(ctx, eventKey);
    if (!existing) throw new Error("Alliance selection hasn't been started");
    await ctx.db.patch(existing._id, { order, updatedAt: Date.now(), updatedBy: userId });
  },
});

/** Mark one team picked / not picked. Per-team so two phones can't clobber each other. */
export const setPicked = mutation({
  args: { eventKey: v.string(), teamNumber: v.number(), picked: v.boolean() },
  handler: async (ctx, { eventKey, teamNumber, picked }) => {
    const userId = await requireAdmin(ctx);
    const existing = await getBoard(ctx, eventKey);
    if (!existing) throw new Error("Alliance selection hasn't been started");
    const rest = existing.picked.filter((n) => n !== teamNumber);
    await ctx.db.patch(existing._id, {
      picked: picked ? [...rest, teamNumber] : rest,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
  },
});
