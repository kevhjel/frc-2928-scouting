import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useActiveScoutingConfig() {
  return useQuery(api.scoutingConfig.getActiveConfig);
}
