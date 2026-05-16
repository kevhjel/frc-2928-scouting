import { useState, useEffect, useRef, useCallback } from "react";
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
  const createMockEvent = useAction(api.actions.createMockEvent.createMockEvent);
  const deleteMockEvent = useAction(api.actions.createMockEvent.deleteMockEvent);
  const myTeamSetting = useQuery(api.appSettings.getAppSetting, { key: "myTeamNumber" });
  const syncEnabledSetting = useQuery(api.appSettings.getAppSetting, { key: "tba_sync_enabled" });
  const setAppSetting = useMutation(api.appSettings.setAppSetting);
  const syncEnabled = syncEnabledSetting?.value !== "false";

  const [eventKey, setEventKey] = useState("");
  const [mockName, setMockName] = useState("");
  const [creatingMock, setCreatingMock] = useState(false);
  const [mockMsg, setMockMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [myTeamInput, setMyTeamInput] = useState("");

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

  async function handleCreateMock() {
    if (!mockName.trim()) return;
    setCreatingMock(true);
    setMockMsg("");
    try {
      const savedTeam = myTeamSetting?.value ? parseInt(myTeamSetting.value, 10) : undefined;
      const result = await createMockEvent({
        name: mockName.trim(),
        myTeamNumber: savedTeam && !isNaN(savedTeam) ? savedTeam : undefined,
      }) as any;
      setMockMsg(`Created mock event "${mockName.trim()}" — ${result.teamsCount} teams, ${result.matchesCount} matches.`);
      setMockName("");
    } catch (e: any) {
      setMockMsg("Error: " + e.message);
    } finally {
      setCreatingMock(false);
    }
  }

  async function handleSaveMyTeam() {
    const num = parseInt(myTeamInput, 10);
    if (!myTeamInput.trim() || isNaN(num) || num < 1 || num > 9999) return;
    await setAppSetting({ key: "myTeamNumber", value: String(num) });
    setMyTeamInput("");
  }

  async function handleDeleteMock(key: string) {
    if (!confirm(`Delete mock event "${key}" and all its data?`)) return;
    try {
      await deleteMockEvent({ eventKey: key });
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs text-slate-400 mb-3">Active Event</p>
        {event ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-100">{event.name}</p>
                {(event as any).isMock && <Badge color="yellow">MOCK</Badge>}
              </div>
              <p className="text-xs text-slate-500">{event.eventKey}</p>
              {event.tbaLastSynced && !(event as any).isMock && (
                <p className="text-xs text-slate-600 mt-1">
                  Last synced: {new Date(event.tbaLastSynced).toLocaleTimeString()}
                </p>
              )}
            </div>
            {!(event as any).isMock && (
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
            )}
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Auto Sync</p>
            <p className="text-xs text-slate-500 mt-0.5">
              TBA every 5 min · EPA every 2 hrs · Disable in the off-season to reduce usage.
            </p>
          </div>
          <button
            onClick={() => setAppSetting({ key: "tba_sync_enabled", value: syncEnabled ? "false" : "true" })}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${syncEnabled ? "bg-blue-600" : "bg-slate-600"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${syncEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
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
        <p className="text-xs text-slate-400 mb-3">My Team Number</p>
        <p className="text-xs text-slate-500 mb-3">
          Your team will be included in all new mock events and highlighted in match analysis.
        </p>
        {myTeamSetting?.value && (
          <p className="text-sm text-blue-400 mb-2 font-medium">Current: Team {myTeamSetting.value}</p>
        )}
        <div className="flex gap-2">
          <input
            type="number"
            value={myTeamInput}
            onChange={(e) => setMyTeamInput(e.target.value)}
            placeholder={myTeamSetting?.value ?? "e.g. 2928"}
            min={1}
            max={9999}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <Button size="sm" onClick={handleSaveMyTeam} disabled={!myTeamInput.trim()}>Save</Button>
        </div>
      </Card>

      <Card>
        <p className="text-xs text-slate-400 mb-3">Create Mock Competition</p>
        <p className="text-xs text-slate-500 mb-3">
          Generates 40 teams and 70 qual matches with times spanning today and tomorrow — useful for testing the scheduler and training scouts.
        </p>
        <div className="flex gap-2">
          <input
            value={mockName}
            onChange={(e) => setMockName(e.target.value)}
            placeholder="e.g. Practice Event"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <Button size="sm" onClick={handleCreateMock} disabled={creatingMock || !mockName.trim()}>
            {creatingMock ? <Spinner size="sm" /> : "Create Mock"}
          </Button>
        </div>
        {mockMsg && (
          <p className={`mt-2 text-xs ${mockMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {mockMsg}
          </p>
        )}
      </Card>

      <Card>
        <p className="text-xs text-slate-400 mb-3">All Events</p>
        {events?.map((e) => (
          <div key={e._id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-b-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-slate-200 truncate">{e.name}</span>
              {e.isActive && <Badge color="green">Active</Badge>}
              {(e as any).isMock && <Badge color="yellow">MOCK</Badge>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!e.isActive && (
                <Button variant="ghost" size="sm" onClick={() => setActiveEvent({ eventId: e._id })}>
                  Set Active
                </Button>
              )}
              {(e as any).isMock && (
                <Button variant="ghost" size="sm" onClick={() => handleDeleteMock(e.eventKey)}>
                  <span className="text-red-400">Delete</span>
                </Button>
              )}
            </div>
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
  const updateDisplayName = useMutation(api.users.adminUpdateDisplayName);
  const createBot = useMutation(api.users.createBotAccount);
  const deleteBot = useMutation(api.users.deleteBotAccount);
  const generateResetCode = useAction(api.passwordReset.generateResetCode);
  const [resetCodes, setResetCodes] = useState<Record<string, { code: string; email: string }>>({});
  const [resetting, setResetting] = useState<string | null>(null);
  const [botName, setBotName] = useState("");
  const [creatingBot, setCreatingBot] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

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

  async function handleCreateBot() {
    if (!botName.trim()) return;
    setCreatingBot(true);
    try {
      await createBot({ displayName: botName.trim() });
      setBotName("");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setCreatingBot(false);
    }
  }

  async function handleDeleteBot(profileId: string, name: string) {
    if (!confirm(`Delete bot "${name}"? This will remove all their match assignments.`)) return;
    try {
      await deleteBot({ profileId: profileId as any });
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div className="space-y-4">
      <Card padding={false}>
        {users.map((u: any) => (
          <div key={u._id} className="px-4 py-3 border-b border-slate-800/50 last:border-b-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {editingName === u._id ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!nameInput.trim()) return;
                        await updateDisplayName({ profileId: u._id, displayName: nameInput.trim() }).catch(() => {});
                        setEditingName(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setEditingName(null)}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-36"
                      />
                      <button type="submit" className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                      <button type="button" onClick={() => setEditingName(null)} className="text-xs text-slate-500 hover:text-slate-300">✕</button>
                    </form>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-200">{u.displayName}</p>
                      <button
                        onClick={() => { setEditingName(u._id); setNameInput(u.displayName); }}
                        className="text-slate-600 hover:text-slate-400 text-xs"
                        title="Edit name"
                      >✎</button>
                    </>
                  )}
                  {u.isBot && <Badge color="yellow">BOT</Badge>}
                </div>
                <p className="text-xs text-slate-500">{u.isBot ? "No login" : u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {!u.isBot && (
                  <select
                    value={u.role}
                    onChange={(e) => updateRole({ profileId: u._id, role: e.target.value as any })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="scout">scout</option>
                    <option value="analyst">analyst</option>
                    <option value="admin">admin</option>
                  </select>
                )}
                {u.isBot ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBot(u._id, u.displayName)}
                  >
                    <span className="text-red-400">Delete</span>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resetting === u._id}
                    onClick={() => handleReset(u.userId, u._id)}
                  >
                    {resetting === u._id ? <Spinner size="sm" /> : "Reset PW"}
                  </Button>
                )}
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

      <Card>
        <p className="text-xs text-slate-400 mb-3">Create Bot Account</p>
        <p className="text-xs text-slate-500 mb-3">
          Bot accounts can be assigned in the scheduler like real scouts but have no login credentials.
        </p>
        <div className="flex gap-2">
          <input
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateBot()}
            placeholder="e.g. Bot Alpha"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <Button size="sm" onClick={handleCreateBot} disabled={creatingBot || !botName.trim()}>
            {creatingBot ? <Spinner size="sm" /> : "Create Bot"}
          </Button>
        </div>
      </Card>
    </div>
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

  const [shiftSize, setShiftSize] = useState(3);
  const [clearExisting, setClearExisting] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignMsg, setReassignMsg] = useState("");
  const [selectedScoutUserId, setSelectedScoutUserId] = useState<string | null>(null);

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
                    <td className="pr-4 py-1 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedScoutUserId(
                          selectedScoutUserId === scout.userId ? null : scout.userId
                        )}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                          selectedScoutUserId === scout.userId
                            ? "bg-yellow-600/70 text-yellow-100 font-semibold"
                            : "text-slate-300 hover:text-slate-100 hover:bg-slate-700"
                        }`}
                      >
                        {scout.displayName}
                      </button>
                    </td>
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

      {/* Match assignment table */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Match Assignments ({qmMatches.length} matches)</p>
        {qmMatches.length === 0 ? (
          <p className="text-xs text-slate-500">No matches — sync TBA or create a mock event first.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-auto text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-slate-500 font-medium px-3 py-2 w-14">Match</th>
                  <th className="text-center text-red-400 font-medium px-2 py-2" colSpan={3}>Red</th>
                  <th className="text-center text-blue-400 font-medium px-2 py-2" colSpan={3}>Blue</th>
                </tr>
              </thead>
              <tbody>
                {qmMatches.map((m) => {
                  const slots = [
                    { alliance: "red" as const, pos: 1 as const, team: m.redAlliance[0] },
                    { alliance: "red" as const, pos: 2 as const, team: m.redAlliance[1] },
                    { alliance: "red" as const, pos: 3 as const, team: m.redAlliance[2] },
                    { alliance: "blue" as const, pos: 1 as const, team: m.blueAlliance[0] },
                    { alliance: "blue" as const, pos: 2 as const, team: m.blueAlliance[1] },
                    { alliance: "blue" as const, pos: 3 as const, team: m.blueAlliance[2] },
                  ];
                  const scoutedCount = slots.filter((s) =>
                    coverageSet.has(`${m.matchKey}:${s.alliance}:${s.pos}`)
                  ).length;
                  const assignedCount = (coverage ?? []).filter((c) => c.matchKey === m.matchKey).length;
                  const rowHasSelected = selectedScoutUserId !== null && slots.some((s) =>
                    assignedMap.get(`${m.matchKey}:${s.alliance}:${s.pos}`) === selectedScoutUserId
                  );

                  return (
                    <tr key={m.matchKey} className={`border-b border-slate-800/60 last:border-b-0 hover:bg-slate-800/20 ${rowHasSelected ? "bg-yellow-900/30" : ""}`}>
                      {/* Match label + coverage badge */}
                      <td className="px-3 py-0 align-middle w-14">
                        <p className="font-bold text-slate-200 whitespace-nowrap">
                          {m.matchKey.split("_").pop()?.toUpperCase()}
                        </p>
                        <p className={`text-xs mt-0.5 ${
                          scoutedCount === 6 ? "text-green-400" : assignedCount === 6 ? "text-blue-400" : "text-slate-600"
                        }`}>
                          {scoutedCount === 6 ? "✓" : `${assignedCount}/6`}
                        </p>
                      </td>

                      {/* 6 slots — each is a mini two-line cell: team number over scout name */}
                      {slots.map(({ alliance, pos, team }) => {
                        const slotKey = `${m.matchKey}:${alliance}:${pos}`;
                        const scouted = coverageSet.has(slotKey);
                        const currentUserId = assignedMap.get(slotKey);
                        const currentScout = (scouts as any[]).find((s) => s.userId === currentUserId);
                        const isHighlighted = selectedScoutUserId !== null && currentUserId === selectedScoutUserId;
                        const teamColor = alliance === "red" ? "text-red-300" : "text-blue-300";
                        const bgColor = isHighlighted
                          ? "bg-yellow-600/30"
                          : scouted
                            ? "bg-green-900/20"
                            : "";

                        return (
                          <td key={slotKey} className={`px-1.5 py-1.5 ${bgColor}`}>
                            {/* Team number */}
                            <p className={`font-mono font-semibold ${teamColor} mb-0.5`}>{team}</p>
                            {/* Scout assignment */}
                            {scouted ? (
                              <p className={`truncate max-w-[135px] ${isHighlighted ? "text-yellow-300 font-semibold" : "text-green-400"}`}>
                                ✓ {currentScout?.displayName ?? "—"}
                              </p>
                            ) : (
                              <select
                                value={currentUserId ?? ""}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignScout({
                                      eventKey: event.eventKey,
                                      matchKey: m.matchKey,
                                      userId: e.target.value as any,
                                      alliance,
                                      position: pos,
                                    });
                                  }
                                }}
                                className="w-full max-w-[135px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-300 focus:outline-none focus:border-blue-500"
                              >
                                <option value="">—</option>
                                {(scouts as any[]).map((u: any) => (
                                  <option key={u._id} value={u.userId}>{u.displayName}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
  const purgeExactDuplicates = useMutation(api.matchScouting.purgeExactDuplicates);
  const [purging, setPurging] = useState(false);

  if (!event) return <p className="text-slate-400 text-sm">No active event.</p>;
  if (!entries || !users) return <Spinner />;

  const userMap = new Map((users as any[]).map((u: any) => [u.userId, u.displayName]));

  // Group entries by matchKey:teamNumber to detect duplicates
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = `${e.matchKey}:${e.teamNumber}`;
    const group = groups.get(key) ?? [];
    group.push(e);
    groups.set(key, group);
  }

  // exactDupIds: ids of entries that are exact duplicates (same data), excluding the one to keep
  // conflictKeys: matchKey:teamNumber combos with differing data
  const exactDupIds = new Set<string>();
  const conflictKeys = new Set<string>();
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const firstData = JSON.stringify(group[0].data);
    const allIdentical = group.every((e) => JSON.stringify(e.data) === firstData);
    if (allIdentical) {
      const sorted = [...group].sort((a, b) => a.submittedAt - b.submittedAt);
      for (const e of sorted.slice(1)) exactDupIds.add(e._id);
    } else {
      conflictKeys.add(key);
    }
  }

  async function handlePurge() {
    if (!event) return;
    setPurging(true);
    try {
      const result = await purgeExactDuplicates({ eventKey: event.eventKey });
      alert(`Purged ${result.deleted} exact duplicate${result.deleted === 1 ? "" : "s"}.`);
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{entries.length} entries</p>

      {/* Duplicate summary banners */}
      {exactDupIds.size > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-700/50 text-sm">
          <span className="text-amber-300">
            {exactDupIds.size} exact duplicate{exactDupIds.size === 1 ? "" : "s"} detected (identical data)
          </span>
          <button
            type="button"
            onClick={handlePurge}
            disabled={purging}
            className="shrink-0 text-xs text-amber-200 hover:text-white transition-colors px-2 py-1 rounded border border-amber-700 hover:border-amber-500 disabled:opacity-50"
          >
            {purging ? "Purging…" : `Purge ${exactDupIds.size}`}
          </button>
        </div>
      )}
      {conflictKeys.size > 0 && (
        <div className="px-3 py-2 rounded-lg bg-red-950/60 border border-red-700/50 text-sm text-red-300">
          ⚠ {conflictKeys.size} match/robot combo{conflictKeys.size === 1 ? "" : "s"} have conflicting data — review below
        </div>
      )}

      <Card padding={false}>
        {entries.length === 0 && (
          <p className="px-4 py-3 text-sm text-slate-500">No entries yet.</p>
        )}
        {entries.map((e) => {
          const key = `${e.matchKey}:${e.teamNumber}`;
          const isExactDup = exactDupIds.has(e._id);
          const isConflict = conflictKeys.has(key);
          return (
            <div key={e._id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 last:border-b-0 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200 font-medium">
                  {e.matchKey.split("_").pop()?.toUpperCase()} — Team {e.teamNumber}
                </p>
                <p className="text-xs text-slate-500">
                  {e.alliance.toUpperCase()} {e.alliancePosition} · {userMap.get(e.scoutUserId) ?? "Unknown"} · {new Date(e.submittedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isExactDup && (
                  <span className="text-xs text-amber-400 border border-amber-800 rounded px-1.5 py-0.5">
                    duplicate
                  </span>
                )}
                {isConflict && (
                  <span className="text-xs text-red-400 border border-red-800 rounded px-1.5 py-0.5">
                    ⚠ conflict
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete entry for Team ${e.teamNumber} in ${e.matchKey}?`)) {
                      deleteEntry({ id: e._id });
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-900 hover:border-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
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

// ── Scouts Tab ─────────────────────────────────────────────────────────────────
function ScoutsTab() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const consistency = useQuery(
    api.scoutConsistency.getScoutConsistency,
    event ? { eventKey: event.eventKey } : "skip",
  );

  if (!event) return <p className="text-slate-400 text-sm">No active event.</p>;
  if (consistency === undefined) return <Spinner />;

  const fieldLabelMap = new Map(
    (config?.matchFields ?? []).map((f) => [f.id, f.label]),
  );

  function deviationColor(dev: number) {
    if (dev < 0.3) return "green" as const;
    if (dev < 0.7) return "yellow" as const;
    return "red" as const;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Deviation measures how far each scout's values differ from the consensus average across
        scouts for the same team. Lower is more consistent. Only fields with 2+ scouts per team
        are included.
      </p>
      {consistency.length === 0 ? (
        <p className="text-sm text-slate-500">No scouting entries yet for this event.</p>
      ) : (
        <Card padding={false}>
          {consistency.map((scout) => (
            <div key={scout.userId} className="px-4 py-3 border-b border-slate-800/50 last:border-b-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{scout.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {scout.entryCount} {scout.entryCount === 1 ? "entry" : "entries"} · {scout.uniqueTeams} {scout.uniqueTeams === 1 ? "team" : "teams"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Avg deviation:</span>
                  <Badge color={deviationColor(scout.overallDeviation)}>
                    {scout.overallDeviation.toFixed(2)}
                  </Badge>
                </div>
              </div>
              {Object.keys(scout.fieldDeviations).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(scout.fieldDeviations)
                    .sort((a, b) => b[1] - a[1])
                    .map(([fid, dev]) => (
                      <span key={fid} className="text-xs">
                        <span className="text-slate-400">{fieldLabelMap.get(fid) ?? fid}:</span>{" "}
                        <span className={dev < 0.3 ? "text-green-400" : dev < 0.7 ? "text-yellow-400" : "text-red-400"}>
                          {dev.toFixed(2)}
                        </span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── For Ryan Tab (Snake Game) ──────────────────────────────────────────────────
const CELL = 20;
const COLS = 20;
const ROWS = 20;
const CANVAS_W = CELL * COLS;
const CANVAS_H = CELL * ROWS;

type Point = { x: number; y: number };
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

const OPPOSITE: Record<Dir, Dir> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };

function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  let food: Point;
  do {
    food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (occupied.has(`${food.x},${food.y}`));
  return food;
}

function ForRyanTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }] as Point[],
    dir: "RIGHT" as Dir,
    nextDir: "RIGHT" as Dir,
    food: { x: 15, y: 10 } as Point,
    score: 0,
    best: 0,
    running: false,
    dead: false,
    started: false,
  });
  const [display, setDisplay] = useState({ score: 0, best: 0, dead: false, started: false });
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const SPEED = 130; // ms per tick

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(CANVAS_W, y * CELL); ctx.stroke();
    }

    // food
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // snake
    s.snake.forEach((seg: Point, i: number) => {
      const ratio = 1 - i / s.snake.length;
      ctx.fillStyle = i === 0 ? "#22c55e" : `hsl(${142 - ratio * 30}, 70%, ${30 + ratio * 20}%)`;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 4);
      ctx.fill();
    });
  }, []);

  const tick = useCallback((now: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    rafRef.current = requestAnimationFrame(tick);
    if (now - lastTickRef.current < SPEED) { draw(); return; }
    lastTickRef.current = now;

    s.dir = s.nextDir;
    const head = s.snake[0];
    const next: Point = {
      x: (head.x + (s.dir === "RIGHT" ? 1 : s.dir === "LEFT" ? -1 : 0) + COLS) % COLS,
      y: (head.y + (s.dir === "DOWN" ? 1 : s.dir === "UP" ? -1 : 0) + ROWS) % ROWS,
    };

    const hitSelf = s.snake.some((p: Point) => p.x === next.x && p.y === next.y);
    if (hitSelf) {
      s.running = false;
      s.dead = true;
      s.best = Math.max(s.best, s.score);
      setDisplay({ score: s.score, best: s.best, dead: true, started: true });
      draw();
      return;
    }

    const ate = next.x === s.food.x && next.y === s.food.y;
    const newSnake = [next, ...s.snake];
    if (!ate) newSnake.pop();
    else {
      s.score += 10;
      s.food = randomFood(newSnake);
    }
    s.snake = newSnake;
    setDisplay((d: typeof display) => ({ ...d, score: s.score }));
    draw();
  }, [draw]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    const initialSnake = [{ x: 10, y: 10 }];
    s.snake = initialSnake;
    s.dir = "RIGHT";
    s.nextDir = "RIGHT";
    s.food = randomFood(initialSnake);
    s.score = 0;
    s.running = true;
    s.dead = false;
    s.started = true;
    lastTickRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    setDisplay((d) => ({ ...d, score: 0, dead: false, started: true }));
  }, [tick]);

  useEffect(() => {
    draw();
    const handleKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const map: Record<string, Dir> = {
        ArrowUp: "UP", w: "UP", W: "UP",
        ArrowDown: "DOWN", s: "DOWN", S: "DOWN",
        ArrowLeft: "LEFT", a: "LEFT", A: "LEFT",
        ArrowRight: "RIGHT", d: "RIGHT", D: "RIGHT",
      };
      const newDir = map[e.key];
      if (newDir && newDir !== OPPOSITE[s.dir as Dir]) {
        e.preventDefault();
        s.nextDir = newDir;
        if (!s.running && !s.dead) startGame();
      }
      if ((e.key === " " || e.key === "Enter") && (!s.running || s.dead)) startGame();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw, startGame]);

  // touch swipe
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const s = stateRef.current;
    let newDir: Dir | null = null;
    if (Math.abs(dx) > Math.abs(dy)) newDir = dx > 0 ? "RIGHT" : "LEFT";
    else newDir = dy > 0 ? "DOWN" : "UP";
    if (newDir && newDir !== OPPOSITE[s.dir as Dir]) s.nextDir = newDir;
    if (!s.running && !s.dead) startGame();
    touchStart.current = null;
  };

  const dpadBtn = (dir: Dir, label: string) => (
    <button
      className="w-12 h-12 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-white text-lg font-bold select-none touch-none"
      onPointerDown={(e) => { e.preventDefault(); const s = stateRef.current; if (dir !== OPPOSITE[s.dir as Dir]) s.nextDir = dir; if (!s.running && !s.dead) startGame(); }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">For Ryan</h2>
        <p className="text-slate-400 text-sm">a gift from the scouting app</p>
      </div>

      <div className="flex gap-6 text-center">
        <div><div className="text-2xl font-bold text-green-400">{display.score}</div><div className="text-xs text-slate-500 uppercase tracking-wide">Score</div></div>
        <div><div className="text-2xl font-bold text-yellow-400">{display.best}</div><div className="text-xs text-slate-500 uppercase tracking-wide">Best</div></div>
      </div>

      <div className="relative" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-lg border border-slate-700 max-w-full"
          style={{ imageRendering: "pixelated", maxWidth: "min(400px, 95vw)", maxHeight: "min(400px, 95vw)", width: CANVAS_W, height: CANVAS_H }}
        />
        {!display.started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 rounded-lg gap-3">
            <div className="text-4xl">🐍</div>
            <div className="text-white font-bold text-lg">Snake</div>
            <button onClick={startGame} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold transition-colors">Play</button>
            <div className="text-slate-400 text-xs">Arrow keys / WASD or swipe</div>
          </div>
        )}
        {display.dead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 rounded-lg gap-3">
            <div className="text-3xl">💀</div>
            <div className="text-white font-bold text-lg">Game Over</div>
            <div className="text-slate-300 text-sm">Score: {display.score}</div>
            <button onClick={startGame} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold transition-colors">Play Again</button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1 md:hidden">
        <div>{dpadBtn("UP", "▲")}</div>
        <div className="flex gap-1">{dpadBtn("LEFT", "◀")}{dpadBtn("DOWN", "▼")}{dpadBtn("RIGHT", "▶")}</div>
      </div>
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
  { path: "scouts", label: "Scouts" },
  { path: "forryan", label: "For Ryan" },
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
          <Route path="scouts" element={<ScoutsTab />} />
          <Route path="forryan" element={<ForRyanTab />} />
          <Route path="*" element={<EventTab />} />
        </Routes>
      </div>
    </div>
  );
}
