import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cacheGet, cacheSet } from "../lib/localCache";

const CACHE_KEY = "frc_cached_config";

export function useActiveScoutingConfig() {
  const live = useQuery(api.scoutingConfig.getActiveConfig);

  useEffect(() => {
    if (live !== undefined) cacheSet(CACHE_KEY, live);
  }, [live]);

  if (live !== undefined) return live;
  return cacheGet(CACHE_KEY) as typeof live;
}
