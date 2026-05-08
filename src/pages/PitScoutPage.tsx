import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveEvent } from "../hooks/useActiveEvent";
import { useActiveScoutingConfig } from "../hooks/useScoutingConfig";
import { EntryData } from "../lib/configTypes";
import DynamicScoutingForm from "../components/forms/DynamicScoutingForm";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

function PitQuestionsAnswerWidget({
  eventKey,
  teamNumber,
}: {
  eventKey: string;
  teamNumber: number;
}) {
  const questions = useQuery(api.pitQuestions.getQuestionsForTeam, { eventKey, teamNumber });
  const answerQuestion = useMutation(api.pitQuestions.answerQuestion);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  if (questions === undefined) return <Spinner />;
  if (questions.length === 0) return <p className="text-xs text-slate-500">No questions from scouts.</p>;

  async function handleAnswer(id: string) {
    const text = inputs[id]?.trim();
    if (!text) return;
    setSaving(id);
    try {
      await answerQuestion({ questionId: id as any, answer: text });
      setInputs((prev) => ({ ...prev, [id]: "" }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div key={q._id} className="space-y-1.5">
          <p className="text-sm text-slate-200">{q.question}</p>
          {q.answer ? (
            <p className="text-xs text-green-400 pl-2 border-l border-green-700">{q.answer}</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Answer…"
                value={inputs[q._id] ?? ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [q._id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleAnswer(q._id)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleAnswer(q._id)}
                disabled={!inputs[q._id]?.trim() || saving === q._id}
                className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors shrink-0"
              >
                {saving === q._id ? "…" : "Save"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PitScoutPage() {
  const event = useActiveEvent();
  const config = useActiveScoutingConfig();
  const submitPit = useMutation(api.pitScouting.submitPitEntry);
  const generateUploadUrl = useMutation(api.pitScouting.generateUploadUrl);
  const removePitPhoto = useMutation(api.pitScouting.removePitPhoto);

  const teams = useQuery(
    api.teams.getTeamsForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const allQuestions = useQuery(
    api.pitQuestions.getAllQuestionsForEvent,
    event ? { eventKey: event.eventKey } : "skip",
  );
  // Need existing pit entries to show check badges on cards
  const allPitEntries = useQuery(
    api.pitScouting.getAllPitEntries,
    event ? { eventKey: event.eventKey } : "skip",
  );
  const pitCardPhotoUrls = useQuery(
    api.pitScouting.getPitCardPhotoUrls,
    event ? { eventKey: event.eventKey } : "skip",
  );

  const [teamNumber, setTeamNumber] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Teams with at least one unanswered question
  const teamsWithOpenQuestions = useMemo(() => {
    const s = new Set<number>();
    for (const q of allQuestions ?? []) {
      if (!q.answer) s.add(q.teamNumber);
    }
    return s;
  }, [allQuestions]);

  // Teams that already have a pit entry
  const teamsWithEntry = useMemo(() => {
    const s = new Set<number>();
    for (const e of allPitEntries ?? []) s.add(e.teamNumber);
    return s;
  }, [allPitEntries]);

  const existingEntry = useQuery(
    api.pitScouting.getPitEntryForTeam,
    event && teamNumber
      ? { eventKey: event.eventKey, teamNumber: Number(teamNumber) }
      : "skip",
  );

  const existingStorageIds = (existingEntry?.photoStorageIds as string[] | undefined) ?? [];
  const photoUrls = useQuery(
    api.pitScouting.getPitPhotoUrls,
    existingStorageIds.length > 0
      ? { storageIds: existingEntry!.photoStorageIds as any }
      : "skip",
  );

  const isEditing = existingEntry != null;

  if (!event)
    return (
      <div className="p-6 text-center text-slate-400">
        No active event. Ask an admin to set one up.
      </div>
    );
  if (!config)
    return (
      <div className="flex h-full items-center justify-center">
        {config === undefined ? (
          <Spinner />
        ) : (
          <p className="text-slate-400">No scouting config active.</p>
        )}
      </div>
    );

  const sortedTeams = teams
    ? [...teams].sort((a, b) => a.teamNumber - b.teamNumber)
    : [];

  async function uploadPhotos(): Promise<string[]> {
    const ids: string[] = [];
    for (const file of photos) {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      ids.push(storageId);
    }
    return ids;
  }

  async function handleSubmit(data: EntryData) {
    if (!event || !config || !teamNumber) return;
    setUploading(photos.length > 0);
    const newPhotoIds = photos.length > 0 ? await uploadPhotos() : [];
    setUploading(false);
    const allPhotoIds = [...existingStorageIds, ...newPhotoIds];
    await submitPit({
      eventKey: event.eventKey,
      teamNumber: Number(teamNumber),
      configId: config._id,
      data,
      photoStorageIds: allPhotoIds.length > 0 ? (allPhotoIds as any) : undefined,
    });
    setPhotos([]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleRemovePhoto(storageId: string) {
    if (!event || !teamNumber) return;
    await removePitPhoto({
      eventKey: event.eventKey,
      teamNumber: Number(teamNumber),
      storageId: storageId as any,
    });
    if (lightboxIdx !== null) setLightboxIdx(null);
  }

  function selectTeam(num: string) {
    setTeamNumber(num);
    setPhotos([]);
    setSaved(false);
    setLightboxIdx(null);
  }

  const validPhotoUrls = (photoUrls ?? []).filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-full">
      {/* Lightbox */}
      {lightboxIdx !== null && validPhotoUrls[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="relative max-w-full max-h-full p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={validPhotoUrls[lightboxIdx]}
              alt="Robot photo"
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg"
            />
            <div className="flex items-center justify-between mt-3 gap-4">
              <button
                onClick={() => setLightboxIdx((i) => (i! > 0 ? i! - 1 : validPhotoUrls.length - 1))}
                className="text-slate-300 hover:text-white px-3 py-1 rounded bg-slate-800"
                disabled={validPhotoUrls.length <= 1}
              >
                ←
              </button>
              <span className="text-xs text-slate-400">
                {lightboxIdx + 1} / {validPhotoUrls.length}
              </span>
              <button
                onClick={() => setLightboxIdx((i) => (i! < validPhotoUrls.length - 1 ? i! + 1 : 0))}
                className="text-slate-300 hover:text-white px-3 py-1 rounded bg-slate-800"
                disabled={validPhotoUrls.length <= 1}
              >
                →
              </button>
              <button
                onClick={() => handleRemovePhoto(existingStorageIds[lightboxIdx])}
                className="text-red-400 hover:text-red-300 px-3 py-1 rounded bg-red-900/30 ml-2"
              >
                Remove
              </button>
              <button
                onClick={() => setLightboxIdx(null)}
                className="text-slate-400 hover:text-white ml-auto"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team card grid */}
      {!teamNumber ? (
        <div className="flex-1 overflow-y-auto p-3">
          {!teams ? (
            <div className="flex justify-center p-8"><Spinner /></div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">
                Select a team to begin pit scouting
                {teamsWithOpenQuestions.size > 0 && (
                  <span className="ml-2 text-red-400">
                    · {teamsWithOpenQuestions.size} team{teamsWithOpenQuestions.size !== 1 ? "s" : ""} with questions
                  </span>
                )}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {sortedTeams.map((t) => {
                  const hasQuestion = teamsWithOpenQuestions.has(t.teamNumber);
                  const hasEntry = teamsWithEntry.has(t.teamNumber);
                  const uploadedUrl = pitCardPhotoUrls?.[t.teamNumber];
                  const photoUrl = uploadedUrl ?? ((t as any).robotPhotoUrl as string | undefined);
                  return (
                    <button
                      key={t.teamNumber}
                      onClick={() => selectTeam(String(t.teamNumber))}
                      className={`relative flex flex-col items-center p-2 rounded-xl border transition-colors text-center ${
                        hasQuestion
                          ? "border-red-600 bg-red-900/20 hover:bg-red-900/30"
                          : "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                      }`}
                    >
                      {hasEntry && (
                        <span className="absolute top-1 right-1 text-green-400 text-xs leading-none">✓</span>
                      )}
                      {hasQuestion && (
                        <span className="absolute top-1 left-1 text-red-400 text-xs leading-none">!</span>
                      )}
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt=""
                          className="w-full aspect-square rounded-lg object-cover bg-slate-700 mb-1"
                        />
                      ) : (
                        <div className="w-full aspect-square rounded-lg bg-slate-700 flex items-center justify-center text-xl mb-1">
                          🤖
                        </div>
                      )}
                      <p className="text-lg font-bold text-slate-200 leading-tight">{t.teamNumber}</p>
                      <p className="text-xs text-slate-400 truncate w-full leading-tight mt-0.5">
                        {t.nickname}
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Selected team header */}
          <div className="p-4 space-y-3 border-b border-slate-800 bg-slate-950">
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectTeam("")}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ← Back
              </button>
              <div className="flex-1">
                <p className="font-bold text-slate-100">
                  Team {teamNumber}
                  {sortedTeams.find((t) => String(t.teamNumber) === teamNumber)?.nickname
                    ? ` — ${sortedTeams.find((t) => String(t.teamNumber) === teamNumber)!.nickname}`
                    : ""}
                </p>
              </div>
              {existingEntry !== undefined && (
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <Badge color="blue">Editing</Badge>
                  ) : (
                    <Badge color="gray">New</Badge>
                  )}
                  {saved && <Badge color="green">Saved ✓</Badge>}
                </div>
              )}
            </div>

            {/* Existing photos strip */}
            {validPhotoUrls.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  Photos ({validPhotoUrls.length})
                </p>
                <div className="flex gap-2 flex-wrap">
                  {validPhotoUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={url}
                        alt={`Photo ${i + 1}`}
                        onClick={() => setLightboxIdx(i)}
                        className="w-16 h-16 rounded-lg object-cover bg-slate-800 cursor-pointer hover:opacity-80 transition-opacity"
                      />
                      <button
                        onClick={() => handleRemovePhoto(existingStorageIds[i])}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-700 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Add Robot Photos (optional)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
              />
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  type="button"
                >
                  📷 Add Photos
                </Button>
                {photos.length > 0 && (
                  <span className="text-sm text-slate-400">
                    {photos.length} new photo{photos.length !== 1 ? "s" : ""} selected
                  </span>
                )}
              </div>
            </div>

            {/* Pit questions from scouts */}
            <div className="border-t border-slate-800 pt-3">
              <p className="text-xs text-slate-400 font-medium mb-2">Scout Questions</p>
              <PitQuestionsAnswerWidget
                eventKey={event.eventKey}
                teamNumber={Number(teamNumber)}
              />
            </div>
          </div>

          {existingEntry === undefined ? (
            <div className="flex-1 flex items-center justify-center"><Spinner /></div>
          ) : uploading ? (
            <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
              <Spinner />
              <span>Uploading photos…</span>
            </div>
          ) : (
            <DynamicScoutingForm
              key={teamNumber}
              config={config as any}
              formType="pit"
              initialData={existingEntry?.data as EntryData | undefined}
              onSubmit={handleSubmit}
              submitLabel={isEditing ? `Update Pit Entry — Team ${teamNumber}` : `Save Pit Entry — Team ${teamNumber}`}
            />
          )}
        </>
      )}
    </div>
  );
}
