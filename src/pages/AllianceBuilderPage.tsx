import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";

type AllianceSlot = { captain: number | null; pick1: number | null; pick2: number | null };

const EMPTY_BOARD: AllianceSlot[] = Array.from({ length: 8 }, () => ({
  captain: null,
  pick1: null,
  pick2: null,
}));

function slotTeams(board: AllianceSlot[]): Set<number> {
  const picked = new Set<number>();
  for (const a of board) {
    if (a.captain) picked.add(a.captain);
    if (a.pick1) picked.add(a.pick1);
    if (a.pick2) picked.add(a.pick2);
  }
  return picked;
}

function TeamDropdown({
  value,
  onChange,
  teams,
  pickedElsewhere,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  teams: Array<{ teamNumber: number; nickname: string }>;
  pickedElsewhere: Set<number>;
  placeholder: string;
}) {
  const available = teams.filter((t) => !pickedElsewhere.has(t.teamNumber) || t.teamNumber === value);
  const selected = value ? teams.find((t) => t.teamNumber === value) : null;
  return (
    <div className="relative w-full">
      <div className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 min-h-[2.75rem] flex flex-col justify-center pointer-events-none">
        {selected ? (
          <>
            <span className="text-xs font-medium text-slate-200 leading-tight">{selected.teamNumber}</span>
            <span className="text-xs text-slate-400 leading-tight truncate">{selected.nickname}</span>
          </>
        ) : (
          <span className="text-xs text-slate-500">{placeholder}</span>
        )}
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {available.map((t) => (
          <option key={t.teamNumber} value={t.teamNumber}>
            {t.teamNumber} — {t.nickname}
          </option>
        ))}
      </select>
    </div>
  );
}

type Mode = "prediction" | "actual";
const MODE_KEY = "frc_alliance_board_mode";

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "actual" ? "actual" : "prediction";
  } catch {
    return "prediction";
  }
}

function parseBoard(json: string | undefined | null): AllianceSlot[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length === 8) return parsed;
  } catch {
    // ignore malformed data
  }
  return null;
}

const ALLIANCE_COLORS = [
  "border-red-700/60",
  "border-blue-700/60",
  "border-green-700/60",
  "border-yellow-700/60",
  "border-purple-700/60",
  "border-orange-700/60",
  "border-pink-700/60",
  "border-teal-700/60",
];

