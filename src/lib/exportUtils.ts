import { TeamStats } from "../../convex/stats";
import { ScoutingConfig } from "./configTypes";

function escapeCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCsv(cells: unknown[]): string {
  return cells.map(escapeCsv).join(",");
}

export function statsToCSV(stats: TeamStats[], config: ScoutingConfig): string {
  const numericFields = config.matchFields.filter(
    (f) => (f.type === "counter" || f.type === "number" || f.type === "rating") && f.aggregatable,
  );

  const headers = [
    "Team Number",
    "Nickname",
    "Matches Scouted",
    "OPR",
    "DPR",
    "CCWM",
    "EPA",
    "EPA Rank",
    ...numericFields.map((f) => f.label + " (avg)"),
    ...numericFields.map((f) => f.label + " (max)"),
  ];

  const rows = stats.map((t) => [
    t.teamNumber,
    t.nickname,
    t.matchCount,
    t.opr ?? "",
    t.dpr ?? "",
    t.ccwm ?? "",
    t.epa ?? "",
    t.epaRank ?? "",
    ...numericFields.map((f) => {
      const fs = t.fieldStats[f.id];
      return fs?.type === "numeric" ? fs.avg.toFixed(2) : "";
    }),
    ...numericFields.map((f) => {
      const fs = t.fieldStats[f.id];
      return fs?.type === "numeric" ? fs.max : "";
    }),
  ]);

  return [headers, ...rows].map(rowToCsv).join("\n");
}

export function matchEntriesToCSV(entries: any[], config: ScoutingConfig): string {
  const fieldIds = config.matchFields.map((f) => f.id);
  const headers = [
    "Match Key",
    "Team Number",
    "Alliance",
    "Position",
    "Scout",
    "Submitted At",
    ...config.matchFields.map((f) => f.label),
    "Notes",
  ];

  const rows = entries.map((e) => [
    e.matchKey,
    e.teamNumber,
    e.alliance,
    e.alliancePosition,
    e.scoutUserId,
    new Date(e.submittedAt).toISOString(),
    ...fieldIds.map((id) => e.data[id] ?? ""),
    e.notes ?? "",
  ]);

  return [headers, ...rows].map(rowToCsv).join("\n");
}

export function pitEntriesToCSV(entries: any[], config: ScoutingConfig): string {
  const fieldIds = config.pitFields.map((f) => f.id);
  const headers = [
    "Team Number",
    "Scout",
    "Submitted At",
    ...config.pitFields.map((f) => f.label),
    "Notes",
  ];

  const rows = entries.map((e) => [
    e.teamNumber,
    e.scoutUserId,
    new Date(e.submittedAt).toISOString(),
    ...fieldIds.map((id) => e.data[id] ?? ""),
    e.notes ?? "",
  ]);

  return [headers, ...rows].map(rowToCsv).join("\n");
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
