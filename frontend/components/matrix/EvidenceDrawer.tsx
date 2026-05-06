"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, BookOpen, Hash, Shield, Brain, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { VerdictBadge, CategoryBadge } from "@/components/ui/badge";
import { ConfidenceMeter } from "@/components/ui/confidence-meter";
import { formatDateTime, formatCurrency, cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { biddersApi } from "@/lib/api/bidders";
import type { CriterionVerdict, TenderCriterion, Bidder } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  verdict: CriterionVerdict | null;
  criterion: TenderCriterion | null;
  bidder: Bidder | null;
  tenderId: string;
}

export function EvidenceDrawer({ open, onClose, verdict, criterion, bidder, tenderId }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { data: evidenceList } = useQuery({
    queryKey: ["evidence", tenderId, bidder?.bidder_id],
    queryFn: () => biddersApi.getEvidence(tenderId, bidder!.bidder_id),
    enabled: open && !!bidder && !!tenderId,
  });

  const evidence = evidenceList?.find((e) => e.criterion_id === criterion?.criterion_id);
  const effectiveVerdict = verdict?.override_verdict ?? verdict?.verdict;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">Evidence Intelligence</span>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Verdict banner */}
              {verdict && effectiveVerdict && (
                <div className={cn("px-5 py-3 flex items-center justify-between border-b",
                  effectiveVerdict === "ELIGIBLE" ? "bg-emerald-50 border-emerald-200" :
                  effectiveVerdict === "NOT_ELIGIBLE" ? "bg-red-50 border-red-200" :
                  "bg-amber-50 border-amber-200")}>
                  <div className="flex items-center gap-2">
                    {effectiveVerdict === "ELIGIBLE" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                     effectiveVerdict === "NOT_ELIGIBLE" ? <XCircle className="w-4 h-4 text-red-600" /> :
                     <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <VerdictBadge verdict={effectiveVerdict} />
                    {verdict.override_verdict && (
                      <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">Human Override</span>
                    )}
                  </div>
                  <ConfidenceMeter value={verdict.confidence} size="sm" />
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* Criterion info */}
                {criterion && (
                  <section>
                    <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Criterion</h3>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CategoryBadge category={criterion.category} />
                        {criterion.source_clause && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <BookOpen className="w-3 h-3" /> Clause {criterion.source_clause}
                            {criterion.source_page && `, p.${criterion.source_page}`}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{criterion.description}</p>
                      {criterion.threshold_json?.value && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Threshold:</span>
                          <span className="text-xs font-semibold text-blue-700">
                            {criterion.threshold_json.unit === "INR"
                              ? formatCurrency(criterion.threshold_json.value)
                              : `${criterion.threshold_json.value} ${criterion.threshold_json.unit}`}
                          </span>
                        </div>
                      )}
                      {criterion.required_document && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <FileText className="w-3 h-3" /> Required: {criterion.required_document}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Bidder & Evidence */}
                {bidder && (
                  <section>
                    <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Bidder Evidence</h3>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">{bidder.company_name}</p>
                        {bidder.gstin && <span className="text-[11px] font-mono text-slate-500">{bidder.gstin}</span>}
                      </div>
                      {evidence ? (
                        <>
                          {evidence.extracted_text && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Extracted Text</p>
                              <blockquote className="text-xs text-slate-600 bg-white border-l-4 border-blue-300 pl-3 py-2 pr-3 rounded-r-lg italic leading-relaxed">
                                "{evidence.extracted_text}"
                              </blockquote>
                              {evidence.source_page && (
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> Page {evidence.source_page}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <p className="text-[10px] text-slate-400 mb-1">Extracted Value</p>
                              <p className="text-sm font-bold text-slate-800">
                                {evidence.extracted_value != null
                                  ? (typeof evidence.extracted_value === "number" && evidence.unit === "INR"
                                    ? formatCurrency(evidence.extracted_value)
                                    : String(evidence.extracted_value))
                                  : "Not found"}
                              </p>
                              {evidence.unit && <p className="text-[10px] text-slate-400">{evidence.unit}</p>}
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <p className="text-[10px] text-slate-400 mb-1">OCR Confidence</p>
                              <ConfidenceMeter value={evidence.ocr_confidence} size="sm" />
                              <p className="text-[10px] text-slate-400 mt-1">Extraction</p>
                              <ConfidenceMeter value={evidence.extraction_confidence} size="sm" />
                            </div>
                          </div>
                          {evidence.extraction_notes && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="text-[10px] font-semibold text-amber-700 mb-1">Extraction Notes</p>
                              <p className="text-xs text-amber-700">{evidence.extraction_notes}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No evidence record — evaluation not yet run</p>
                      )}
                    </div>
                  </section>
                )}

                {/* Rule Engine */}
                {verdict && (
                  <section>
                    <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Rule Engine Decision</h3>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Rule Applied</p>
                          <p className="font-mono text-blue-700 text-[11px]">{verdict.rule_applied ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Decided By</p>
                          <p className="font-medium text-slate-700">{verdict.decided_by}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Decided At</p>
                          <p className="text-slate-700">{formatDateTime(verdict.decided_at)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Human Reviewed</p>
                          <p className={verdict.human_reviewed ? "text-emerald-600 font-medium" : "text-slate-400"}>
                            {verdict.human_reviewed ? "Yes" : "No"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">Decision Reason</p>
                        <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                          {verdict.reason}
                        </p>
                      </div>
                      {verdict.override_verdict && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Shield className="w-3 h-3 text-blue-600" />
                            <p className="text-[10px] font-semibold text-blue-700">Human Override Applied</p>
                          </div>
                          <p className="text-xs text-blue-700">{verdict.override_reason}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
