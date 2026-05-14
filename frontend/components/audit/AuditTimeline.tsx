"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Brain, User, FileText, CheckCircle, LogIn, Hash, ChevronDown, ChevronUp, Eye,Trash2,Trash,} from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";
import type { AuditEvent, AuditEventType } from "@/lib/types";


const EVENT_CONFIG: Record<AuditEventType, { icon: React.ElementType; color: string; label: string }> = {
  TENDER_UPLOADED: { icon: FileText, color: "bg-blue-100 text-blue-600", label: "Tender Uploaded" },
  TENDER_DELETED: {icon: Trash2,color: "bg-red-100 text-red-600",label: "Tender Deleted",},
  DOCUMENT_DELETED: {icon: Trash,color: "bg-orange-100 text-orange-600",label: "Document Deleted",},
  CRITERION_EXTRACTED: { icon: Brain, color: "bg-purple-100 text-purple-600", label: "Criteria Extracted" },
  CRITERION_SCHEMA_APPROVED: { icon: CheckCircle, color: "bg-emerald-100 text-emerald-600", label: "Schema Approved" },
  BIDDER_UPLOADED: { icon: User, color: "bg-slate-100 text-slate-600", label: "Bidder Registered" },
  OCR_COMPLETED: { icon: FileText, color: "bg-indigo-100 text-indigo-600", label: "OCR Complete" },
  EVIDENCE_EXTRACTED: { icon: Brain, color: "bg-purple-100 text-purple-600", label: "Evidence Extracted" },
  VERDICT_EMITTED: { icon: Shield, color: "bg-blue-100 text-blue-600", label: "Verdict Emitted" },
  HUMAN_REVIEW_ASSIGNED: { icon: User, color: "bg-amber-100 text-amber-600", label: "Review Assigned" },
  HUMAN_OVERRIDE_APPLIED: { icon: User, color: "bg-orange-100 text-orange-600", label: "Human Override" },
  REPORT_EXPORTED: { icon: FileText, color: "bg-emerald-100 text-emerald-600", label: "Report Exported" },
  USER_LOGIN: { icon: LogIn, color: "bg-slate-100 text-slate-500", label: "User Login" },
  BIDDER_REGISTERED: { icon: User, color: "bg-teal-100 text-teal-600", label: "Bidder Registered" },
  BIDDER_DOC_VIEWED: { icon: Eye, color: "bg-slate-100 text-slate-500", label: "Document Viewed" },
};

function AuditEventRow({ event, index }: { event: AuditEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENT_CONFIG[event.event_type] ?? { icon: Shield, color: "bg-slate-100 text-slate-500", label: event.event_type };
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex gap-4"
    >
      <div className="flex flex-col items-center">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", cfg.color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 w-px bg-slate-200 my-1" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-700">{cfg.label}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] text-slate-400">{formatDateTime(event.timestamp)}</span>
              <span className={cn("text-[10px] font-medium", event.actor_type === "HUMAN" ? "text-blue-600" : "text-slate-400")}>
                {event.actor_type === "HUMAN" ? "👤 Human" : "🤖 System"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{event.actor_id.substring(0, 8)}…</span>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
            <Eye className="w-3 h-3" />
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="mt-2 space-y-2">
            {event.payload_json && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Payload</p>
                <pre className="text-[10px] text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(event.payload_json, null, 2)}
                </pre>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Hash Chain
              </p>
              <div className="space-y-1">
                <div className="flex gap-2">
                  <span className="text-[9px] text-slate-400 w-16 flex-shrink-0">prev_hash</span>
                  <span className="text-[9px] font-mono text-slate-500 break-all">{event.prev_hash ?? "GENESIS"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[9px] text-slate-400 w-16 flex-shrink-0">hash</span>
                  <span className="text-[9px] font-mono text-emerald-600 break-all">{event.hash}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (!events.length) return (
    <div className="text-center py-12 text-slate-400 text-sm">No audit events found</div>
  );

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <AuditEventRow key={event.event_id} event={event} index={i} />
      ))}
    </div>
  );
}
