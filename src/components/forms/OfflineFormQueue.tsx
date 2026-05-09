import { useEffect, useState } from "react";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

export default function OfflineFormQueue() {
  const { queue, retryAll } = useOfflineQueue();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (isOnline && queue.length === 0) return null;

  const pending = queue.length;

  return (
    <div className="fixed bottom-20 right-3 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {expanded && (
        <div
          className={`rounded-xl border shadow-lg px-4 py-3 text-sm w-52 ${
            isOnline
              ? "bg-yellow-900/95 border-yellow-700 text-yellow-100"
              : "bg-orange-950/95 border-orange-800 text-orange-100"
          }`}
        >
          <p className="font-medium mb-2">
            {isOnline
              ? `${pending} entr${pending === 1 ? "y" : "ies"} pending sync`
              : pending > 0
                ? `Offline — ${pending} entr${pending === 1 ? "y" : "ies"} queued`
                : "You are offline"}
          </p>
          {isOnline && pending > 0 && (
            <button
              type="button"
              onClick={() => { retryAll(); setExpanded(false); }}
              className="w-full text-xs bg-yellow-700/60 hover:bg-yellow-700 rounded-lg py-1.5 transition-colors"
            >
              Retry Now
            </button>
          )}
        </div>
      )}

      {/* Floating pill */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg transition-colors ${
          isOnline
            ? "bg-yellow-900/90 border-yellow-700 text-yellow-200 hover:bg-yellow-800/90"
            : "bg-orange-950/90 border-orange-800 text-orange-200 hover:bg-orange-900/90"
        }`}
      >
        {isOnline ? (
          <>
            <span>↑</span>
            <span>{pending}</span>
          </>
        ) : (
          <>
            <span>📵</span>
            {pending > 0 && <span>{pending}</span>}
          </>
        )}
      </button>
    </div>
  );
}
