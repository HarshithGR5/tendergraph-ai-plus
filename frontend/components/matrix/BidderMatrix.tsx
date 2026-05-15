"use client";
import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { VerdictBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EvidenceDrawer } from "./EvidenceDrawer";
import type { BidderMatrixRow, TenderCriterion, CriterionVerdict, Bidder, VerdictValue, OverallVerdict } from "@/lib/types";

interface Props {
  matrix: BidderMatrixRow[];
  criteria: TenderCriterion[];
  tenderId: string;
}

const VERDICT_ICON = {
  ELIGIBLE: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  NOT_ELIGIBLE: <XCircle className="w-4 h-4 text-red-600" />,
  NEEDS_MANUAL_REVIEW: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  PENDING: <Clock className="w-4 h-4 text-slate-400" />,
};

const CELL_BG: Record<string, string> = {
  ELIGIBLE: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  NOT_ELIGIBLE: "bg-red-50 hover:bg-red-100 border-red-200",
  NEEDS_MANUAL_REVIEW: "bg-amber-50 hover:bg-amber-100 border-amber-200",
  PENDING: "bg-slate-50 hover:bg-slate-100 border-slate-200",
};

export function BidderMatrix({ matrix, criteria, tenderId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVerdict, setSelectedVerdict] = useState<CriterionVerdict | null>(null);
  const [selectedCriterion, setSelectedCriterion] = useState<TenderCriterion | null>(null);
  const [selectedBidder, setSelectedBidder] = useState<Bidder | null>(null);
  const [sortField, setSortField] = useState<string>("company_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterVerdict, setFilterVerdict] = useState<OverallVerdict | "ALL">("ALL");

  const approvedCriteria = criteria.filter((c) => c.is_approved);

  const sorted = [...matrix]
    .filter((r) => filterVerdict === "ALL" || r.overall_verdict === filterVerdict)
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "company_name") return a.company_name.localeCompare(b.company_name) * dir;
      if (sortField === "overall_verdict") return a.overall_verdict.localeCompare(b.overall_verdict) * dir;
      return 0;
    });

  function openEvidence(row: BidderMatrixRow, criterion: TenderCriterion) {
    const verdict = row.criteria_verdicts.find((v) => v.criterion_id === criterion.criterion_id) ?? null;
    setSelectedVerdict(verdict);
    setSelectedCriterion(criterion);
    setSelectedBidder({
      bidder_id: row.bidder_id,
      company_name: row.company_name,
      tender_id: tenderId,
      kyc_status: row.kyc_status,
      gstin: row.gstin,
      pan: row.pan,
      overall_verdict: row.overall_verdict,
      processing_complete: true,
      submission_confirmed: true,
      submission_timestamp: "",
      document_count: 0,
      email: null,
      contact_name: null,
    } as Bidder);
    setDrawerOpen(true);
  }

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const eligible = matrix.filter((r) => r.overall_verdict === "ELIGIBLE").length;
  const notEligible = matrix.filter((r) => r.overall_verdict === "NOT_ELIGIBLE").length;
  const review = matrix.filter((r) => r.overall_verdict === "NEEDS_MANUAL_REVIEW").length;

  return (
    <>
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {[
          { label: "Eligible", count: eligible, color: "text-emerald-700 bg-emerald-50 border-emerald-200", filter: "ELIGIBLE" as OverallVerdict },
          { label: "Not Eligible", count: notEligible, color: "text-red-700 bg-red-50 border-red-200", filter: "NOT_ELIGIBLE" as OverallVerdict },
          { label: "Needs Review", count: review, color: "text-amber-700 bg-amber-50 border-amber-200", filter: "NEEDS_MANUAL_REVIEW" as OverallVerdict },
        ].map(({ label, count, color, filter }) => (
          <button key={label}
            onClick={() => setFilterVerdict(filterVerdict === filter ? "ALL" : filter)}
            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", color, filterVerdict === filter ? "ring-2 ring-offset-1 ring-current" : "")}>
            <span className="text-lg font-bold">{count}</span>
            <span>{label}</span>
          </button>
        ))}
        {filterVerdict !== "ALL" && (
          <button onClick={() => setFilterVerdict("ALL")} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Show all
          </button>
        )}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[220px]">
                <button onClick={() => toggleSort("company_name")} className="flex items-center gap-1 hover:text-slate-700">
                  Bidder {sortField === "company_name" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                </button>
              </th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 min-w-[110px]">
                <button onClick={() => toggleSort("overall_verdict")} className="flex items-center justify-center gap-1 w-full hover:text-slate-700">
                  Overall {sortField === "overall_verdict" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                </button>
              </th>
              {approvedCriteria.map((c, i) => (
                <th key={c.criterion_id} className="text-center px-3 py-3 text-[10px] font-semibold text-slate-500 min-w-[90px] max-w-[120px]">
                  <div className="truncate" title={c.description}>C{i + 1}</div>
                  <div className="text-[9px] font-normal text-slate-400 truncate">{c.category}</div>
                </th>
              ))}
            </tr>
            {/* Criteria short names */}
            <tr className="bg-white border-b border-slate-100">
              <td className="px-4 py-2 text-[10px] text-slate-400 sticky left-0 bg-white">
                {approvedCriteria.length} criteria evaluated
              </td>
              <td />
              {approvedCriteria.map((c, i) => (
                <td key={c.criterion_id} className="px-3 py-1 text-center">
                  <div title={c.description} className="text-[9px] text-slate-400 truncate max-w-[100px] mx-auto">
                    {c.description.substring(0, 30)}…
                  </div>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <motion.tr
                key={row.bidder_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: ri * 0.02 }}
                className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 transition-colors z-10">
                  <div className="font-medium text-slate-800 text-sm">{row.company_name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{row.criteria_verdicts.length} criteria evaluated</div>
                </td>
                <td className="px-3 py-3 text-center">
                  <VerdictBadge verdict={row.overall_verdict} />
                </td>
                {approvedCriteria.map((criterion) => {
                  const verdict = row.criteria_verdicts.find((v) => v.criterion_id === criterion.criterion_id);
                  const eff = (verdict?.override_verdict ?? verdict?.verdict ?? "PENDING") as VerdictValue | "PENDING";
                  return (
                    <td key={criterion.criterion_id} className="px-2 py-2 text-center">
                      <button
                        onClick={() => openEvidence(row, criterion)}
                        className={cn(
                          "w-full min-h-[36px] rounded-lg border flex items-center justify-center transition-all hover:scale-105",
                          CELL_BG[eff] ?? CELL_BG.PENDING
                        )}
                        title={`${row.company_name} · ${criterion.description.substring(0, 60)}`}
                      >
                        {VERDICT_ICON[eff as keyof typeof VERDICT_ICON] ?? VERDICT_ICON.PENDING}
                      </button>
                    </td>
                  );
                })}
              </motion.tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={approvedCriteria.length + 2} className="text-center py-16 text-sm text-slate-400">
                  No bidders match the current filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EvidenceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        verdict={selectedVerdict}
        criterion={selectedCriterion}
        bidder={selectedBidder}
        tenderId={tenderId}
      />
    </>
  );
}
