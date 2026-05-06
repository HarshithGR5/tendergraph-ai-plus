"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend
} from "recharts";
import type { Tender } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  ELIGIBLE: "#16a34a",
  NOT_ELIGIBLE: "#dc2626",
  NEEDS_MANUAL_REVIEW: "#d97706",
  PENDING: "#94a3b8",
};

interface TenderActivityChartProps { tenders: Tender[]; }

export function TenderStatusChart({ tenders }: TenderActivityChartProps) {
  const counts: Record<string, number> = {};
  tenders.forEach((t) => {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  });
  const data = Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Tender Pipeline Status</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface VerdictDistChartProps {
  data: { eligible: number; not_eligible: number; review: number; pending: number };
}

export function VerdictDistributionChart({ data }: VerdictDistChartProps) {
  const chartData = [
    { name: "Eligible", value: data.eligible, color: "#16a34a" },
    { name: "Not Eligible", value: data.not_eligible, color: "#dc2626" },
    { name: "Needs Review", value: data.review, color: "#d97706" },
    { name: "Pending", value: data.pending, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  if (!chartData.length) return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-center h-48">
      <p className="text-sm text-slate-400">No verdict data yet</p>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Bidder Verdict Distribution</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
