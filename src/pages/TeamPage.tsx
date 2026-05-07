import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import TeamRadarChart from "../components/charts/TeamRadarChart";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import Modal from "../components/ui/Modal";
import { PRESET_TAGS } from "../../convex/teamFlags";

export default function TeamPage() {
  const { teamNumber: teamParam } = useParams<{ teamNumber: string }>();
  const teamNumber = Number(teamParam);
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();

  const teamStats = useQuery(
    api.stats.getTeamStats,
    event && config ? { eventKey: event.eventKey, teamNumber, configId: config._id } : "skip",
  );
  const allStats = useQuery(
    api.stats.getAllTeamStats,
    event && config ? { eventKey: event.eventKey, configId: config._id } : "skip",
  );
  const entries = useQuery(
    api.matchScouting.getEntriesForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );
  const pitEntry = useQuery(
    api.pitScouting.getPitEntryForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );
  const flags = useQuery(
    api.teamFlags.getFlagsForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );
  const matches = useQuery(
    api.matches.getMatchesForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const pitQuestions = useQuery(
    api.pitQuestions.getQuestionsForTeam,
    event ? { eventKey: event.eventKey, teamNumber } : "skip",
  );

  const matchVideoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches ?? []) {
      if ((m as any).videoUrl) map.set(m.matchKey, (m as any).videoUrl);
    }
    return map;
  }, [matches]);


  const addFlag = useMutation(api.teamFlags.addFlag);
  const removeFlag = useMutation(api.teamFlags.removeFlag);

  const [flagModal, setFlagModal] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const [flagNotes, setFlagNotes] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  function youtubeEmbedUrl(url: string): string {
    const vParam = url.split("v=")[1]?.split("&")[0];
    return `https://www.youtube.com/embed/${vParam ?? url.split("/").pop()}`;
  }

  if (!event)
    return (
      <div className="p-6 text-center text-slate-400">No active event.</div>
    );
  if (teamStats === undefined)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  if (!teamStats)
    return (
      <div className="p-6 text-center text-slate-400">
        Team {teamNumber} not found at this event.
      </div>
    );

  const numericFields = (config?.matchFields ?? []).filter(
    (f) => (f.type === "counter" || f.type === "number" || f.type === "rating") && f.aggregatable,
  );

  async function handleAddFlag(tag: string) {
    if (!event) return;
    await addFlag({ eventKey: event.eventKey, teamNumber, tag, notes: flagNotes || undefined });
    setFlagModal(false);
    setCustomTag("");
    setFlagNotes("");
  }

  const displayPhotoUrl = teamStats.pitPhotoUrl ?? teamStats.robotPhotoUrl;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team {teamNumber}</h1>
          <p className="text-slate-400">{teamStats.nickname}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setFlagModal(true)}>
          + Flag
        </Button>
      </div>

      {/* Robot photo */}
      {displayPhotoUrl ? (
        <Card padding={false}>
          <img
            src={displayPhotoUrl}
            alt={`Team ${teamNumber} robot`}
            className="w-full max-h-64 object-contain rounded-lg bg-slate-900"
          />
        </Card>
      ) : null}

      {/* External stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "OPR", value: teamStats.opr, decimals: 1 },
          { label: "EPA", value: teamStats.epa, decimals: 1 },
          { label: "Avg Match Balls", value: teamStats.avgMatchBalls, decimals: 1 },
        ].map(({ label, value, decimals }) => (
          <Card key={label} className="text-center">
            <div className="text-xl font-bold text-blue-400">
              {value !== null ? Number(value).toFixed(decimals) : "—"}
            </div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </Card>
        ))}
      </div>

      {/* Flags */}
      {flags && flags.length > 0 && (
        <Card>
          <p className="text-xs text-slate-400 mb-2">Flags</p>
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <div key={f._id} className="flex items-center gap-1">
                <Badge color="yellow">{f.tag}</Badge>
                <button
                  onClick={() => removeFlag({ flagId: f._id })}
                  className="text-slate-600 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Radar chart */}
      {allStats && config && (
        <Card>
          <p className="text-xs text-slate-400 mb-2">Performance (vs. event)</p>
          <TeamRadarChart
            stats={teamStats}
            allStats={allStats}
            fields={config.matchFields as any}
          />
        </Card>
      )}

      {/* Key stats */}
      {numericFields.length > 0 && (
        <Card>
          <p className="text-xs text-slate-400 mb-3">Average Stats</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Avg Match Balls</span>
              <span className="text-sm font-medium text-slate-200 ml-2">
                {teamStats.avgMatchBalls !== null ? teamStats.avgMatchBalls.toFixed(1) : "—"}
              </span>
            </div>
            {numericFields.map((f) => {
              const fs = teamStats.fieldStats[f.id];
              const avg = fs?.type === "numeric" ? fs.avg : null;
              return (
                <div key={f.id} className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">{f.label}</span>
                  <span className="text-sm font-medium text-slate-200 ml-2">
                    {avg !== null ? avg.toFixed(1) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {numericFields.length > 0 && (
        <Card>
          <p className="text-xs text-slate-400 mb-3">Maximum Stats</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Max Match Balls</span>
              <span className="text-sm font-medium text-slate-200 ml-2">
                {teamStats.maxMatchBalls !== null ? teamStats.maxMatchBalls.toFixed(1) : "—"}
              </span>
            </div>
            {numericFields.map((f) => {
              const fs = teamStats.fieldStats[f.id];
              const max = fs?.type === "numeric" ? fs.max : null;
              return (
                <div key={f.id} className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">{f.label}</span>
                  <span className="text-sm font-medium text-slate-200 ml-2">
                    {max !== null ? max.toFixed(1) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Pit scouting */}
      {pitEntry && config && (
        <Card>
          <p className="text-xs text-slate-400 mb-3">Pit Scouting</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            {config.pitFields
              .filter((f) => pitEntry.data[f.id] !== undefined && pitEntry.data[f.id] !== null && pitEntry.data[f.id] !== "")
              .map((f) => (
                <div key={f.id} className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">{f.label}</span>
                  <span className="text-xs font-medium text-slate-300 ml-2">
                    {String(pitEntry.data[f.id])}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Match notes */}
      {(() => {
        const notes = (entries ?? []).filter((e) => e.notes?.trim());
        if (notes.length === 0) return null;
        return (
          <Card>
            <p className="text-xs text-slate-400 mb-3">Match Notes</p>
            <div className="space-y-2">
              {notes.map((e) => (
                <div key={e._id} className="flex gap-2">
                  <span className="text-xs text-slate-500 shrink-0">
                    {e.matchKey.split("_")[1]?.toUpperCase()}
                  </span>
                  <p className="text-xs text-slate-300 italic">{e.notes}</p>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Pit questions */}
      {pitQuestions && pitQuestions.length > 0 && (
        <Card>
          <p className="text-xs text-slate-400 mb-3">Pit Questions</p>
          <div className="space-y-3">
            {pitQuestions.map((q) => (
              <div key={q._id} className="space-y-1">
                <p className="text-xs text-slate-200">{q.question}</p>
                {q.answer ? (
                  <p className="text-xs text-green-400 pl-2 border-l border-green-700">
                    {q.answer}
                  </p>
                ) : (
                  <p className="text-xs text-amber-500 pl-2 border-l border-amber-800">
                    Unanswered
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Match history */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-800">
          <p className="text-xs text-slate-400">
            Match Entries ({entries?.length ?? 0})
          </p>
        </div>
        {entries?.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No entries yet.</p>
        ) : (
          <div>
            {entries?.map((entry) => (
              <div
                key={entry._id}
                className="border-b border-slate-800/50 last:border-b-0"
              >
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 text-left"
                  onClick={() =>
                    setExpandedEntry(expandedEntry === entry._id ? null : entry._id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <Badge color={entry.alliance === "red" ? "red" : "blue"}>
                      {entry.matchKey.split("_")[1]?.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {entry.alliance} {entry.alliancePosition}
                    </span>
                    {matchVideoMap.get(entry.matchKey) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedVideo((v) => v === entry.matchKey ? null : entry.matchKey);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        {expandedVideo === entry.matchKey ? "▼ Hide" : "▶ Watch"}
                      </button>
                    )}
                  </div>
                  <span className="text-slate-600 text-xs">
                    {expandedEntry === entry._id ? "▲" : "▼"}
                  </span>
                </button>
                {expandedVideo === entry.matchKey && matchVideoMap.get(entry.matchKey) && (
                  <div className="px-4 pb-3">
                    <iframe
                      src={youtubeEmbedUrl(matchVideoMap.get(entry.matchKey)!)}
                      className="w-full aspect-video rounded-lg"
                      allowFullScreen
                      title={`Match ${entry.matchKey} video`}
                    />
                  </div>
                )}
                {expandedEntry === entry._id && (
                  <div className="px-4 pb-3 grid grid-cols-2 gap-y-1 gap-x-4">
                    {Object.entries(entry.data)
                      .filter(([, v]) => v !== null && v !== "" && v !== 0)
                      .map(([k, v]) => {
                        const field = config?.matchFields.find((f) => f.id === k);
                        return (
                          <div key={k} className="flex justify-between">
                            <span className="text-xs text-slate-500 truncate">
                              {field?.label ?? k}
                            </span>
                            <span className="text-xs text-slate-300 ml-2">
                              {String(v)}
                            </span>
                          </div>
                        );
                      })}
                    {entry.notes && (
                      <div className="col-span-2 text-xs text-slate-400 mt-1 italic">
                        {entry.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Flag modal */}
      <Modal open={flagModal} onClose={() => setFlagModal(false)} title="Add Flag">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => handleAddFlag(tag)}
                className="px-3 py-1.5 rounded-full text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Custom tag…"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <Button
              size="sm"
              onClick={() => customTag && handleAddFlag(customTag)}
              disabled={!customTag}
            >
              Add
            </Button>
          </div>
          <input
            type="text"
            placeholder="Notes (optional)…"
            value={flagNotes}
            onChange={(e) => setFlagNotes(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>
      </Modal>
    </div>
  );
}
