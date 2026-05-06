"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Shield, CheckCircle, XCircle, Filter, Download, Search } from "lucide-react";
import { auditApi } from "@/lib/api/audit";
import { tendersApi } from "@/lib/api/tenders";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { TableSkeleton } from "@/components/ui/skeleton";
import type { AuditEventType } from "@/lib/types";

const EVENT_TYPES: Array<{ value: AuditEventType | "ALL"; label: string }> = [
  { value: "ALL", label: "All Events" },
  { value: "TENDER_UPLOADED", label: "Tender Upload" },
  { value: "CRITERION_EXTRACTED", label: "AI Extraction" },
  { value: "VERDICT_EMITTED", label: "Verdict Emitted" },
  { value: "HUMAN_OVERRIDE_APPLIED", label: "Human Override" },
  { value: "REPORT_EXPORTED", label: "Report Export" },
];

export default function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [eventFilter, setEventFilter] = useState<AuditEventType | "ALL">("ALL");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["audit", id, eventFilter],
    queryFn: () => auditApi.list(id, {
      event_type: eventFilter !== "ALL" ? eventFilter : undefined,
      limit: 100,
    }),
    refetchInterval: 15_000,
  });

  const { data: chainStatus } = useQuery({
    queryKey: ["audit-chain", id],
    queryFn: () => auditApi.verifyChain(id),
    refetchInterval: 30_000,
  });

  const { data: tender } = useQuery({
    queryKey: ["tender", id],
    queryFn: () => tendersApi.get(id),
  });

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/tenders" className="hover:text-slate-600">Tenders</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/tenders/${id}`} className="hover:text-slate-600">{tender?.title ?? id}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Audit Trail</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Immutable Audit Trail</h2>
          <p className="text-xs text-slate-500 mt-0.5">SHA-256 hash-chained event log — tamper-evident and CVC-ready</p>
        </div>
        <div className="flex items-center gap-2">
          {chainStatus && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium ${chainStatus.valid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {chainStatus.valid ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              Chain {chainStatus.valid ? "Intact" : "BROKEN"}
              <span className="text-[10px] opacity-70">· {chainStatus.event_count} events</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Chain verification panel */}
      {chainStatus && (
        <div className={`border rounded-xl p-4 ${chainStatus.valid ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-start gap-3">
            <Shield className={`w-5 h-5 mt-0.5 ${chainStatus.valid ? "text-emerald-600" : "text-red-600"}`} />
            <div>
              <p className={`text-sm font-semibold ${chainStatus.valid ? "text-emerald-800" : "text-red-800"}`}>
                Hash Chain {chainStatus.valid ? "Verification Passed" : "Verification FAILED"}
              </p>
              <p className={`text-xs mt-1 ${chainStatus.valid ? "text-emerald-700" : "text-red-700"}`}>
                {chainStatus.valid
                  ? `All ${chainStatus.event_count} events verified. Every SHA-256 hash correctly references its predecessor. This log has not been tampered with.`
                  : `Chain broken at event: ${chainStatus.broken_at ?? "unknown"}. Immediate escalation required.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        {EVENT_TYPES.map(({ value, label }) => (
          <button key={value} onClick={() => setEventFilter(value as AuditEventType | "ALL")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${eventFilter === value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{events.length} events</span>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {isLoading ? <TableSkeleton rows={6} cols={1} /> : <AuditTimeline events={events} />}
      </div>
    </div>
  );
}
