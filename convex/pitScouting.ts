import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const entryDataValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
);

export const submitPitEntry = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    configId: v.id("scoutingConfigs"),
    data: entryDataValidator,
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db
      .query("pitScoutingEntries")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", args.eventKey).eq("teamNumber", args.teamNumber),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        scoutUserId: userId,
        lastEditedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("pitScoutingEntries", {
        ...args,
        scoutUserId: userId,
        submittedAt: Date.now(),
      });
    }

    // Update team's primary pit photo storage ID
    if (args.photoStorageIds?.length) {
      const team = await ctx.db
        .query("teams")
        .withIndex("by_eventKey_teamNumber", (q) =>
          q.eq("eventKey", args.eventKey).eq("teamNumber", args.teamNumber),
        )
        .unique();
      if (team) {
        await ctx.db.patch(team._id, { pitPhotoStorageId: args.photoStorageIds[0] });
      }
    }

    return existing?._id;
  },
});

export const getPitEntryForTeam = query({
  args: { eventKey: v.string(), teamNumber: v.number() },
  handler: async (ctx, { eventKey, teamNumber }) => {
    return ctx.db
      .query("pitScoutingEntries")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
  },
});

export const getAllPitEntries = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("pitScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

// Returns teamNumber → first uploaded pit photo URL, for card grid display
export const getPitCardPhotoUrls = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }): Promise<Record<number, string | null>> => {
    const entries = await ctx.db
      .query("pitScoutingEntries")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
    const result: Record<number, string | null> = {};
    await Promise.all(
      entries.map(async (e) => {
        const ids = (e.photoStorageIds ?? []) as string[];
        if (ids.length === 0) { result[e.teamNumber] = null; return; }
        result[e.teamNumber] = await ctx.storage.getUrl(ids[0] as any);
      }),
    );
    return result;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return ctx.storage.generateUploadUrl();
  },
});

export const getPhotoUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return ctx.storage.getUrl(storageId);
  },
});

export const getPitPhotoUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, { storageIds }) => {
    return Promise.all(storageIds.map((id) => ctx.storage.getUrl(id)));
  },
});

export const removePitPhoto = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { eventKey, teamNumber, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const entry = await ctx.db
      .query("pitScoutingEntries")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
    if (!entry) return;

    const updated = (entry.photoStorageIds ?? []).filter((id) => id !== storageId);
    await ctx.db.patch(entry._id, { photoStorageIds: updated, lastEditedAt: Date.now() });

    // Update team's pitPhotoStorageId if it was this photo
    const team = await ctx.db
      .query("teams")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .unique();
    if (team?.pitPhotoStorageId === storageId) {
      await ctx.db.patch(team._id, { pitPhotoStorageId: updated[0] ?? undefined });
    }
  },
});
