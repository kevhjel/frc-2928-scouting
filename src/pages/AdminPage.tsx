import { useState } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import {
  statsToCSV,
  matchEntriesToCSV,
  pitEntriesToCSV,
  downloadCSV,
} from "../lib/exportUtils";
import { config2026 } from "../config/defaultScoutingConfig";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Spinner from "../components/ui/Spinner";

// ── Event Tab ──────────────────────────────────────────────────────────────────
function EventTab() {
  const event = useActiveEvent();
  const events = useQuery(api.events.listEvents);
  const upsertEvent = useMutation(api.events.upsertEvent);
  const setActiveEvent = useMutation(api.events.setActiveEvent);
  const syncTBA = useAction(api.actions.tbaSync.syncEventFromTBA);
  const syncStatbotics = useAction(api.actions.statboticsSync.syncStatbotics);
  const syncPhotos = useAction(api.actions.tbaSync.syncTeamPhotos);

  const [eventKey, setEventKey] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function handleSync() {
    if (!event) return;
    setSyncing(true);
    setSyncMsg("");
    try {
      const result = await syncTBA({ eventKey: event.eventKey });
      await syncStatbotics({ eventKey: event.eventKey });
      setSyncMsg(`Synced ${(result as any).teamsCount} teams, ${(result as any).matchesCount} matches + EPA data.`);
    } catch (e: any) {
      setSyncMsg("Error: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleAddEvent() {
    if (!eventKey.trim()) return;
    const year = parseInt(eventKey.slice(0, 4), 10);
    await upsertEvent({
      eventKey: eventKey.trim(),
      name: eventKey.trim(),
      year,
      startDate: "",
      endDate: "",
      location: "",
    });
    setEventKey("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs text-slate-400 mb-3">Active Event</p>
        {event ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-100">{event.name}</p>
              <p className="text-xs text-slate-500">{event.eventKey}</p>
              {event.tbaLastSynced && (
                <p className="text-xs text-slate-600 mt-1">
                  Last synced: {new Date(event.tbaLastSynced).toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={async () => {
                if (!event) return;
                setSyncing(true);
                setSyncMsg("");
                try {
                  const r = await syncPhotos({ eventKey: event.eventKey });
                  setSyncMsg(`Synced ${(r as any).synced} robot photos.`);
                } catch (e: any) {
                  setSyncMsg("Error: " + e.message);
                } finally {
                  setSyncing(false);
                }
              }} disabled={syncing} size="sm" variant="secondary">
                {syncing ? <Spinner size="sm" /> : "Sync Photos"}
              </Button>
              <Button onClick={handleSync} disabled={syncing} size="sm">
                {syncing ? <Spinner size="sm" /> : "Sync TBA"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No active event.</p>
        )}
        {syncMsg && (
          <p className={`mt-2 text-xs ${syncMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {syncMsg}
          </p>
        )}
      </Card>

      <Card>
        <p className="text-xs text-slate-400 mb-3">Add Event by TBA Key</p>
        <div className="flex gap-2">
          <input
            value={eventKey}
            onChange={(e) => setEventKey(e.target.value)}
            placeholder="e.g. 2026miket"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <Button size="sm" onClick={handleAddEvent}>Add</Button>
        </div>
      </Card>

      <Card>
        <p className="text-xs text-slate-400 mb-3">All Events</p>
        {events?.map((e) => (
          <div key={e._id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-b-0">
            <div>
              <span className="text-sm text-slate-200">{e.name}</span>
              {e.isActive && <Badge color="green" className="ml-2">Active</Badge>}
            </div>
            {!e.isActive && (
              <Button variant="ghost" size="sm" onClick={() => setActiveEvent({ eventId: e._id })}>
                Set Active
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────
function UsersTab() {
  const users = useQuery(api.users.listUsers);
  const updateRole = useMutation(api.users.updateUserRole);
  const generateResetCode = useAction(api.passwordReset.generateResetCode);
  const [resetCodes, setResetCodes] = useState<Record<string, { code: string; email: string }>>({});
  const [resetting, setResetting] = useState<string | null>(null);

  if (!users) return <Spinner />;

  async function handleReset(userId: string, profileId: string) {
    setResetting(profileId);
    try {
      const result = await generateResetCode({ userId: userId as any });
      setResetCodes((prev) => ({ ...prev, [profileId]: result as any }));
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setResetting(null);
    }
  }

  return (
    <Card padding={false}>
      {users.map((u: any) => (
        <div key={u._id} className="px-4 py-3 border-b border-slate-800/50 last:border-b-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">{u.displayName}</p>
              <p className="text-xs text-slate-500">{u.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => updateRole({ profileId: u._id, role: e.target.value as any })}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
              >
                <option value="scout">scout</option>
                <option value="analyst">analyst</option>
                <option value="admin">admin</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                disabled={resetting === u._id}
                onClick={() => handleReset(u.userId, u._id)}
              >
                {resetting === u._id ? <Spinner size="sm" /> : "Reset PW"}
              </Button>
            </div>
          </div>
          {resetCodes[u._id] && (
            <div className="mt-2 bg-slate-800 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Reset code (expires 24h):</p>
                <p className="text-sm font-mono font-bold text-blue-300">{resetCodes[u._id].code}</p>
                <p className="text-xs text-slate-500">for {resetCodes[u._id].email}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(resetCodes[u._id].code)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

// ── Assignments Tab ────────────────────────────────────────────────────────────
function AssignmentsTab() {
  const event = useActiveEvent();
  const coverage = useQuery(
    api.matchAssignments.getCoverageMap,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const users = useQuery(api.users.listUsers);
  const matches = useQuery(
    api.matches.getMatchesForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const availability = useQuery(
    api.scoutAvailability.getAvailabilityForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const autoConfig = useQuery(
    api.autoAssignConfig.getAutoAssignConfig,
    event ? { eventKey: event.eventKey } : "skip",
  );

  const assignScout = useMutation(api.matchAssignments.assignScout);
  const setAvailability = useMutation(api.scoutAvailability.setAvailability);
  const bulkReassign = useMutation(api.matchAssignments.bulkReassign);
  const generateAutoAssignments = useAction(api.actions.autoAssign.generateAutoAssignments);

  const [selectedMatch, setSelectedMatch] = useState("");
  const [shiftSize, setShiftSize] = useState(3);
  const [clearExisting, setClearExisting] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignMsg, setReassignMsg] = useState("");

  if (!event)
    return <p className="text-slate-400 text-sm">No active event.</p>;
  if (!matches || !users) return <Spinner />;

  const qmMatches = matches
    .filter((m) => m.compLevel === "qm")
    .sort((a, b) => a.matchNumber - b.matchNumber);

  const scouts = users as any[];

  // Derive event days from match predictedTimes
  const eventDays = Array.from(
    new Set(
      qmMatches
        .filter((m) => m.predictedTime)
        .map((m) => new Date(m.predictedTime! * 1000).toISOString().split("T")[0]),
    ),
  ).sort();

  // Build availability set: "userId:date" → boolean
  const availSet = new Set(
    (availability ?? []).filter((a) => a.available).map((a) => `${a.userId}:${a.date}`),
  );

  const coverageSet = new Set(
    (coverage ?? []).filter((c) => c.isScouted).map((c) => `${c.matchKey}:${c.alliance}:${c.position}`),
  );
  const assignedMap = new Map(
    (coverage ?? []).map((c) => [`${c.matchKey}:${c.alliance}:${c.position}`, c.userId]),
  );

  const match = qmMatches.find((m) => m.matchKey === selectedMatch);

  async function handleGenerate() {
    if (!event) return;
    setGenerating(true);
    setGenMsg("");
    try {
      const result = await generateAutoAssignments({
        eventKey: event.eventKey,
        shiftSize,
        clearExisting,
      });
      setGenMsg(`Done: ${(result as any).assigned} assigned, ${(result as any).skipped} skipped.`);
    } catch (e: any) {
      setGenMsg("Error: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleReassign() {
    if (!event || !fromUserId || !toUserId) return;
    setReassigning(true);
    setReassignMsg("");
    try {
      const count = await bulkReassign({
        eventKey: event.eventKey,
        fromUserId: fromUserId as any,
        toUserId: toUserId as any,
      });
      setReassignMsg(`Moved ${count} future assignment${count !== 1 ? "s" : ""}.`);
    } catch (e: any) {
      setReassignMsg("Error: " + e.message);
    } finally {
      setReassigning(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Availability Grid */}
      <Card>
        <p className="text-xs text-slate-400 mb-3">Scout Availability</p>
        {scouts.length === 0 ? (
          <p className="text-xs text-slate-500">No scouts found.</p>
        ) : eventDays.length === 0 ? (
          <p className="text-xs text-slate-500">No match schedule available (sync TBA first).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left text-slate-400 font-medium pr-4 pb-2">Scout</th>
                  {eventDays.map((d) => {
                    const dt = new Date(d + "T12:00:00Z");
                    return (
                      <th key={d} className="text-center text-slate-400 font-medium px-2 pb-2 whitespace-nowrap">
                        {dt.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "UTC" })}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {scouts.map((scout: any) => (
                  <tr key={scout._id}>
                    <td className="text-slate-300 pr-4 py-1 whitespace-nowrap">{scout.displayName}</td>
                    {eventDays.map((d) => {
                      const isAvail = availSet.has(`${scout.userId}:${d}`);
                      return (
                        <td key={d} className="text-center px-2 py-1">
                          <button
                            onClick={() =>
                              setAvailability({
                                eventKey: event.eventKey,
                                userId: scout.userId,
                                date: d,
                                available: !isAvail,
                              })
                            }
                            className={`w-7 h-7 rounded-md border text-xs transition-colors ${
                              isAvail
                                ? "bg-green-700 border-green-600 text-green-100"
                                : "bg-slate-800 border-slate-700 text-slate-600 hover:border-slate-500"
                            }`}
                          >
                            {isAvail ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Auto-Generate */}
      <Card>
        <p className="text-xs text-slate-400 mb-3">Auto-Generate Assignments</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0">Shift size</label>
            <input
              type="number"
              min={1}
              max={10}
              value={shiftSize}
              onChange={(e) => setShiftSize(Number(e.target.value))}
              className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-100 focus:outline-none"
            />
            <span className="text-xs text-slate-500">matches per shift</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="accent-blue-500"
            />
            Clear existing assignments first
          </label>
          {autoConfig?.lastGeneratedAt && (
            <p className="text-xs text-slate-500">
              Last generated: {new Date(autoConfig.lastGeneratedAt).toLocaleString()}
            </p>
          )}
          <Button onClick={handleGenerate} disabled={generating} size="sm">
            {generating ? <Spinner size="sm" /> : "Generate Assignments"}
          </Button>
          {genMsg && (
            <p className={`text-xs ${genMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
              {genMsg}
            </p>
          )}
        </div>
      </Card>

      {/* Bulk Reassign */}
      <Card>
        <p className="text-xs text-slate-400 mb-3">Reassign Scout</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-8 shrink-0">From</label>
            <select
              value={fromUserId}
              onChange={(e) => setFromUserId(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">Select scout…</option>
              {scouts.map((u: any) => (
                <option key={u._id} value={u.userId}>{u.displayName}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-8 shrink-0">To</label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">Select scout…</option>
              {scouts.map((u: any) => (
                <option key={u._id} value={u.userId}>{u.displayName}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleReassign}
            disabled={reassigning || !fromUserId || !toUserId || fromUserId === toUserId}
            size="sm"
            variant="secondary"
          >
            {reassigning ? <Spinner size="sm" /> : "Reassign Future Matches"}
          </Button>
          {reassignMsg && (
            <p className={`text-xs ${reassignMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
              {reassignMsg}
            </p>
          )}
        </div>
      </Card>

      {/* Manual assignment */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Select Match</label>
        <select
          value={selectedMatch}
          onChange={(e) => setSelectedMatch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">Choose match…</option>
          {qmMatches.map((m) => (
            <option key={m.matchKey} value={m.matchKey}>
              {m.matchKey.split("_")[1]?.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {match && (
        <Card>
          {(["red", "blue"] as const).map((alliance) => {
            const teams =
              alliance === "red" ? match.redAlliance : match.blueAlliance;
            return (
              <div key={alliance} className="mb-4 last:mb-0">
                <p className={`text-xs font-medium mb-2 ${alliance === "red" ? "text-red-400" : "text-blue-400"}`}>
                  {alliance.toUpperCase()} ALLIANCE
                </p>
                {teams.map((t, i) => {
                  const pos = (i + 1) as 1 | 2 | 3;
                  const key = `${match.matchKey}:${alliance}:${pos}`;
                  const scouted = coverageSet.has(key);
                  const currentUserId = assignedMap.get(key);
                  return (
                    <div key={t} className="flex items-center gap-3 py-1.5">
                      <span className="text-sm text-slate-300 w-12">{t}</span>
                      {scouted ? (
                        <Badge color="green">Scouted</Badge>
                      ) : (
                        <select
                          value={currentUserId ?? ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              assignScout({
                                eventKey: event.eventKey,
                                matchKey: match.matchKey,
                                userId: e.target.value as any,
                                alliance,
                                position: pos,
                              });
                            }
                          }}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none flex-1 max-w-[180px]"
                        >
                          <option value="">Assign scout…</option>
                          {(users as any[]).map((u) => (
                            <option key={u._id} value={u.userId}>
                              {u.displayName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Card>
      )}

      {/* Coverage summary */}
      <Card>
        <p className="text-xs text-slate-400 mb-2">Coverage Summary</p>
        <p className="text-sm text-slate-300">
          {coverageSet.size} / {(coverage ?? []).length} positions scouted
        </p>
      </Card>
    </div>
  );
}

// ── Raw Data Tab ───────────────────────────────────────────────────────────────
function RawDataTab() {
  const event = useActiveEvent();
  const entries = useQuery(
    api.matchScouting.getEntriesForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const users = useQuery(api.users.listUsers);
  const deleteEntry = useMutation(api.matchScouting.deleteMatchEntry);

  if (!event) return <p className="text-slate-400 text-sm">No active event.</p>;
  if (!entries || !users) return <Spinner />;

  const userMap = new Map((users as any[]).map((u: any) => [u.userId, u.displayName]));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{entries.length} entries</p>
      <Card padding={false}>
        {entries.length === 0 && (
          <p className="px-4 py-3 text-sm text-slate-500">No entries yet.</p>
        )}
        {entries.map((e) => (
          <div key={e._id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 last:border-b-0 gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-200 font-medium">
                {e.matchKey.split("_")[1]?.toUpperCase()} — Team {e.teamNumber}
              </p>
              <p className="text-xs text-slate-500">
                {e.alliance.toUpperCase()} {e.alliancePosition} · {userMap.get(e.scoutUserId) ?? "Unknown"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete entry for Team ${e.teamNumber} in ${e.matchKey}?`)) {
                  deleteEntry({ id: e._id });
                }
              }}
              className="shrink-0 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-900 hover:border-red-700"
            >
              Delete
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Config Tab ──────────────────────────────────────────────────────────────────
function ConfigTab() {
  const configs = useQuery(api.scoutingConfig.listConfigs);
  const profile = useQuery(api.users.getCurrentUserProfile);
  const createConfig = useMutation(api.scoutingConfig.createConfig);
  const setActive = useMutation(api.scoutingConfig.setActiveConfig);
  const deleteConfig = useMutation(api.scoutingConfig.deleteConfig);
  const [creating, setCreating] = useState(false);

  async function seedDefault() {
    if (!profile) return;
    setCreating(true);
    await createConfig({
      year: config2026.year,
      name: config2026.name,
      matchFields: config2026.matchFields as any,
      pitFields: config2026.pitFields as any,
      matchSections: config2026.matchSections,
      pitSections: config2026.pitSections,
    });
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <Button onClick={seedDefault} disabled={creating} variant="secondary">
        {creating ? <Spinner size="sm" /> : "Seed 2026 Reefscape Config"}
      </Button>
      <Card padding={false}>
        {configs?.map((c) => (
          <div key={c._id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 last:border-b-0">
            <div>
              <p className="text-sm text-slate-200">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.matchFields.length} match fields · {c.pitFields.length} pit fields
              </p>
            </div>
            {c.isActive ? (
              <Badge color="green">Active</Badge>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setActive({ id: c._id })}>
                  Activate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete "${c.name}"?`)) deleteConfig({ id: c._id });
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Export Tab ─────────────────────────────────────────────────────────────────
function ExportTab() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const allStats = useQuery(
    api.stats.getAllTeamStats,
    event && config ? { eventKey: event.eventKey, configId: config._id } : "skip",
  );
  const matchEntries = useQuery(
    api.matchScouting.getEntriesForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const pitEntries = useQuery(
    api.pitScouting.getAllPitEntries,
    event ? { eventKey: event.eventKey } : "skip",
  );

  if (!event)
    return <p className="text-slate-400 text-sm">No active event.</p>;

  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        disabled={!allStats || !config}
        onClick={() => {
          if (allStats && config)
            downloadCSV(
              statsToCSV(allStats, config as any),
              `${event.eventKey}_stats.csv`,
            );
        }}
      >
        📥 Download Stats CSV
      </Button>
      <Button
        variant="secondary"
        disabled={!matchEntries || !config}
        onClick={() => {
          if (matchEntries && config)
            downloadCSV(
              matchEntriesToCSV(matchEntries, config as any),
              `${event.eventKey}_match_entries.csv`,
            );
        }}
      >
        📥 Download Match Entries CSV
      </Button>
      <Button
        variant="secondary"
        disabled={!pitEntries || !config}
        onClick={() => {
          if (pitEntries && config)
            downloadCSV(
              pitEntriesToCSV(pitEntries, config as any),
              `${event.eventKey}_pit_entries.csv`,
            );
        }}
      >
        📥 Download Pit Entries CSV
      </Button>
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────
const tabs = [
  { path: "event", label: "Event" },
  { path: "users", label: "Users" },
  { path: "assignments", label: "Assignments" },
  { path: "config", label: "Config" },
  { path: "rawdata", label: "Raw Data" },
  { path: "export", label: "Export" },
];

export default function AdminPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex overflow-x-auto gap-1 px-4 py-2 bg-slate-900 border-b border-slate-800">
        {tabs.map((t) => (
          <NavLink
            key={t.path}
            to={`/admin/${t.path}`}
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <Routes>
          <Route path="event" element={<EventTab />} />
          <Route path="users" element={<UsersTab />} />
          <Route path="assignments" element={<AssignmentsTab />} />
          <Route path="config" element={<ConfigTab />} />
          <Route path="rawdata" element={<RawDataTab />} />
          <Route path="export" element={<ExportTab />} />
          <Route path="*" element={<EventTab />} />
        </Routes>
      </div>
    </div>
  );
}
