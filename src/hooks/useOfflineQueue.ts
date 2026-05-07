import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  dequeue,
  getQueue,
  incrementRetry,
  QueuedEntry,
} from "../lib/offlineStorage";

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedEntry[]>(getQueue);
  const submitMatch = useMutation(api.matchScouting.submitMatchEntry);
  const submitPit = useMutation(api.pitScouting.submitPitEntry);

  const refresh = () => setQueue(getQueue());

  async function retryEntry(entry: QueuedEntry) {
    try {
      if (entry.type === "match") {
        await submitMatch(entry.payload);
      } else {
        await submitPit(entry.payload);
      }
      dequeue(entry.id);
    } catch {
      incrementRetry(entry.id);
    }
    refresh();
  }

  async function retryAll() {
    if (!navigator.onLine) return;
    const current = getQueue();
    for (const entry of current) {
      await retryEntry(entry);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && getQueue().length > 0) {
        retryAll();
      }
      refresh();
    }, 10_000);
    window.addEventListener("online", retryAll);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", retryAll);
    };
  }, []);

  return { queue, retryAll, refresh };
}
