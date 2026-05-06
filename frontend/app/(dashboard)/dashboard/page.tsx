"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, Users, Brain, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import Link from "next/link";
import { tendersApi } from "@/lib/api/tenders";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TenderStatusChart, VerdictDistributionChart } from "@/components/dashboard/ProcurementChart";
import { VerdictBadge, StatusBadge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";

export default function DashboardPage() {
  const { initFromStorage, user } = useAuthStore();

  useEffect(() => { initFromStorage(); }, [initFromStorage]);

  const { data: tenders = [], isLoading } = useQuery({
    queryKey: ["tenders"],
    queryFn: tendersApi.list,
  });

  const totalCriteria = tenders.reduce((s, t) => s + (t.criteria_count ?? 0), 0);
  const processingCount = tenders.filter((t) => ["PROCESSING", "EVALUATION_IN_PROGRESS"].includes(t.status)).length;
  const completeCount = tenders.filter((t) => t.status === "EVALUATION_COMPLETE").length;

  return (
    <div className="space-y-6">
      {/* Welcome strip */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#0f172a] rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">
            Welcome back, {user?.full_name ?? user?.username ?? "Officer"}
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {tenders.length} tender{tenders.length !== 1 ? "s" : ""} in system · {processingCount} AI processing · {formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950 border border-emerald-800 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            AI Engine Online
          </div>
        </div>
      </motion.div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard label="Total Tenders" value={tenders.length} icon={FileText} color="blue" />
            <MetricCard label="Total Criteria" value={totalCriteria} icon={CheckCircle} color="emerald" />
            <MetricCard label="AI Processing" value={processingCount} icon={Brain} color="purple" />
            <MetricCard label="Complete Evaluations" value={completeCount} icon={Activity} color="slate" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /></>
        ) : (
          <>
            <TenderStatusChart tenders={tenders} />
            <VerdictDistributionChart data={{ eligible: completeCount, not_eligible: 0, review: 0, pending: processingCount }} />
          </>
        )}
      </div>

      {/* Recent Tenders */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Recent Tender Activity</h3>
          <Link href="/tenders" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : tenders.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No tenders yet</p>
              <Link href="/tenders" className="text-xs text-blue-600 hover:underline mt-1 block">Upload your first tender →</Link>
            </div>
          ) : (
            tenders.slice(0, 6).map((tender) => (
              <Link key={tender.tender_id} href={`/tenders/${tender.tender_id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{tender.title}</p>
                    <p className="text-[11px] text-slate-400">{formatDateTime(tender.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-slate-500">{tender.criteria_count} criteria</span>
                  <StatusBadge status={tender.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Architecture principle */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">System Architecture Principle</p>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { icon: "🤖", label: "AI Extracts", desc: "GPT-4o OCR + structured evidence extraction" },
            { icon: "⚖️", label: "Rule Engine Decides", desc: "Deterministic Python rules — never AI direct verdict" },
            { icon: "👤", label: "Human Reviews", desc: "Ambiguous cases escalated automatically" },
            { icon: "🔒", label: "Audit Records", desc: "SHA-256 hash-chained immutable event log" },
          ].map(({ icon, label, desc }, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span>{icon}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-700">{label}</p>
                  <p className="text-[10px] text-slate-400">{desc}</p>
                </div>
              </div>
              {i < 3 && <span className="text-slate-300 text-lg">→</span>}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
