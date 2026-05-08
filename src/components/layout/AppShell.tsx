import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import OfflineFormQueue from "../forms/OfflineFormQueue";
import { NavVisibilityProvider, useNavVisibility } from "../../context/NavVisibility";

function Shell() {
  const { hideNav } = useNavVisibility();
  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <OfflineFormQueue />
      <main className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function AppShell() {
  return (
    <NavVisibilityProvider>
      <Shell />
    </NavVisibilityProvider>
  );
}
