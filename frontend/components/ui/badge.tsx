import { cn } from "@/lib/utils";
import type { VerdictValue, OverallVerdict, CriterionCategory, MandatoryStatus } from "@/lib/types";

interface BadgeProps { children: React.ReactNode; className?: string; }

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", className)}>
      {children}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: VerdictValue | OverallVerdict }) {
  const styles: Record<string, string> = {
    ELIGIBLE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    NOT_ELIGIBLE: "bg-red-50 text-red-700 border border-red-200",
    NEEDS_MANUAL_REVIEW: "bg-amber-50 text-amber-700 border border-amber-200",
    PENDING: "bg-slate-50 text-slate-500 border border-slate-200",
  };
  const labels: Record<string, string> = {
    ELIGIBLE: "Eligible",
    NOT_ELIGIBLE: "Not Eligible",
    NEEDS_MANUAL_REVIEW: "Needs Review",
    PENDING: "Pending",
  };
  return <Badge className={styles[verdict] ?? styles.PENDING}>{labels[verdict] ?? verdict}</Badge>;
}

export function CategoryBadge({ category }: { category: CriterionCategory }) {
  const styles: Record<string, string> = {
    FINANCIAL: "bg-blue-50 text-blue-700 border border-blue-200",
    TECHNICAL: "bg-purple-50 text-purple-700 border border-purple-200",
    COMPLIANCE: "bg-orange-50 text-orange-700 border border-orange-200",
    COMPLETENESS: "bg-teal-50 text-teal-700 border border-teal-200",
  };
  return <Badge className={styles[category] ?? "bg-slate-100 text-slate-600"}>{category}</Badge>;
}

export function MandatoryBadge({ status }: { status: MandatoryStatus }) {
  if (status === "MANDATORY")
    return <Badge className="bg-red-50 text-red-700 border border-red-200">Mandatory</Badge>;
  if (status === "OPTIONAL_PREFERRED")
    return <Badge className="bg-slate-50 text-slate-600 border border-slate-200">Preferred</Badge>;
  if (status === "OPTIONAL_SCORED")
    return <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200">Scored</Badge>;
  return <Badge className="bg-slate-50 text-slate-500 border border-slate-200">Conditional</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    UPLOADING: "bg-slate-100 text-slate-600",
    PROCESSING: "bg-blue-50 text-blue-700",
    CRITERIA_EXTRACTED: "bg-indigo-50 text-indigo-700",
    CRITERIA_APPROVED: "bg-purple-50 text-purple-700",
    EVALUATION_IN_PROGRESS: "bg-amber-50 text-amber-700",
    EVALUATION_COMPLETE: "bg-emerald-50 text-emerald-700",
    REPORT_GENERATED: "bg-green-50 text-green-700",
    PENDING: "bg-slate-100 text-slate-500",
    COMPLETE: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    OPEN: "bg-amber-50 text-amber-700",
    IN_PROGRESS: "bg-blue-50 text-blue-700",
    COMPLETED: "bg-emerald-50 text-emerald-700",
  };
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return <Badge className={cn("border", styles[status] ?? "bg-slate-100 text-slate-600")}>{label}</Badge>;
}
