"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, Brain, User, FileText, CheckCircle, LogIn, Hash,
  ChevronDown, ChevronUp, Eye, Trash2, Trash, AlertTriangle,
  XCircle, Activity, Award, BarChart2,
} from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";
import type { AuditEvent, AuditEventType } from "@/lib/types";

const EVENT_CONFIG: Record<AuditEventType, { icon: React.ElementType; color: string; label: string }> = {
  TENDER_UPLOADED:          { icon: FileText,    color: "bg-blue-100 text-blue-600",    label: "Tender Uploaded" },
  TENDER_DELETED:           { icon: Trash2,      color: "bg-red-100 text-red-600",      label: "Tender Deleted" },
  DOCUMENT_DELETED:         { icon: Trash,       color: "bg-orange-100 text-orange-600",label: "Document Deleted" },
  CRITERION_EXTRACTED:      { icon: Brain,       color: "bg-purple-100 text-purple-600",label: "Criteria Extracted" },
  CRITERION_SCHEMA_APPROVED:{ icon: CheckCircle, color: "bg-emerald-100 text-emerald-600", label: "Schema Approved" },
  BIDDER_UPLOADED:          { icon: User,        color: "bg-slate-100 text-slate-600",  label: "Bidder Registered" },
  OCR_COMPLETED:            { icon: FileText,    color: "bg-indigo-100 text-indigo-600",label: "OCR Complete" },
  EVIDENCE_EXTRACTED:       { icon: Brain,       color: "bg-purple-100 text-purple-600",label: "Evidence Extracted" },
  VERDICT_EMITTED:          { icon: Shield,      color: "bg-blue-100 text-blue-600",    label: "Verdict Emitted" },
  HUMAN_REVIEW_ASSIGNED:    { icon: User,        color: "bg-amber-100 text-amber-600",  label: "Review Assigned" },
  HUMAN_OVERRIDE_APPLIED:   { icon: User,        color: "bg-orange-100 text-orange-600",label: "Human Override" },
  REPORT_EXPORTED:          { icon: FileText,    color: "bg-emerald-100 text-emerald-600", label: "Report Exported" },
  USER_LOGIN:               { icon: LogIn,       color: "bg-slate-100 text-slate-500",  label: "User Login" },
  BIDDER_REGISTERED:        { icon: User,        color: "bg-teal-100 text-teal-600",    label: "Bidder Registered" },
  BIDDER_DOC_VIEWED:        { icon: Eye,         color: "bg-slate-100 text-slate-500",  label: "Document Viewed" },
};

const VERDICT_COLORS: Record<string, string> = {
  ELIGIBLE:            "bg-emerald-100 text-emerald-700 border-emerald-200",
  NOT_ELIGIBLE:        "bg-red-100 text-red-700 border-red-200",
  NEEDS_MANUAL_REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  PENDING:             "bg-slate-100 text-slate-600 border-slate-200",
};

const KYC_COLORS: Record<string, string> = {
  PASS:   "bg-emerald-100 text-emerald-700",
  FAIL:   "bg-red-100 text-red-700",
  REVIEW: "bg-amber-100 text-amber-700",
};

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-[10px] text-slate-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-[11px] text-slate-700 flex-1", mono && "font-mono text-blue-600 break-all")}>{value}</span>
    </div>
  );
}

function ShortId({ id }: { id?: string }) {
  if (!id) return <span className="text-slate-400 italic">—</span>;
  return <span className="font-mono text-[10px] text-blue-500">{id.substring(0, 8)}…</span>;
}

