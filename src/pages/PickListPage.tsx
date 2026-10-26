import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDragSensors, dragStartHaptic, draggingRowClass, DragHandle } from "../components/picklist/dragKit";
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
import PickListTabs from "../components/picklist/PickListTabs";
import {
  TeamData,
  TeamPhoto,
  FlagBadges,
  CompareModal,
  TeamQuickViewModal,
} from "../components/picklist/PickListShared";

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.teamNumber,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-drag-row
      className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 ${draggingRowClass(isDragging)}`}
    >
      <DragHandle attributes={attributes} listeners={listeners} isDragging={isDragging} />
      <div className="w-6 text-xs text-slate-500 text-right shrink-0">{rank}</div>
      <TeamPhoto url={data?.thumbUrl ?? data?.photoUrl ?? null} />
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
  onDnpClick,
}: {
  team: ConsensusTeam;
  rank: number;
  data?: TeamData;
  flags?: string[];
  draggable: boolean;
  onPreview: (n: number) => void;
  onDnpClick?: (n: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.teamNumber,
    disabled: !draggable,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-drag-row
      className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 last:border-b-0 ${draggingRowClass(isDragging)}`}
    >
      {draggable && (
        <DragHandle attributes={attributes} listeners={listeners} isDragging={isDragging} />
      )}
      <span className="w-6 text-xs text-slate-500 text-right shrink-0">{rank}</span>
      <TeamPhoto url={data?.thumbUrl ?? data?.photoUrl ?? null} />
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
      {team.dnpCount > 0 && (
        <button
          type="button"
          onClick={() => onDnpClick?.(team.teamNumber)}
          className="shrink-0"
        >
          <Badge color="red">DNP×{team.dnpCount}</Badge>
        </button>
      )}
      <span className="text-xs text-slate-600 shrink-0">{team.submissionCount} lists</span>
    </div>
  );
}


type RankResult = { teamNumber: number; oldRank: number; newRank: number; delta: number };

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePairs(teamNumbers: number[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < teamNumbers.length; i++)
    for (let j = i + 1; j < teamNumbers.length; j++)
      pairs.push([teamNumbers[i], teamNumbers[j]]);
  return shuffle(pairs);
}

function generateRandomPairs(teamNumbers: number[], maxCount: number): Array<[number, number]> {
  return generatePairs(teamNumbers).slice(0, maxCount);
}

function generateNeighborhoodPairs(teamNumbers: number[], k: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < teamNumbers.length; i++)
    for (let d = 1; d <= k && i + d < teamNumbers.length; d++)
      pairs.push([teamNumbers[i], teamNumbers[i + d]]);
  return shuffle(pairs);
}

