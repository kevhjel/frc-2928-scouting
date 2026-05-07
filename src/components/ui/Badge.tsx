interface BadgeProps {
  children: React.ReactNode;
  color?: "blue" | "green" | "red" | "yellow" | "gray" | "purple";
  className?: string;
}

const colors = {
  blue: "bg-blue-900/50 text-blue-300 border-blue-800",
  green: "bg-green-900/50 text-green-300 border-green-800",
  red: "bg-red-900/50 text-red-300 border-red-800",
  yellow: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  gray: "bg-slate-800 text-slate-400 border-slate-700",
  purple: "bg-purple-900/50 text-purple-300 border-purple-800",
};

export default function Badge({ children, color = "gray", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[color]} ${className}`}
    >
      {children}
    </span>
  );
}
