import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { NavLink } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import Badge from "../ui/Badge";

const navItems = [
  { to: "/scout", label: "Scout", roles: ["scout", "admin"] },
  { to: "/pit", label: "Pit", roles: ["scout", "admin"] },
  { to: "/data", label: "Data", roles: ["scout", "analyst", "admin"] },
  { to: "/match-analysis", label: "Analysis", roles: ["scout", "analyst", "admin"] },
  { to: "/picklist/mine", label: "Pick List", roles: ["scout", "admin"] },
  { to: "/admin/event", label: "Admin", roles: ["admin"] },
] as const;

export default function TopBar() {
  const { signOut } = useAuthActions();
  const event = useQuery(api.events.getActiveEvent);
  const profile = useQuery(api.users.getCurrentUserProfile);
  const role = profile?.role;

  const visible = navItems.filter((item) =>
    role ? (item.roles as readonly string[]).includes(role) : false,
  );

  return (
    <header className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-2 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <span className="font-bold text-blue-400 text-lg">⚙ Scout</span>
        {event && <Badge color="blue">{event.name}</Badge>}
      </div>

      <nav className="hidden sm:flex items-center gap-1">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "text-blue-400 bg-slate-800"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {profile && (
          <span className="hidden sm:block text-sm text-slate-400">
            {profile.displayName}
            <Badge color="gray" className="ml-2">{profile.role}</Badge>
          </span>
        )}
        <button
          onClick={() => signOut()}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
