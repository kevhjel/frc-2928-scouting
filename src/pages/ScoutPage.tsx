import { useState, useMemo, useEffect } from "react";
import { useNavVisibility } from "../context/NavVisibility";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import { enqueue, dequeue } from "../lib/offlineStorage";
import { EntryData } from "../lib/configTypes";
import DynamicScoutingForm from "../components/forms/DynamicScoutingForm";
import Spinner from "../components/ui/Spinner";
import Card from "../components/ui/Card";
import { PRESET_TAGS } from "../../convex/teamFlags";

function formatMatchTime(predictedTime?: number | null): string {
  if (!predictedTime) return "";
  return new Date(predictedTime * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

type Alliance = "red" | "blue";
type Position = 1 | 2 | 3;

function PitQuestionWidget({ eventKey, teamNumber }: { eventKey: string; teamNumber: number }) {
  const addQuestion = useMutation(api.pitQuestions.addQuestion);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      await addQuestion({ eventKey, teamNumber, question: text.trim() });
      setText("");
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 font-medium">Pit Questions</p>
      <p className="text-xs text-slate-500">Ask the pit crew something about Team {teamNumber}.</p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="e.g. What is their climb strategy?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || saving}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors shrink-0"
        >
          {saving ? "…" : sent ? "✓" : "Send"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function ScoutPage() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const submitEntry = useMutation(api.matchScouting.submitMatchEntry);
  const addFlag = useMutation(api.teamFlags.addFlag);
  const allAssignments = useQuery(
    api.matchAssignments.getMyAssignmentsFull,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const matches = useQuery(
    api.matches.getMatchesForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const coverage = useQuery(
    api.matchScouting.getScoutingCoverage,
    event ? { eventKey: event.eventKey } : "skip",
  );

  const [matchKey, setMatchKey] = useState("");
  const [teamNumber, setTeamNumber] = useState("");
  const [alliance, setAlliance] = useState<Alliance>("red");
  const [position, setPosition] = useState<Position>(1);
  const [submitted, setSubmitted] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  const { setHasUnsavedData } = useNavVisibility();
  useEffect(() => {
    const active = !!(matchKey && teamNumber && !submitted);
    setHasUnsavedData(active);
    return () => setHasUnsavedData(false);
  }, [matchKey, teamNumber, submitted]);

  // Build per-match coverage count
  const matchCoverageMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of coverage ?? []) {
      if (c.isScouted) map.set(c.matchKey, (map.get(c.matchKey) ?? 0) + 1);
    }
    return map;
  }, [coverage]);

  // Determine next upcoming assignment (must be before any early returns)
  const nextAssignment = useMemo(() => {
    if (!allAssignments) return null;
    return (
      allAssignments
        .filter((a) => !a.isScouted && a.match?.status !== "completed")
        .sort((a, b) => (a.match?.predictedTime ?? 0) - (b.match?.predictedTime ?? 0))[0] ?? null
    );
  }, [allAssignments]);

  if (!event) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p className="text-4xl mb-3">🏁</p>
        <p>No active event. Ask an admin to set one up.</p>
      </div>
    );
  }
  if (!config) {
    return (
      <div className="flex h-full items-center justify-center">
        {config === undefined ? <Spinner /> : (
          <p className="text-slate-400">No scouting config active. Ask an admin to create one.</p>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Entry Submitted!</h2>
        <p className="text-slate-400 mb-6">Data saved successfully.</p>
        <button
          onClick={() => {
            setSubmitted(false);
            setMatchKey("");
            setTeamNumber("");
            setSelectedTags([]);
            setCustomTagInput("");
          }}
          className="text-blue-400 underline"
        >
          Scout another match
        </button>
      </div>
    );
  }

  const sortedMatches = matches
    ? [...matches].sort((a, b) => {
        const levelOrder: Record<string, number> = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
        if (a.compLevel !== b.compLevel)
          return (levelOrder[a.compLevel] ?? 0) - (levelOrder[b.compLevel] ?? 0);
        if (a.setNumber !== b.setNumber) return a.setNumber - b.setNumber;
        return a.matchNumber - b.matchNumber;
      })
    : [];

  const selectedMatch = sortedMatches.find((m) => m.matchKey === matchKey);
  const redTeams = selectedMatch?.redAlliance ?? [];
  const blueTeams = selectedMatch?.blueAlliance ?? [];

  function selectTeam(num: number, al: Alliance, pos: Position) {
    setTeamNumber(String(num));
    setAlliance(al);
    setPosition(pos);
  }

  function matchLabel(m: (typeof sortedMatches)[0]) {
    const level = m.compLevel.toUpperCase();
    if (m.compLevel === "qm") return `QM${m.matchNumber}`;
    return `${level}${m.setNumber}-${m.matchNumber}`;
  }

  async function handleSubmit(data: EntryData) {
    if (!event || !config || !matchKey || !teamNumber) return;
    const payload = {
      eventKey: event.eventKey,
      matchKey,
      teamNumber: Number(teamNumber),
      configId: config._id,
      alliance,
      alliancePosition: position,
      data,
    };
    const queued = enqueue("match", payload);
    try {
      await submitEntry(payload);
      dequeue(queued.id);
      // Apply selected tags as team flags
      for (const tag of selectedTags) {
        await addFlag({ eventKey: event.eventKey, teamNumber: Number(teamNumber), tag });
      }
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomTag() {
    const tag = customTagInput.trim();
    if (!tag || selectedTags.includes(tag)) return;
    setSelectedTags((prev) => [...prev, tag]);
    setCustomTagInput("");
  }

  const ready = matchKey && teamNumber;

  function assignmentMatchLabel(matchKey: string): string {
    const part = matchKey.split("_").pop() ?? "";
    if (part.startsWith("qm")) return `QM${part.slice(2)}`;
    return part.toUpperCase();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 border-b border-slate-800 bg-slate-950">
        {/* Match selector — dropdown with coverage-colored border */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Match</label>
          {(() => {
            const count = matchCoverageMap.get(matchKey) ?? 0;
            const borderClass = !matchKey
              ? "border-slate-700"
              : count === 0
                ? "border-slate-700"
                : count < 6
                  ? "border-yellow-600"
                  : "border-green-600";
            return (
              <select
                value={matchKey}
                onChange={(e) => {
                  setMatchKey(e.target.value);
                  setTeamNumber("");
                }}
                className={`w-full bg-slate-800 border ${borderClass} rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none transition-colors`}
              >
                <option value="">Choose match…</option>
                {sortedMatches.map((m) => {
                  const c = matchCoverageMap.get(m.matchKey) ?? 0;
                  const prefix = c === 0 ? "" : c < 6 ? "⚠ " : "✓ ";
                  return (
                    <option key={m.matchKey} value={m.matchKey}>
                      {prefix}{matchLabel(m)}
                    </option>
                  );
                })}
              </select>
            );
          })()}
        </div>

        {/* All 6 teams — color-coded by alliance */}
        {matchKey && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Team</label>
            <div className="space-y-1.5">
              {(
                [
                  { label: "Red", teams: redTeams, al: "red" as Alliance },
                  { label: "Blue", teams: blueTeams, al: "blue" as Alliance },
                ] as const
              ).map(({ label, teams, al }) => (
                <div key={al} className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium w-8 shrink-0 ${
                      al === "red" ? "text-red-400" : "text-blue-400"
                    }`}
                  >
                    {label}
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {teams.map((t, i) => {
                      const isSelected = teamNumber === String(t) && alliance === al;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => selectTeam(t, al, (i + 1) as Position)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            isSelected
                              ? al === "red"
                                ? "bg-red-600 border-red-500 text-white"
                                : "bg-blue-600 border-blue-500 text-white"
                              : al === "red"
                                ? "bg-red-900/30 border-red-800 text-red-200 hover:bg-red-900/50"
                                : "bg-blue-900/30 border-blue-800 text-blue-200 hover:bg-blue-900/50"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Other input */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-8 shrink-0">Other</span>
                <input
                  type="number"
                  placeholder="Team #…"
                  value={
                    !redTeams.includes(Number(teamNumber)) &&
                    !blueTeams.includes(Number(teamNumber))
                      ? teamNumber
                      : ""
                  }
                  onChange={(e) => {
                    setTeamNumber(e.target.value);
                    setAlliance("red");
                    setPosition(1);
                  }}
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {ready ? (
        <DynamicScoutingForm
          config={config as any}
          formType="match"
          onSubmit={handleSubmit}
          submitLabel={`Submit — Team ${teamNumber}`}
          onDiscard={() => {
            setMatchKey("");
            setTeamNumber("");
            setSelectedTags([]);
            setCustomTagInput("");
          }}
          sectionExtras={{
            notes: (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Quick Tags (optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          selectedTags.includes(tag)
                            ? "bg-yellow-600 border-yellow-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-yellow-700"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {selectedTags.filter((t) => !PRESET_TAGS.includes(t)).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="px-2.5 py-1 rounded-full text-xs border transition-colors bg-yellow-600 border-yellow-500 text-white"
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                      placeholder="Custom tag…"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      className="px-3 py-1 rounded-lg text-xs bg-slate-700 border border-slate-600 text-slate-300 hover:border-slate-500 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <PitQuestionWidget
                  eventKey={event.eventKey}
                  teamNumber={Number(teamNumber)}
                />
              </div>
            ),
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {allAssignments && allAssignments.length > 0 ? (
            <>
              <p className="text-xs text-slate-400 font-medium mb-2">
                Your Assignments ({allAssignments.length})
              </p>
              {allAssignments.map((a) => {
                const isNext =
                  nextAssignment !== null &&
                  a.matchKey === nextAssignment.matchKey &&
                  a.alliance === nextAssignment.alliance &&
                  a.position === nextAssignment.position;
                const cardClass = a.isScouted
                  ? "bg-green-900/25 border-green-800 cursor-pointer"
                  : isNext
                    ? "bg-yellow-900/30 border-yellow-700 cursor-pointer"
                    : "bg-slate-900 border-slate-800 cursor-pointer";
                return (
                  <Card
                    key={`${a.matchKey}:${a.alliance}:${a.position}`}
                    className={cardClass}
                    onClick={() => {
                      if (!a.isScouted) {
                        const teams = a.alliance === "red"
                          ? a.match?.redAlliance
                          : a.match?.blueAlliance;
                        const team = teams?.[a.position - 1];
                        setMatchKey(a.matchKey);
                        setAlliance(a.alliance as Alliance);
                        setPosition(a.position as Position);
                        if (team) setTeamNumber(String(team));
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Robot photo */}
                      {a.robotPhotoUrl ? (
                        <img
                          src={a.robotPhotoUrl}
                          alt={`Team ${a.teamNumber}`}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-800"
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-lg shrink-0 flex items-center justify-center text-lg font-bold ${
                          a.alliance === "red"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-blue-900/30 text-blue-400"
                        }`}>
                          {a.teamNumber ?? "?"}
                        </div>
                      )}

                      {/* Match + team info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-slate-200 font-semibold text-sm">
                            {assignmentMatchLabel(a.matchKey)}
                          </p>
                          {isNext && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-700/60 text-yellow-200">
                              NEXT
                            </span>
                          )}
                          {a.isScouted && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-800/60 text-green-300">
                              ✓ Done
                            </span>
                          )}
                        </div>
                        {a.teamNumber && (
                          <p className="text-sm font-medium text-slate-100 truncate">
                            {a.teamNumber}
                            {a.teamNickname ? ` — ${a.teamNickname}` : ""}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          <span className={a.alliance === "red" ? "text-red-400" : "text-blue-400"}>
                            {a.alliance.toUpperCase()}
                          </span>
                          {" "}· Pos {a.position}
                          {a.match?.predictedTime
                            ? ` · ~${formatMatchTime(a.match.predictedTime)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm pt-16">
              Select a match and team to begin scouting.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
