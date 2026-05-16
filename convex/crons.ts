import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// TBA sync: match status and scores change frequently during play
crons.interval(
  "sync TBA",
  { minutes: 5 },
  internal.actions.autoSync.runTbaSync,
  {},
);

// Statbotics EPA: calculated nightly, updates slowly — no need to sync every 5 min
crons.interval(
  "sync Statbotics EPA",
  { hours: 2 },
  internal.actions.autoSync.runEpaSync,
  {},
);

export default crons;
