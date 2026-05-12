import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cacheGet, cacheSet } from "../lib/localCache";

const CACHE_KEY = "frc_cached_event";

export function useActiveEvent() {
  const live = useQuery(api.events.getActiveEvent);

  useEffect(() => {
    if (live !== undefined) cacheSet(CACHE_KEY, live);
  }, [live]);

  if (live !== undefined) return live;
  return cacheGet(CACHE_KEY) as typeof live;
}
