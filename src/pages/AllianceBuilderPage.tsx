import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import Card from "../components/ui/Card";
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
  const boardKey = event ? `allianceBoard_${event.eventKey}` : null;
  const savedBoard = useQuery(
    api.appSettings.getAppSetting,
    boardKey ? { key: boardKey } : "skip",
  );
  const setAppSetting = useMutation(api.appSettings.setAppSetting);

  const [board, setBoard] = useState<AllianceSlot[]>(EMPTY_BOARD);
  const [initialized, setInitialized] = useState(false);

  // Load board from appSettings once available
  useEffect(() => {
    if (initialized) return;
    if (savedBoard === undefined) return; // still loading
    if (savedBoard?.value) {
      try {
        const parsed = JSON.parse(savedBoard.value);
        if (Array.isArray(parsed) && parsed.length === 8) {
          setBoard(parsed);
          setInitialized(true);
          return;
        }
      } catch {}
    }
    // No saved board — pre-fill alliance 1 captain from myTeamNumber if admin
    const myTeam = myTeamSetting?.value ? Number(myTeamSetting.value) : null;
    if (myTeam && profile?.role === "admin") {
      setBoard((b) => {
        const next = b.map((a) => ({ ...a }));
        next[0].captain = myTeam;
        return next;
      });
    }
    setInitialized(true);
  }, [savedBoard, myTeamSetting, profile, initialized]);

  const isAdmin = profile?.role === "admin";

  const sortedTeams = useMemo(
    () => (teams ? [...teams].sort((a, b) => a.teamNumber - b.teamNumber) : []),
    [teams],
  );

  const statsMap = useMemo(
    () => new Map((allStats ?? []).map((s) => [s.teamNumber, s])),
    [allStats],
  );

  function updateSlot(
    allianceIdx: number,
    slot: keyof AllianceSlot,
    value: number | null,
  ) {
    if (!isAdmin) return;
    setBoard((prev) => {
      const next = prev.map((a) => ({ ...a }));
      next[allianceIdx][slot] = value;
      const json = JSON.stringify(next);
      if (boardKey) setAppSetting({ key: boardKey, value: json }).catch(() => {});
      return next;
    });
  }

  function clearBoard() {
    if (!isAdmin) return;
    if (!confirm("Clear the entire alliance board?")) return;
    const empty = EMPTY_BOARD.map((a) => ({ ...a }));
    setBoard(empty);
    if (boardKey) setAppSetting({ key: boardKey, value: JSON.stringify(empty) }).catch(() => {});
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

  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-100">Alliance Selection Board</h2>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={clearBoard}>
            <span className="text-red-400">Clear Board</span>
          </Button>
        )}
      </div>

      {!isAdmin && (
        <p className="text-xs text-slate-500">View only — admins can edit the board.</p>
      )}

      <div className="space-y-2">
        {board.map((alliance, i) => {
          const { opr, epa, balls, count } = allianceStats(alliance);
          const pickedElsewhere = new Set<number>();
          for (const t of allPicked) {
            if (t !== alliance.captain && t !== alliance.pick1 && t !== alliance.pick2) {
              pickedElsewhere.add(t);
            }
          }

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
                    {isAdmin ? (
                      <TeamDropdown
                        value={alliance[slot]}
                        onChange={(v) => updateSlot(i, slot, v)}
                        teams={sortedTeams}
                        pickedElsewhere={pickedElsewhere}
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
    </div>
  );
}
