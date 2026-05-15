"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, User, Clock, CheckCircle, XCircle, MessageSquare, FileText, BookOpen } from "lucide-react";
import { VerdictBadge, StatusBadge } from "@/components/ui/badge";
import { formatDateTime, cn } from "@/lib/utils";
import { reviewsApi } from "@/lib/api/reviews";
import { useAuthStore } from "@/lib/stores/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReviewTask, VerdictValue } from "@/lib/types";

interface Props { task: ReviewTask; tenderId: string; onUpdated: (t: ReviewTask) => void; }

export function ReviewTaskCard({ task, tenderId, onUpdated }: Props) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  const canResolve = user?.role === "SENIOR_OFFICER" || user?.role === "SYSTEM_ADMIN";
  const hasEvidence = !!(task.evidence_source_doc_name || task.evidence_source_page || task.evidence_extracted_text);

  async function assign() {
    setAssigning(true);
    try {
      const updated = await reviewsApi.assign(tenderId, task.task_id);
      onUpdated(updated);
      toast.success("Task assigned to you");
    } catch { toast.error("Failed to assign task"); }
    finally { setAssigning(false); }
  }

  async function resolve(verdict: VerdictValue) {
    if (notes.trim().length < 20) { toast.error("Please provide at least 20 characters of review notes"); return; }
    setResolving(true);
    try {
      const updated = await reviewsApi.resolve(tenderId, task.task_id, { resolution_verdict: verdict, resolution_notes: notes });
      onUpdated(updated);
      // Immediately refresh the matrix so overall verdict updates without waiting for the 15s poll
      queryClient.invalidateQueries({ queryKey: ["matrix", tenderId] });
      toast.success("Review task resolved — bidder matrix updated");
      setShowResolve(false);
    } catch { toast.error("Failed to resolve task"); }
    finally { setResolving(false); }
  }

  const priorityColor = task.priority <= 2 ? "border-red-300 bg-red-50" : task.priority <= 4 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("border rounded-xl overflow-hidden", priorityColor)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn("w-4 h-4 mt-0.5 flex-shrink-0", task.priority <= 2 ? "text-red-500" : "text-amber-500")} />
            <div>
              <div className="text-xs font-semibold text-slate-700">{task.company_name ?? "Bidder"}</div>
              {task.criterion_description && (
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{task.criterion_description}</div>
              )}
            </div>
          </div>
          <StatusBadge status={task.status} />
        </div>

        <div className="bg-white/70 rounded-lg p-3 border border-white mb-3">
          <p className="text-[11px] font-semibold text-slate-500 mb-1">Escalation Reason</p>
          <p className="text-xs text-slate-700 leading-relaxed">{task.reason_for_review}</p>
        </div>

        {/* Evidence citation block */}
        {hasEvidence && (
          <div className="mb-3">
            <button
              onClick={() => setShowEvidence(!showEvidence)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <FileText className="w-3 h-3" />
              Evidence Citation
              <span className={cn("text-[9px] ml-0.5 transition-transform inline-block", showEvidence ? "rotate-180" : "")}>▼</span>
            </button>
            {showEvidence && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2"
              >
                {task.evidence_source_doc_name && (
                  <div className="flex items-start gap-1.5">
                    <FileText className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide block">Source Document</span>
                      <span className="text-[11px] text-blue-800 font-medium">{task.evidence_source_doc_name}</span>
                    </div>
                  </div>
                )}
                {task.evidence_source_page && (
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide">Page</span>
                    <span className="text-[11px] font-bold text-blue-800">{task.evidence_source_page}</span>
                  </div>
                )}
                {(task.evidence_ocr_confidence != null || task.evidence_extraction_confidence != null) && (
                  <div className="flex items-center gap-3">
                    {task.evidence_ocr_confidence != null && (
                      <span className="text-[9px] text-blue-500">
                        OCR: <strong>{(task.evidence_ocr_confidence * 100).toFixed(0)}%</strong>
                      </span>
                    )}
                    {task.evidence_extraction_confidence != null && (
                      <span className="text-[9px] text-blue-500">
                        Extraction: <strong>{(task.evidence_extraction_confidence * 100).toFixed(0)}%</strong>
                      </span>
                    )}
                  </div>
                )}
                {task.evidence_extracted_text && (
                  <div>
                    <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide block mb-1">Extracted Text</span>
                    <p className="text-[10px] text-blue-900 leading-relaxed bg-white/60 rounded px-2 py-1.5 border border-blue-100 font-mono">
                      {task.evidence_extracted_text.length > 300
                        ? task.evidence_extracted_text.substring(0, 300) + "…"
                        : task.evidence_extracted_text}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(task.assigned_at)}</span>
          <span className="flex items-center gap-1">Priority: {task.priority <= 2 ? "🔴 Critical" : task.priority <= 4 ? "🟡 High" : "🟢 Normal"}</span>
          {task.trigger_condition && <span className="font-mono text-[9px]">{task.trigger_condition}</span>}
        </div>

        {task.status === "COMPLETED" && task.resolution_verdict && (
          <div className="mt-3 pt-3 border-t border-white flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <VerdictBadge verdict={task.resolution_verdict} />
            <span className="text-[10px] text-slate-500">{task.resolution_notes?.substring(0, 60)}…</span>
          </div>
        )}

        {task.status !== "COMPLETED" && (
          <div className="mt-3 pt-3 border-t border-white flex gap-2">
            {task.status === "OPEN" && (
              <button onClick={assign} disabled={assigning}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                <User className="w-3 h-3" /> {assigning ? "…" : "Assign to Me"}
              </button>
            )}
            {task.status !== "OPEN" && canResolve && (
              <button onClick={() => setShowResolve(!showResolve)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
                <MessageSquare className="w-3 h-3" /> {showResolve ? "Cancel" : "Resolve"}
              </button>
            )}
            {task.status !== "OPEN" && !canResolve && (
              <span className="text-[11px] text-slate-400 italic py-1.5">Senior Procurement Officer approval required to resolve</span>
            )}
          </div>
        )}

        {showResolve && canResolve && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="mt-3 space-y-2">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              rows={3} placeholder="Enter review notes (min. 20 chars) — this becomes part of the immutable audit record" />
            <div className="flex gap-2">
              <button onClick={() => resolve("ELIGIBLE")} disabled={resolving}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                <CheckCircle className="w-3 h-3" /> Mark Eligible
              </button>
              <button onClick={() => resolve("NOT_ELIGIBLE")} disabled={resolving}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                <XCircle className="w-3 h-3" /> Not Eligible
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
