"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { FolderOpen, FileText, CheckCircle, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { biddersApi } from "@/lib/api/bidders";
import { VerdictBadge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export default function MySubmissionsPage() {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: biddersApi.getMySubmissions,
    refetchInterval: 15_000,
  });

  const registered = submissions.length;
  const complete = submissions.filter((s) => s.processing_complete).length;
  const eligible = submissions.filter((s) => s.overall_verdict === "ELIGIBLE").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-800">My Submissions</h2>
        <p className="text-xs text-slate-500 mt-0.5">Tenders you have registered for · Upload documents · Track evaluation status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Registered Tenders", value: registered, icon: FolderOpen, color: "text-blue-600 bg-blue-50" },
          { label: "Evaluations Complete", value: complete, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
          { label: "Eligible Verdicts", value: eligible, icon: AlertTriangle, color: "text-purple-600 bg-purple-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800">{value}</div>
              <div className="text-[11px] text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Submissions list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No submissions yet"
          description="Browse open tenders and register your company to participate in evaluations"
          action={
            <Link href="/tenders"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <FileText className="w-4 h-4" /> Browse Open Tenders
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {submissions.map((sub, i) => (
            <motion.div
              key={sub.bidder_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link href={`/tenders/${sub.tender_id}`}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all group block">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {sub.tender_title ?? "Tender"}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[11px] text-slate-500">{sub.company_name}</span>
                    {sub.gstin && <span className="text-[11px] font-mono text-slate-400">{sub.gstin}</span>}
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3" /> Registered {formatDate(sub.submission_timestamp.toString())}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-700">{sub.document_count}</div>
                    <div className="text-[10px] text-slate-400">docs</div>
                  </div>
                  <VerdictBadge verdict={sub.overall_verdict} />
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Help note */}
      {submissions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">How evaluations work</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Click any tender above to upload documents and track your evaluation. A procurement officer will trigger the AI evaluation once all documents are uploaded. You'll see your eligibility verdict here.
          </p>
        </div>
      )}
    </div>
  );
}
