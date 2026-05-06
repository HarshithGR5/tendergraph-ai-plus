"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Info, RefreshCw } from "lucide-react";
import { verdictsApi } from "@/lib/api/verdicts";
import { tendersApi } from "@/lib/api/tenders";
import { BidderMatrix } from "@/components/matrix/BidderMatrix";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart2 } from "lucide-react";

export default function MatrixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: matrix = [], isLoading: matrixLoading, refetch, isFetching } = useQuery({
    queryKey: ["matrix", id],
    queryFn: () => verdictsApi.getMatrix(id),
    refetchInterval: 15_000,
  });

  const { data: criteria = [], isLoading: criteriaLoading } = useQuery({
    queryKey: ["criteria", id],
    queryFn: () => tendersApi.getCriteria(id),
  });

  const { data: tender } = useQuery({
    queryKey: ["tender", id],
    queryFn: () => tendersApi.get(id),
  });

  const isLoading = matrixLoading || criteriaLoading;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/tenders" className="hover:text-slate-600">Tenders</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/tenders/${id}`} className="hover:text-slate-600 max-w-xs truncate">{tender?.title ?? id}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Bidder Matrix</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Bidder Comparison Matrix</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any cell to view evidence, OCR confidence, rule explanation & audit references
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Legend:</span>
        {[
          { color: "bg-emerald-100 border-emerald-200", label: "Eligible" },
          { color: "bg-red-100 border-red-200", label: "Not Eligible" },
          { color: "bg-amber-100 border-amber-200", label: "Needs Review" },
          { color: "bg-slate-100 border-slate-200", label: "Pending" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded border ${color}`} />
            <span className="text-[11px] text-slate-600">{label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5" />
          Click any cell for full evidence chain
        </div>
      </div>

      {/* Matrix */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <TableSkeleton rows={5} cols={6} />
        </div>
      ) : matrix.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No evaluation data yet"
          description="Register bidders, upload documents, and trigger evaluation to populate the matrix"
        />
      ) : (
        <BidderMatrix matrix={matrix} criteria={criteria} tenderId={id} />
      )}
    </div>
  );
}
