"use client";
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Download, FileText, Loader2, CheckCircle, Calendar, Hash } from "lucide-react";
import { reportsApi } from "@/lib/api/reports";
import { tendersApi } from "@/lib/api/tenders";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", id],
    queryFn: () => reportsApi.list(id),
  });

  const { data: tender } = useQuery({
    queryKey: ["tender", id],
    queryFn: () => tendersApi.get(id),
  });

  async function generate() {
    setGenerating(true);
    try {
      await reportsApi.generateAndDownload(id);
      queryClient.invalidateQueries({ queryKey: ["reports", id] });
      toast.success("Report generated and downloaded");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadReport(reportId: string) {
    setDownloading(reportId);
    try {
      await reportsApi.downloadById(id, reportId);
    } catch {
      toast.error("Failed to download report");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/tenders" className="hover:text-slate-600">Tenders</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/tenders/${id}`} className="hover:text-slate-600">{tender?.title ?? id}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Reports</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Evaluation Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Digitally signed PDF reports with SHA-256 integrity hash — downloads immediately</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            : <><FileText className="w-4 h-4" /> Generate &amp; Download</>}
        </button>
      </div>

      {/* Reports list */}
      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : reports.length === 0 ? (
        <EmptyState icon={FileText} title="No reports generated"
          description="Generate an evaluation report to produce a digitally-signed, audit-ready PDF procurement summary"
          action={
            <button onClick={generate} disabled={generating}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              <FileText className="w-4 h-4" /> Generate First Report
            </button>
          } />
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => (
            <motion.div key={report.report_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800">Evaluation Report</p>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                        {report.report_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(report.generated_at)}</span>
                      {report.report_hash && (
                        <span className="flex items-center gap-1 font-mono"><Hash className="w-3 h-3" />{report.report_hash.substring(0, 16)}…</span>
                      )}
                    </div>

                    {/* Summary cards */}
                    {report.summary_json && (
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {[
                          { label: "Total", value: report.summary_json.total_bidders, color: "text-slate-700 bg-slate-50 border-slate-200" },
                          { label: "Eligible", value: report.summary_json.eligible, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                          { label: "Not Eligible", value: report.summary_json.not_eligible, color: "text-red-700 bg-red-50 border-red-200" },
                          { label: "Review", value: report.summary_json.needs_review, color: "text-amber-700 bg-amber-50 border-amber-200" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${color}`}>
                            <span className="font-bold text-sm">{value}</span> {label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {report.report_hash && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                      <CheckCircle className="w-3 h-3" /> Hash Verified
                    </div>
                  )}
                  <button
                    onClick={() => downloadReport(report.report_id)}
                    disabled={downloading === report.report_id}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                    {downloading === report.report_id
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Downloading…</>
                      : <><Download className="w-3.5 h-3.5" /> Download PDF</>}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
