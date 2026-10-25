import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/picklist/mine", label: "My List" },
  { to: "/picklist/consensus", label: "Team List" },
  { to: "/picklist/selection", label: "Selection" },
] as const;

/** Tab bar shared by the My List, Team List and Alliance Selection views. */
export default function PickListTabs({ onCompare }: { onCompare: () => void }) {
  return (
    <div className="flex border-b border-slate-800 bg-slate-950 shrink-0">
      {tabs.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 py-3 text-sm font-medium text-center transition-colors ${
              isActive
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
      <button
        onClick={onCompare}
        className="px-4 text-sm text-slate-400 hover:text-slate-200 shrink-0"
      >
        Compare
      </button>
    </div>
  );
}