export default function AllianceBuilderPage() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const profile = useQuery(api.users.getCurrentUserProfile);
  const teams = useQuery(
    api.teams.getTeamsForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const allStats = useQuery(
    api.stats.getAllTeamStats,
    event && config ? { eventKey: event.eventKey, configId: config._id } : "skip",
  );
  const myTeamSetting = useQuery(api.appSettings.getAppSetting, { key: "myTeamNumber" });
  // Old shared board (before predictions were per user). Used to seed a
  // user's first prediction so earlier work isn't lost.
  const legacyBoard = useQuery(
    api.appSettings.getAppSetting,
    event ? { key: `allianceBoard_${event.eventKey}` } : "skip",
  );
  const myPrediction = useQuery(
    api.allianceSelection.getMyPrediction,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const selection = useQuery(
    api.allianceSelection.getAllianceSelection,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const savePrediction = useMutation(api.allianceSelection.saveMyPrediction);
  const setActualSlot = useMutation(api.allianceSelection.setActualSlot);
  const clearActual = useMutation(api.allianceSelection.clearActualBoard);

  const isAdmin = profile?.role === "admin";
  const [mode, setModeState] = useState<Mode>(readMode);
  const [prediction, setPrediction] = useState<AllianceSlot[]>(EMPTY_BOARD);
  const [predictionLoaded, setPredictionLoaded] = useState(false);
  const [actual, setActual] = useState<AllianceSlot[]>(EMPTY_BOARD);
  const [actualError, setActualError] = useState<string | null>(null);

  function setMode(m: Mode) {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // storage unavailable — mode just won't be remembered
    }
  }

  // Load this user's prediction once
  useEffect(() => {
    if (predictionLoaded) return;
    if (myPrediction === undefined || legacyBoard === undefined || myTeamSetting === undefined) return;
    if (myPrediction) {
      setPrediction(myPrediction.board);
    } else {
      const legacy = parseBoard(legacyBoard?.value);
      if (legacy) {
        setPrediction(legacy);
      } else {
        const myTeam = myTeamSetting?.value ? Number(myTeamSetting.value) : null;
        if (myTeam) {
          const next = EMPTY_BOARD.map((a) => ({ ...a }));
          next[0].captain = myTeam;
          setPrediction(next);
        }
      }
    }
    setPredictionLoaded(true);
  }, [myPrediction, legacyBoard, myTeamSetting, predictionLoaded]);

  // Actual board follows the server live
  useEffect(() => {
    setActual(selection?.actualBoard ?? EMPTY_BOARD);
  }, [selection?.updatedAt, selection?._id]);

  const sortedTeams = useMemo(
    () => (teams ? [...teams].sort((a, b) => a.teamNumber - b.teamNumber) : []),
    [teams],
  );

  const statsMap = useMemo(
    () => new Map((allStats ?? []).map((s) => [s.teamNumber, s])),
    [allStats],
  );

  const canEdit = mode === "prediction" || isAdmin;
  const board = mode === "prediction" ? prediction : actual;

  function updateSlot(allianceIdx: number, slot: keyof AllianceSlot, value: number | null) {
    if (!event) return;
    // A team can only hold one slot on the whole board (including its own alliance)
    if (value !== null && board[allianceIdx][slot] !== value && slotTeams(board).has(value)) return;
    const next = board.map((a) => ({ ...a }));
    next[allianceIdx][slot] = value;

    if (mode === "prediction") {
      setPrediction(next);
      savePrediction({ eventKey: event.eventKey, board: next }).catch(() => {});
      return;
    }
    if (!isAdmin) return;
    setActual(next);
    setActualError(null);
    setActualSlot({ eventKey: event.eventKey, allianceIndex: allianceIdx, slot, teamNumber: value }).catch(
      (e) => {
        setActual(selection?.actualBoard ?? EMPTY_BOARD);
        setActualError(e instanceof Error ? e.message : "Couldn't save that change");
      },
    );
  }

  function clearBoard() {
    if (!event) return;
    if (mode === "prediction") {
      if (!confirm("Clear your predicted alliances?")) return;
      const empty = EMPTY_BOARD.map((a) => ({ ...a }));
      setPrediction(empty);
      savePrediction({ eventKey: event.eventKey, board: empty }).catch(() => {});
      return;
    }
    if (!isAdmin) return;
    if (!confirm("Clear the actual alliances? Those teams will be un-picked on the Selection tab.")) return;
    setActual(EMPTY_BOARD);
    clearActual({ eventKey: event.eventKey }).catch(() => {});
  }

  const allPicked = slotTeams(board);

  if (!event)
    return <div className="p-6 text-center text-slate-400">No active event.</div>;

  if (!teams || !allStats)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  function allianceStats(slot: AllianceSlot) {
    const nums = [slot.captain, slot.pick1, slot.pick2].filter(Boolean) as number[];
    const stats = nums.map((n) => statsMap.get(n)).filter(Boolean);
    const opr = stats.reduce((s, t) => s + (t?.opr ?? 0), 0);
    const epa = stats.reduce((s, t) => s + (t?.epa ?? 0), 0);
    const balls = stats.reduce((s, t) => s + (t?.avgMatchBalls ?? 0), 0);
    return { opr, epa, balls, count: stats.length };
  }

  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-slate-100">Alliances</h2>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
          {(["prediction", "actual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                mode === m ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {m === "prediction" ? "Prediction" : "Actual"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {mode === "prediction"
            ? "Your own guess. Only you can see it."
            : isAdmin
              ? "Live for everyone. Teams you enter are marked picked on the Selection tab."
              : "Live view. Admins enter alliances as they're announced."}
        </p>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={clearBoard}>
            <span className="text-red-400">Clear</span>
          </Button>
        )}
      </div>

      {actualError && mode === "actual" && (
        <p className="text-xs text-red-400">{actualError}</p>
      )}

      {mode === "prediction" && !predictionLoaded ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-2">
          {board.map((alliance, i) => {
            const { opr, epa, balls, count } = allianceStats(alliance);
            return (
              <div
                key={i}
                className={`bg-slate-900 rounded-xl border ${ALLIANCE_COLORS[i]} p-3`}
              >
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs font-bold text-slate-400 w-20 shrink-0">
                    Alliance {i + 1}
                  </span>
                  {count > 0 && (
                    <div className="flex gap-3 ml-auto text-xs text-slate-400">
                      <span>OPR <span className="text-slate-200 font-medium">{opr.toFixed(1)}</span></span>
                      <span>EPA <span className="text-slate-200 font-medium">{epa.toFixed(1)}</span></span>
                      <span>~Balls <span className="text-slate-200 font-medium">{balls.toFixed(1)}</span></span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["captain", "pick1", "pick2"] as const).map((slot, si) => (
                    <div key={slot}>
                      <p className="text-xs text-slate-500 mb-1">
                        {si === 0 ? "Captain" : `Pick ${si}`}
                      </p>
                      {canEdit ? (
                        <TeamDropdown
                          value={alliance[slot]}
                          onChange={(v) => updateSlot(i, slot, v)}
                          teams={sortedTeams}
                          pickedElsewhere={allPicked}
                          placeholder="—"
                        />
                      ) : (
                        <div className="min-h-[2.75rem] flex flex-col justify-center">
                          {alliance[slot] ? (
                            <>
                              <span className="text-xs font-medium text-slate-300 leading-tight">{alliance[slot]}</span>
                              <span className="text-xs text-slate-400 leading-tight truncate">{statsMap.get(alliance[slot]!)?.nickname ?? ""}</span>
                            </>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
