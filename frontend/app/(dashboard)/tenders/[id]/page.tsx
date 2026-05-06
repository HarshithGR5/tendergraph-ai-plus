"use client";
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight, FileText, CheckSquare, BarChart2, MessageSquare,
  Shield, Download, RefreshCw, CheckCircle, Plus
} from "lucide-react";
import { tendersApi } from "@/lib/api/tenders";
import { biddersApi } from "@/lib/api/bidders";
import { CriterionCard } from "@/components/tenders/CriterionCard";
import { VerdictBadge, StatusBadge, CategoryBadge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TenderCriterion } from "@/lib/types";
import { RegisterBidderModal } from "@/components/tenders/RegisterBidderModal";

export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [approvingAll, setApprovingAll] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState<"criteria" | "bidders">("criteria");

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
    { label: "Matrix", href: `/tenders/${id}/matrix`, icon: BarChart2 },
    { label: "Reviews", href: `/tenders/${id}/reviews`, icon: MessageSquare },
    { label: "Audit", href: `/tenders/${id}/audit`, icon: Shield },
    { label: "Reports", href: `/tenders/${id}/reports`, icon: Download },
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

          {/* Stats */}
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

      {/* Navigation links to sub-pages */}
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
            {unapproved > 0 && (
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
              description="Criteria will appear here once GPT-4o processes the tender document. This may take 30–60 seconds." />
          ) : (
            <div className="space-y-3">
              {criteria.map((c, i) => (
                <CriterionCard key={c.criterion_id} criterion={c} onUpdate={updateCriterion} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bidders tab */}
      {activeTab === "bidders" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{bidders.length} bidder{bidders.length !== 1 ? "s" : ""} registered</p>
            <button onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Register Bidder
            </button>
          </div>

          {biddersLoading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : bidders.length === 0 ? (
            <EmptyState icon={FileText} title="No bidders registered"
              description="Register bidders and upload their documents to begin evaluation"
              action={
                <button onClick={() => setShowRegister(true)}
                  className="flex items-center gap-2 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium">
                  <Plus className="w-3.5 h-3.5" /> Register Bidder
                </button>
              } />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">GSTIN</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Documents</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Verdict</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bidders.map((bidder) => (
                    <BidderRow key={bidder.bidder_id} bidder={bidder} tenderId={id} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showRegister && (
        <RegisterBidderModal
          tenderId={id}
          onClose={() => setShowRegister(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["bidders", id] });
            setShowRegister(false);
          }}
        />
      )}
    </div>
  );
}

function BidderRow({ bidder, tenderId }: { bidder: import("@/lib/types").Bidder; tenderId: string }) {
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
      <td className="px-4 py-3">
        <button onClick={evaluate} disabled={evaluating}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-60">
          <RefreshCw className={cn("w-3 h-3", evaluating && "animate-spin")} />
          {evaluating ? "Running…" : "Evaluate"}
        </button>
      </td>
    </motion.tr>
  );
}
