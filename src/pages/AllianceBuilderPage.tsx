import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import { Link } from "react-router-dom";

const HOME_TEAM = 2928;

function TeamSelector({
  label,
  value,
  onChange,
  teams,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  teams: Array<{ teamNumber: number; nickname: string }>;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
      >
        <option value="">Select team…</option>
        {teams.map((t) => (
          <option key={t.teamNumber} value={t.teamNumber}>
            {t.teamNumber} — {t.nickname}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AllianceBuilderPage() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const teams = useQuery(
    api.teams.getTeamsForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const allStats = useQuery(
    api.stats.getAllTeamStats,
    event && config ? { eventKey: event.eventKey, configId: config._id } : "skip",
  );

  const [pick1, setPick1] = useState("");
  const [pick2, setPick2] = useState("");

  const sortedTeams = useMemo(
    () =>
      teams ? [...teams].sort((a, b) => a.teamNumber - b.teamNumber) : [],
    [teams],
  );

  const statsMap = useMemo(
    () =>
      new Map(
        (allStats ?? []).map((s) => [s.teamNumber, s]),
      ),
    [allStats],
  );

  const homeStats = statsMap.get(HOME_TEAM);
  const p1Stats = pick1 ? statsMap.get(Number(pick1)) : undefined;
  const p2Stats = pick2 ? statsMap.get(Number(pick2)) : undefined;

  const allSelected = [homeStats, p1Stats, p2Stats].filter(Boolean);

  const combinedOpr = allSelected.reduce((s, t) => s + (t?.opr ?? 0), 0);
  const combinedEpa = allSelected.reduce((s, t) => s + (t?.epa ?? 0), 0);

  if (!event)
    return (
      <div className="p-6 text-center text-slate-400">No active event.</div>
    );
  if (!teams || !allStats)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  function StatRow({ label, value }: { label: string; value: number | null }) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-200">
          {value !== null ? value.toFixed(1) : "—"}
        </span>
      </div>
    );
  }

  function TeamCard({
    label,
    stats,
  }: {
    label: string;
    stats?: ReturnType<typeof statsMap.get>;
  }) {
    if (!stats) return null;
    return (
      <Card className="flex-1">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <Link
          to={`/team/${stats.teamNumber}`}
          className="font-bold text-blue-400 text-lg block mb-2"
        >
          {stats.teamNumber}
        </Link>
        <p className="text-xs text-slate-500 mb-3 truncate">{stats.nickname}</p>
        <StatRow label="OPR" value={stats.opr} />
        <StatRow label="EPA" value={stats.epa} />
        <StatRow label="Matches" value={stats.matchCount} />
      </Card>
    );
  }

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h2 className="font-bold text-slate-100">Alliance Builder</h2>

      <div className="space-y-3">
        <Card>
          <p className="text-xs text-slate-400 mb-1">Your Team</p>
          <p className="font-bold text-blue-400 text-lg">{HOME_TEAM}</p>
          <p className="text-xs text-slate-500">
            {homeStats?.nickname ?? "Team 2928"}
          </p>
        </Card>

        <TeamSelector
          label="First Pick"
          value={pick1}
          onChange={setPick1}
          teams={sortedTeams.filter((t) => t.teamNumber !== HOME_TEAM)}
        />
        <TeamSelector
          label="Second Pick"
          value={pick2}
          onChange={setPick2}
          teams={sortedTeams.filter(
            (t) => t.teamNumber !== HOME_TEAM && String(t.teamNumber) !== pick1,
          )}
        />
      </div>

      {allSelected.length >= 2 && (
        <>
          <Card>
            <p className="text-xs text-slate-400 mb-3">Alliance Totals</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {combinedOpr.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Combined OPR</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {combinedEpa.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Combined EPA</div>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <TeamCard label="Your Robot" stats={homeStats} />
            {p1Stats && <TeamCard label="Pick 1" stats={p1Stats} />}
            {p2Stats && <TeamCard label="Pick 2" stats={p2Stats} />}
          </div>
        </>
      )}
    </div>
  );
}
