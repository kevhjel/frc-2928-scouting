import { useState, useEffect, useRef, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import { useRole } from "../hooks/useRole";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import TeamRadarChart from "../components/charts/TeamRadarChart";
import OffenseRadarChart from "../components/charts/OffenseRadarChart";
import { computeOffenseMetrics } from "../lib/offenseMetrics";

interface RankedTeam {
  teamNumber: number;
  rank: number;
  notes?: string;
  dnp?: boolean;
}

interface ConsensusTeam {
  teamNumber: number;
  bordaScore: number;
  averageRank: number;
  submissionCount: number;
  dnpCount: number;
  isConfirmed: boolean;
  notes?: string;
}

type TeamData = { photoUrl: string | null; opr: number | null; epa: number | null };

function TeamPhoto({ url }: { url: string | null }) {
  if (url)
    return <img src={url} alt="" className="w-6 h-6 rounded object-cover bg-slate-800 shrink-0" />;
  return (
    <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs shrink-0">
      🤖
    </div>
  );
}

function FlagBadges({ flags }: { flags?: string[] }) {
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

function SortableTeamRow({
  team,
  rank,
  data,
  flags,
  onToggleDnp,
  onNotesChange,
  onPreview,
}: {
  team: RankedTeam;
  rank: number;
  data?: TeamData;
  flags?: string[];
  onToggleDnp: () => void;
  onNotesChange: (n: string) => void;
  onPreview: (n: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: team.teamNumber,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 ${
        team.dnp ? "opacity-40" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="text-slate-500 cursor-grab active:cursor-grabbing select-none flex items-center self-stretch px-2 -mx-1 touch-none"
      >
        ⠿
      </div>
      <div className="w-6 text-xs text-slate-500 text-right shrink-0">{rank}</div>
      <TeamPhoto url={data?.photoUrl ?? null} />
      <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
        <button
          onClick={() => onPreview(team.teamNumber)}
          className="font-medium text-blue-300 hover:text-blue-200 text-sm underline-offset-2 hover:underline"
        >
          {team.teamNumber}
        </button>
        {data?.opr !== null && data?.opr !== undefined && (
          <span className="text-xs text-slate-500">OPR {data.opr.toFixed(1)}</span>
        )}
        <FlagBadges flags={flags} />
      </div>
      <input
        type="text"
        placeholder="notes…"
        value={team.notes ?? ""}
        onChange={(e) => onNotesChange(e.target.value)}
        className="hidden sm:block w-28 bg-transparent border-b border-slate-700 text-xs text-slate-400 focus:outline-none focus:border-blue-500 py-0.5"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onToggleDnp}
        className={`text-xs px-2 py-1 rounded border transition-colors shrink-0 ${
          team.dnp
            ? "border-red-700 text-red-400 bg-red-900/20"
            : "border-slate-700 text-slate-500 hover:border-red-700"
        }`}
      >
        DNP
      </button>
    </div>
  );
}

function ConsensusRow({
  team,
  rank,
  data,
  flags,
  draggable,
  onPreview,
}: {
  team: ConsensusTeam;
  rank: number;
  data?: TeamData;
  flags?: string[];
  draggable: boolean;
  onPreview: (n: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: team.teamNumber,
    disabled: !draggable,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 last:border-b-0 ${
        team.dnpCount > 0 ? "opacity-50" : ""
      }`}
    >
      {draggable && (
        <div
          {...attributes}
          {...listeners}
          className="text-slate-500 cursor-grab active:cursor-grabbing select-none flex items-center self-stretch px-2 -mx-1 touch-none"
        >
          ⠿
        </div>
      )}
      <span className="w-6 text-xs text-slate-500 text-right shrink-0">{rank}</span>
      <TeamPhoto url={data?.photoUrl ?? null} />
      <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
        <button
          onClick={() => onPreview(team.teamNumber)}
          className="font-medium text-blue-300 hover:text-blue-200 text-sm underline-offset-2 hover:underline"
        >
          {team.teamNumber}
        </button>
        {data?.epa !== null && data?.epa !== undefined && (
          <span className="text-xs text-slate-500">EPA {data.epa.toFixed(1)}</span>
        )}
        <FlagBadges flags={flags} />
      </div>
      {team.dnpCount > 0 && <Badge color="red">DNP×{team.dnpCount}</Badge>}
      <span className="text-xs text-slate-600 shrink-0">{team.submissionCount} lists</span>
    </div>
  );
}

function CompareModal({
  open,
  onClose,
  teamsList,
  flagsByTeam,
  teamDataMap,
  event,
  config,
}: {
  open: boolean;
  onClose: () => void;
  teamsList: Array<{ teamNumber: number; nickname: string }>;
  flagsByTeam: Map<number, string[]>;
  teamDataMap: Map<number, TeamData>;
  event: { eventKey: string } | null;
  config: { _id: string; matchFields: any[] } | null;
}) {
  const [teamA, setTeamA] = useState<number | null>(null);
  const [teamB, setTeamB] = useState<number | null>(null);

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
              ].map(({ num, stats }) => {
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
                    <p className="text-sm font-bold text-slate-200">Team {num}</p>
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

function TeamQuickViewModal({
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
          {entries && entries.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Recent Matches ({entries.length})</p>
              <div className="space-y-1">
                {entries.slice(0, 5).map((e) => (
                  <div key={e._id} className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${e.alliance === "red" ? "bg-red-900/40 text-red-300" : "bg-blue-900/40 text-blue-300"}`}>
                      {e.matchKey.split("_").pop()?.toUpperCase()}
                    </span>
                    {e.notes && <span className="text-slate-400 italic truncate">{e.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

type RankResult = { teamNumber: number; oldRank: number; newRank: number; delta: number };

function generatePairs(teamNumbers: number[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < teamNumbers.length; i++)
    for (let j = i + 1; j < teamNumbers.length; j++)
      pairs.push([teamNumbers[i], teamNumbers[j]]);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

function computeRankResults(
  sub: { teamNumber: number }[],
  scores: Map<number, number>,
  rangeStart: number,
): RankResult[] {
  const sortedSub = [...sub].sort((a, b) => {
    const diff = (scores.get(b.teamNumber) ?? 0) - (scores.get(a.teamNumber) ?? 0);
    return diff !== 0 ? diff : sub.indexOf(a) - sub.indexOf(b);
  });
  return sortedSub.map((team, newIdx) => {
    const oldIdx = sub.findIndex((t) => t.teamNumber === team.teamNumber);
    return { teamNumber: team.teamNumber, oldRank: rangeStart + oldIdx, newRank: rangeStart + newIdx, delta: oldIdx - newIdx };
  });
}

export default function PickListPage({ view }: { view: "mine" | "consensus" }) {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const role = useRole();

  const myList = useQuery(
    api.pickList.getMyPickList,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const consensusList = useQuery(
    api.pickList.getConsensusPickList,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const teamsList = useQuery(
    api.teams.getTeamsForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const allStats = useQuery(
    api.stats.getAllTeamStats,
    event && config ? { eventKey: event.eventKey, configId: config._id } : "skip",
  );
  const allFlags = useQuery(
    api.teamFlags.getAllFlags,
    event ? { eventKey: event.eventKey } : "skip",
  );

  const upsertList = useMutation(api.pickList.upsertMyPickList);
  const setReadyMutation = useMutation(api.pickList.setPickListReady);
  const calculateConsensus = useAction(api.pickList.calculateConsensusPickList);
  const updateConsensus = useMutation(api.pickList.updateConsensusPickList);

  const [localList, setLocalList] = useState<RankedTeam[]>([]);
  const [localConsensus, setLocalConsensus] = useState<ConsensusTeam[]>([]);
  const [generating, setGenerating] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<number | null>(null);
  const userEdited = useRef(false);

  // Rank game state
  const [rankPhase, setRankPhase] = useState<"idle" | "setup" | "comparing" | "results">("idle");
  const [rankTarget, setRankTarget] = useState<"mine" | "consensus">("mine");
  const [rankRange, setRankRange] = useState({ start: 1, end: 10 });
  const [rankPairs, setRankPairs] = useState<Array<[number, number]>>([]);
  const [rankPairIdx, setRankPairIdx] = useState(0);
  const [rankScores, setRankScores] = useState<Map<number, number>>(new Map());
  const [rankResults, setRankResults] = useState<RankResult[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const teamDataMap = useMemo<Map<number, TeamData>>(() => {
    const map = new Map<number, TeamData>();
    if (allStats) {
      for (const s of allStats) {
        map.set(s.teamNumber, {
          photoUrl: s.pitPhotoUrl ?? s.robotPhotoUrl,
          opr: s.opr,
          epa: s.epa,
        });
      }
    } else if (teamsList) {
      for (const t of teamsList) {
        map.set(t.teamNumber, {
          photoUrl: (t as any).robotPhotoUrl ?? null,
          opr: t.opr ?? null,
          epa: t.epa ?? null,
        });
      }
    }
    return map;
  }, [allStats, teamsList]);

  const flagsByTeam = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const f of allFlags ?? []) {
      const list = map.get(f.teamNumber) ?? [];
      list.push(f.tag);
      map.set(f.teamNumber, list);
    }
    return map;
  }, [allFlags]);

  const allStatsMap = useMemo(() => {
    const map = new Map<number, (typeof allStats)[0] & {}>();
    for (const s of allStats ?? []) map.set(s.teamNumber, s as any);
    return map;
  }, [allStats]);

  // Init my list from DB — skip if user has already started editing
  useEffect(() => {
    if (view !== "mine") return;
    if (userEdited.current) return;
    if (myList !== undefined) {
      if (myList) {
        setLocalList([...myList.rankedTeams].sort((a, b) => a.rank - b.rank));
      } else if (teamsList) {
        setLocalList(
          [...teamsList]
            .sort((a, b) => (b.opr ?? 0) - (a.opr ?? 0))
            .map((t, i) => ({ teamNumber: t.teamNumber, rank: i + 1 })),
        );
      }
    }
  }, [myList, teamsList, view]);

  // Init consensus list
  useEffect(() => {
    if (view !== "consensus") return;
    if (consensusList) {
      setLocalConsensus([...consensusList.rankedTeams]);
    }
  }, [consensusList, view]);

  // Auto-save my list after user edits (debounced)
  useEffect(() => {
    if (!userEdited.current || !event || localList.length === 0) return;
    const timer = setTimeout(() => {
      upsertList({ eventKey: event.eventKey, rankedTeams: localList });
    }, 800);
    return () => clearTimeout(timer);
  }, [localList]);

  function handleMyDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    userEdited.current = true;
    setLocalList((prev) => {
      const oldIdx = prev.findIndex((t) => t.teamNumber === active.id);
      const newIdx = prev.findIndex((t) => t.teamNumber === over.id);
      return arrayMove(prev, oldIdx, newIdx).map((t, i) => ({ ...t, rank: i + 1 }));
    });
  }

  async function handleConsensusDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !event) return;
    const newList = arrayMove(
      localConsensus,
      localConsensus.findIndex((t) => t.teamNumber === active.id),
      localConsensus.findIndex((t) => t.teamNumber === over.id),
    );
    setLocalConsensus(newList);
    await updateConsensus({ eventKey: event.eventKey, rankedTeams: newList });
  }

  async function handleGenerateConsensus() {
    if (!event) return;
    setGenerating(true);
    try {
      await calculateConsensus({ eventKey: event.eventKey });
    } finally {
      setGenerating(false);
    }
  }

  function getRankList() {
    return rankTarget === "mine" ? localList : localConsensus;
  }

  function startRankingGame(target: "mine" | "consensus") {
    const list = target === "mine" ? localList : localConsensus;
    const sub = list.slice(rankRange.start - 1, rankRange.end);
    const pairs = generatePairs(sub.map((t) => t.teamNumber));
    setRankTarget(target);
    setRankPairs(pairs);
    setRankPairIdx(0);
    setRankScores(new Map(sub.map((t) => [t.teamNumber, 0])));
    setRankPhase("comparing");
  }

  function handleRankPick(winner: number) {
    const newScores = new Map(rankScores);
    newScores.set(winner, (newScores.get(winner) ?? 0) + 1);
    const nextIdx = rankPairIdx + 1;
    const sub = getRankList().slice(rankRange.start - 1, rankRange.end);
    if (nextIdx >= rankPairs.length) {
      setRankResults(computeRankResults(sub, newScores, rankRange.start));
      setRankScores(newScores);
      setRankPhase("results");
    } else {
      setRankScores(newScores);
      setRankPairIdx(nextIdx);
    }
  }

  function handleRankSkipOrStop() {
    const nextIdx = rankPairIdx + 1;
    const sub = getRankList().slice(rankRange.start - 1, rankRange.end);
    if (nextIdx >= rankPairs.length) {
      setRankResults(computeRankResults(sub, rankScores, rankRange.start));
      setRankPhase("results");
    } else {
      setRankPairIdx(nextIdx);
    }
  }

  function finishRankingEarly() {
    const sub = getRankList().slice(rankRange.start - 1, rankRange.end);
    setRankResults(computeRankResults(sub, rankScores, rankRange.start));
    setRankPhase("results");
  }

  async function applyRankingResults() {
    if (rankTarget === "mine") {
      const sub = localList.slice(rankRange.start - 1, rankRange.end);
      const sortedSub = [...sub].sort((a, b) => {
        const diff = (rankScores.get(b.teamNumber) ?? 0) - (rankScores.get(a.teamNumber) ?? 0);
        return diff !== 0 ? diff : sub.indexOf(a) - sub.indexOf(b);
      });
      const newList = [
        ...localList.slice(0, rankRange.start - 1),
        ...sortedSub,
        ...localList.slice(rankRange.end),
      ].map((t, i) => ({ ...t, rank: i + 1 }));
      userEdited.current = true;
      setLocalList(newList);
    } else {
      const sub = localConsensus.slice(rankRange.start - 1, rankRange.end);
      const sortedSub = [...sub].sort((a, b) => {
        const diff = (rankScores.get(b.teamNumber) ?? 0) - (rankScores.get(a.teamNumber) ?? 0);
        return diff !== 0 ? diff : sub.indexOf(a) - sub.indexOf(b);
      });
      const newList = [
        ...localConsensus.slice(0, rankRange.start - 1),
        ...sortedSub,
        ...localConsensus.slice(rankRange.end),
      ];
      setLocalConsensus(newList);
      if (event) await updateConsensus({ eventKey: event.eventKey, rankedTeams: newList });
    }
    setRankPhase("idle");
  }

  if (!event)
    return <div className="p-6 text-center text-slate-400">No active event.</div>;

  const sortedTeamsList = teamsList
    ? [...teamsList].sort((a, b) => a.teamNumber - b.teamNumber)
    : [];

  const tabBar = (
    <div className="flex border-b border-slate-800 bg-slate-950 shrink-0">
      {(
        [
          { to: "/picklist/mine", label: "My List" },
          { to: "/picklist/consensus", label: "Team List" },
        ] as const
      ).map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 py-3 text-sm font-medium text-center transition-colors ${
              isActive
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
      <button
        onClick={() => setCompareOpen(true)}
        className="px-4 text-sm text-slate-400 hover:text-slate-200 shrink-0"
      >
        Compare
      </button>
    </div>
  );

  // ── RANK GAME MODALS (shared by both views) ───────────────────────────────
  const rankListLen = getRankList().length;
  const rankGameModals = (
    <>
      {/* Setup */}
      <Modal
        open={rankPhase === "setup"}
        onClose={() => setRankPhase("idle")}
        title="Robot Ranking Game"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Select a range of robots to compare head-to-head. You'll be shown pairs and asked which should rank higher.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">From rank</label>
              <input
                type="number"
                min={1}
                max={rankListLen - 1}
                value={rankRange.start}
                onChange={(e) => setRankRange((r) => ({ ...r, start: Math.max(1, Math.min(Number(e.target.value), r.end - 1)) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">To rank</label>
              <input
                type="number"
                min={2}
                max={rankListLen}
                value={rankRange.end}
                onChange={(e) => setRankRange((r) => ({ ...r, end: Math.max(r.start + 1, Math.min(Number(e.target.value), rankListLen)) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {(() => {
            const n = rankRange.end - rankRange.start + 1;
            const pairs = (n * (n - 1)) / 2;
            return (
              <p className="text-xs text-slate-500">
                {n} robots · {pairs} comparison{pairs !== 1 ? "s" : ""}
                {pairs > 30 && <span className="text-yellow-400 ml-2">⚠ Large range — consider narrowing</span>}
              </p>
            );
          })()}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setRankPhase("idle")}>Cancel</Button>
            <Button size="sm" onClick={() => startRankingGame(rankTarget)}>Start</Button>
          </div>
        </div>
      </Modal>

      {/* Comparing */}
      <Modal
        open={rankPhase === "comparing"}
        onClose={finishRankingEarly}
        title={`Rank Game — ${rankPairIdx + 1} / ${rankPairs.length}`}
        size="xl"
      >
        {rankPhase === "comparing" && rankPairs.length > 0 && (() => {
          const [numA, numB] = rankPairs[rankPairIdx];
          const sA = allStatsMap.get(numA);
          const sB = allStatsMap.get(numB);
          const tdA = teamDataMap.get(numA);
          const tdB = teamDataMap.get(numB);

          function TeamPanel({ num, stats, td }: { num: number; stats: any; td: TeamData | undefined }) {
            return (
              <div className="flex flex-col items-center gap-2 text-center">
                {td?.photoUrl ? (
                  <img src={td.photoUrl} alt="" className="w-32 h-32 object-cover rounded-lg bg-slate-800" />
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-slate-800 flex items-center justify-center text-4xl">🤖</div>
                )}
                <p className="text-lg font-bold text-slate-100">{num}</p>
                <p className="text-xs text-slate-400">{stats?.nickname ?? ""}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mt-1">
                  <span className="text-slate-500 text-right">OPR</span>
                  <span className="text-slate-200">{stats?.opr?.toFixed(1) ?? "—"}</span>
                  <span className="text-slate-500 text-right">EPA</span>
                  <span className="text-slate-200">{stats?.epa?.toFixed(1) ?? "—"}</span>
                  <span className="text-slate-500 text-right">Avg Balls</span>
                  <span className="text-slate-200">{stats?.avgMatchBalls?.toFixed(1) ?? "—"}</span>
                  <span className="text-slate-500 text-right">Max Balls</span>
                  <span className="text-slate-200">{stats?.maxMatchBalls?.toFixed(1) ?? "—"}</span>
                </div>
                {(flagsByTeam.get(num)?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center">
                    <FlagBadges flags={flagsByTeam.get(num)} />
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <TeamPanel num={numA} stats={sA} td={tdA} />
                <TeamPanel num={numB} stats={sB} td={tdB} />
              </div>
              {sA && sB && config && (() => {
                const numStatF = (s: typeof sA, id: string) => {
                  const f = s?.fieldStats[id];
                  return f?.type === "numeric" && f.count > 0 ? f.avg : 0;
                };
                const rawA = {
                  teamNumber: numA,
                  autoBalls: numStatF(sA, "auto_avg_balls_cycle") * numStatF(sA, "auto_shoot_cycles"),
                  teleBalls: numStatF(sA, "tele_avg_balls_shot") * numStatF(sA, "tele_shoot_cycles"),
                  fedBalls: numStatF(sA, "tele_avg_balls_fed") * numStatF(sA, "tele_feed_cycles"),
                  epa: Math.max(0, sA.epa ?? 0),
                };
                const rawB = {
                  teamNumber: numB,
                  autoBalls: numStatF(sB, "auto_avg_balls_cycle") * numStatF(sB, "auto_shoot_cycles"),
                  teleBalls: numStatF(sB, "tele_avg_balls_shot") * numStatF(sB, "tele_shoot_cycles"),
                  fedBalls: numStatF(sB, "tele_avg_balls_fed") * numStatF(sB, "tele_feed_cycles"),
                  epa: Math.max(0, sB.epa ?? 0),
                };
                const om = computeOffenseMetrics([rawA, rawB]);
                return (
                  <>
                    <TeamRadarChart
                      stats={sA}
                      statsB={sB}
                      labelA={`Team ${numA}`}
                      labelB={`Team ${numB}`}
                      fields={config.matchFields as any}
                    />
                    <OffenseRadarChart
                      metrics={om[numA]}
                      metricsB={om[numB]}
                      alliance="red"
                      labelA={`Team ${numA}`}
                      labelB={`Team ${numB}`}
                    />
                  </>
                );
              })()}
              <p className="text-center text-sm text-slate-400">Which robot should rank higher?</p>
              <div className="grid grid-cols-3 gap-3">
                <Button onClick={() => handleRankPick(numA)} className="w-full">← Team {numA}</Button>
                <Button variant="ghost" size="sm" onClick={handleRankSkipOrStop} className="w-full">Skip</Button>
                <Button onClick={() => handleRankPick(numB)} className="w-full">Team {numB} →</Button>
              </div>
              <div className="text-center">
                <button
                  onClick={finishRankingEarly}
                  className="text-xs text-slate-500 hover:text-slate-300 underline"
                >
                  Stop early and see results
                </button>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(rankPairIdx / rankPairs.length) * 100}%` }}
                />
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Results */}
      <Modal
        open={rankPhase === "results"}
        onClose={() => setRankPhase("idle")}
        title="Ranking Results"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Based on {rankPairIdx} comparison{rankPairIdx !== 1 ? "s" : ""}, here's how ranks would change within positions {rankRange.start}–{rankRange.end}:
          </p>
          <div className="max-h-72 overflow-y-auto">
            <div className="grid grid-cols-4 text-xs text-slate-500 pb-1 border-b border-slate-800 mb-1">
              <span>Team</span>
              <span className="text-center">Old</span>
              <span className="text-center">New</span>
              <span className="text-right">Change</span>
            </div>
            {rankResults.map((r) => (
              <div key={r.teamNumber} className="grid grid-cols-4 text-sm py-1.5 border-b border-slate-800/40">
                <span className="font-medium text-slate-200">{r.teamNumber}</span>
                <span className="text-center text-slate-400">{r.oldRank}</span>
                <span className="text-center text-slate-400">{r.newRank}</span>
                <span className={`text-right font-medium ${r.delta > 0 ? "text-green-400" : r.delta < 0 ? "text-red-400" : "text-slate-500"}`}>
                  {r.delta > 0 ? `↑${r.delta}` : r.delta < 0 ? `↓${Math.abs(r.delta)}` : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setRankPhase("idle")}>Discard</Button>
            <Button size="sm" onClick={applyRankingResults}>
              Apply to {rankTarget === "consensus" ? "Team List" : "My Pick List"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  // ── CONSENSUS VIEW ────────────────────────────────────────────────────────
  if (view === "consensus") {
    return (
      <div className="flex flex-col h-full">
        {tabBar}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-slate-100">Team Pick List</h2>
            {role === "admin" && localConsensus.length > 1 && (
              <button
                onClick={() => {
                  setRankTarget("consensus");
                  setRankRange({ start: 1, end: Math.min(localConsensus.length, 10) });
                  setRankPhase("setup");
                }}
                className="px-3 py-1 rounded-lg text-xs bg-purple-800 border border-purple-600 text-purple-200 hover:bg-purple-700 transition-colors"
              >
                Rank Game
              </button>
            )}
          </div>
          {role === "admin" && (
            <Button size="sm" onClick={handleGenerateConsensus} disabled={generating}>
              {generating ? <Spinner size="sm" /> : "Generate"}
            </Button>
          )}
        </div>

        {consensusList === undefined ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        ) : !consensusList ? (
          <div className="p-6 text-slate-500 text-sm text-center">
            No consensus list yet.{" "}
            {role === "admin"
              ? 'Click "Generate" once scouts have marked ready.'
              : "Ask an admin to generate."}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={role === "admin" ? handleConsensusDragEnd : undefined}
            >
              <SortableContext
                items={localConsensus.map((t) => t.teamNumber)}
                strategy={verticalListSortingStrategy}
              >
                {localConsensus.map((team, i) => (
                  <ConsensusRow
                    key={team.teamNumber}
                    team={team}
                    rank={i + 1}
                    data={teamDataMap.get(team.teamNumber)}
                    flags={flagsByTeam.get(team.teamNumber)}
                    draggable={role === "admin"}
                    onPreview={setPreviewTeam}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        <CompareModal
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          teamsList={sortedTeamsList}
          flagsByTeam={flagsByTeam}
          teamDataMap={teamDataMap}
          event={event}
          config={config as any}
        />
        {previewTeam !== null && (
          <TeamQuickViewModal
            teamNumber={previewTeam}
            event={event}
            config={config as any}
            allStats={allStats as any}
            onClose={() => setPreviewTeam(null)}
          />
        )}
        {rankGameModals}
      </div>
    );
  }

  // ── MY PICK LIST VIEW ─────────────────────────────────────────────────────
  const isReady = myList?.isSubmitted ?? false;

  return (
    <div className="flex flex-col h-full">
      {tabBar}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-slate-100">My Pick List</h2>
          <button
            onClick={() => {
              setRankTarget("mine");
              setRankRange({ start: 1, end: Math.min(localList.length, 10) });
              setRankPhase("setup");
            }}
            className="px-3 py-1 rounded-lg text-xs bg-purple-800 border border-purple-600 text-purple-200 hover:bg-purple-700 transition-colors"
          >
            Rank Game
          </button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className={`text-sm ${isReady ? "text-green-400" : "text-slate-400"}`}>
            {isReady ? "Ready ✓" : "Not ready"}
          </span>
          <input
            type="checkbox"
            checked={isReady}
            onChange={(e) =>
              event &&
              setReadyMutation({ eventKey: event.eventKey, isReady: e.target.checked })
            }
            className="w-4 h-4 accent-green-500"
          />
        </label>
      </div>

      {localList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleMyDragEnd}
          >
            <SortableContext
              items={localList.map((t) => t.teamNumber)}
              strategy={verticalListSortingStrategy}
            >
              {localList.map((team, i) => (
                <SortableTeamRow
                  key={team.teamNumber}
                  team={team}
                  rank={i + 1}
                  data={teamDataMap.get(team.teamNumber)}
                  flags={flagsByTeam.get(team.teamNumber)}
                  onToggleDnp={() => {
                    userEdited.current = true;
                    setLocalList((prev) =>
                      prev.map((t) =>
                        t.teamNumber === team.teamNumber ? { ...t, dnp: !t.dnp } : t,
                      ),
                    );
                  }}
                  onNotesChange={(n) => {
                    userEdited.current = true;
                    setLocalList((prev) =>
                      prev.map((t) =>
                        t.teamNumber === team.teamNumber ? { ...t, notes: n } : t,
                      ),
                    );
                  }}
                  onPreview={setPreviewTeam}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      <CompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        teamsList={sortedTeamsList}
        flagsByTeam={flagsByTeam}
        teamDataMap={teamDataMap}
        event={event}
        config={config as any}
      />
      {previewTeam !== null && (
        <TeamQuickViewModal
          teamNumber={previewTeam}
          event={event}
          config={config as any}
          allStats={allStats as any}
          onClose={() => setPreviewTeam(null)}
        />
      )}

      {rankGameModals}
    </div>
  );
}
