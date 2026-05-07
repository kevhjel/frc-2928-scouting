import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const addQuestion = mutation({
  args: {
    eventKey: v.string(),
    teamNumber: v.number(),
    question: v.string(),
  },
  handler: async (ctx, { eventKey, teamNumber, question }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return ctx.db.insert("pitQuestions", {
      eventKey,
      teamNumber,
      question,
      askedBy: userId,
      askedAt: Date.now(),
    });
  },
});

export const getQuestionsForTeam = query({
  args: { eventKey: v.string(), teamNumber: v.number() },
  handler: async (ctx, { eventKey, teamNumber }) => {
    return ctx.db
      .query("pitQuestions")
      .withIndex("by_eventKey_teamNumber", (q) =>
        q.eq("eventKey", eventKey).eq("teamNumber", teamNumber),
      )
      .order("desc")
      .collect();
  },
});

export const getAllQuestionsForEvent = query({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    return ctx.db
      .query("pitQuestions")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .collect();
  },
});

export const answerQuestion = mutation({
  args: {
    questionId: v.id("pitQuestions"),
    answer: v.string(),
  },
  handler: async (ctx, { questionId, answer }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    await ctx.db.patch(questionId, {
      answer,
      answeredBy: userId,
      answeredAt: Date.now(),
    });
  },
});

export const deleteQuestion = mutation({
  args: { questionId: v.id("pitQuestions") },
  handler: async (ctx, { questionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const q = await ctx.db.get(questionId);
    if (!q) return;
    if (q.askedBy !== userId) throw new Error("Unauthorized");
    await ctx.db.delete(questionId);
  },
});
