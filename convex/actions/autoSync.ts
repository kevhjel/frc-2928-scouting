"use node";
import { internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";

// Self-scheduling action: reschedules itself every 5 min when enabled.
// When disabled, it returns without scheduling — chain stops until toggleAutoSync
// re-enables it (or the hourly watchdog cron fires and restarts).
export const runTbaSync = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const syncEnabled = await ctx.runQuery(api.appSettings.getAppSetting, { key: "tba_sync_enabled" });
    if (syncEnabled?.value === "false") return;

    const eventKey: string | null = await ctx.runQuery(internal.events.getActiveEventKey, {});
    if (eventKey) {
      await ctx.runAction(api.actions.tbaSync.syncEventFromTBA, { eventKey });
    }
    await ctx.scheduler.runAfter(5 * 60 * 1000, internal.actions.autoSync.runTbaSync, {});
  },
});

export const runEpaSync = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const syncEnabled = await ctx.runQuery(api.appSettings.getAppSetting, { key: "tba_sync_enabled" });
    if (syncEnabled?.value === "false") return;

    const eventKey: string | null = await ctx.runQuery(internal.events.getActiveEventKey, {});
    if (eventKey) {
      await ctx.runAction(api.actions.statboticsSync.syncStatbotics, { eventKey });
    }
    await ctx.scheduler.runAfter(2 * 60 * 60 * 1000, internal.actions.autoSync.runEpaSync, {});
  },
});
