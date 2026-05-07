"use client";
import { use, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight, FileText, CheckSquare, BarChart2, MessageSquare,
  Shield, Download, RefreshCw, CheckCircle, Plus, Upload,
  Loader2, Building2, X, AlertTriangle
} from "lucide-react";
import { tendersApi } from "@/lib/api/tenders";
import { biddersApi } from "@/lib/api/bidders";
import { CriterionCard } from "@/components/tenders/CriterionCard";
import { VerdictBadge, StatusBadge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/authStore";
import type { TenderCriterion, Bidder, BidderDocument } from "@/lib/types";

// ─── Bidder Portal: tender-specific view ──────────────────────────────────────
function BidderTenderView({ tenderId }: { tenderId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ company_name: "", gstin: "", pan: "", contact_name: "" });
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docCategory, setDocCategory] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !registration) return;
    const fd = new FormData();
    fd.append("file", file);
    if (docCategory) fd.append("doc_category", docCategory);
    setUploading(true);
    try {
      await biddersApi.uploadDocument(tenderId, registration.bidder_id, fd);
      toast.success(`${file.name} uploaded — OCR processing started`);
      queryClient.invalidateQueries({ queryKey: ["my-docs", tenderId, registration.bidder_id] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      if (fileRef.current) fileRef.current.value = "";
      setDocCategory("");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Upload failed");
    } finally { setUploading(false); }
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Registered — {registration.company_name}</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {registration.gstin && `GSTIN: ${registration.gstin} · `}
                  {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
                </p>
              </div>
            </div>
            <VerdictBadge verdict={registration.overall_verdict} />
          </div>

          {/* Upload area */}
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
                {uploading ? "Uploading…" : "Choose File"}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Accepted: PDF, Word, PNG, JPG · Each upload is OCR-processed and locked to your account</p>
          </div>

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
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">File</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Category</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Pages</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">OCR Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.doc_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700 truncate max-w-[200px]">{doc.original_filename ?? doc.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{doc.doc_category ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{doc.page_count ?? "—"}</td>
                      <td className="px-4 py-3">
                        <OcrStatusBadge status={doc.ocr_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Evaluation note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Once all documents are uploaded, a procurement officer will trigger the AI evaluation. Your eligibility verdict will be shown above when complete. All uploads are tamper-evident and logged to the audit trail.
              </p>
            </div>
          </div>
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
              <div className="grid grid-cols-2 gap-3">
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

  // Bidder gets their own dedicated view
  if (isBidder) return <BidderTenderView tenderId={id} />;

  const { data: tender, isLoading: tenderLoading } = useQuery({
    queryKey: ["tender", id],
    queryFn: () => tendersApi.get(id),
    refetchInterval: 8_000,
  });

  const { data: criteria = [], isLoading: criteriaLoading } = useQuery({
    queryKey: ["criteria", id],
    queryFn: () => tendersApi.getCriteria(id),
    refetchInterval: 8_000,
  });

  const { data: bidders = [], isLoading: biddersLoading } = useQuery({
    queryKey: ["bidders", id],
    queryFn: () => biddersApi.list(id),
    refetchInterval: 8_000,
  });

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
          </div>

          {biddersLoading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : bidders.length === 0 ? (
            <EmptyState icon={FileText} title="No bidders registered yet"
              description="Bidders register from their own portal after browsing open tenders" />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
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

function BidderRow({ bidder, tenderId, canEvaluate }: { bidder: Bidder; tenderId: string; canEvaluate: boolean }) {
  const [evaluating, setEvaluating] = useState(false);

  async function evaluate() {
    setEvaluating(true);
    try {
      await biddersApi.triggerEvaluation(tenderId, bidder.bidder_id);
      toast.success("Evaluation started — processing in background");
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
      <td className="px-4 py-3 text-xs text-slate-600">{bidder.document_count} docs</td>
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
