import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import OfflineFormQueue from "../forms/OfflineFormQueue";

export default function AppShell() {
  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-0">
        <Outlet />
      </main>
      <BottomNav />
      <OfflineFormQueue />
    </div>
  );
}
