import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { allianceSlotValidator } from "./schema";

type AllianceSlot = { captain: number | null; pick1: number | null; pick2: number | null };
const SLOTS = ["captain", "pick1", "pick2"] as const;
const ALLIANCE_COUNT = 8;

function emptyBoard(): AllianceSlot[] {
  return Array.from({ length: ALLIANCE_COUNT }, () => ({ captain: null, pick1: null, pick2: null }));
}

function boardTeams(board: AllianceSlot[] | undefined): Set<number> {
  const out = new Set<number>();
  for (const a of board ?? []) for (const k of SLOTS) if (a[k] !== null) out.add(a[k]!);
  return out;
}

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

/** Team List order, with any teams missing from it appended by EPA. */
async function buildOrder(ctx: QueryCtx, eventKey: string): Promise<number[]> {
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
  return order;
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

    const order = await buildOrder(ctx, eventKey);

    const existing = await getBoard(ctx, eventKey);
    if (existing) {
      await ctx.db.patch(existing._id, {
        order,
        // Teams already placed on the Actual board stay picked
        picked: clearPicked ? [...boardTeams(existing.actualBoard)] : existing.picked,
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

/**
 * Set one slot on the Actual alliance board (admin only). Teams placed on the
 * board are marked picked; a team taken off the board is un-picked.
 */
export const setActualSlot = mutation({
  args: {
    eventKey: v.string(),
    allianceIndex: v.number(),
    slot: v.union(v.literal("captain"), v.literal("pick1"), v.literal("pick2")),
    teamNumber: v.union(v.number(), v.null()),
  },
  handler: async (ctx, { eventKey, allianceIndex, slot, teamNumber }) => {
    const userId = await requireAdmin(ctx);
    if (!Number.isInteger(allianceIndex) || allianceIndex < 0 || allianceIndex >= ALLIANCE_COUNT)
      throw new Error("Invalid alliance");

    let doc: Doc<"allianceSelections"> | null = await getBoard(ctx, eventKey);
    if (!doc) {
      // First Actual entry starts the Selection board too
      const id = await ctx.db.insert("allianceSelections", {
        eventKey,
        order: await buildOrder(ctx, eventKey),
        picked: [],
        updatedAt: Date.now(),
        updatedBy: userId,
      });
      doc = (await ctx.db.get(id))!;
    }

    const board = (doc.actualBoard ?? emptyBoard()).map((a) => ({ ...a }));
    const previous = board[allianceIndex][slot];
    if (previous === teamNumber) return;
    if (teamNumber !== null && boardTeams(board).has(teamNumber))
      throw new Error(`Team ${teamNumber} is already on the board`);
    board[allianceIndex][slot] = teamNumber;

    let picked = doc.picked;
    if (previous !== null) picked = picked.filter((n) => n !== previous);
    if (teamNumber !== null && !picked.includes(teamNumber)) picked = [...picked, teamNumber];

    await ctx.db.patch(doc._id, {
      actualBoard: board,
      picked,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
  },
});

/** Empty the Actual board (admin only) and un-pick the teams that were on it. */
export const clearActualBoard = mutation({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await requireAdmin(ctx);
    const doc = await getBoard(ctx, eventKey);
    if (!doc?.actualBoard) return;
    const onBoard = boardTeams(doc.actualBoard);
    await ctx.db.patch(doc._id, {
      actualBoard: emptyBoard(),
      picked: doc.picked.filter((n) => !onBoard.has(n)),
      updatedAt: Date.now(),
      updatedBy: userId,
    });
  },
});

// ── Per-user predictions ────────────────────────────────────────────────────

export const getMyPrediction = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("alliancePredictions")
      .withIndex("by_eventKey_userId", (q) => q.eq("eventKey", eventKey).eq("userId", userId))
      .unique();
  },
});

export const saveMyPrediction = mutation({
  args: { eventKey: v.string(), board: v.array(allianceSlotValidator) },
  handler: async (ctx, { eventKey, board }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    if (board.length !== ALLIANCE_COUNT) throw new Error("Invalid board");
    const existing = await ctx.db
      .query("alliancePredictions")
      .withIndex("by_eventKey_userId", (q) => q.eq("eventKey", eventKey).eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { board, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("alliancePredictions", { eventKey, userId, board, updatedAt: Date.now() });
    }
  },
});