function PayloadRenderer({ eventType, payload }: { eventType: AuditEventType; payload: Record<string, unknown> | null }) {
  if (!payload) return null;
  const p = payload as Record<string, unknown>;

  switch (eventType) {
    case "VERDICT_EMITTED": {
      const v = String(p.verdict ?? "");
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", VERDICT_COLORS[v] ?? VERDICT_COLORS.PENDING)}>
              {v.replace(/_/g, " ")}
            </span>
            {p.confidence != null && (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {(Number(p.confidence) * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
          {p.reason != null && <Row label="Reason" value={String(p.reason)} />}
          {p.rule != null && <Row label="Rule" value={String(p.rule)} mono />}
          <Row label="Bidder" value={<ShortId id={String(p.bidder_id ?? "")} />} />
          <Row label="Criterion" value={<ShortId id={String(p.criterion_id ?? "")} />} />
        </div>
      );
    }

    case "HUMAN_OVERRIDE_APPLIED": {
      const rv = String(p.resolution_verdict ?? p.override_verdict ?? "");
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-orange-500" />
            <span className="text-[11px] font-semibold text-orange-700">Manual override applied</span>
          </div>
          {rv && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">New verdict:</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", VERDICT_COLORS[rv] ?? VERDICT_COLORS.PENDING)}>
                {rv.replace(/_/g, " ")}
              </span>
            </div>
          )}
          {(p.resolution_notes != null || p.override_reason != null) && (
            <Row
              label="Notes"
              value={String(p.resolution_notes ?? p.override_reason)}
            />
          )}
        </div>
      );
    }

    case "TENDER_UPLOADED": {
      return (
        <div className="space-y-1">
          {p.title != null && (<Row label="Title" value={String(p.title)} />)}
          {p.filename != null && <Row label="File" value={String(p.filename)} />}
          <Row label="Tender ID" value={<ShortId id={String(p.tender_id ?? "")} />} />
        </div>
      );
    }

    case "TENDER_DELETED": {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span className="text-[11px] text-red-600 font-semibold">Tender permanently deleted</span>
          </div>
          {p.title != null && <Row label="Title" value={String(p.title)} />}
          <Row label="Tender ID" value={<ShortId id={String(p.tender_id ?? "")} />} />
        </div>
      );
    }

    case "BIDDER_UPLOADED":
    case "BIDDER_REGISTERED": {
      return (
        <div className="space-y-1">
          {p.company_name != null && <Row label="Company" value={String(p.company_name)} />}
          {p.gstin != null && <Row label="GSTIN" value={String(p.gstin)} mono />}
          <Row label="Bidder ID" value={<ShortId id={String(p.bidder_id ?? "")} />} />
        </div>
      );
    }

    case "OCR_COMPLETED": {
      const conf = p.avg_confidence != null ? (Number(p.avg_confidence) * 100).toFixed(0) + "%" : null;
      return (
        <div className="space-y-1">
          {p.page_count != null && <Row label="Pages" value={String(p.page_count)} />}
          {conf && <Row label="Avg. confidence" value={conf} />}
          <Row label="Doc ID" value={<ShortId id={String(p.doc_id ?? "")} />} />
        </div>
      );
    }

    case "EVIDENCE_EXTRACTED": {
      return (
        <div className="space-y-1">
          {p.extracted_value != null && <Row label="Extracted value" value={String(p.extracted_value)} />}
          {p.extraction_confidence != null && (
            <Row label="Confidence" value={(Number(p.extraction_confidence) * 100).toFixed(0) + "%"} />
          )}
          <Row label="Criterion" value={<ShortId id={String(p.criterion_id ?? "")} />} />
        </div>
      );
    }

    case "CRITERION_EXTRACTED": {
      return (
        <div className="space-y-1">
          {p.count != null && <Row label="Criteria found" value={String(p.count)} />}
          {p.category != null && <Row label="Category" value={String(p.category)} />}
          <Row label="Tender" value={<ShortId id={String(p.tender_id ?? "")} />} />
        </div>
      );
    }

    case "CRITERION_SCHEMA_APPROVED": {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-700">Criteria schema approved</span>
          </div>
          {p.approved_count != null && <Row label="Approved" value={`${p.approved_count} criteria`} />}
        </div>
      );
    }

    case "HUMAN_REVIEW_ASSIGNED": {
      return (
        <div className="space-y-1">
          <Row label="Task ID" value={<ShortId id={String(p.task_id ?? "")} />} />
          {p.assigned_to != null && <Row label="Assigned to" value={<ShortId id={String(p.assigned_to)} />} />}
        </div>
      );
    }

    case "REPORT_EXPORTED": {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {p.eligible != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
                {String(p.eligible)} Eligible
              </span>
            )}
            {p.not_eligible != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">
                {String(p.not_eligible)} Not Eligible
              </span>
            )}
            {p.needs_review != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
                {String(p.needs_review)} Review
              </span>
            )}
          </div>
          {p.total_bidders != null && <Row label="Total bidders" value={String(p.total_bidders)} />}
          <Row label="Report ID" value={<ShortId id={String(p.report_id ?? "")} />} />
        </div>
      );
    }

    case "USER_LOGIN": {
      return (
        <div className="space-y-1">
          {p.username != null && <Row label="Username" value={String(p.username)} />}
          {p.role != null && <Row label="Role" value={String(p.role).replace(/_/g, " ")} />}
        </div>
      );
    }

    case "DOCUMENT_DELETED": {
      return (
        <div className="space-y-1">
          {(p.filename != null || p.original_filename != null ) && (
            <Row label="File" value={String(p.filename ?? p.original_filename)} />
          )}
          <Row label="Doc ID" value={<ShortId id={String(p.doc_id ?? "")} />} />
        </div>
      );
    }

    case "BIDDER_DOC_VIEWED": {
      return (
        <div className="space-y-1">
          {(p.filename != null || p.original_filename!= null) && (
            <Row label="File" value={String(p.filename ?? p.original_filename)} />
          )}
          <Row label="Bidder" value={<ShortId id={String(p.bidder_id ?? "")} />} />
        </div>
      );
    }

    default: {
      const keys = Object.entries(p).filter(([, v]) => v != null);
      if (!keys.length) return null;
      return (
        <div className="space-y-1">
          {keys.map(([k, v]) => (
            <Row key={k} label={k.replace(/_/g, " ")} value={
              typeof v === "object" ? JSON.stringify(v) : String(v)
            } />
          ))}
        </div>
      );
    }
  }
}

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
          {event.payload_json && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
              <Eye className="w-3 h-3" />
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {expanded && event.payload_json && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="mt-2 space-y-2">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-500 mb-2">Details</p>
              <PayloadRenderer eventType={event.event_type} payload={event.payload_json as Record<string, unknown>} />
            </div>
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
