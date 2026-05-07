"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

const TBA_BASE = "https://www.thebluealliance.com/api/v3";

async function tbaFetch(path: string) {
  const apiKey = process.env.TBA_API_KEY;
  if (!apiKey) throw new Error("TBA_API_KEY environment variable not set");
  const res = await fetch(`${TBA_BASE}${path}`, {
    headers: { "X-TBA-Auth-Key": apiKey },
  });
  if (!res.ok) throw new Error(`TBA fetch failed: ${res.status} ${path}`);
  return res.json();
}

function parseTeamNumber(teamKey: string): number {
  return parseInt(teamKey.replace("frc", ""), 10);
}

function matchStatus(m: any): "upcoming" | "in_progress" | "completed" {
  if (m.actual_time) return "completed";
  if (m.predicted_time && m.predicted_time < Date.now() / 1000 + 300) return "in_progress";
  return "upcoming";
}

export const syncEventFromTBA = action({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const [teamsData, matchesData, oprsData]: [any[], any[], any] =
      await Promise.all([
        tbaFetch(`/event/${eventKey}/teams`),
        tbaFetch(`/event/${eventKey}/matches`),
        tbaFetch(`/event/${eventKey}/oprs`),
      ]);

    for (const team of teamsData) {
      await ctx.runMutation(api.teams.upsertTeam, {
        eventKey,
        teamNumber: parseTeamNumber(team.key),
        teamKey: team.key,
        nickname: team.nickname ?? `Team ${parseTeamNumber(team.key)}`,
        city: team.city ?? undefined,
        stateMprovince: team.state_prov ?? undefined,
        country: team.country ?? undefined,
        rookieYear: team.rookie_year ?? undefined,
      });
    }

    for (const match of matchesData) {
      const red = (match.alliances?.red?.team_keys ?? []).map(parseTeamNumber);
      const blue = (match.alliances?.blue?.team_keys ?? []).map(parseTeamNumber);
      const youtubeKey = (match.videos ?? []).find((v: any) => v.type === "youtube")?.key;
      await ctx.runMutation(api.matches.upsertMatch, {
        eventKey,
        matchKey: match.key,
        compLevel: match.comp_level as any,
        matchNumber: match.match_number,
        setNumber: match.set_number,
        redAlliance: red,
        blueAlliance: blue,
        redScore: match.alliances?.red?.score >= 0 ? match.alliances.red.score : undefined,
        blueScore: match.alliances?.blue?.score >= 0 ? match.alliances.blue.score : undefined,
        predictedTime: match.predicted_time ?? undefined,
        actualTime: match.actual_time ?? undefined,
        status: matchStatus(match),
        videoUrl: youtubeKey ? `https://www.youtube.com/watch?v=${youtubeKey}` : undefined,
      });
    }

    if (oprsData?.oprs) {
      for (const [teamKey, opr] of Object.entries(oprsData.oprs) as [string, number][]) {
        const teamNumber = parseTeamNumber(teamKey);
        await ctx.runMutation(api.teams.updateTeamOpr, {
          eventKey,
          teamNumber,
          opr,
          dpr: (oprsData.dprs?.[teamKey] as number) ?? 0,
          ccwm: (oprsData.ccwms?.[teamKey] as number) ?? 0,
        });
      }
    }

    return {
      teamsCount: teamsData.length,
      matchesCount: matchesData.length,
    };
  },
});

export const syncTeamPhotos = action({
  args: { eventKey: v.string() },
  handler: async (ctx, { eventKey }) => {
    const year = parseInt(eventKey.slice(0, 4), 10);
    const teamsData: any[] = await tbaFetch(`/event/${eventKey}/teams`);
    const PHOTO_TYPES = ["cdphotothread", "imgur"];
    let synced = 0;

    for (const team of teamsData) {
      try {
        const media: any[] = await tbaFetch(`/team/${team.key}/media/${year}`);
        const photos = media.filter((m) => PHOTO_TYPES.includes(m.type) && m.direct_url);
        const preferred = photos.find((m) => m.preferred) ?? photos[0];
        if (preferred?.direct_url) {
          await ctx.runMutation(api.teams.updateTeamPhoto, {
            eventKey,
            teamNumber: parseTeamNumber(team.key),
            photoUrl: preferred.direct_url,
          });
          synced++;
        }
      } catch {
        // skip teams with no media
      }
    }

    return { synced, total: teamsData.length };
  },
});

export const syncSingleMatch = action({
  args: { matchKey: v.string(), eventKey: v.string() },
  handler: async (ctx, { matchKey, eventKey }) => {
    const match = await tbaFetch(`/match/${matchKey}`);
    const red = (match.alliances?.red?.team_keys ?? []).map(parseTeamNumber);
    const blue = (match.alliances?.blue?.team_keys ?? []).map(parseTeamNumber);
    const youtubeKey = (match.videos ?? []).find((v: any) => v.type === "youtube")?.key;
    await ctx.runMutation(api.matches.upsertMatch, {
      eventKey,
      matchKey: match.key,
      compLevel: match.comp_level as any,
      matchNumber: match.match_number,
      setNumber: match.set_number,
      redAlliance: red,
      blueAlliance: blue,
      redScore: match.alliances?.red?.score >= 0 ? match.alliances.red.score : undefined,
      blueScore: match.alliances?.blue?.score >= 0 ? match.alliances.blue.score : undefined,
      predictedTime: match.predicted_time ?? undefined,
      actualTime: match.actual_time ?? undefined,
      status: matchStatus(match),
      videoUrl: youtubeKey ? `https://www.youtube.com/watch?v=${youtubeKey}` : undefined,
    });
  },
});
