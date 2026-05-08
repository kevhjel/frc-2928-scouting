import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import Spinner from "../components/ui/Spinner";
import TeamRadarChart from "../components/charts/TeamRadarChart";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
  type TooltipProps,
} from "recharts";

function OffenseTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const raw = (payload[0] as any)?.payload?.raw;
  return (
    <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", textAlign: "center" }}>
      <p style={{ color: "#94a3b8", marginBottom: "2px" }}>{label}</p>
      <p style={{ color: "#e2e8f0", fontWeight: 600 }}>{raw ?? payload[0]?.value}</p>
    </div>
  );
}

function matchLabel(matchKey: string): string {
  const part = matchKey.split("_").pop() ?? matchKey;
  return part.toUpperCase().replace("QM", "QM ");
}

function formatTime(predictedTime: number | null): string {
  if (!predictedTime) return "";
  return new Date(predictedTime * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TeamData = {
  teamNumber: number;
  nickname: string;
  opr: number | null;
  epa: number | null;
  robotPhotoUrl: string | null;
  fieldStats: Record<string, any>;
  matchNotes: string | null;
  pitNotes: string | null;
  matchCount: number;
};

type FieldDef = {
  id: string;
  label: string;
  type: string;
  higherIsBetter?: boolean;
  aggregatable: boolean;
};

type NormalizedOffenseMetrics = {
  autoBalls: number;
  teleBalls: number;
  fedBalls: number;
  epa: number;
  rawAutoBalls: number;
  rawTeleBalls: number;
  rawFedBalls: number;
  rawEpa: number;
};

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
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={`Ask Team ${teamNumber} pit crew…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || saving}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded-lg transition-colors shrink-0"
        >
          {saving ? "…" : sent ? "✓" : "Send"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function OffenseRadarChart({ metrics, alliance }: { metrics: NormalizedOffenseMetrics; alliance: "red" | "blue" }) {
  const color = alliance === "red" ? "#ef4444" : "#3b82f6";
  const data = [
    { subject: "Auto Balls", a: Math.round(metrics.autoBalls * 10) / 10, raw: Math.round(metrics.rawAutoBalls * 10) / 10, fullMark: 5 },
    { subject: "Tele Balls", a: Math.round(metrics.teleBalls * 10) / 10, raw: Math.round(metrics.rawTeleBalls * 10) / 10, fullMark: 5 },
    { subject: "Fed Balls", a: Math.round(metrics.fedBalls * 10) / 10, raw: Math.round(metrics.rawFedBalls * 10) / 10, fullMark: 5 },
    { subject: "EPA", a: Math.round(metrics.epa * 10) / 10, raw: Math.round(metrics.rawEpa * 10) / 10, fullMark: 5 },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
        <Tooltip content={<OffenseTooltip />} />
        <Radar name="Offense" dataKey="a" stroke={color} fill={color} fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function TeamCard({
  team,
  alliance,
  fields,
  eventKey,
  offenseMetrics,
}: {
  team: TeamData;
  alliance: "red" | "blue";
  fields: FieldDef[];
  eventKey: string;
  offenseMetrics?: NormalizedOffenseMetrics;
}) {
  const [showPitQ, setShowPitQ] = useState(false);
  const borderColor = alliance === "red" ? "border-red-800/50" : "border-blue-800/50";
  const bgColor = alliance === "red" ? "bg-red-950/20" : "bg-blue-950/20";
  const placeholderBg = alliance === "red" ? "bg-red-900/30 text-red-400" : "bg-blue-900/30 text-blue-400";

  // Adapt fieldStats to the shape TeamRadarChart expects
  const fakeStats = { fieldStats: team.fieldStats } as any;

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3 space-y-2`}>
      {/* Header: photo + name — click to toggle pit question */}
      <button
        className="flex items-center gap-5 w-full text-left"
        onClick={() => setShowPitQ((v) => !v)}
        title="Click to ask pit crew a question"
      >
        {team.robotPhotoUrl ? (
          <img
            src={team.robotPhotoUrl}
            alt={`Team ${team.teamNumber}`}
            className="w-48 h-48 rounded-lg object-cover shrink-0 bg-slate-800"
          />
        ) : (
          <div
            className={`w-48 h-48 rounded-lg shrink-0 flex items-center justify-center text-2xl font-bold ${placeholderBg}`}
          >
            {team.teamNumber}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-100 text-2xl">{team.teamNumber}</p>
          <p className="text-xl text-slate-400 truncate">{team.nickname}</p>
          <div className="flex gap-3 mt-1 flex-wrap">
            {team.opr !== null && (
              <span className="text-base text-slate-500">OPR {team.opr.toFixed(1)}</span>
            )}
            {team.epa !== null && (
              <span className="text-base text-slate-500">EPA {team.epa.toFixed(1)}</span>
            )}
            {team.matchCount === 0 && (
              <span className="text-base text-amber-600">no data</span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {showPitQ ? "▲ close question" : "💬 ask pit crew"}
          </p>
        </div>
      </button>

      {/* Pit question input */}
      {showPitQ && (
        <div className="pt-1 border-t border-slate-700/50">
          <PitQuestionWidget eventKey={eventKey} teamNumber={team.teamNumber} />
        </div>
      )}

      {/* Radar charts */}
      {team.matchCount > 0 && (
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 text-center mb-0.5">Skills</p>
            <TeamRadarChart
              stats={fakeStats}
              fields={fields as any}
              labelA={`Team ${team.teamNumber}`}
              color={alliance === "blue" ? "#3b82f6" : "#ef4444"}
            />
          </div>
          {offenseMetrics && (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 text-center mb-0.5">Offense</p>
              <OffenseRadarChart metrics={offenseMetrics} alliance={alliance} />
            </div>
          )}
        </div>
      )}

      {/* Match notes */}
      {team.matchNotes && (
        <div className="pt-1 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 mb-0.5">Match notes</p>
          <p className="text-xs text-slate-300 italic">{team.matchNotes}</p>
        </div>
      )}

      {/* Pit notes */}
      {team.pitNotes && (
        <div className="pt-1 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 mb-0.5">Pit notes</p>
          <p className="text-xs text-slate-300 italic">{team.pitNotes}</p>
        </div>
      )}
    </div>
  );
}

function numStat(team: TeamData, fieldId: string): number {
  const s = team.fieldStats[fieldId];
  return s?.type === "numeric" && s.count > 0 ? s.avg : 0;
}

function RatingBar({ value, max = 5, color }: { value: number; max?: number; color: "red" | "blue" }) {
  const pct = Math.round((value / max) * 100);
  const barColor = color === "red" ? "bg-red-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-300 w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function AllianceColumn({
  teams,
  alliance,
  fields,
  score,
  eventKey,
  offenseMetrics,
}: {
  teams: TeamData[];
  alliance: "red" | "blue";
  fields: FieldDef[];
  score: number | null;
  eventKey: string;
  offenseMetrics: Record<number, NormalizedOffenseMetrics>;
}) {

  // Alliance summary metrics
  const estimatedBalls = useMemo(() =>
    teams.reduce((sum, t) => {
      const autoBalls = numStat(t, "auto_avg_balls_cycle") * numStat(t, "auto_shoot_cycles");
      const teleBalls = numStat(t, "tele_avg_balls_shot") * numStat(t, "tele_shoot_cycles");
      return sum + autoBalls + teleBalls;
    }, 0),
  [teams]);

  // Defense quality — average only for teams that played defense at least sometimes
  const defenseTeams = teams.filter((t) => {
    const d = t.fieldStats["tele_defense"];
    return d?.type === "boolean" && d.trueCount > 0;
  });
  const netDefenseQuality =
    defenseTeams.length > 0
      ? defenseTeams.reduce((s, t) => s + numStat(t, "tele_defense_quality"), 0) /
        defenseTeams.length
      : null;

  // Defense handling — average across all teams with data
  const handledTeams = teams.filter((t) => {
    const s = t.fieldStats["tele_defense_handling"];
    return s?.type === "numeric" && s.count > 0;
  });
  const netDefenseHandling =
    handledTeams.length > 0
      ? handledTeams.reduce((s, t) => s + numStat(t, "tele_defense_handling"), 0) /
        handledTeams.length
      : null;

  const headerBg = alliance === "red" ? "bg-red-900/30 text-red-300" : "bg-blue-900/30 text-blue-300";
  const summaryBorder = alliance === "red" ? "border-red-800/40" : "border-blue-800/40";
  const summaryBg = alliance === "red" ? "bg-red-950/10" : "bg-blue-950/10";
  const epaTotalLabel = teams.reduce((s, t) => s + (t.epa ?? 0), 0).toFixed(1);
  const oprTotalLabel = teams.reduce((s, t) => s + (t.opr ?? 0), 0).toFixed(1);

  return (
    <div className="flex-1 min-w-0 space-y-2">
      {/* Alliance header */}
      <div className={`rounded-lg px-3 py-2 ${headerBg} flex items-center justify-between`}>
        <span className="font-semibold text-sm uppercase tracking-wide">
          {alliance} Alliance
        </span>
        <div className="flex items-center gap-3 text-xs">
          {score !== null && <span className="font-bold text-base">{score}</span>}
          <span className="opacity-70">OPR Σ {oprTotalLabel}</span>
          <span className="opacity-70">EPA Σ {epaTotalLabel}</span>
        </div>
      </div>

      {/* Alliance summary */}
      <div className={`rounded-lg border ${summaryBorder} ${summaryBg} px-3 py-2.5 space-y-2`}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Alliance Summary</p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Est. balls/match</span>
          <span className="text-sm font-semibold text-slate-200">{estimatedBalls.toFixed(1)}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-32 shrink-0">Defense quality</span>
          {netDefenseQuality !== null ? (
            <RatingBar value={netDefenseQuality} color={alliance} />
          ) : (
            <span className="text-xs text-slate-600">no defense played</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-32 shrink-0">Handles defense</span>
          {netDefenseHandling !== null ? (
            <RatingBar value={netDefenseHandling} color={alliance} />
          ) : (
            <span className="text-xs text-slate-600">no data</span>
          )}
        </div>
      </div>

      {/* Team cards */}
      {teams.map((t) => (
        <TeamCard
          key={t.teamNumber}
          team={t}
          alliance={alliance}
          fields={fields}
          eventKey={eventKey}
          offenseMetrics={offenseMetrics[t.teamNumber]}
        />
      ))}
    </div>
  );
}

export default function MatchAnalysisPage() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);

  const matches = useQuery(
    api.matches.getMatchesForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const myTeamSetting = useQuery(api.appSettings.getAppSetting, { key: "myTeamNumber" });
  const myTeamNumber = myTeamSetting?.value ? parseInt(myTeamSetting.value, 10) : null;

  const analysisData = useQuery(
    api.matchAnalysis.getMatchAnalysisData,
    event && selectedMatchKey && config
      ? { eventKey: event.eventKey, matchKey: selectedMatchKey, configId: config._id }
      : "skip",
  );

  const sortedMatches = useMemo(
    () =>
      [...(matches ?? [])].sort((a, b) => (a.predictedTime ?? 0) - (b.predictedTime ?? 0)),
    [matches],
  );

  if (!event) {
    return (
      <div className="p-6 text-slate-400 text-sm">No active event. Set one in Admin.</div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-lg font-semibold text-slate-100">Match Analysis</h1>

      {/* Match selector */}
      {!matches ? (
        <Spinner />
      ) : (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-xs text-slate-400">
              Select a match
              {myTeamNumber ? ` — matches with Team ${myTeamNumber} are highlighted` : ""}
            </p>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {sortedMatches.map((m) => {
              const isMyMatch =
                myTeamNumber != null &&
                [...m.redAlliance, ...m.blueAlliance].includes(myTeamNumber);
              const isSelected = m.matchKey === selectedMatchKey;
              return (
                <button
                  key={m.matchKey}
                  onClick={() => setSelectedMatchKey(m.matchKey)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between border-b border-slate-800/60 last:border-b-0 transition-colors ${
                    isSelected
                      ? "bg-blue-900/40 text-blue-200"
                      : isMyMatch
                      ? "bg-yellow-900/20 text-yellow-200 hover:bg-yellow-900/30"
                      : "text-slate-300 hover:bg-slate-700/40"
                  }`}
                >
                  <span className="font-medium">{matchLabel(m.matchKey)}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {isMyMatch && (
                      <span className="text-yellow-500 font-medium">★ My Team</span>
                    )}
                    <span>
                      <span className="text-red-400">{m.redAlliance.join(", ")}</span>
                      {" vs "}
                      <span className="text-blue-400">{m.blueAlliance.join(", ")}</span>
                    </span>
                    {m.predictedTime && (
                      <span>{formatTime(m.predictedTime)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Analysis content */}
      {selectedMatchKey && (
        <>
          {analysisData === undefined ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : analysisData === null ? (
            <p className="text-slate-500 text-sm">Match data not available.</p>
          ) : (
            <>
              {(() => {
                const allTeams = [...analysisData.redTeams, ...analysisData.blueTeams];
                const rawValues = allTeams.map((t) => ({
                  autoBalls: numStat(t, "auto_avg_balls_cycle") * numStat(t, "auto_shoot_cycles"),
                  teleBalls: numStat(t, "tele_avg_balls_shot") * numStat(t, "tele_shoot_cycles"),
                  fedBalls: numStat(t, "tele_avg_balls_fed") * numStat(t, "tele_feed_cycles"),
                  epa: Math.max(0, t.epa ?? 0),
                }));
                const maxAuto = Math.max(...rawValues.map((v) => v.autoBalls), 1);
                const maxTele = Math.max(...rawValues.map((v) => v.teleBalls), 1);
                const maxFed = Math.max(...rawValues.map((v) => v.fedBalls), 1);
                const maxEpa = Math.max(...rawValues.map((v) => v.epa), 1);
                const offenseMetrics: Record<number, NormalizedOffenseMetrics> = {};
                allTeams.forEach((t, i) => {
                  const r = rawValues[i];
                  offenseMetrics[t.teamNumber] = {
                    autoBalls: (r.autoBalls / maxAuto) * 5,
                    teleBalls: (r.teleBalls / maxTele) * 5,
                    fedBalls: (r.fedBalls / maxFed) * 5,
                    epa: (r.epa / maxEpa) * 5,
                    rawAutoBalls: r.autoBalls,
                    rawTeleBalls: r.teleBalls,
                    rawFedBalls: r.fedBalls,
                    rawEpa: r.epa,
                  };
                });
                return (
                  <div className="flex gap-3">
                    <AllianceColumn
                      teams={analysisData.redTeams}
                      alliance="red"
                      fields={analysisData.matchFields}
                      score={analysisData.match.redScore}
                      eventKey={event.eventKey}
                      offenseMetrics={offenseMetrics}
                    />
                    <AllianceColumn
                      teams={analysisData.blueTeams}
                      alliance="blue"
                      fields={analysisData.matchFields}
                      score={analysisData.match.blueScore}
                      eventKey={event.eventKey}
                      offenseMetrics={offenseMetrics}
                    />
                  </div>
                );
              })()}


              {/* Summary footer */}
              {analysisData.match.status === "completed" && (
                <div className="text-center text-sm text-slate-400">
                  Final score:{" "}
                  <span className="text-red-400 font-semibold">{analysisData.match.redScore}</span>
                  {" – "}
                  <span className="text-blue-400 font-semibold">{analysisData.match.blueScore}</span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
