import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { TeamStats } from "../../../convex/stats";
import { ScoutingField } from "../../lib/configTypes";

interface Props {
  stats: TeamStats;
  statsB?: TeamStats;
  labelA?: string;
  labelB?: string;
  fields: ScoutingField[];
}

const RADAR_FIELD_IDS = [
  "notes_feed_quality",
  "notes_speed",
  "notes_driver_skill",
  "tele_defense_quality",
  "tele_defense_handling",
];

export default function TeamRadarChart({ stats, statsB, labelA, labelB, fields }: Props) {
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
        <Radar
          name={labelA ?? "Team"}
          dataKey="a"
          stroke="#ef4444"
          fill="#ef4444"
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
