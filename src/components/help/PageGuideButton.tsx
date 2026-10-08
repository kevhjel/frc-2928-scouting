import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import Modal from "../ui/Modal";
import { getGuideForPath } from "./pageGuides";

const SEEN_KEY = "frc_seen_guides";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  try {
    const seen = readSeen();
    if (!seen.includes(id))
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
  } catch {
    // storage unavailable — the hint dot just keeps showing
  }
}

/** "?" button in the top bar that opens a how-to guide for the current page. */
export default function PageGuideButton() {
  const { pathname } = useLocation();
  const guide = getGuideForPath(pathname);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);

  if (!guide) return null;
  const unseen = !seen.includes(guide.id);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          markSeen(guide.id);
          setSeen(readSeen());
        }}
        title={`How to use ${guide.title}`}
        aria-label={`How to use ${guide.title}`}
        className="relative flex items-center justify-center w-7 h-7 rounded-full border border-slate-700 text-slate-400 text-sm font-semibold hover:text-slate-100 hover:border-slate-500 transition-colors"
      >
        ?
        {/* Hint dot until the user has opened this page's guide once */}
        {unseen && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500" />
        )}
      </button>

      {/* Portal to body so the guide stacks above the sticky header and offline banner */}
      {createPortal(
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={`How to use: ${guide.title}`}
          size="lg"
        >
          <div className="max-h-[65vh] overflow-y-auto -mx-1 px-1 space-y-4">
            <p className="text-sm text-slate-300">{guide.intro}</p>
            {guide.sections.map((s) => (
              <div key={s.heading}>
                <p className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-1.5">
                  {s.heading}
                </p>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5 marker:text-slate-600">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>,
        document.body,
      )}
    </>
  );
}
