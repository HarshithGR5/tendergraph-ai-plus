"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, AlertTriangle, BookOpen, FileText, MessageSquare, Pencil } from "lucide-react";
import { CategoryBadge, MandatoryBadge } from "@/components/ui/badge";
import { ConfidenceMeter } from "@/components/ui/confidence-meter";
import { formatCurrency, cn } from "@/lib/utils";
import { tendersApi } from "@/lib/api/tenders";
import { toast } from "sonner";
import type { TenderCriterion } from "@/lib/types";

interface Props { criterion: TenderCriterion; onUpdate: (c: TenderCriterion) => void; index: number; canApprove: boolean; }

export function CriterionCard({ criterion, onUpdate, index, canApprove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState(criterion.reviewer_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  const threshold = criterion.threshold_json;
  const thresholdDisplay = threshold?.value
    ? threshold.unit === "INR" ? formatCurrency(threshold.value) : `${threshold.value} ${threshold.unit ?? ""}`
    : null;

  async function approve() {
    setApproving(true);
    try {
      const updated = await tendersApi.approveCriterion(
        criterion.tender_id,
        criterion.criterion_id,
        notesInput.trim() || undefined
      );
      onUpdate(updated);
      toast.success("Criterion approved");
      setEditingNotes(false);
    } catch {
      toast.error("Failed to approve criterion");
    } finally {
      setApproving(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const updated = await tendersApi.updateCriterion(
        criterion.tender_id,
        criterion.criterion_id,
        { reviewer_notes: notesInput.trim() || null }
      );
      onUpdate(updated);
      toast.success("Notes saved");
      setEditingNotes(false);
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "bg-white border rounded-xl overflow-hidden transition-all",
        criterion.is_approved ? "border-emerald-200" : "border-slate-200"
      )}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {criterion.is_approved ? (
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-emerald-600" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CategoryBadge category={criterion.category} />
            <MandatoryBadge status={criterion.mandatory_status} />
            {criterion.source_clause && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                <BookOpen className="w-3 h-3" />
                Clause {criterion.source_clause}
                {criterion.source_page && ` · p.${criterion.source_page}`}
              </span>
            )}
            {!criterion.source_clause && criterion.source_page && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                <BookOpen className="w-3 h-3" /> p.{criterion.source_page}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-snug">{criterion.description}</p>

          <div className="flex items-center gap-4 mt-2">
            {thresholdDisplay && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                Min: {thresholdDisplay}
              </span>
            )}
            {criterion.required_document && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <FileText className="w-3 h-3" /> {criterion.required_document}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Confidence</span>
              <ConfidenceMeter value={criterion.extraction_confidence} size="sm" />
            </div>
          </div>

          {/* Reviewer notes — display or edit */}
          {criterion.is_approved && criterion.reviewer_notes && !editingNotes && (
            <div className="mt-2 flex items-start gap-1.5">
              <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-slate-500 italic leading-relaxed flex-1">{criterion.reviewer_notes}</p>
              {canApprove && (
                <button onClick={() => { setNotesInput(criterion.reviewer_notes ?? ""); setEditingNotes(true); }}
                  className="flex-shrink-0 text-[10px] text-slate-400 hover:text-blue-600 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {criterion.ambiguity_flags?.length > 0 && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-2 text-[11px] text-amber-600 hover:text-amber-700">
              <AlertTriangle className="w-3 h-3" />
              {criterion.ambiguity_flags.length} ambiguity flag{criterion.ambiguity_flags.length > 1 ? "s" : ""}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {canApprove && !criterion.is_approved && (
            <div className="flex flex-col items-end gap-2">
              {!editingNotes ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingNotes(true)}
                    className="text-xs px-2.5 py-1.5 border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 rounded-lg font-medium transition-colors flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Notes
                  </button>
                  <button onClick={approve} disabled={approving}
                    className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                    {approving ? "…" : "Approve"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setEditingNotes(false)}
                    className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600 transition-colors">
                    Cancel
                  </button>
                  <button onClick={approve} disabled={approving}
                    className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                    {approving ? "…" : "Approve"}
                  </button>
                </div>
              )}
            </div>
          )}
          {canApprove && criterion.is_approved && !criterion.reviewer_notes && !editingNotes && (
            <button onClick={() => { setNotesInput(""); setEditingNotes(true); }}
              className="text-xs px-2.5 py-1 border border-dashed border-slate-200 hover:border-blue-300 text-slate-400 hover:text-blue-600 rounded-lg font-medium transition-colors flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Add notes
            </button>
          )}
        </div>
      </div>

      {/* Inline notes editor */}
      {editingNotes && (
        <div className="px-4 pb-3 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] font-medium text-slate-500 pt-2 mb-1.5">
            {criterion.is_approved ? "Edit reviewer notes" : "Reviewer recommendation / notes (optional)"}
          </p>
          <textarea
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            rows={2}
            placeholder="Add your recommendation, clarification, or override justification…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none bg-white"
          />
          {criterion.is_approved && (
            <div className="flex justify-end gap-2 mt-1.5">
              <button onClick={() => setEditingNotes(false)}
                className="text-xs px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button onClick={saveNotes} disabled={savingNotes}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                {savingNotes ? "Saving…" : "Save Notes"}
              </button>
            </div>
          )}
        </div>
      )}

      {expanded && criterion.ambiguity_flags?.length > 0 && (
        <div className="px-4 pb-3 bg-amber-50 border-t border-amber-100">
          <p className="text-xs font-medium text-amber-700 mb-1.5 pt-2">Ambiguity Flags</p>
          <ul className="space-y-1">
            {criterion.ambiguity_flags.map((flag, i) => (
              <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