function generateMergeSortPairs(teamNumbers: number[]): Array<[number, number]> {
  const n = teamNumbers.length;
  const pairs: Array<[number, number]> = [];
  // Bottom-up merge sort: record every comparison that would be made
  for (let width = 1; width < n; width *= 2) {
    const passCompares: Array<[number, number]> = [];
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let i = lo, j = mid;
      while (i < mid && j < hi) {
        passCompares.push([teamNumbers[i], teamNumbers[j]]);
        // Simulate merge: assume left wins (preserves current order) for pair generation
        i++;
        if (i >= mid) j++;
      }
    }
    pairs.push(...shuffle(passCompares));
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
  const allUsers = useQuery(api.users.listUsers);
  const allPickLists = useQuery(
    api.pickList.getAllPickLists,
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
  const [dnpPopupTeam, setDnpPopupTeam] = useState<number | null>(null);
  const userEdited = useRef(false);

  // Rank game state
  const [rankPhase, setRankPhase] = useState<"idle" | "setup" | "comparing" | "results">("idle");
  const [rankTarget, setRankTarget] = useState<"mine" | "consensus">("mine");
  const [rankRange, setRankRange] = useState({ start: 1, end: 10 });
  const [rankRangeText, setRankRangeText] = useState({ start: "1", end: "10" });
  const [rankMode, setRankMode] = useState<"full" | "neighborhood" | "random" | "mergesort">("full");
  const [neighborhoodK, setNeighborhoodK] = useState(3);
  const [maxComparisons, setMaxComparisons] = useState("30");
  const [rankPairs, setRankPairs] = useState<Array<[number, number]>>([]);
  const [rankPairIdx, setRankPairIdx] = useState(0);
  const [rankScores, setRankScores] = useState<Map<number, number>>(new Map());
  const [rankResults, setRankResults] = useState<RankResult[]>([]);

  const sensors = useDragSensors();

  const teamDataMap = useMemo<Map<number, TeamData>>(() => {
    const map = new Map<number, TeamData>();
    if (allStats) {
      for (const s of allStats) {
        map.set(s.teamNumber, {
          photoUrl: s.pitPhotoUrl ?? s.robotPhotoUrl,
          thumbUrl: s.pitThumbUrl,
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
    // Parse and clamp the text inputs to valid range values
    const s = Math.max(1, parseInt(rankRangeText.start, 10) || 1);
    const e = Math.max(s + 1, Math.min(parseInt(rankRangeText.end, 10) || s + 1, getRankList().length));
    setRankRange({ start: s, end: e });
    const list = target === "mine" ? localList : localConsensus;
    const sub = list.slice(s - 1, e);
    const nums = sub.map((t) => t.teamNumber);
    let pairs: Array<[number, number]>;
    if (rankMode === "neighborhood") pairs = generateNeighborhoodPairs(nums, neighborhoodK);
    else if (rankMode === "random") pairs = generateRandomPairs(nums, Math.max(1, parseInt(maxComparisons, 10) || 1));
    else if (rankMode === "mergesort") pairs = generateMergeSortPairs(nums);
    else pairs = generatePairs(nums);
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

  // Must stay above the early return below (hooks can't be conditional)
  const userDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of (allUsers as any[] | undefined) ?? []) {
      map.set(u.userId, u.displayName ?? u.email ?? "Unknown");
    }
    return map;
  }, [allUsers]);

  if (!event)
    return <div className="p-6 text-center text-slate-400">No active event.</div>;

  const sortedTeamsList = teamsList
    ? [...teamsList].sort((a, b) => a.teamNumber - b.teamNumber)
    : [];

  const tabBar = <PickListTabs onCompare={() => setCompareOpen(true)} />;

  // ── DNP POPUP MODAL ──────────────────────────────────────────────────────
  const dnpPopupModal = dnpPopupTeam !== null && (
    <Modal
      open={true}
      onClose={() => setDnpPopupTeam(null)}
      title={`DNP Flags — Team ${dnpPopupTeam}`}
    >
      <div className="space-y-2">
        {(() => {
          const scouts = (allPickLists ?? [])
            .filter((pl: any) => pl.rankedTeams.some((t: any) => t.teamNumber === dnpPopupTeam && t.dnp))
            .map((pl: any) => userDisplayMap.get(pl.userId) ?? "Unknown scout");
          if (scouts.length === 0)
            return <p className="text-slate-400 text-sm">No DNP flags found.</p>;
          return scouts.map((name: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-slate-300">{name}</span>
            </div>
          ));
        })()}
      </div>
    </Modal>
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
                type="text"
                inputMode="numeric"
                value={rankRangeText.start}
                onChange={(e) => setRankRangeText((r) => ({ ...r, start: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">To rank</label>
              <input
                type="text"
                inputMode="numeric"
                value={rankRangeText.end}
                onChange={(e) => setRankRangeText((r) => ({ ...r, end: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Mode</label>
            <select
              value={rankMode}
              onChange={(e) => setRankMode(e.target.value as typeof rankMode)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="full">Full — all pairs (O(n²))</option>
              <option value="neighborhood">Neighborhood — ±k window</option>
              <option value="random">Random sample</option>
              <option value="mergesort">Merge sort sequence (O(n log n))</option>
            </select>
          </div>
          {rankMode === "neighborhood" && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Window size k (compare each team to ±k neighbors)</label>
              <input
                type="range"
                min={1}
                max={5}
                value={neighborhoodK}
                onChange={(e) => setNeighborhoodK(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">k = {neighborhoodK}</p>
            </div>
          )}
          {rankMode === "random" && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max comparisons</label>
              <input
                type="text"
                inputMode="numeric"
                value={maxComparisons}
                onChange={(e) => setMaxComparisons(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
          {(() => {
            const s = Math.max(1, parseInt(rankRangeText.start, 10) || 1);
            const e = Math.max(s + 1, Math.min(parseInt(rankRangeText.end, 10) || s + 1, rankListLen));
            const n = e - s + 1;
            let pairCount: number;
            if (rankMode === "neighborhood") pairCount = Math.max(0, neighborhoodK * n - (neighborhoodK * (neighborhoodK + 1)) / 2);
            else if (rankMode === "random") pairCount = Math.min(Math.max(1, parseInt(maxComparisons, 10) || 1), (n * (n - 1)) / 2);
            else if (rankMode === "mergesort") pairCount = Math.round(n * Math.ceil(Math.log2(Math.max(n, 2))));
            else pairCount = (n * (n - 1)) / 2;
            return (
              <p className="text-xs text-slate-500">
                {n} robots · ~{pairCount} comparison{pairCount !== 1 ? "s" : ""}
                {pairCount > 100 && <span className="text-yellow-400 ml-2">⚠ Many pairs</span>}
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

          function TeamPanel({ num, stats, td, color }: { num: number; stats: any; td: TeamData | undefined; color: string }) {
            return (
              <button
                onClick={() => setPreviewTeam(num)}
                className="flex flex-col items-center gap-1.5 text-center w-full cursor-pointer hover:bg-slate-800/50 rounded-lg p-1 transition-colors"
              >
                {td?.photoUrl ? (
                  <img src={td.photoUrl} alt="" className="w-20 h-20 object-cover rounded-lg bg-slate-800" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-800 flex items-center justify-center text-3xl">🤖</div>
                )}
                <p className={`text-base font-bold ${color}`}>{num}</p>
                <p className="text-xs text-slate-400 leading-tight">{stats?.nickname ?? ""}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-0.5">
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
              </button>
            );
          }

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <TeamPanel num={numA} stats={sA} td={tdA} color="text-red-400" />
                <TeamPanel num={numB} stats={sB} td={tdB} color="text-blue-400" />
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
                    <div className="grid grid-cols-2 gap-1">
                      <TeamRadarChart
                        stats={sA}
                        statsB={sB}
                        labelA={`Team ${numA}`}
                        labelB={`Team ${numB}`}
                        fields={config.matchFields as any}
                        height={180}
                      />
                      <OffenseRadarChart
                        metrics={om[numA]}
                        metricsB={om[numB]}
                        alliance="red"
                        labelA={`Team ${numA}`}
                        labelB={`Team ${numB}`}
                        height={180}
                      />
                    </div>
                  </>
                );
              })()}
              <p className="text-center text-sm text-slate-400">Which robot should rank higher?</p>
              <div className="grid grid-cols-3 gap-3">
                <Button onClick={() => handleRankPick(numA)} className="w-full"><span className="text-red-400">{numA}</span> is better</Button>
                <Button variant="ghost" size="sm" onClick={handleRankSkipOrStop} className="w-full">Skip</Button>
                <Button onClick={() => handleRankPick(numB)} className="w-full"><span className="text-blue-400">{numB}</span> is better</Button>
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
              sensors={sensors} onDragStart={dragStartHaptic}
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
                    onDnpClick={setDnpPopupTeam}
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
        {rankGameModals}
        {dnpPopupModal}
        {previewTeam !== null && (
          <TeamQuickViewModal
            teamNumber={previewTeam}
            event={event}
            config={config as any}
            allStats={allStats as any}
            onClose={() => setPreviewTeam(null)}
          />
        )}
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
            sensors={sensors} onDragStart={dragStartHaptic}
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
                    setLocalList((prev) => {
                      const updated = prev.map((t) =>
                        t.teamNumber === team.teamNumber ? { ...t, dnp: !t.dnp } : t,
                      );
                      const nowDnp = updated.find((t) => t.teamNumber === team.teamNumber)?.dnp;
                      if (nowDnp) {
                        // Move to bottom of list
                        const idx = updated.findIndex((t) => t.teamNumber === team.teamNumber);
                        const [moved] = updated.splice(idx, 1);
                        updated.push(moved);
                      }
                      return updated;
                    });
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
      {rankGameModals}
      {dnpPopupModal}
      {previewTeam !== null && (
        <TeamQuickViewModal
          teamNumber={previewTeam}
          event={event}
          config={config as any}
          allStats={allStats as any}
          onClose={() => setPreviewTeam(null)}
        />
      )}
    </div>
  );
}
