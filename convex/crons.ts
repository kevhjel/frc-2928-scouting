import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "auto-sync TBA and Statbotics",
  { minutes: 30 },
  internal.actions.autoSync.runAutoSync,
  {},
);

export default crons;
