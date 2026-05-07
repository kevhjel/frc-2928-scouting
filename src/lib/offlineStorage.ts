import { EntryData } from "./configTypes";

export interface QueuedEntry {
  id: string;
  type: "match" | "pit";
  payload: any;
  queuedAt: number;
  retryCount: number;
}

const KEY = "frc_scout_offline_queue";

export function getQueue(): QueuedEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function enqueue(type: "match" | "pit", payload: any): QueuedEntry {
  const entry: QueuedEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    queuedAt: Date.now(),
    retryCount: 0,
  };
  const queue = getQueue();
  queue.push(entry);
  localStorage.setItem(KEY, JSON.stringify(queue));
  return entry;
}

export function dequeue(id: string) {
  const queue = getQueue().filter((e) => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(queue));
}

export function incrementRetry(id: string) {
  const queue = getQueue().map((e) =>
    e.id === id ? { ...e, retryCount: e.retryCount + 1 } : e,
  );
  localStorage.setItem(KEY, JSON.stringify(queue));
}
