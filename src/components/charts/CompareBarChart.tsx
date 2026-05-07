import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TeamStats } from "../../../convex/stats";

interface Props {
  teams: TeamStats[];
  fieldId: string;
  fieldLabel: string;
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];

export default function CompareBarChart({ teams, fieldId, fieldLabel }: Props) {
  const data = teams.map((t) => {
    const fs = t.fieldStats[fieldId];
    const value = fs?.type === "numeric" ? fs.avg : fs?.type === "boolean" ? fs.truePercent : 0;
    return { team: String(t.teamNumber), value: Math.round((value ?? 0) * 100) / 100 };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="team" tick={{ fill: "#94a3b8", fontSize: 12 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
          labelStyle={{ color: "#cbd5e1" }}
          itemStyle={{ color: "#94a3b8" }}
        />
        <Bar dataKey="value" name={fieldLabel} fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
