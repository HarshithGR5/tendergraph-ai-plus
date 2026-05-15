"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileText, Brain, Activity, CheckCircle,
  FolderOpen, AlertTriangle, Clock, ChevronRight, Upload,
} from "lucide-react";
import Link from "next/link";
import { tendersApi } from "@/lib/api/tenders";
import { dashboardApi } from "@/lib/api/dashboard";
import { biddersApi } from "@/lib/api/bidders";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TenderStatusChart, VerdictDistributionChart } from "@/components/dashboard/ProcurementChart";
import { VerdictBadge, StatusBadge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";
import type { BidderSubmission } from "@/lib/types";

/* ─── Bidder-specific dashboard ──────────────────────────────────────── */
function BidderDashboard() {
  const { user } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["bidder-dashboard-stats"],
    queryFn: dashboardApi.getBidderStats,
    refetchInterval: 20_000,
  });

  const { data: submissions = [], isLoading: subsLoading } = useQuery<BidderSubmission[]>({
    queryKey: ["my-submissions"],
    queryFn: biddersApi.getMySubmissions,
    refetchInterval: 15_000,
  });

  const isLoading = statsLoading || subsLoading;

  const verdictData = {
    eligible:     stats?.eligible     ?? 0,
    not_eligible: stats?.not_eligible ?? 0,
    review:       stats?.needs_review ?? 0,
    pending:      stats?.pending      ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Welcome strip */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#0f172a] rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">
            Welcome, {user?.full_name ?? user?.username ?? "Bidder"}
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Your submission portal · Track evaluations · Upload documents
          </p>
        </div>
        <Link
          href="/my-submissions"
          className="flex items-center gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" /> My Submissions
        </Link>
      </motion.div>

      {/* Bidder metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard label="Registered Tenders"    value={stats?.registered_tenders ?? 0}   icon={FileText}    color="blue" />
            <MetricCard label="Evaluations Complete"  value={stats?.evaluations_complete ?? 0} icon={CheckCircle} color="emerald" />
            <MetricCard label="Eligible Verdicts"     value={stats?.eligible ?? 0}             icon={Activity}    color="emerald" />
            <MetricCard label="Documents Uploaded"    value={stats?.total_documents ?? 0}      icon={Upload}      color="purple" />
          </>
        )}
      </div>

      {/* Verdict chart + status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /></>
        ) : (
          <>
            <VerdictDistributionChart data={verdictData} title="My Verdict Distribution" />

            {/* Status breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Evaluation Status</h3>
              <div className="space-y-3">
                {[
                  { label: "Eligible",       value: stats?.eligible ?? 0,     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                  { label: "Not Eligible",   value: stats?.not_eligible ?? 0, color: "bg-red-100 text-red-700 border-red-200" },
                  { label: "Needs Review",   value: stats?.needs_review ?? 0, color: "bg-amber-100 text-amber-700 border-amber-200" },
                  { label: "Pending",        value: stats?.pending ?? 0,      color: "bg-slate-100 text-slate-600 border-slate-200" },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${color}`}>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-lg font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent submissions */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Recent Submissions</h3>
          <Link href="/my-submissions" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {subsLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No submissions yet</p>
              <Link href="/tenders" className="text-xs text-blue-600 hover:underline mt-1 block">
                Browse open tenders →
              </Link>
            </div>
          ) : (
            submissions.slice(0, 5).map((sub) => (
              <Link key={sub.bidder_id} href={`/tenders/${sub.tender_id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{sub.tender_title ?? "Tender"}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {sub.company_name} · {formatDate(sub.submission_timestamp.toString())}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-slate-500">{sub.document_count} docs</span>
                  <VerdictBadge verdict={sub.overall_verdict} />
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* How it works tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-blue-700 mb-2">How evaluation works</p>
        <div className="flex items-center gap-3 flex-wrap text-xs text-blue-600">
          {[
            "Register for a tender",
            "Upload your documents",
            "AI processes your submission",
            "Procurement officer runs evaluation",
            "Receive your eligibility verdict",
          ].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                {i + 1}
              </span>
              {step}
              {i < arr.length - 1 && <span className="text-blue-300">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Officer / Admin dashboard ──────────────────────────────────────── */
function ProcurementDashboard() {
  const { user } = useAuthStore();

  const { data: tenders = [], isLoading } = useQuery({
    queryKey: ["tenders"],
    queryFn: tendersApi.list,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30_000,
  });

  const processingCount = tenders.filter((t) => ["PROCESSING", "EVALUATION_IN_PROGRESS"].includes(t.status)).length;
  const totalCriteria = tenders.reduce((s, t) => s + (t.criteria_count ?? 0), 0);
  const completeCount = tenders.filter((t) => t.status === "EVALUATION_COMPLETE").length;

  const verdictData = {
    eligible:     stats?.eligible     ?? 0,
    not_eligible: stats?.not_eligible ?? 0,
    review:       stats?.needs_review ?? 0,
    pending:      stats?.pending      ?? 0,
  };

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
            <MetricCard label="Total Tenders"        value={tenders.length}    icon={FileText}    color="blue" />
            <MetricCard label="Total Criteria"       value={totalCriteria}     icon={CheckCircle} color="emerald" />
            <MetricCard label="AI Processing"        value={processingCount}   icon={Brain}       color="purple" />
            <MetricCard label="Complete Evaluations" value={completeCount}     icon={Activity}    color="slate" />
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
            <VerdictDistributionChart data={verdictData} />
          </>
        )}
      </div>

      {/* Bidder summary row */}
      {stats && (stats.total_bidders > 0 || stats.open_review_tasks > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] text-slate-400 font-medium mb-1">Total Bidders</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total_bidders}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-[11px] text-emerald-600 font-medium mb-1">Eligible</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.eligible}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-[11px] text-red-600 font-medium mb-1">Not Eligible</p>
            <p className="text-2xl font-bold text-red-700">{stats.not_eligible}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[11px] text-amber-600 font-medium mb-1">Open Reviews</p>
            <p className="text-2xl font-bold text-amber-700">{stats.open_review_tasks}</p>
          </div>
        </div>
      )}

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
            { icon: "🤖", label: "AI Extracts",        desc: "GPT-4o OCR + structured evidence extraction" },
            { icon: "⚖️", label: "Rule Engine Decides", desc: "Deterministic Python rules — never AI direct verdict" },
            { icon: "👤", label: "Human Reviews",       desc: "Ambiguous cases escalated automatically" },
            { icon: "🔒", label: "Audit Records",       desc: "SHA-256 hash-chained immutable event log" },
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

/* ─── Root router ─────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { initFromStorage, user } = useAuthStore();
  useEffect(() => { initFromStorage(); }, [initFromStorage]);

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="bg-[#0f172a] rounded-xl p-5 h-20 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-52 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-52 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return user.role === "BIDDER" ? <BidderDashboard /> : <ProcurementDashboard />;
}
