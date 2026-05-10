import { useState } from "react";

interface Note {
  matchLabel: string;
  text: string;
}

function NoteGroup({ label, notes }: { label: string; notes: Note[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/50 text-left"
      >
        <span>
          {label}{" "}
          <span className="text-slate-500">({notes.length})</span>
        </span>
        <span className="text-slate-500 text-[10px]">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 px-3 py-2 space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-xs text-slate-500 shrink-0 font-mono">{n.matchLabel}</span>
              <p className="text-xs text-slate-300 italic">{n.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Entry {
  _id: string;
  matchKey: string;
  data: Record<string, any>;
}

interface Field {
  id: string;
  label: string;
  type: string;
}

interface Props {
  entries: Entry[];
  matchFields: Field[];
}

export default function TeamNotesSection({ entries, matchFields }: Props) {
  const groups = matchFields
    .filter((f) => f.type === "text")
    .map((f) => ({
      id: f.id,
      label: f.label,
      notes: entries
        .filter((e) => e.data?.[f.id] && String(e.data[f.id]).trim())
        .map((e) => ({
          matchLabel: e.matchKey.split("_").pop()?.toUpperCase() ?? e.matchKey,
          text: String(e.data[f.id]),
        })),
    }))
    .filter((g) => g.notes.length > 0);

  if (!groups.length) return null;

  return (
    <div className="space-y-1">
      {groups.map((g) => (
        <NoteGroup key={g.id} label={g.label} notes={g.notes} />
      ))}
    </div>
  );
}
