"use client";
import { use, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight, FileText, CheckSquare, BarChart2, MessageSquare,
  Shield, Download, RefreshCw, CheckCircle, Plus, Upload,
  Loader2, Building2, X, AlertTriangle, Trash2, Lock, CheckCheck,
  Play, ChevronDown, ChevronUp, XCircle
} from "lucide-react";
import { tendersApi } from "@/lib/api/tenders";
import { biddersApi } from "@/lib/api/bidders";
import { CriterionCard } from "@/components/tenders/CriterionCard";
import { VerdictBadge, StatusBadge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/modal";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/authStore";
import type { TenderCriterion, Bidder, BidderDocument, BidderVerdictDetail } from "@/lib/types";

// ─── Bidder Portal: tender-specific view ──────────────────────────────────────
function BidderTenderView({ tenderId }: { tenderId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ company_name: "", gstin: "", pan: "", contact_name: "" });
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [docCategory, setDocCategory] = useState("");
  const [confirmingSubmission, setConfirmingSubmission] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleCriterion(id: string) {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { data: tender } = useQuery({
    queryKey: ["tender", tenderId],
    queryFn: () => tendersApi.get(tenderId),
  });

  const { data: registration, isLoading: regLoading, error: regError } = useQuery({
    queryKey: ["my-registration", tenderId],
    queryFn: () => biddersApi.getMyRegistration(tenderId),
    retry: false,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["my-docs", tenderId, registration?.bidder_id],
    queryFn: () => biddersApi.listDocuments(tenderId, registration!.bidder_id),
    enabled: !!registration?.bidder_id,
    refetchInterval: 10_000,
  });

  const showVerdictDetail = registration?.processing_complete &&
    (registration.overall_verdict === "NOT_ELIGIBLE" || registration.overall_verdict === "NEEDS_MANUAL_REVIEW");

  const { data: verdictDetails = [] } = useQuery<BidderVerdictDetail[]>({
    queryKey: ["my-verdicts", registration?.bidder_id],
    queryFn: () => biddersApi.getMyVerdicts(registration!.bidder_id),
    enabled: !!registration?.bidder_id && !!showVerdictDetail,
  });

  // Only show criteria where the bidder failed or needs review — eligibles are not shown
  const failedCriteria = verdictDetails.filter((v) =>
    v.effective_verdict === "NOT_ELIGIBLE" || v.effective_verdict === "NEEDS_MANUAL_REVIEW"
  );

  const isNotRegistered = (regError as any)?.response?.status === 404;

  async function handleRegister() {
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    setRegistering(true);
    try {
      await biddersApi.selfRegister(tenderId, {
        company_name: form.company_name,
        gstin: form.gstin || undefined,
        pan: form.pan || undefined,
        contact_name: form.contact_name || user?.full_name || undefined,
      });
      toast.success("Registered successfully! You can now upload documents.");
      queryClient.invalidateQueries({ queryKey: ["my-registration", tenderId] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      setShowForm(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Registration failed");
    } finally { setRegistering(false); }
  }

  async function handleConfirmSubmission() {
    if (!registration) return;
    setShowLockModal(true);
  }

  async function doConfirmSubmission() {
    if (!registration) return;
    setShowLockModal(false);
    setConfirmingSubmission(true);
    try {
      await biddersApi.confirmSubmission(tenderId, registration.bidder_id);
      toast.success("Submission confirmed & locked! KYC is running in the background.");
      queryClient.invalidateQueries({ queryKey: ["my-registration", tenderId] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Confirmation failed");
    } finally { setConfirmingSubmission(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !registration) return;
    setUploading(true);
    try {
      if (files.length === 1) {
        setUploadProgress(`Uploading ${files[0].name}…`);
        const fd = new FormData();
        fd.append("file", files[0]);
        if (docCategory) fd.append("doc_category", docCategory);
        await biddersApi.uploadDocument(tenderId, registration.bidder_id, fd);
        toast.success(`${files[0].name} uploaded — OCR processing started`);
      } else {
        setUploadProgress(`Uploading ${files.length} files…`);
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        if (docCategory) fd.append("doc_category", docCategory);
        await biddersApi.uploadDocumentsBulk(tenderId, registration.bidder_id, fd);
        toast.success(`${files.length} files uploaded — OCR processing started`);
      }
      queryClient.invalidateQueries({ queryKey: ["my-docs", tenderId, registration.bidder_id] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      if (fileRef.current) fileRef.current.value = "";
      setDocCategory("");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/tenders" className="hover:text-slate-600">Open Tenders</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate max-w-xs">{tender?.title ?? "Loading…"}</span>
      </div>

      {/* Tender info card */}
      {tender && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-slate-800">{tender.title}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                {tender.issuing_authority && <span className="text-xs text-slate-500">{tender.issuing_authority}</span>}
                {tender.nit_number && <span className="text-xs font-mono text-slate-500">{tender.nit_number}</span>}
                {tender.closing_date && <span className="text-xs text-slate-500">Closes: {formatDate(tender.closing_date)}</span>}
                {tender.emd_amount && <span className="text-xs font-semibold text-blue-700">EMD: {formatCurrency(tender.emd_amount)}</span>}
              </div>
            </div>
            <StatusBadge status={tender.status} />
          </div>
        </div>
      )}

      {regLoading ? (
        <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : registration ? (
        /* ── Already registered ── */
        <>
          {/* Registration status */}
          <div className={cn(
            "rounded-xl p-4 flex items-center justify-between",
            registration.submission_confirmed
              ? "bg-violet-50 border border-violet-200"
              : "bg-emerald-50 border border-emerald-200"
          )}>
            <div className="flex items-center gap-3">
              {registration.submission_confirmed
                ? <Lock className="w-5 h-5 text-violet-600 flex-shrink-0" />
                : <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
              <div>
                <p className={cn("text-sm font-semibold", registration.submission_confirmed ? "text-violet-800" : "text-emerald-800")}>
                  {registration.submission_confirmed ? "Submission Locked — " : "Registered — "}{registration.company_name}
                </p>
                <p className={cn("text-xs mt-0.5", registration.submission_confirmed ? "text-violet-600" : "text-emerald-600")}>
                  {registration.gstin && `GSTIN: ${registration.gstin} · `}
                  {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
                  {registration.submission_confirmed && registration.kyc_status && ` · KYC: ${registration.kyc_status}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {registration.kyc_status && (
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  registration.kyc_status === "PASS" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                  registration.kyc_status === "FAIL" ? "bg-red-100 text-red-700 border-red-200" :
                  "bg-amber-100 text-amber-700 border-amber-200"
                )}>
                  KYC {registration.kyc_status}
                </span>
              )}
              <VerdictBadge verdict={registration.overall_verdict} />
            </div>
          </div>

          {/* Verdict breakdown — only shown when NOT_ELIGIBLE / NEEDS_MANUAL_REVIEW and failed criteria exist */}
          {showVerdictDetail && failedCriteria.length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-red-100 bg-red-50/60 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-red-800">
                    {registration?.overall_verdict === "NOT_ELIGIBLE" ? "Reasons for Ineligibility" : "Criteria Requiring Review"}
                  </h3>
                  <p className="text-xs text-red-500 mt-0.5">
                    {failedCriteria.length} criterion{failedCriteria.length !== 1 ? "a" : ""} did not pass — click any row to see the full explanation.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {failedCriteria.map((v) => {
                  const eff = v.effective_verdict;
                  const isExpanded = expandedCriteria.has(v.criterion_id);
                  const borderColor = eff === "NOT_ELIGIBLE" ? "border-l-red-400" : "border-l-amber-400";
                  const label = eff === "NOT_ELIGIBLE" ? "Not Eligible" : "Under Review";
                  const labelColor = eff === "NOT_ELIGIBLE" ? "text-red-700 bg-red-100" : "text-amber-700 bg-amber-100";
                  return (
                    <div key={v.criterion_id} className={cn("border-l-4", borderColor)}>
                      <button
                        onClick={() => toggleCriterion(v.criterion_id)}
                        className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {eff === "NOT_ELIGIBLE"
                            ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {v.criterion_category && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{v.criterion_category}</span>
                              )}
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", labelColor)}>{label}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{v.criterion_description ?? "Unnamed criterion"}</p>
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                      </button>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-5 pb-4"
                        >
                          <div className={cn("rounded-lg p-3.5 text-xs leading-relaxed border",
                            eff === "NOT_ELIGIBLE" ? "bg-red-50 border-red-100 text-red-800" : "bg-amber-50 border-amber-100 text-amber-800"
                          )}>
                            {v.reason}
                          </div>
                          {v.confidence !== null && v.confidence !== undefined && (
                            <p className="text-[10px] text-slate-400 mt-1.5 pl-1">
                              Extraction confidence: {(v.confidence * 100).toFixed(0)}%
                            </p>
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload area — hidden when submission confirmed */}
          {!registration.submission_confirmed && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Upload Submission Documents</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  placeholder="Document category (e.g. Financial Statement, PAN Card)"
                  className="flex-1 min-w-[220px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <label className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors",
                  uploading
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                )}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? (uploadProgress ?? "Uploading…") : "Choose Files"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Accepted: PDF, Word, PNG, JPG · Select multiple files to upload in bulk · Each upload is OCR-processed</p>
            </div>
          )}

          {/* Document list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Uploaded Documents</h3>
              <span className="text-xs text-slate-400">{documents.length} file{documents.length !== 1 ? "s" : ""}</span>
            </div>
            {docsLoading ? (
              <div className="p-4"><TableSkeleton rows={3} cols={3} /></div>
            ) : documents.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No documents yet — upload your first file above
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">File</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Category</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Pages</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">OCR Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <DocRow
                        key={doc.doc_id}
                        doc={doc}
                        tenderId={tenderId}
                        bidderId={registration!.bidder_id}
                        submissionConfirmed={registration!.submission_confirmed}
                        onDeleted={() => {
                          queryClient.invalidateQueries({ queryKey: ["my-docs", tenderId, registration!.bidder_id] });
                          queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Confirm submission CTA — shown before confirmation, requires at least 1 doc */}
          {!registration.submission_confirmed && documents.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2">
                  <CheckCheck className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-violet-800">Ready to submit?</p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      Once confirmed, your submission is locked — no further uploads or deletions. KYC verification runs automatically.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConfirmSubmission}
                  disabled={confirmingSubmission}
                  className="flex items-center gap-2 flex-shrink-0 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                >
                  {confirmingSubmission ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {confirmingSubmission ? "Confirming…" : "Confirm & Lock"}
                </button>
              </div>
            </div>
          )}

          {/* Post-submission note */}
          {registration.submission_confirmed ? (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-violet-700 leading-relaxed">
                  Your submission is confirmed and locked. A procurement officer will now run the AI evaluation. Your eligibility verdict will appear above when complete.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Upload all required documents, then click <strong>Confirm &amp; Lock</strong> to finalise your submission. You can delete and re-upload documents until you confirm.
                </p>
              </div>
            </div>
          )}
        </>
      ) : isNotRegistered ? (
        /* ── Not yet registered ── */
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Register for this Tender</h3>
              <p className="text-xs text-slate-500 mt-0.5">Provide your company details to participate. You can upload documents after registering.</p>
            </div>
          </div>

          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> Register Now
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Company Name *</label>
                  <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    placeholder="M/s Example Pvt. Ltd."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Contact Name</label>
                  <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder={user?.full_name ?? "Your name"}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">GSTIN</label>
                  <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">PAN</label>
                  <input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })}
                    placeholder="AAAAA0000A"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleRegister} disabled={registering}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                  {registering ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</> : "Confirm Registration"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <ConfirmModal
        open={showLockModal}
        title="Lock your submission?"
        message="After confirming, you cannot add or remove documents. KYC verification will run automatically in the background."
        confirmLabel="Confirm & Lock"
        cancelLabel="Cancel"
        variant="violet"
        onConfirm={doConfirmSubmission}
        onCancel={() => setShowLockModal(false)}
      />
    </div>
  );
}

function OcrStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:    { label: "Pending",    cls: "bg-slate-100 text-slate-500" },
    PROCESSING: { label: "Processing", cls: "bg-blue-100 text-blue-600"  },
    COMPLETE:   { label: "Complete",   cls: "bg-emerald-100 text-emerald-600" },
    FAILED:     { label: "Failed",     cls: "bg-red-100 text-red-600"    },
  };
  const m = map[status] ?? map.PENDING;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

function DocRow({
  doc, tenderId, bidderId, submissionConfirmed, onDeleted,
}: {
  doc: BidderDocument;
  tenderId: string;
  bidderId: string;
  submissionConfirmed: boolean;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const canDelete = !submissionConfirmed;

  async function handleDelete() {
    setShowDeleteModal(true);
  }

  async function doDelete() {
    setShowDeleteModal(false);
    setDeleting(true);
    try {
      await biddersApi.deleteDocument(tenderId, bidderId, doc.doc_id);
      toast.success("Document deleted");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Delete failed");
    } finally { setDeleting(false); }
  }

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-slate-700 truncate max-w-[180px]">{doc.original_filename ?? doc.filename}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500">{doc.doc_category ?? "—"}</td>
        <td className="px-4 py-3 text-xs text-slate-500">{doc.page_count ?? "—"}</td>
        <td className="px-4 py-3"><OcrStatusBadge status={doc.ocr_status} /></td>
        <td className="px-4 py-3">
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete document (available before submission is confirmed)"
              className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {deleting ? "…" : "Delete"}
            </button>
          )}
        </td>
      </tr>
      <ConfirmModal
        open={showDeleteModal}
        title="Delete document?"
        message={`"${doc.original_filename ?? doc.filename}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}


// ─── Officer view ─────────────────────────────────────────────────────────────
export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [approvingAll, setApprovingAll] = useState(false);
  const [activeTab, setActiveTab] = useState<"criteria" | "bidders">("criteria");

  const isBidder = user?.role === "BIDDER";
  const canApproveCriteria = user?.role === "SENIOR_OFFICER" || user?.role === "SYSTEM_ADMIN";
  const canTriggerEvaluation = user?.role === "PROCUREMENT_OFFICER" || user?.role === "SENIOR_OFFICER" || user?.role === "SYSTEM_ADMIN";

  // All hooks must be called unconditionally before any early return
  const { data: tender, isLoading: tenderLoading } = useQuery({
    queryKey: ["tender", id],
    queryFn: () => tendersApi.get(id),
    refetchInterval: 8_000,
    enabled: !isBidder,
  });

  const { data: criteria = [], isLoading: criteriaLoading } = useQuery({
    queryKey: ["criteria", id],
    queryFn: () => tendersApi.getCriteria(id),
    refetchInterval: 8_000,
    enabled: !isBidder,
  });

  const { data: bidders = [], isLoading: biddersLoading } = useQuery({
    queryKey: ["bidders", id],
    queryFn: () => biddersApi.list(id),
    refetchInterval: 8_000,
    enabled: !isBidder,
  });

  // Bidder gets their own dedicated view — after all hooks
  if (isBidder) return <BidderTenderView tenderId={id} />;

  function updateCriterion(updated: TenderCriterion) {
    queryClient.setQueryData<TenderCriterion[]>(["criteria", id], (old) =>
      old?.map((c) => (c.criterion_id === updated.criterion_id ? updated : c)) ?? []
    );
  }

  async function approveAll() {
    setApprovingAll(true);
    try {
      await tendersApi.approveAllCriteria(id);
      queryClient.invalidateQueries({ queryKey: ["criteria", id] });
      queryClient.invalidateQueries({ queryKey: ["tender", id] });
      toast.success("All criteria approved");
    } catch { toast.error("Failed to approve all criteria"); }
    finally { setApprovingAll(false); }
  }

  const approved = criteria.filter((c) => c.is_approved).length;
  const unapproved = criteria.filter((c) => !c.is_approved).length;

  const navItems = [
    { label: "Matrix",  href: `/tenders/${id}/matrix`,  icon: BarChart2    },
    { label: "Reviews", href: `/tenders/${id}/reviews`, icon: MessageSquare },
    { label: "Audit",   href: `/tenders/${id}/audit`,   icon: Shield       },
    { label: "Reports", href: `/tenders/${id}/reports`, icon: Download     },
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/tenders" className="hover:text-slate-600">Tenders</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate max-w-xs">
          {tender?.title ?? "Loading…"}
        </span>
      </div>

      {/* Tender header */}
      {tenderLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 h-32 animate-pulse" />
      ) : tender && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">{tender.title}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                  {tender.issuing_authority && <span className="text-xs text-slate-500">{tender.issuing_authority}</span>}
                  {tender.nit_number && <span className="text-xs font-mono text-slate-500">{tender.nit_number}</span>}
                  {tender.closing_date && <span className="text-xs text-slate-500">Closes: {formatDate(tender.closing_date)}</span>}
                  {tender.emd_amount && <span className="text-xs font-semibold text-blue-700">EMD: {formatCurrency(tender.emd_amount)}</span>}
                </div>
              </div>
            </div>
            <StatusBadge status={tender.status} />
          </div>

          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-800">{criteria.length}</div>
              <div className="text-[10px] text-slate-500">Total Criteria</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-600">{approved}</div>
              <div className="text-[10px] text-slate-500">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-600">{unapproved}</div>
              <div className="text-[10px] text-slate-500">Pending Review</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{bidders.length}</div>
              <div className="text-[10px] text-slate-500">Bidders</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation links */}
      <div className="grid grid-cols-4 gap-3">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-300 hover:shadow-card-hover transition-all group">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Icon className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[{ key: "criteria", label: "Eligibility Criteria" }, { key: "bidders", label: "Registered Bidders" }].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key as "criteria" | "bidders")}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
              activeTab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700")}>
            {label}
          </button>
        ))}
      </div>

      {/* Criteria tab */}
      {activeTab === "criteria" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{criteria.length} criteria extracted by AI · {approved} approved</p>
            {canApproveCriteria && unapproved > 0 && (
              <button onClick={approveAll} disabled={approvingAll}
                className="flex items-center gap-2 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
                <CheckCircle className="w-3.5 h-3.5" />
                {approvingAll ? "Approving…" : `Approve All ${unapproved} Criteria`}
              </button>
            )}
          </div>

          {criteriaLoading ? (
            <TableSkeleton rows={4} cols={1} />
          ) : criteria.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No criteria extracted yet"
              description="Criteria will appear here once GPT-4o processes the tender document." />
          ) : (
            <div className="space-y-3">
              {criteria.map((c, i) => (
                <CriterionCard key={c.criterion_id} criterion={c} onUpdate={updateCriterion} index={i} canApprove={canApproveCriteria} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bidders tab */}
      {activeTab === "bidders" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {bidders.length} bidder{bidders.length !== 1 ? "s" : ""} registered · Bidders self-register via their portal
            </p>
            {canTriggerEvaluation && bidders.length > 0 && (
              <EvaluateAllButton tenderId={id} bidderCount={bidders.length} />
            )}
          </div>

          {biddersLoading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : bidders.length === 0 ? (
            <EmptyState icon={FileText} title="No bidders registered yet"
              description="Bidders register from their own portal after browsing open tenders" />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">GSTIN</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Documents</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Verdict</th>
                    {canTriggerEvaluation && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bidders.map((bidder) => (
                    <BidderRow key={bidder.bidder_id} bidder={bidder} tenderId={id} canEvaluate={canTriggerEvaluation} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvaluateAllButton({ tenderId, bidderCount }: { tenderId: string; bidderCount: number }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function doEvaluateAll() {
    setShowModal(false);
    setRunning(true);
    try {
      const result = await biddersApi.evaluateAll(tenderId);
      toast.success(`Evaluation queued for ${result.triggered_count ?? bidderCount} bidder${bidderCount !== 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["bidders", tenderId] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Bulk evaluation failed");
    } finally { setRunning(false); }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={running}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-60"
      >
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        {running ? "Queuing…" : "Evaluate All"}
      </button>
      <ConfirmModal
        open={showModal}
        title={`Evaluate all ${bidderCount} bidder${bidderCount !== 1 ? "s" : ""}?`}
        message="This will use OpenAI API credits and may take several minutes. Each bidder will be processed by the AI extraction + rule engine pipeline."
        confirmLabel="Run Evaluation"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={doEvaluateAll}
        onCancel={() => setShowModal(false)}
      />
    </>
  );
}

function BidderRow({ bidder, tenderId, canEvaluate }: { bidder: Bidder; tenderId: string; canEvaluate: boolean }) {
  const queryClient = useQueryClient();
  const [evaluating, setEvaluating] = useState(false);

  async function evaluate() {
    setEvaluating(true);
    try {
      await biddersApi.triggerEvaluation(tenderId, bidder.bidder_id);
      toast.success("Evaluation started — processing in background");
      queryClient.invalidateQueries({ queryKey: ["bidders", tenderId] });
    } catch { toast.error("Failed to trigger evaluation"); }
    finally { setEvaluating(false); }
  }

  return (
    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800 text-sm">{bidder.company_name}</div>
        {bidder.contact_name && <div className="text-[11px] text-slate-400">{bidder.contact_name}</div>}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{bidder.gstin ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <span>{bidder.document_count} docs</span>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {bidder.submission_confirmed ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
              <Lock className="w-2.5 h-2.5" />Locked
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">Draft</span>
          )}
          {bidder.kyc_status && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
              bidder.kyc_status === "PASS" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              bidder.kyc_status === "FAIL" ? "bg-red-50 text-red-700 border-red-200" :
              "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              KYC {bidder.kyc_status}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3"><VerdictBadge verdict={bidder.overall_verdict} /></td>
      {canEvaluate && (
        <td className="px-4 py-3">
          <button onClick={evaluate} disabled={evaluating}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-60">
            <RefreshCw className={cn("w-3 h-3", evaluating && "animate-spin")} />
            {evaluating ? "Running…" : "Evaluate"}
          </button>
        </td>
      )}
    </motion.tr>
  );
}
