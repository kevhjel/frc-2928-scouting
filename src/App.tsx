import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { cacheGet, cacheSet } from "./lib/localCache";
import AppShell from "./components/layout/AppShell";
import LoginPage from "./auth/LoginPage";
import ScoutPage from "./pages/ScoutPage";
import PitScoutPage from "./pages/PitScoutPage";
import DataPage from "./pages/DataPage";
import TeamPage from "./pages/TeamPage";
import PickListPage from "./pages/PickListPage";
import AllianceBuilderPage from "./pages/AllianceBuilderPage";
import AdminPage from "./pages/AdminPage";
import MatchAnalysisPage from "./pages/MatchAnalysisPage";
import NotFoundPage from "./pages/NotFoundPage";
import Spinner from "./components/ui/Spinner";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureProfile = useMutation(api.users.ensureProfile);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("frc_was_authenticated", "1");
      ensureProfile({}).catch(() => {});
    }
  }, [isAuthenticated]);

  // Offline bypass: if Convex is unreachable but the user was previously authenticated,
  // let them through so the cached scout form is accessible.
  const wasAuthenticated = localStorage.getItem("frc_was_authenticated") === "1";
  if (isLoading && !navigator.onLine && wasAuthenticated) return <>{children}</>;

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const profile = useQuery(api.users.getCurrentUserProfile);
  if (profile === undefined)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  if (profile?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const profile = useQuery(api.users.getCurrentUserProfile);

  useEffect(() => {
    if (profile !== undefined) cacheSet("frc_cached_role", profile?.role ?? null);
  }, [profile]);

  if (profile === undefined) {
    // Offline: use cached role to redirect without a spinner
    if (!navigator.onLine) {
      const cachedRole = cacheGet<string | null>("frc_cached_role");
      if (cachedRole !== undefined) {
        return cachedRole === "analyst"
          ? <Navigate to="/data" replace />
          : <Navigate to="/scout" replace />;
      }
    }
    return <Spinner />;
  }
  if (profile?.role === "analyst") return <Navigate to="/data" replace />;
  return <Navigate to="/scout" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="scout" element={<ScoutPage />} />
          <Route path="pit" element={<PitScoutPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="team/:teamNumber" element={<TeamPage />} />
          <Route path="picklist/mine" element={<PickListPage view="mine" />} />
          <Route
            path="picklist/consensus"
            element={<PickListPage view="consensus" />}
          />
          <Route path="alliance-builder" element={<AllianceBuilderPage />} />
          <Route path="match-analysis" element={<MatchAnalysisPage />} />
          <Route
            path="admin/*"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
