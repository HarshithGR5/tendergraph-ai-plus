"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Filter, FileText } from "lucide-react";
import { tendersApi } from "@/lib/api/tenders";
import { TenderCard } from "@/components/tenders/TenderCard";
import { UploadTenderModal } from "@/components/tenders/UploadTenderModal";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/lib/stores/authStore";
import type { Tender, TenderStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ label: string; value: TenderStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Criteria Ready", value: "CRITERIA_EXTRACTED" },
  { label: "Approved", value: "CRITERIA_APPROVED" },
  { label: "Evaluating", value: "EVALUATION_IN_PROGRESS" },
  { label: "Complete", value: "EVALUATION_COMPLETE" },
];

export default function TendersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenderStatus | "ALL">("ALL");

  const canUpload = user?.role === "SENIOR_OFFICER" || user?.role === "SYSTEM_ADMIN";

  const { data: tenders = [], isLoading } = useQuery({
    queryKey: ["tenders"],
    queryFn: tendersApi.list,
    refetchInterval: 10_000,
  });

  const filtered = tenders.filter((t) => {
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.nit_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.issuing_authority?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function handleCreated(tender: Tender) {
    queryClient.invalidateQueries({ queryKey: ["tenders"] });
    setShowUpload(false);
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Tender Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {canUpload ? "Upload documents · AI extracts criteria · Evaluate bidders" : "Browse tenders · View criteria · Track evaluations"}
          </p>
        </div>
        {canUpload && (
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Upload Tender
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenders…"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {STATUS_FILTERS.map(({ label, value }) => (
            <button key={value}
              onClick={() => setStatusFilter(value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${statusFilter === value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} tender{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || statusFilter !== "ALL" ? "No tenders match your filter" : "No tenders yet"}
          description={
            search || statusFilter !== "ALL"
              ? "Try a different search or filter"
              : canUpload
                ? "Upload your first tender document to begin AI-powered eligibility analysis"
                : "No tenders have been published yet"
          }
          action={canUpload ? (
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> Upload Tender
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((tender, i) => (
            <TenderCard key={tender.tender_id} tender={tender} index={i} />
          ))}
        </div>
      )}

      {showUpload && <UploadTenderModal onClose={() => setShowUpload(false)} onCreated={handleCreated} />}
    </div>
  );
}
