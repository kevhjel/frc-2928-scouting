import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Spinner from "../ui/Spinner";
import Modal from "../ui/Modal";
import TeamRadarChart from "../charts/TeamRadarChart";
import OffenseRadarChart from "../charts/OffenseRadarChart";
import TeamNotesSection from "../teams/TeamNotesSection";
import { computeOffenseMetrics } from "../../lib/offenseMetrics";

export type TeamData = { photoUrl: string | null; opr: number | null; epa: number | null };

export function TeamPhoto({ url }: { url: string | null }) {
  if (url)
    return <img src={url} alt="" className="w-6 h-6 rounded object-cover bg-slate-800 shrink-0" />;
  return (
    <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs shrink-0">
      🤖
    </div>
  );
}

export function FlagBadges({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null;
  return (
    <>
      {flags.map((f) => (
        <span
          key={f}
          className="text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800/50 px-1 py-0.5 rounded leading-none"
        >
          {f}
        </span>
      ))}
    </>
  );
}

export function CompareModal({
  open,
  onClose,
  teamsList,
  flagsByTeam,
  teamDataMap,
  event,
  config,
  initialTeams,
}: {
  open: boolean;
  onClose: () => void;
  /** Pre-select Team A / Team B each time the modal opens */
  initialTeams?: [number, number] | null;
  teamsList: Array<{ teamNumber: number; nickname: string }>;
  flagsByTeam: Map<number, string[]>;
  teamDataMap: Map<number, TeamData>;
  event: { eventKey: string } | null;
  config: { _id: string; matchFields: any[] } | null;
}) {
  const [teamA, setTeamA] = useState<number | null>(null);
  const [teamB, setTeamB] = useState<number | null>(null);

  useEffect(() => {
    if (open && initialTeams) {
      setTeamA(initialTeams[0]);
      setTeamB(initialTeams[1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTeams?.[0], initialTeams?.[1]]);

  const statsA = useQuery(
    api.stats.getTeamStats,
    event && config && teamA
      ? { eventKey: event.eventKey, teamNumber: teamA, configId: config._id as any }
      : "skip",
  );
  const statsB = useQuery(
    api.stats.getTeamStats,
    event && config && teamB
      ? { eventKey: event.eventKey, teamNumber: teamB, configId: config._id as any }
      : "skip",
  );

  const numericFields = (config?.matchFields ?? []).filter(
    (f: any) =>
      (f.type === "counter" || f.type === "number" || f.type === "rating") && f.aggregatable,
  );

  const rows: Array<{ label: string; getVal: (s: any) => number | null }> = [
    { label: "OPR", getVal: (s) => s?.opr ?? null },
    { label: "EPA", getVal: (s) => s?.epa ?? null },
    { label: "Avg Match Balls", getVal: (s) => s?.avgMatchBalls ?? null },
    { label: "Max Match Balls", getVal: (s) => s?.maxMatchBalls ?? null },
    ...numericFields.map((f: any) => ({
      label: f.label,
      getVal: (s: any) => {
        const fs = s?.fieldStats?.[f.id];
        return fs?.type === "numeric" ? fs.avg : null;
      },
    })),
  ];

  return (
    <Modal open={open} onClose={onClose} title="Compare Teams" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {([["A", teamA, setTeamA], ["B", teamB, setTeamB]] as const).map(
            ([label, val, setVal]) => (
              <select
                key={label}
                value={val ?? ""}
                onChange={(e) => (setVal as any)(e.target.value ? Number(e.target.value) : null)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Team {label}…</option>
                {teamsList.map((t) => (
                  <option key={t.teamNumber} value={t.teamNumber}>
                    {t.teamNumber} — {t.nickname}
                  </option>
                ))}
              </select>
            ),
          )}
        </div>

        {teamA && teamB && (
          <>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { num: teamA, stats: statsA },
                { num: teamB, stats: statsB },
              ].map(({ num, stats }, idx) => {
                const td = teamDataMap.get(num);
                const nickname =
                  stats?.nickname ?? teamsList.find((t) => t.teamNumber === num)?.nickname ?? "";
                return (
                  <div key={num}>
                    {td?.photoUrl ? (
                      <img
                        src={td.photoUrl}
                        alt=""
                        className="w-48 h-48 rounded-lg object-cover bg-slate-800 mx-auto mb-2"
                      />
                    ) : (
                      <div className="w-48 h-48 rounded-lg bg-slate-800 flex items-center justify-center text-5xl mx-auto mb-2">
                        🤖
                      </div>
                    )}
                    <p className={`text-sm font-bold ${idx === 0 ? "text-red-400" : "text-blue-400"}`}>Team {num}</p>
                    <p className="text-xs text-slate-500 truncate">{nickname}</p>
                    <div className="flex flex-wrap gap-1 justify-center mt-1">
                      <FlagBadges flags={flagsByTeam.get(num)} />
                    </div>
                  </div>
                );
              })}
            </div>

            {statsA && statsB ? (
              <>
                <TeamRadarChart
                  stats={statsA as any}
                  statsB={statsB as any}
                  labelA={`Team ${teamA}`}
                  labelB={`Team ${teamB}`}
                  fields={config?.matchFields as any ?? []}
                />
                {(() => {
                  const numStatF = (s: typeof statsA, id: string) => {
                    const f = s?.fieldStats?.[id];
                    return (f as any)?.type === "numeric" && (f as any).count > 0 ? (f as any).avg : 0;
                  };
                  const rawA = {
                    teamNumber: teamA!,
                    autoBalls: numStatF(statsA, "auto_avg_balls_cycle") * numStatF(statsA, "auto_shoot_cycles"),
                    teleBalls: numStatF(statsA, "tele_avg_balls_shot") * numStatF(statsA, "tele_shoot_cycles"),
                    fedBalls: numStatF(statsA, "tele_avg_balls_fed") * numStatF(statsA, "tele_feed_cycles"),
                    epa: Math.max(0, (statsA as any).epa ?? 0),
                  };
                  const rawB = {
                    teamNumber: teamB!,
                    autoBalls: numStatF(statsB, "auto_avg_balls_cycle") * numStatF(statsB, "auto_shoot_cycles"),
                    teleBalls: numStatF(statsB, "tele_avg_balls_shot") * numStatF(statsB, "tele_shoot_cycles"),
                    fedBalls: numStatF(statsB, "tele_avg_balls_fed") * numStatF(statsB, "tele_feed_cycles"),
                    epa: Math.max(0, (statsB as any).epa ?? 0),
                  };
                  const om = computeOffenseMetrics([rawA, rawB]);
                  return (
                    <OffenseRadarChart
                      metrics={om[teamA!]}
                      metricsB={om[teamB!]}
                      alliance="red"
                      labelA={`Team ${teamA}`}
                      labelB={`Team ${teamB}`}
                    />
                  );
                })()}
                <div className="flex gap-4 justify-center text-xs mb-1">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500" />Team {teamA}</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500" />Team {teamB}</span>
                </div>
                <div className="overflow-y-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-800">
                        <th className="text-left py-1 font-normal">Metric</th>
                        <th className="text-right py-1 font-normal text-red-400">Team {teamA}</th>
                        <th className="text-right py-1 font-normal text-blue-400">Team {teamB}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ label, getVal }) => {
                        const valA = getVal(statsA);
                        const valB = getVal(statsB);
                        const aWins = valA !== null && valB !== null && valA > valB;
                        const bWins = valA !== null && valB !== null && valB > valA;
                        return (
                          <tr key={label} className="border-b border-slate-800/40">
                            <td className="py-1.5 text-xs text-slate-400">{label}</td>
                            <td className={`py-1.5 text-right font-medium ${aWins ? "text-red-400" : bWins ? "text-slate-500" : "text-slate-300"}`}>
                              {valA !== null ? Number(valA).toFixed(1) : "—"}
                            </td>
                            <td className={`py-1.5 text-right font-medium ${bWins ? "text-blue-400" : aWins ? "text-slate-500" : "text-slate-300"}`}>
                              {valB !== null ? Number(valB).toFixed(1) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export function TeamQuickViewModal({
  teamNumber,
  event,
  config,
  allStats,
  onClose,
}: {
  teamNumber: number;
  event: { eventKey: string } | null;
  config: { _id: string; matchFields: any[]; pitFields: any[] } | null;
  allStats?: any[];
  onClose: () => void;
}) {
  const stats = useQuery(
    api.stats.getTeamStats,
    event && config
      ? { eventKey: event.eventKey, teamNumber, configId: config._id as any }
      : "skip",
  );
  const entries = useQuery(
    api.matchScouting.getEntriesForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );
  const flags = useQuery(
    api.teamFlags.getFlagsForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );
  const pitEntry = useQuery(
    api.pitScouting.getPitEntryForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );
  const questions = useQuery(
    api.pitQuestions.getQuestionsForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );

  const displayPhotoUrl = stats?.pitPhotoUrl ?? stats?.robotPhotoUrl ?? null;

  return (
    <Modal open onClose={onClose} title={`Team ${teamNumber}`} size="xl">
      {stats === undefined ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !stats ? (
        <p className="text-slate-400 text-sm">Team not found.</p>
      ) : (
        <div className="space-y-4">
          {displayPhotoUrl && (
            <img
              src={displayPhotoUrl}
              alt=""
              className="w-full max-h-56 object-contain rounded-lg bg-slate-900"
            />
          )}
          <div>
            <p className="text-lg font-bold text-slate-100">Team {teamNumber}</p>
            <p className="text-slate-400 text-sm">{stats.nickname}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "OPR", value: stats.opr, dec: 1 },
              { label: "EPA", value: stats.epa, dec: 1 },
              { label: "Avg Match Balls", value: stats.avgMatchBalls, dec: 1 },
            ].map(({ label, value, dec }) => (
              <div key={label} className="bg-slate-800 rounded-lg p-2">
                <p className="text-blue-400 font-bold">
                  {value !== null && value !== undefined ? Number(value).toFixed(dec) : "—"}
                </p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          {flags && flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <span key={f._id} className="text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800/50 px-2 py-0.5 rounded-full">
                  {f.tag}
                </span>
              ))}
            </div>
          )}
          {config && config.matchFields.length > 0 && (
            <TeamRadarChart
              stats={stats as any}
              fields={config.matchFields as any}
            />
          )}
          {(() => {
            const numFields = (config?.matchFields ?? []).filter(
              (f: any) => (f.type === "counter" || f.type === "number" || f.type === "rating") && f.aggregatable,
            );
            if (!numFields.length) return null;
            return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-2">Averages</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Avg Match Balls</span>
                      <span className="text-slate-200">{stats.avgMatchBalls !== null ? stats.avgMatchBalls.toFixed(1) : "—"}</span>
                    </div>
                    {numFields.map((f: any) => {
                      const fs = (stats as any).fieldStats?.[f.id];
                      const val = fs?.type === "numeric" ? fs.avg : null;
                      return (
                        <div key={f.id} className="flex justify-between text-xs">
                          <span className="text-slate-400">{f.label}</span>
                          <span className="text-slate-200">{val !== null ? val.toFixed(1) : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-2">Maximums</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Max Match Balls</span>
                      <span className="text-slate-200">{stats.maxMatchBalls !== null ? stats.maxMatchBalls.toFixed(1) : "—"}</span>
                    </div>
                    {numFields.map((f: any) => {
                      const fs = (stats as any).fieldStats?.[f.id];
                      const val = fs?.type === "numeric" ? fs.max : null;
                      return (
                        <div key={f.id} className="flex justify-between text-xs">
                          <span className="text-slate-400">{f.label}</span>
                          <span className="text-slate-200">{val !== null ? val.toFixed(1) : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
          {pitEntry && config && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Pit Scouting</p>
              <div className="grid grid-cols-2 gap-y-1 gap-x-3">
                {config.pitFields
                  .filter((f: any) => pitEntry.data[f.id] !== undefined && pitEntry.data[f.id] !== null && pitEntry.data[f.id] !== "")
                  .map((f: any) => (
                    <div key={f.id} className="flex justify-between">
                      <span className="text-xs text-slate-400">{f.label}</span>
                      <span className="text-xs text-slate-300 ml-1">{String(pitEntry.data[f.id])}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {questions && questions.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Pit Questions</p>
              <div className="space-y-2">
                {questions.map((q) => (
                  <div key={q._id}>
                    <p className="text-xs text-slate-200">{q.question}</p>
                    {q.answer ? (
                      <p className="text-xs text-green-400 pl-2 border-l border-green-700 mt-0.5">{q.answer}</p>
                    ) : (
                      <p className="text-xs text-amber-500 pl-2 border-l border-amber-800 mt-0.5">Unanswered</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {entries && config && entries.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Notes</p>
              <TeamNotesSection entries={entries as any} matchFields={config.matchFields as any} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
