"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";

const STATBOTICS_BASE = "https://api.statbotics.io/v3";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const syncStatbotics = action({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const teams: Array<{ teamNumber: number; teamKey: string }> =
      await ctx.runQuery(api.teams.getTeamsForEvent, { eventKey });

    let synced = 0;
    const updates: Array<{ teamNumber: number; epa: number; epaRank?: number }> = [];
    const BATCH = 10;

    for (let i = 0; i < teams.length; i += BATCH) {
      const batch = teams.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (team) => {
          try {
            const res = await fetch(
              `${STATBOTICS_BASE}/team_event/${team.teamNumber}/${eventKey}`,
            );
            if (!res.ok) return;
            const data = await res.json();
            const epaRaw = data?.epa;
            const epa: number =
              typeof epaRaw === "number"
                ? epaRaw
                : (epaRaw?.total_points?.mean ?? epaRaw?.mean ?? 0);
            const epaRank: number | undefined = data?.rank ?? undefined;
            updates.push({ teamNumber: team.teamNumber, epa, epaRank });
            synced++;
          } catch {
            // silently skip teams not found in Statbotics
          }
        }),
      );
      if (i + BATCH < teams.length) await delay(200);
    }

    // One mutation call for all EPA updates (was N separate calls)
    if (updates.length > 0) {
      await ctx.runMutation(internal.teams.batchUpdateEpa, { eventKey, updates });
    }

    return { synced, total: teams.length };
  },
});
