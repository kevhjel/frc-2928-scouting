"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

const TEAM_COUNT = 40;
const MATCH_COUNT = 70;
const MATCH_GAP_SECONDS = 8 * 60; // 8 minutes between matches
const MATCHES_PER_DAY = 35;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateMatchSchedule(teamNumbers: number[]): { red: number[]; blue: number[] }[] {
  const appearances = new Map(teamNumbers.map((t) => [t, 0]));
  const schedule: { red: number[]; blue: number[] }[] = [];

  for (let m = 0; m < MATCH_COUNT; m++) {
    // Sort teams by appearance count ascending, with random tie-breaking
    const sorted = [...teamNumbers].sort(
      (a, b) =>
        (appearances.get(a)! - appearances.get(b)!) * 10 + (Math.random() - 0.5),
    );
    // Pick the 6 least-used teams and shuffle them for random red/blue assignment
    const picked = shuffleArray(sorted.slice(0, 6));
    for (const t of picked) appearances.set(t, appearances.get(t)! + 1);
    schedule.push({ red: picked.slice(0, 3), blue: picked.slice(3, 6) });
  }

  return schedule;
}

export const createMockEvent = action({
  args: { name: v.string(), myTeamNumber: v.optional(v.number()) },
  handler: async (
    ctx,
    { name, myTeamNumber },
  ): Promise<{ eventKey: string; teamsCount: number; matchesCount: number }> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");

    const isAdmin = (await ctx.runQuery(internal.autoAssignInternal.checkIsAdmin, {
      userId: callerId,
    })) as boolean;
    if (!isAdmin) throw new Error("Unauthorized");

    const eventKey = `mock_${Date.now()}`;

    // Compute dates: day 1 = today UTC, day 2 = tomorrow UTC
    const now = new Date();
    const day1Start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0),
    );
    const day2Start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 12, 0, 0),
    );
    const todayStr = day1Start.toISOString().split("T")[0];
    const tomorrowStr = day2Start.toISOString().split("T")[0];

    // Create the event
    await ctx.runMutation(internal.mockEventInternal.insertMockEvent, {
      eventKey,
      name,
      year: now.getUTCFullYear(),
      startDate: todayStr,
      endDate: tomorrowStr,
    });

    // Create 40 teams (1001–1040), replacing the last slot with the real team if set
    const teamNumbers = Array.from({ length: TEAM_COUNT }, (_, i) => 1001 + i);
    if (myTeamNumber && !teamNumbers.includes(myTeamNumber)) {
      teamNumbers[teamNumbers.length - 1] = myTeamNumber;
    }
    await ctx.runMutation(internal.mockEventInternal.bulkInsertMockTeams, {
      teams: teamNumbers.map((n) => ({
        eventKey,
        teamNumber: n,
        teamKey: `frc${n}`,
        nickname: myTeamNumber && n === myTeamNumber ? `Team ${n}` : `Mock Team ${n}`,
      })),
    });

    // Generate balanced match schedule
    const matchSchedule = generateMatchSchedule(teamNumbers);

    // Build match records with predicted times
    const day1BaseSeconds = day1Start.getTime() / 1000;
    const day2BaseSeconds = day2Start.getTime() / 1000;

    const matches = matchSchedule.map((s, i) => {
      const matchNumber = i + 1;
      const predictedTime =
        i < MATCHES_PER_DAY
          ? day1BaseSeconds + i * MATCH_GAP_SECONDS
          : day2BaseSeconds + (i - MATCHES_PER_DAY) * MATCH_GAP_SECONDS;
      return {
        eventKey,
        matchKey: `${eventKey}_qm${matchNumber}`,
        compLevel: "qm" as const,
        matchNumber,
        setNumber: 1,
        redAlliance: s.red,
        blueAlliance: s.blue,
        predictedTime: Math.round(predictedTime),
        status: "upcoming" as const,
      };
    });

    await ctx.runMutation(internal.mockEventInternal.bulkInsertMockMatches, { matches });

    return { eventKey, teamsCount: TEAM_COUNT, matchesCount: MATCH_COUNT };
  },
});

export const deleteMockEvent = action({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }): Promise<void> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");

    const isAdmin = (await ctx.runQuery(internal.autoAssignInternal.checkIsAdmin, {
      userId: callerId,
    })) as boolean;
    if (!isAdmin) throw new Error("Unauthorized");

    await ctx.runMutation(internal.mockEventInternal.deleteMockEventData, { eventKey });
  },
});
