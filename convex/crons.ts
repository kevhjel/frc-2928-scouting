import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Watchdog crons: fire hourly to restart the self-scheduling chain if it ever
// breaks (e.g. after an unhandled error). When sync is disabled the chain stops
// itself; the watchdog re-checks once per hour and stays idle until re-enabled.
crons.interval(
  "sync TBA watchdog",
  { hours: 1 },
  internal.actions.autoSync.runTbaSync,
  {},
);

crons.interval(
  "sync Statbotics EPA watchdog",
  { hours: 1 },
  internal.actions.autoSync.runEpaSync,
  {},
);

export default crons;
