"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

type Alliance = "red" | "blue";
type Position = 1 | 2 | 3;

interface AssignmentRecord {
  eventKey: string;
  matchKey: string;
  userId: Id<"users">;
  alliance: Alliance;
  position: Position;
}

interface ScoutState {
  assignmentCount: number;
  shiftProgress: number;
  onBreak: boolean;
  breakMatchesLeft: number;
  teamsSeen: Set<number>;
}

function matchDateStr(predictedTime: number | undefined): string {
  if (!predictedTime) return "";
  return new Date(predictedTime * 1000).toISOString().split("T")[0];
}

export const generateAutoAssignments = action({
  args: {
    eventKey: v.string(),
    shiftSize: v.number(),
    clearExisting: v.boolean(),
  },
  handler: async (ctx, { eventKey, shiftSize, clearExisting }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");

    const queryResult = await ctx.runQuery(
      internal.autoAssignInternal.getAutoAssignData,
      { eventKey },
    ) as {
      matches: Array<{
        matchKey: string;
        status: string;
        redAlliance: number[];
        blueAlliance: number[];
        predictedTime?: number;
      }>;
      scouts: Array<{ userId: Id<"users">; displayName: string }>;
      availability: Array<{ userId: Id<"users">; date: string; available: boolean }>;
    };
    const { matches, scouts, availability } = queryResult;

    if (clearExisting) {
      await ctx.runMutation(internal.autoAssignInternal.internalClearAssignments, { eventKey });
    }

    if (scouts.length === 0) throw new Error("No scouts found");

    // Build map: date → Set<userId>
    const availableOnDate = new Map<string, Set<Id<"users">>>();
    for (const row of availability) {
      const set = availableOnDate.get(row.date) ?? new Set();
      set.add(row.userId);
      availableOnDate.set(row.date, set);
    }

    // Initialize per-scout state
    const state = new Map<Id<"users">, ScoutState>();
    for (const scout of scouts) {
      state.set(scout.userId, {
        assignmentCount: 0,
        shiftProgress: 0,
        onBreak: false,
        breakMatchesLeft: 0,
        teamsSeen: new Set(),
      });
    }

    const assignments: AssignmentRecord[] = [];
    let skipped = 0;

    const slots: Array<{ alliance: Alliance; position: Position; teamIndex: number }> = [
      { alliance: "red", position: 1, teamIndex: 0 },
      { alliance: "red", position: 2, teamIndex: 1 },
      { alliance: "red", position: 3, teamIndex: 2 },
      { alliance: "blue", position: 1, teamIndex: 0 },
      { alliance: "blue", position: 2, teamIndex: 1 },
      { alliance: "blue", position: 3, teamIndex: 2 },
    ];

    for (const match of matches) {
      const matchDate = matchDateStr(match.predictedTime);
      const availableSet = availableOnDate.get(matchDate) ?? new Set();

      for (const slot of slots) {
        const teamNumber =
          slot.alliance === "red"
            ? match.redAlliance[slot.teamIndex]
            : match.blueAlliance[slot.teamIndex];

        // Candidates: available for this day and not on break
        let candidates = scouts.filter(
          (s) => availableSet.has(s.userId) && !state.get(s.userId)!.onBreak,
        );

        // Fall back to on-break scouts if none available
        if (candidates.length === 0) {
          candidates = scouts
            .filter((s) => availableSet.has(s.userId))
            .sort(
              (a, b) =>
                state.get(b.userId)!.breakMatchesLeft -
                state.get(a.userId)!.breakMatchesLeft,
            );
        }

        if (candidates.length === 0) {
          skipped++;
          continue;
        }

        // Score: prefer scouts who haven't seen this team + fewer total assignments
        candidates.sort((a, b) => {
          const sa = state.get(a.userId)!;
          const sb = state.get(b.userId)!;
          const scoreA = (sa.teamsSeen.has(teamNumber) ? 1000 : 0) + sa.assignmentCount;
          const scoreB = (sb.teamsSeen.has(teamNumber) ? 1000 : 0) + sb.assignmentCount;
          return scoreA - scoreB;
        });

        const chosen = candidates[0];
        const s = state.get(chosen.userId)!;

        assignments.push({
          eventKey,
          matchKey: match.matchKey,
          userId: chosen.userId,
          alliance: slot.alliance,
          position: slot.position,
        });

        s.assignmentCount++;
        s.teamsSeen.add(teamNumber);
        s.shiftProgress++;

        if (s.shiftProgress >= shiftSize) {
          s.onBreak = true;
          s.breakMatchesLeft = shiftSize;
          s.shiftProgress = 0;
        }
      }

      // Decrement break counters after each match
      for (const [, s] of state) {
        if (s.onBreak) {
          s.breakMatchesLeft--;
          if (s.breakMatchesLeft <= 0) {
            s.onBreak = false;
          }
        }
      }
    }

    if (assignments.length > 0) {
      await ctx.runMutation(internal.autoAssignInternal.bulkInsertAssignments, { assignments });
    }

    await ctx.runMutation(internal.autoAssignInternal.recordGenerated, {
      eventKey,
      generatedBy: callerId,
      shiftSize,
    });

    return { assigned: assignments.length, skipped };
  },
});
