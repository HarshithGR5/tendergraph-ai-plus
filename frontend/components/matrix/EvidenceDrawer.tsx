"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FileText, BookOpen, Hash, Shield, Brain,
  AlertTriangle, CheckCircle, XCircle, Search, Loader2,
  Building2, Clock, RefreshCw,
} from "lucide-react";
import { VerdictBadge, CategoryBadge } from "@/components/ui/badge";
import { ConfidenceMeter } from "@/components/ui/confidence-meter";
import { formatDateTime, formatCurrency, cn, getRuleDisplayName } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { biddersApi } from "@/lib/api/bidders";
import { kycApi } from "@/lib/api/kyc";
import type { CriterionVerdict, TenderCriterion, Bidder, KYCResult } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  verdict: CriterionVerdict | null;
  criterion: TenderCriterion | null;
  bidder: Bidder | null;
  tenderId: string;
}

function KYCStatusBadge({ status }: { status: "PASS" | "FAIL" | "REVIEW" }) {
  const cfg = {
    PASS:   { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "KYC PASS" },
    FAIL:   { cls: "bg-red-100 text-red-700 border-red-200",             label: "KYC FAIL" },
    REVIEW: { cls: "bg-amber-100 text-amber-700 border-amber-200",       label: "KYC REVIEW" },
  }[status];
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function KYCCheckRow({ label, result }: { label: string; result: { status: string; legal_name?: string | null; name?: string | null; error?: string | null; debarred?: boolean } | null }) {
  if (!result) return null;
  const isOk   = result.status === "ACTIVE" || result.status === "VALID" || result.status === "CLEAR";
  const isFail = result.debarred || result.status === "DEBARRED" || result.status === "INVALID" || result.status === "INACTIVE";
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <div className={cn("mt-0.5 w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center",
        isFail ? "bg-red-100" : isOk ? "bg-emerald-100" : "bg-amber-100")}>
        {isFail
          ? <XCircle className="w-2.5 h-2.5 text-red-600" />
          : isOk
          ? <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
          : <Clock className="w-2.5 h-2.5 text-amber-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xs text-slate-700 mt-0.5">{result.legal_name ?? result.name ?? result.status}</p>
        {result.error && <p className="text-[10px] text-red-500 mt-0.5">{result.error}</p>}
      </div>
      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5",
        isFail ? "bg-red-100 text-red-700" : isOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
        {result.status}
      </span>
    </div>
  );
}

function KYCResultDetail({ kycResult, onRerun }: { kycResult: KYCResult; onRerun: () => void }) {
  return (
    <div className="space-y-1">
      {kycResult.sandbox_mode && (
        <div className="flex items-center gap-1.5 mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
          <p className="text-[10px] text-amber-700">Sandbox mode — simulated data, not live government database</p>
        </div>
      )}
      {kycResult.gstin_check   && <KYCCheckRow label="GSTIN"          result={kycResult.gstin_check} />}
      {kycResult.pan_check     && <KYCCheckRow label="PAN"            result={kycResult.pan_check} />}
      <KYCCheckRow label="Debarment"     result={kycResult.debarment_check} />
      <KYCCheckRow label="Company Status" result={kycResult.company_status} />
      {kycResult.issues.length > 0 && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
          <p className="text-[10px] font-semibold text-red-700 mb-1">Issues Found</p>
          <ul className="space-y-0.5">
            {kycResult.issues.map((issue, i) => (
              <li key={i} className="text-[11px] text-red-600 flex items-start gap-1">
                <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={onRerun} className="mt-2 w-full text-[11px] text-slate-400 hover:text-slate-600 underline flex items-center justify-center gap-1">
        <RefreshCw className="w-3 h-3" /> Re-run check
      </button>
    </div>
  );
}

export function EvidenceDrawer({ open, onClose, verdict, criterion, bidder, tenderId }: Props) {
  const [kycResult, setKycResult] = useState<KYCResult | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycRan, setKycRan] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Reset only the fresh-run result when bidder changes; preserve existing kyc_status display
  useEffect(() => {
    if (open) {
      setKycResult(null);
      setKycRan(false);
    }
  }, [open, bidder?.bidder_id]);

  const { data: evidenceList } = useQuery({
    queryKey: ["evidence", tenderId, bidder?.bidder_id],
    queryFn: () => biddersApi.getEvidence(tenderId, bidder!.bidder_id),
    enabled: open && !!bidder && !!tenderId,
  });

  const evidence = evidenceList?.find((e) => e.criterion_id === criterion?.criterion_id);
  const effectiveVerdict = verdict?.override_verdict ?? verdict?.verdict;

  // If the bidder already has a KYC status from a previous check, treat it as "already run"
  const existingKycStatus = bidder?.kyc_status as ("PASS" | "FAIL" | "REVIEW") | null | undefined;
  const showExistingSummary = !!existingKycStatus && !kycRan;

  async function runKYC() {
    if (!bidder) return;
    setKycLoading(true);
    setKycRan(true);
    try {
      const result = await kycApi.fullCheck({
        company_name: bidder.company_name,
        gstin: bidder.gstin,
        pan: bidder.pan,
      });
      setKycResult(result);
    } catch {
      setKycResult(null);
    } finally {
      setKycLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
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
                <div className={cn("px-5 py-3 flex items-center justify-between border-b flex-shrink-0",
                  effectiveVerdict === "ELIGIBLE"     ? "bg-emerald-50 border-emerald-200" :
                  effectiveVerdict === "NOT_ELIGIBLE" ? "bg-red-50 border-red-200" :
                  "bg-amber-50 border-amber-200")}>
                  <div className="flex items-center gap-2">
                    {effectiveVerdict === "ELIGIBLE"     ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
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
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-[10px] text-slate-400 mb-1">Rule Applied</p>
                        <p className="text-xs font-semibold text-slate-800 leading-snug">
                          {getRuleDisplayName(verdict.rule_applied)}
                        </p>
                        {verdict.rule_applied && (
                          <p className="font-mono text-[10px] text-blue-500 mt-1 break-all">{verdict.rule_applied}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Decided By</p>
                          <p className="font-medium text-slate-700 text-[11px]">{verdict.decided_by}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Decided At</p>
                          <p className="text-slate-700 text-[11px]">{formatDateTime(verdict.decided_at)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Human Review</p>
                          <p className={cn("text-[11px] font-medium", verdict.human_reviewed ? "text-emerald-600" : "text-slate-400")}>
                            {verdict.human_reviewed ? "Reviewed" : "Auto"}
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

                {/* KYC Verification */}
                {bidder && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">KYC Verification</h3>
                      {(kycResult?.overall_kyc_status ?? existingKycStatus) && (
                        <KYCStatusBadge status={(kycResult?.overall_kyc_status ?? existingKycStatus) as "PASS" | "FAIL" | "REVIEW"} />
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      {/* Case 1: KYC was already run before (bidder.kyc_status is set) and no fresh run yet */}
                      {showExistingSummary ? (
                        <div className="space-y-3">
                          <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2.5 border",
                            existingKycStatus === "PASS"   ? "bg-emerald-50 border-emerald-200" :
                            existingKycStatus === "FAIL"   ? "bg-red-50 border-red-200" :
                            "bg-amber-50 border-amber-200")}>
                            {existingKycStatus === "PASS"
                              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              : existingKycStatus === "FAIL"
                              ? <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                              : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                            <div>
                              <p className={cn("text-xs font-semibold",
                                existingKycStatus === "PASS" ? "text-emerald-700" :
                                existingKycStatus === "FAIL" ? "text-red-700" : "text-amber-700")}>
                                KYC verification completed
                              </p>
                              <p className={cn("text-[10px] mt-0.5",
                                existingKycStatus === "PASS" ? "text-emerald-600" :
                                existingKycStatus === "FAIL" ? "text-red-600" : "text-amber-600")}>
                                {existingKycStatus === "PASS"
                                  ? "All checks passed — GSTIN, PAN, and debarment registry clear."
                                  : existingKycStatus === "FAIL"
                                  ? "One or more checks failed. View detailed results below."
                                  : "Manual review recommended. Some checks need attention."}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={runKYC}
                            className="flex items-center gap-2 w-full justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            View Full Details / Re-run Check
                          </button>
                        </div>
                      ) : kycLoading ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          Running KYC checks…
                        </div>
                      ) : kycRan && kycResult ? (
                        <KYCResultDetail kycResult={kycResult} onRerun={runKYC} />
                      ) : kycRan && !kycResult ? (
                        <div className="text-center py-2">
                          <p className="text-xs text-red-500 mb-2">KYC check failed. Try again.</p>
                          <button onClick={runKYC} className="text-xs text-blue-600 underline">Retry</button>
                        </div>
                      ) : (
                        /* Case: no existing KYC status, never run */
                        <div className="text-center py-2">
                          <p className="text-xs text-slate-500 mb-3">
                            Run a live KYC check on this bidder's GSTIN, PAN, and debarment status.
                          </p>
                          <button
                            onClick={runKYC}
                            className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Run KYC Check
                          </button>
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
