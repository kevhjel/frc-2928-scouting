import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
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
import Modal from "../components/ui/Modal";
import PickListTabs from "../components/picklist/PickListTabs";
import {
  TeamData,
  TeamPhoto,
  FlagBadges,
  CompareModal,
  TeamQuickViewModal,
} from "../components/picklist/PickListShared";

type RowProps = {
  teamNumber: number;
  rank: number | null;
  data?: TeamData;
  flags?: string[];
  dnpCount: number;
  picked: boolean;
  canEdit: boolean;
  compareSelected: boolean;
  onTogglePicked: () => void;
  onToggleCompare: () => void;
  onPreview: () => void;
};

function SelectionRow({
  teamNumber,
  rank,
  data,
  flags,
  dnpCount,
  picked,
  canEdit,
  compareSelected,
  onTogglePicked,
  onToggleCompare,
  onPreview,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: teamNumber,
    disabled: !canEdit || picked,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 ${
        picked ? "opacity-50" : ""
      } ${compareSelected ? "bg-purple-950/40" : ""}`}
    >
      {canEdit && !picked && (
        <div
          {...attributes}
          {...listeners}
          className="text-slate-500 cursor-grab active:cursor-grabbing select-none flex items-center self-stretch px-2 -mx-1 touch-none"
        >
          ⠿
        </div>
      )}
      <span className="w-6 text-xs text-slate-500 text-right shrink-0">{rank ?? ""}</span>
      <TeamPhoto url={data?.photoUrl ?? null} />
      <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
        <button
          onClick={onPreview}
          className={`font-medium text-sm underline-offset-2 hover:underline ${
            picked ? "text-slate-400 line-through" : "text-blue-300 hover:text-blue-200"
          }`}
        >
          {teamNumber}
        </button>
        {data?.epa !== null && data?.epa !== undefined && (
          <span className="text-xs text-slate-500">EPA {data.epa.toFixed(1)}</span>
        )}
        {!picked && <FlagBadges flags={flags} />}
        {!picked && dnpCount > 0 && <Badge color="red">DNP×{dnpCount}</Badge>}
      </div>
      {!picked && (
        <button
          onClick={onToggleCompare}
          aria-label={`Compare ${teamNumber}`}
          className={`text-xs px-2 py-1.5 rounded border shrink-0 transition-colors ${
            compareSelected
              ? "border-purple-500 text-purple-200 bg-purple-900/40"
              : "border-slate-700 text-slate-500 hover:border-purple-600"
          }`}
        >
          ⇄
        </button>
      )}
      {canEdit && (
        <button
          onClick={onTogglePicked}
          className={`text-xs px-3 py-1.5 rounded border shrink-0 font-medium transition-colors ${
            picked
              ? "border-slate-700 text-slate-400 hover:border-slate-500"
              : "border-green-700 text-green-300 bg-green-900/20 hover:bg-green-900/40"
          }`}
        >
          {picked ? "Undo" : "Picked"}
        </button>
      )}
    </div>
  );
}

export default function AllianceSelectionPage() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const role = useRole();
  const canEdit = role === "admin";

  const board = useQuery(
    api.allianceSelection.getAllianceSelection,
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

  const startBoard = useMutation(api.allianceSelection.startFromTeamList);
  const setOrder = useMutation(api.allianceSelection.setOrder);
  const setPicked = useMutation(api.allianceSelection.setPicked);

  // Local copies so drags and taps feel instant; server updates overwrite them.
  const [localOrder, setLocalOrder] = useState<number[]>([]);
  const [localPicked, setLocalPicked] = useState<number[]>([]);
  const [compareSel, setCompareSel] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<number | null>(null);
  const [showPicked, setShowPicked] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!board) return;
    setLocalOrder(board.order);
    setLocalPicked(board.picked);
  }, [board?.updatedAt, board?._id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const teamDataMap = useMemo<Map<number, TeamData>>(() => {
    const map = new Map<number, TeamData>();
    if (allStats) {
      for (const s of allStats)
        map.set(s.teamNumber, { photoUrl: s.pitPhotoUrl ?? s.robotPhotoUrl, opr: s.opr, epa: s.epa });
    } else if (teamsList) {
      for (const t of teamsList)
        map.set(t.teamNumber, {
          photoUrl: (t as any).robotPhotoUrl ?? null,
          opr: t.opr ?? null,
          epa: t.epa ?? null,
        });
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

  const dnpByTeam = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of consensusList?.rankedTeams ?? []) map.set(t.teamNumber, t.dnpCount);
    return map;
  }, [consensusList]);

  // Full order, plus any event teams that were added after the board started
  const fullOrder = useMemo(() => {
    const seen = new Set(localOrder);
    const extra = (teamsList ?? [])
      .filter((t) => !seen.has(t.teamNumber))
      .map((t) => t.teamNumber);
    return [...localOrder, ...extra];
  }, [localOrder, teamsList]);

  const pickedSet = useMemo(() => new Set(localPicked), [localPicked]);
  const available = fullOrder.filter((n) => !pickedSet.has(n));
  // Picked section lists teams in the order they were taken
  const pickedInOrder = localPicked.filter((n) => fullOrder.includes(n));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !event) return;
    const moved = arrayMove(
      available,
      available.indexOf(active.id as number),
      available.indexOf(over.id as number),
    );
    // Put the reordered available teams back into the non-picked slots,
    // leaving picked teams where they were.
    let i = 0;
    const next = fullOrder.map((n) => (pickedSet.has(n) ? n : moved[i++]));
    setLocalOrder(next);
    setOrder({ eventKey: event.eventKey, order: next }).catch(() => {
      if (board) setLocalOrder(board.order);
    });
  }

  function togglePicked(teamNumber: number) {
    if (!event) return;
    const nowPicked = !pickedSet.has(teamNumber);
    setLocalPicked((prev) =>
      nowPicked ? [...prev.filter((n) => n !== teamNumber), teamNumber] : prev.filter((n) => n !== teamNumber),
    );
    if (nowPicked) setCompareSel((prev) => prev.filter((n) => n !== teamNumber));
    setPicked({ eventKey: event.eventKey, teamNumber, picked: nowPicked }).catch(() => {
      if (board) setLocalPicked(board.picked);
    });
  }

  function toggleCompare(teamNumber: number) {
    setCompareSel((prev) => {
      if (prev.includes(teamNumber)) return prev.filter((n) => n !== teamNumber);
      return [...prev, teamNumber].slice(-2);
    });
  }

  async function handleStart(clearPicked: boolean) {
    if (!event) return;
    setStarting(true);
    try {
      await startBoard({ eventKey: event.eventKey, clearPicked });
    } finally {
      setStarting(false);
      setConfirmReset(false);
    }
  }

  if (!event) return <div className="p-6 text-center text-slate-400">No active event.</div>;

  const sortedTeamsList = teamsList ? [...teamsList].sort((a, b) => a.teamNumber - b.teamNumber) : [];
  const compareReady = compareSel.length === 2;

  return (
    <div className="flex flex-col h-full">
      <PickListTabs
        onCompare={() => {
          setCompareOpen(true);
        }}
      />

      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950 shrink-0">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-100">Alliance Selection</h2>
          {board && (
            <p className="text-xs text-slate-500">
              {available.length} available · {pickedInOrder.length} picked
            </p>
          )}
        </div>
        {canEdit && board && (
          <Button size="sm" variant="secondary" onClick={() => setConfirmReset(true)}>
            Reload
          </Button>
        )}
      </div>

      {board === undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      ) : !board ? (
        <div className="p-6 text-center space-y-3">
          <p className="text-slate-400 text-sm">
            Alliance selection hasn't started for this event.
          </p>
          {canEdit ? (
            <>
              <p className="text-slate-500 text-xs">
                {consensusList
                  ? "The board starts from the current Team List order."
                  : "No Team List yet, so the board will start in EPA order."}
              </p>
              <Button onClick={() => handleStart(true)} disabled={starting}>
                {starting ? <Spinner size="sm" /> : "Start alliance selection"}
              </Button>
            </>
          ) : (
            <p className="text-slate-500 text-xs">Ask an admin to start it.</p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={canEdit ? handleDragEnd : undefined}>
            <SortableContext items={available} strategy={verticalListSortingStrategy}>
              {available.map((n, i) => (
                <SelectionRow
                  key={n}
                  teamNumber={n}
                  rank={i + 1}
                  data={teamDataMap.get(n)}
                  flags={flagsByTeam.get(n)}
                  dnpCount={dnpByTeam.get(n) ?? 0}
                  picked={false}
                  canEdit={canEdit}
                  compareSelected={compareSel.includes(n)}
                  onTogglePicked={() => togglePicked(n)}
                  onToggleCompare={() => toggleCompare(n)}
                  onPreview={() => setPreviewTeam(n)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {pickedInOrder.length > 0 && (
            <>
              <button
                onClick={() => setShowPicked((s) => !s)}
                className="w-full flex items-center justify-between px-4 py-2 bg-slate-900 border-y border-slate-800 text-xs text-slate-400"
              >
                <span>Picked ({pickedInOrder.length})</span>
                <span>{showPicked ? "Hide" : "Show"}</span>
              </button>
              {showPicked && (
                <DndContext sensors={sensors}>
                  <SortableContext items={pickedInOrder} strategy={verticalListSortingStrategy}>
                    {pickedInOrder.map((n) => (
                      <SelectionRow
                        key={n}
                        teamNumber={n}
                        rank={null}
                        data={teamDataMap.get(n)}
                        flags={flagsByTeam.get(n)}
                        dnpCount={0}
                        picked
                        canEdit={canEdit}
                        compareSelected={false}
                        onTogglePicked={() => togglePicked(n)}
                        onToggleCompare={() => {}}
                        onPreview={() => setPreviewTeam(n)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </div>
      )}

      {compareSel.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-purple-950 border-t border-purple-800 shrink-0">
          <span className="text-sm text-purple-200">
            {compareSel[0]} vs {compareSel[1] ?? "…"}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCompareSel([])}>
              Clear
            </Button>
            <Button size="sm" disabled={!compareReady} onClick={() => setCompareOpen(true)}>
              Compare
            </Button>
          </div>
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
        initialTeams={compareReady ? [compareSel[0], compareSel[1]] : null}
      />

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reload from Team List?">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            This replaces the board's order with the current Team List. Any reordering done here will be lost.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => handleStart(false)} disabled={starting}>
              Reload order, keep picks
            </Button>
            <Button variant="danger" onClick={() => handleStart(true)} disabled={starting}>
              Start over (clear picks too)
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

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
