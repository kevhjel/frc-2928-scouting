import { useEffect, useState } from "react";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import Button from "../ui/Button";

export default function OfflineFormQueue() {
  const { queue, retryAll } = useOfflineQueue();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return (
    <div
      className={`fixed top-14 left-0 right-0 z-30 border-b px-4 py-2 flex items-center justify-between text-sm ${
        isOnline
          ? "bg-yellow-900/90 border-yellow-700"
          : "bg-orange-950/90 border-orange-800"
      }`}
    >
      <span className={isOnline ? "text-yellow-200" : "text-orange-200"}>
        {isOnline
          ? `⚠ ${queue.length} entr${queue.length === 1 ? "y" : "ies"} pending sync`
          : queue.length > 0
            ? `📵 Offline — ${queue.length} entr${queue.length === 1 ? "y" : "ies"} will sync on reconnect`
            : "📵 You are offline"}
      </span>
      {isOnline && queue.length > 0 && (
        <Button variant="secondary" size="sm" onClick={retryAll}>
          Retry Now
        </Button>
      )}
    </div>
  );
}
