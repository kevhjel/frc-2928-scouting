"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

const STATBOTICS_BASE = "https://api.statbotics.io/v3";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const syncStatbotics = action({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const teams: Array<{ teamNumber: number; teamKey: string }> =
      await ctx.runQuery(api.teams.getTeamsForEvent, { eventKey });

    const year = parseInt(eventKey.slice(0, 4), 10);
    const shortEventKey = eventKey.slice(4);

    let synced = 0;
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
            await ctx.runMutation(api.teams.updateTeamEpa, {
              eventKey,
              teamNumber: team.teamNumber,
              epa,
              epaRank,
            });
            synced++;
          } catch {
            // silently skip teams not found in Statbotics
          }
        }),
      );
      if (i + BATCH < teams.length) await delay(200);
    }
    return { synced, total: teams.length };
  },
});
