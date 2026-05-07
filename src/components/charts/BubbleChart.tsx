import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TeamStats } from "../../../convex/stats";

interface Field {
  id: string;
  label: string;
}

interface Props {
  teams: TeamStats[];
  fields: Field[];
  xFieldId: string;
  yFieldId: string;
}

function getFieldValue(team: TeamStats, fieldId: string): number {
  if (fieldId === "opr") return team.opr ?? 0;
  if (fieldId === "epa") return team.epa ?? 0;
  const fs = team.fieldStats[fieldId];
  return fs?.type === "numeric" ? fs.avg : 0;
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#3b82f6" fillOpacity={0.8} stroke="#1d4ed8" strokeWidth={1} />
      <text
        x={cx}
        y={cy - 9}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={10}
      >
        {payload.teamNumber}
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-lg">
      <p className="font-semibold mb-1">{d.teamNumber} — {d.nickname}</p>
      <p>{d.xLabel}: <span className="text-blue-300">{d.x.toFixed(2)}</span></p>
      <p>{d.yLabel}: <span className="text-blue-300">{d.y.toFixed(2)}</span></p>
    </div>
  );
}

export default function BubbleChart({ teams, fields, xFieldId, yFieldId }: Props) {
  const allFields = [
    { id: "opr", label: "OPR" },
    { id: "epa", label: "EPA" },
    ...fields,
  ];
  const xField = allFields.find((f) => f.id === xFieldId);
  const yField = allFields.find((f) => f.id === yFieldId);

  const data = teams.map((t) => ({
    x: getFieldValue(t, xFieldId),
    y: getFieldValue(t, yFieldId),
    teamNumber: t.teamNumber,
    nickname: t.nickname,
    xLabel: xField?.label ?? xFieldId,
    yLabel: yField?.label ?? yFieldId,
  }));

  return (
    <ResponsiveContainer width="100%" height={420}>
      <ScatterChart margin={{ top: 24, right: 24, bottom: 32, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          type="number"
          dataKey="x"
          name={xField?.label}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          label={{ value: xField?.label ?? xFieldId, position: "insideBottom", offset: -16, fill: "#64748b", fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yField?.label}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          label={{ value: yField?.label ?? yFieldId, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Scatter data={data} shape={<CustomDot />} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
