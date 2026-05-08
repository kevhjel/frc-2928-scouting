import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useNavVisibility } from "../../context/NavVisibility";

const navItems = [
  { to: "/scout", label: "Scout", icon: "📋", matchPrefix: "/scout", roles: ["scout", "admin"] },
  { to: "/pit", label: "Pit", icon: "🔧", matchPrefix: "/pit", roles: ["scout", "admin"] },
  { to: "/data", label: "Data", icon: "📊", matchPrefix: "/data", roles: ["scout", "analyst", "admin"] },
  { to: "/match-analysis", label: "Analysis", icon: "🔬", matchPrefix: "/match-analysis", roles: ["scout", "analyst", "admin"] },
  { to: "/picklist/mine", label: "Pick List", icon: "🏆", matchPrefix: "/picklist", roles: ["scout", "admin"] },
  { to: "/alliance-builder", label: "Alliances", icon: "🤝", matchPrefix: "/alliance-builder", roles: ["scout", "analyst", "admin"] },
  { to: "/admin/event", label: "Admin", icon: "⚙️", matchPrefix: "/admin", roles: ["admin"] },
] as const;

export default function BottomNav() {
  const profile = useQuery(api.users.getCurrentUserProfile);
  const role = profile?.role;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { hasUnsavedData } = useNavVisibility();
  const [pendingTo, setPendingTo] = useState<string | null>(null);

  const visible = navItems.filter((item) =>
    role ? (item.roles as readonly string[]).includes(role) : false,
  );

  return (
    <nav className="sm:hidden bg-slate-900 border-t border-slate-800 shrink-0">
      {pendingTo && (
        <div className="bg-orange-950 border-t border-orange-800 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-orange-200">Unsaved data will be lost</span>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingTo(null)}
              className="text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { navigate(pendingTo); setPendingTo(null); }}
              className="text-orange-300 font-semibold hover:text-orange-100 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      )}
      <div className="flex">
        {visible.map((item) => {
          const active = pathname.startsWith(item.matchPrefix);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                active ? "text-blue-400" : "text-slate-500"
              }`}
              onClick={(e) => {
                if (hasUnsavedData && !active) {
                  e.preventDefault();
                  setPendingTo(item.to);
                }
              }}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
