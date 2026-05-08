import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from "recharts";

function RadarTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", textAlign: "center" }}>
      <p style={{ color: "#94a3b8", marginBottom: "2px" }}>{label}</p>
      <p style={{ color: "#e2e8f0", fontWeight: 600 }}>{payload[0]?.value}</p>
    </div>
  );
}
import { TeamStats } from "../../../convex/stats";
import { ScoutingField } from "../../lib/configTypes";

interface Props {
  stats: TeamStats;
  statsB?: TeamStats;
  labelA?: string;
  labelB?: string;
  fields: ScoutingField[];
  color?: string;
}

const RADAR_FIELD_IDS = [
  "notes_feed_quality",
  "notes_speed",
  "notes_driver_skill",
  "tele_defense_quality",
  "tele_defense_handling",
];

export default function TeamRadarChart({ stats, statsB, labelA, labelB, fields, color }: Props) {
  const primaryColor = color ?? "#ef4444";
  const radarFields = RADAR_FIELD_IDS.map((id) => fields.find((f) => f.id === id)).filter(Boolean) as typeof fields;

  const data = radarFields.map((f) => {
    const fsA = stats.fieldStats[f.id];
    const valA = fsA?.type === "numeric" ? Math.round(fsA.avg * 10) / 10 : 0;
    const fsB = statsB?.fieldStats[f.id];
    const valB = fsB?.type === "numeric" ? Math.round(fsB.avg * 10) / 10 : undefined;
    return { subject: f.label, a: valA, b: valB, fullMark: 5 };
  });

  if (data.length < 3) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
        <Tooltip content={<RadarTooltip />} />
        <Radar
          name={labelA ?? "Team"}
          dataKey="a"
          stroke={primaryColor}
          fill={primaryColor}
          fillOpacity={statsB ? 0.2 : 0.3}
        />
        {statsB && (
          <Radar
            name={labelB ?? "Team B"}
            dataKey="b"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}
