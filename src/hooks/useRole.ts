import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRole() {
  const profile = useQuery(api.users.getCurrentUserProfile);
  return profile?.role ?? null;
}
