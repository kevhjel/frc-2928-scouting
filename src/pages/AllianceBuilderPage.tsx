import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import { teamMatchScore } from "../lib/teamSearch";

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

type TeamOption = { teamNumber: number; nickname: string };
type SlotKey = keyof AllianceSlot;
const SLOT_LABEL: Record<SlotKey, string> = { captain: "Captain", pick1: "Pick 1", pick2: "Pick 2" };

/** Read-only display of a slot, used as the tap target that opens the picker. */
function SlotButton({
  value,
  nickname,
  onClick,
}: {
  value: number | null;
  nickname?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-slate-800 border border-slate-700 rounded px-2 py-1.5 min-h-[2.75rem] flex flex-col justify-center hover:border-slate-500 active:border-blue-500 transition-colors"
    >
      {value ? (
        <>
          <span className="text-xs font-medium text-slate-200 leading-tight">{value}</span>
          <span className="text-xs text-slate-400 leading-tight truncate">{nickname ?? ""}</span>
        </>
      ) : (
        <span className="text-xs text-slate-500">Tap to set</span>
      )}
    </button>
  );
}

/**
 * Type a team number (or part of a name) and pick from the matches.
 * Anchored to the top of the screen so the phone keyboard doesn't cover it.
 */
function TeamPicker({
  title,
  value,
  teams,
  takenBy,
  onPick,
  onClose,
}: {
  title: string;
  value: number | null;
  teams: TeamOption[];
  /** Teams already on the board, with where they are (e.g. "A2 Pick 1") */
  takenBy: Map<number, string>;
  onPick: (team: number | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return teams;
    // Exact number first, then numbers starting with it, then name matches
    return teams
      .map((t) => ({ t, score: teamMatchScore(t.teamNumber, t.nickname, q) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.t);
  }, [teams, q]);

  function isAvailable(n: number) {
    return n === value || !takenBy.has(n);
  }

  function submit() {
    const exact = matches.find((t) => String(t.teamNumber) === q);
    if (exact && isAvailable(exact.teamNumber)) return onPick(exact.teamNumber);
    const available = matches.filter((t) => isAvailable(t.teamNumber));
    if (available.length === 1) onPick(available[0].teamNumber);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 pt-6 sm:pt-16" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="font-semibold text-slate-100 text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 px-2 py-1" aria-label="Close">
            ✕
          </button>
        </div>
        <form
          className="px-4 pb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Team number or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          {value !== null && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="shrink-0 px-3 rounded-lg border border-red-800 text-red-300 text-sm hover:bg-red-900/30"
            >
              Clear
            </button>
          )}
        </form>
        <div className="overflow-y-auto border-t border-slate-800">
          {matches.length === 0 ? (
            <p className="p-4 text-sm text-slate-500 text-center">No team matches “{query}”.</p>
          ) : (
            matches.map((t) => {
              const available = isAvailable(t.teamNumber);
              const isCurrent = t.teamNumber === value;
              return (
                <button
                  key={t.teamNumber}
                  type="button"
                  disabled={!available}
                  onClick={() => onPick(t.teamNumber)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-800/60 transition-colors ${
                    available ? "hover:bg-slate-800 active:bg-slate-700" : "opacity-40"
                  } ${isCurrent ? "bg-blue-950/50" : ""}`}
                >
                  <span className="w-14 font-semibold text-slate-100">{t.teamNumber}</span>
                  <span className="flex-1 min-w-0 truncate text-sm text-slate-400">{t.nickname}</span>
                  {!available && <span className="text-xs text-slate-500 shrink-0">{takenBy.get(t.teamNumber)}</span>}
                  {isCurrent && <span className="text-xs text-blue-300 shrink-0">current</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
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
  const [pickerFor, setPickerFor] = useState<{ alliance: number; slot: SlotKey } | null>(null);

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

  const teamNickname = useMemo(
    () => new Map(sortedTeams.map((t) => [t.teamNumber, t.nickname])),
    [sortedTeams],
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

  const takenBy = new Map<number, string>();
  board.forEach((a, i) => {
    for (const k of ["captain", "pick1", "pick2"] as const) {
      const n = a[k];
      if (n !== null) takenBy.set(n, `A${i + 1} ${SLOT_LABEL[k]}`);
    }
  });

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
                        <SlotButton
                          value={alliance[slot]}
                          nickname={alliance[slot] ? teamNickname.get(alliance[slot]!) : undefined}
                          onClick={() => setPickerFor({ alliance: i, slot })}
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

      {pickerFor && canEdit && (
        <TeamPicker
          title={`Alliance ${pickerFor.alliance + 1} · ${SLOT_LABEL[pickerFor.slot]}`}
          value={board[pickerFor.alliance][pickerFor.slot]}
          teams={sortedTeams}
          takenBy={takenBy}
          onPick={(team) => {
            updateSlot(pickerFor.alliance, pickerFor.slot, team);
            setPickerFor(null);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}
