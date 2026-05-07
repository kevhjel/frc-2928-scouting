import { TeamStats, FieldStats } from "../../convex/stats";

export function getNumericAvg(stats: TeamStats, fieldId: string): number | null {
  const fs = stats.fieldStats[fieldId];
  if (!fs || fs.type !== "numeric") return null;
  return fs.count > 0 ? fs.avg : null;
}

export function getBooleanPercent(stats: TeamStats, fieldId: string): number | null {
  const fs = stats.fieldStats[fieldId];
  if (!fs || fs.type !== "boolean") return null;
  return fs.truePercent;
}

export function formatStat(value: number | null, decimals = 1): string {
  if (value === null) return "—";
  return value.toFixed(decimals);
}

export function statColor(value: number | null, higherIsBetter: boolean, max: number): string {
  if (value === null || max === 0) return "text-slate-400";
  const pct = value / max;
  if (higherIsBetter) {
    if (pct >= 0.7) return "text-green-400";
    if (pct >= 0.4) return "text-yellow-400";
    return "text-red-400";
  } else {
    if (pct <= 0.3) return "text-green-400";
    if (pct <= 0.6) return "text-yellow-400";
    return "text-red-400";
  }
}
