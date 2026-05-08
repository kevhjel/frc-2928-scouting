import { NavLink } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const navItems = [
  { to: "/scout", label: "Scout", icon: "📋", roles: ["scout", "admin"] },
  { to: "/pit", label: "Pit", icon: "🔧", roles: ["scout", "admin"] },
  { to: "/data", label: "Data", icon: "📊", roles: ["scout", "analyst", "admin"] },
  { to: "/match-analysis", label: "Analysis", icon: "🔬", roles: ["scout", "analyst", "admin"] },
  { to: "/picklist/mine", label: "Pick List", icon: "🏆", roles: ["scout", "admin"] },
  { to: "/alliance-builder", label: "Alliances", icon: "🤝", roles: ["scout", "analyst", "admin"] },
  { to: "/admin/event", label: "Admin", icon: "⚙️", roles: ["admin"] },
] as const;

export default function BottomNav() {
  const profile = useQuery(api.users.getCurrentUserProfile);
  const role = profile?.role;

  const visible = navItems.filter((item) =>
    role ? (item.roles as readonly string[]).includes(role) : false,
  );

  return (
    <nav className="sm:hidden bg-slate-900 border-t border-slate-800 shrink-0">
      <div className="flex">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                isActive ? "text-blue-400" : "text-slate-500"
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="mt-0.5">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
