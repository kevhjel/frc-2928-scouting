import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import Button from "../ui/Button";

export default function OfflineFormQueue() {
  const { queue, retryAll } = useOfflineQueue();
  if (queue.length === 0) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-30 bg-yellow-900/90 border-b border-yellow-700 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-yellow-200">
        ⚠ {queue.length} entr{queue.length === 1 ? "y" : "ies"} pending sync
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={retryAll}
        disabled={!navigator.onLine}
      >
        Retry Now
      </Button>
    </div>
  );
}
