import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import { TeamStats } from "../../convex/stats";
import Spinner from "../components/ui/Spinner";
import Badge from "../components/ui/Badge";
import BubbleChart from "../components/charts/BubbleChart";

type SortKey = "teamNumber" | "opr" | "epa" | string;
type ViewMode = "table" | "chart";

export default function DataPage() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("opr");
  const [sortAsc, setSortAsc] = useState(false);
  const [view, setView] = useState<ViewMode>("table");

  const allStats = useQuery(
    api.stats.getAllTeamStats,
    event && config ? { eventKey: event.eventKey, configId: config._id } : "skip",
  );

  const flags = useQuery(
    api.teamFlags.getAllFlags,
    event ? { eventKey: event.eventKey } : "skip",
  );

  const flagsByTeam = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const f of flags ?? []) {
      const arr = map.get(f.teamNumber) ?? [];
      arr.push(f.tag);
      map.set(f.teamNumber, arr);
    }
    return map;
  }, [flags]);

  const numericFields = useMemo(
    () =>
      (config?.matchFields ?? []).filter(
        (f) =>
          (f.type === "counter" || f.type === "number" || f.type === "rating") &&
          f.aggregatable,
      ),
    [config],
  );

  const chartFields = useMemo(
    () => [{ id: "opr", label: "OPR" }, { id: "epa", label: "EPA" }, ...numericFields],
    [numericFields],
  );

  const [xFieldId, setXFieldId] = useState("opr");
  const [yFieldId, setYFieldId] = useState("epa");

  function getVal(t: TeamStats, key: SortKey): number {
    if (key === "opr") return t.opr ?? -999;
    if (key === "epa") return t.epa ?? -999;
    if (key === "teamNumber") return t.teamNumber;
    if (key === "avgMatchBalls") return t.avgMatchBalls ?? -999;
    if (key === "maxMatchBalls") return t.maxMatchBalls ?? -999;
    const fs = t.fieldStats[key];
    return fs?.type === "numeric" ? fs.avg : 0;
  }

  const sorted = useMemo(() => {
    if (!allStats) return [];
    const filtered = allStats.filter(
      (t) =>
        !search ||
        String(t.teamNumber).includes(search) ||
        t.nickname.toLowerCase().includes(search.toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const diff = getVal(a, sortKey) - getVal(b, sortKey);
      return sortAsc ? diff : -diff;
    });
  }, [allStats, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortHeader({ label, k, className = "" }: { label: string; k: SortKey; className?: string }) {
    const active = sortKey === k;
    return (
      <th
        className={`px-3 py-2 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-200 whitespace-nowrap select-none ${className}`}
        onClick={() => toggleSort(k)}
      >
        {label} {active ? (sortAsc ? "↑" : "↓") : ""}
      </th>
    );
  }

  if (!event)
    return (
      <div className="p-6 text-center text-slate-400">No active event.</div>
    );
  if (allStats === undefined)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-950 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <div className="flex rounded-lg bg-slate-800 p-1 shrink-0">
            {(["table", "chart"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  view === v ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                {v === "table" ? "Table" : "Chart"}
              </button>
            ))}
          </div>
        </div>

        {view === "chart" && chartFields.length >= 2 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">X Axis</label>
              <select
                value={xFieldId}
                onChange={(e) => setXFieldId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
              >
                {chartFields.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">Y Axis</label>
              <select
                value={yFieldId}
                onChange={(e) => setYFieldId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
              >
                {chartFields.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {view === "chart" ? (
        <div className="flex-1 overflow-auto p-4">
          {allStats.length > 0 ? (
            <BubbleChart
              teams={sorted}
              fields={numericFields}
              xFieldId={xFieldId}
              yFieldId={yFieldId}
            />
          ) : (
            <div className="p-8 text-center text-slate-500">No teams found.</div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="hidden sm:table-cell px-3 py-2 w-40" />
                <SortHeader label="Team" k="teamNumber" className="sticky top-0 left-0 z-30 bg-slate-900" />
                <SortHeader label="OPR" k="opr" />
                <SortHeader label="EPA" k="epa" />
                <SortHeader label="Avg Match Balls" k="avgMatchBalls" />
                <SortHeader label="Max Match Balls" k="maxMatchBalls" />
                {numericFields.map((f) => (
                  <SortHeader key={f.id} label={f.label} k={f.id} />
                ))}
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Flags</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const teamFlags = flagsByTeam.get(t.teamNumber) ?? [];
                return (
                  <tr
                    key={t.teamNumber}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => navigate(`/team/${t.teamNumber}`)}
                  >
                    <td className="hidden sm:table-cell pl-3 py-2 w-40">
                      {(t.robotPhotoUrl ?? t.pitPhotoUrl) ? (
                        <img
                          src={(t.robotPhotoUrl ?? t.pitPhotoUrl)!}
                          alt={`Team ${t.teamNumber}`}
                          className="w-40 h-40 rounded object-cover bg-slate-800"
                        />
                      ) : (
                        <div className="w-40 h-40 rounded bg-slate-800 flex items-center justify-center text-slate-600 text-xs">🤖</div>
                      )}
                    </td>
                    <td className="sticky left-0 z-10 bg-slate-950 px-3 py-2.5 font-medium text-slate-200">
                      <div>{t.teamNumber}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[100px]">{t.nickname}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {t.opr !== null ? t.opr.toFixed(1) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {t.epa !== null ? t.epa.toFixed(1) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {t.avgMatchBalls !== null ? t.avgMatchBalls.toFixed(1) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {t.maxMatchBalls !== null ? t.maxMatchBalls.toFixed(1) : <span className="text-slate-600">—</span>}
                    </td>
                    {numericFields.map((f) => {
                      const fs = t.fieldStats[f.id];
                      const val = fs?.type === "numeric" ? fs.avg : null;
                      return (
                        <td key={f.id} className="px-3 py-2.5 text-slate-300">
                          {val !== null ? val.toFixed(1) : <span className="text-slate-600">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {teamFlags.slice(0, 2).map((tag) => (
                          <Badge key={tag} color="yellow" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {teamFlags.length > 2 && (
                          <Badge color="gray">+{teamFlags.length - 2}</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="p-8 text-center text-slate-500">No teams found.</div>
          )}
        </div>
      )}
    </div>
  );
}
