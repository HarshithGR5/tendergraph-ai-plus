"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Clock, RefreshCw, ExternalLink, FileText } from "lucide-react";
import { reviewsApi } from "@/lib/api/reviews";
import { ReviewTaskCard } from "@/components/reviews/ReviewTaskCard";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { ReviewTaskStatus, GlobalReviewTask } from "@/lib/types";

const COLS: Array<{ status: ReviewTaskStatus; label: string; icon: React.ElementType; color: string }> = [
  { status: "OPEN",        label: "Open",        icon: AlertTriangle, color: "text-amber-600"  },
  { status: "IN_PROGRESS", label: "In Progress",  icon: Clock,         color: "text-blue-600"  },
  { status: "COMPLETED",   label: "Resolved",     icon: CheckCircle,   color: "text-emerald-600" },
];

export default function GlobalReviewsPage() {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["reviews-global"],
    queryFn: () => reviewsApi.listAll(),
    refetchInterval: 15_000,
  });

  const open       = tasks.filter((t) => t.status === "OPEN");
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const completed  = tasks.filter((t) => t.status === "COMPLETED");
  const grouped    = { OPEN: open, IN_PROGRESS: inProgress, COMPLETED: completed };

  const tenderGroups = tasks.reduce<Record<string, GlobalReviewTask[]>>((acc, t) => {
    const key = t.tender_id ?? "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Manual Review Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All cases escalated where AI confidence &lt; 60% or rule engine flagged ambiguity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-amber-600 font-semibold">{open.length} open</span>
            <span className="text-blue-600 font-semibold">{inProgress.length} in progress</span>
            <span className="text-emerald-600 font-semibold">{completed.length} resolved</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tender breakdown */}
      {!isLoading && tasks.length > 0 && Object.keys(tenderGroups).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(tenderGroups).map(([tenderId, tTasks]) => {
            const title = tTasks[0]?.tender_title ?? tenderId;
            return (
              <Link
                key={tenderId}
                href={`/tenders/${tenderId}/reviews`}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
              >
                <FileText className="w-3 h-3" />
                {title}
                <span className="font-semibold text-slate-500">({tTasks.length})</span>
                <ExternalLink className="w-3 h-3 opacity-50" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Kanban */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {COLS.map((c) => (
            <div key={c.status} className="space-y-3">
              <TableSkeleton rows={3} cols={1} />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No review tasks"
          description="All evaluations were decided with sufficient AI confidence. No human review required."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {COLS.map(({ status, label, icon: Icon, color }) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn("w-4 h-4", color)} />
                <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
                <span className="ml-auto text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {grouped[status].length}
                </span>
              </div>
              <div className="space-y-3">
                {grouped[status].length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-xs text-slate-400">
                    No {label.toLowerCase()} tasks
                  </div>
                ) : (
                  grouped[status].map((task) => (
                    <ReviewTaskCard
                      key={task.task_id}
                      task={task}
                      tenderId={task.tender_id ?? ""}
                      onUpdated={(updated) => {
                        queryClient.setQueryData<GlobalReviewTask[]>(
                          ["reviews-global"],
                          (old) => old?.map((t) => (t.task_id === updated.task_id ? { ...t, ...updated } : t)) ?? []
                        );
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
