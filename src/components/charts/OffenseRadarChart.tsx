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
import { NormalizedOffenseMetrics } from "../../lib/offenseMetrics";

interface Props {
  metrics: NormalizedOffenseMetrics;
  metricsB?: NormalizedOffenseMetrics;
  alliance?: "red" | "blue";
  labelA?: string;
  labelB?: string;
}

function OffenseTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", textAlign: "center" }}>
      <p style={{ color: "#94a3b8", marginBottom: "2px" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? "#e2e8f0", fontWeight: 600 }}>
          {p.name ? `${p.name}: ` : ""}{p.payload[i === 0 ? "rawA" : "rawB"] ?? p.value}
        </p>
      ))}
    </div>
  );
}

const SUBJECTS = ["Auto Balls", "Tele Balls", "Fed Balls", "EPA"] as const;
const KEYS: (keyof NormalizedOffenseMetrics)[] = ["autoBalls", "teleBalls", "fedBalls", "epa"];
const RAW_KEYS: (keyof NormalizedOffenseMetrics)[] = ["rawAutoBalls", "rawTeleBalls", "rawFedBalls", "rawEpa"];

export default function OffenseRadarChart({ metrics, metricsB, alliance = "red", labelA, labelB }: Props) {
  const colorA = alliance === "red" ? "#ef4444" : "#3b82f6";
  const colorB = "#3b82f6";

  const data = SUBJECTS.map((subject, i) => ({
    subject,
    a: Math.round((metrics[KEYS[i]] as number) * 10) / 10,
    b: metricsB ? Math.round((metricsB[KEYS[i]] as number) * 10) / 10 : undefined,
    rawA: Math.round((metrics[RAW_KEYS[i]] as number) * 10) / 10,
    rawB: metricsB ? Math.round((metricsB[RAW_KEYS[i]] as number) * 10) / 10 : undefined,
    fullMark: 5,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
        <Tooltip content={<OffenseTooltip />} />
        <Radar
          name={labelA ?? ""}
          dataKey="a"
          stroke={colorA}
          fill={colorA}
          fillOpacity={metricsB ? 0.2 : 0.3}
        />
        {metricsB && (
          <Radar
            name={labelB ?? ""}
            dataKey="b"
            stroke={colorB}
            fill={colorB}
            fillOpacity={0.2}
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}
