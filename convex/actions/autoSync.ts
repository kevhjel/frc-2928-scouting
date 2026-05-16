"use node";
import { internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";

export const runTbaSync = internalAction({
  args: {},
  handler: async (ctx) => {
    const syncEnabled = await ctx.runQuery(api.appSettings.getAppSetting, { key: "tba_sync_enabled" });
    if (syncEnabled?.value === "false") return;
    const eventKey: string | null = await ctx.runQuery(internal.events.getActiveEventKey, {});
    if (!eventKey) return;
    await ctx.runAction(api.actions.tbaSync.syncEventFromTBA, { eventKey });
  },
});

export const runEpaSync = internalAction({
  args: {},
  handler: async (ctx) => {
    const syncEnabled = await ctx.runQuery(api.appSettings.getAppSetting, { key: "tba_sync_enabled" });
    if (syncEnabled?.value === "false") return;
    const eventKey: string | null = await ctx.runQuery(internal.events.getActiveEventKey, {});
    if (!eventKey) return;
    await ctx.runAction(api.actions.statboticsSync.syncStatbotics, { eventKey });
  },
});
