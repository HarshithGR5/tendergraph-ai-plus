"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LabelList,
} from "recharts";
import type { Tender } from "@/lib/types";

export function TenderStatusChart({ tenders }: { tenders: Tender[] }) {
  const counts: Record<string, number> = {};
  tenders.forEach((t) => {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  });
  const data = Object.entries(counts).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Tender Pipeline Status</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface VerdictDistChartProps {
  data: { eligible: number; not_eligible: number; review: number; pending: number };
  title?: string;
}

const VERDICT_CONFIG = [
  { key: "eligible",     label: "Eligible",      color: "#16a34a", bg: "#dcfce7" },
  { key: "review",       label: "Needs Review",  color: "#d97706", bg: "#fef3c7" },
  { key: "not_eligible", label: "Not Eligible",  color: "#dc2626", bg: "#fee2e2" },
  { key: "pending",      label: "Pending",       color: "#94a3b8", bg: "#f1f5f9" },
] as const;

export function VerdictDistributionChart({ data, title = "Bidder Verdict Breakdown" }: VerdictDistChartProps) {
  const rows = VERDICT_CONFIG.map((cfg) => ({
    ...cfg,
    value: data[cfg.key as keyof typeof data] ?? 0,
  })).filter((r) => r.value > 0);

  const total = rows.reduce((s, r) => s + r.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-center h-48">
        <p className="text-sm text-slate-400">No verdict data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-400 font-medium">{total} total</span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const pct = Math.round((row.value / total) * 100);
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: row.color }}
                  />
                  <span className="text-xs font-medium text-slate-600">{row.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{row.value}</span>
                  <span className="text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2 flex-wrap">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: row.bg, color: row.color }}
          >
            <span>{row.value}</span>
            <span className="font-normal opacity-80">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
