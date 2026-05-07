import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useActiveEvent() {
  return useQuery(api.events.getActiveEvent);
}
