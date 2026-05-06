import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function confidenceColor(conf: number | null | undefined): string {
  if (!conf) return "text-slate-400";
  if (conf >= 0.85) return "text-emerald-600";
  if (conf >= 0.70) return "text-amber-600";
  return "text-red-600";
}

export function confidenceBg(conf: number | null | undefined): string {
  if (!conf) return "bg-slate-100";
  if (conf >= 0.85) return "bg-emerald-50";
  if (conf >= 0.70) return "bg-amber-50";
  return "bg-red-50";
}

export function verdictLabel(v: string): string {
  const map: Record<string, string> = {
    ELIGIBLE: "Eligible",
    NOT_ELIGIBLE: "Not Eligible",
    NEEDS_MANUAL_REVIEW: "Needs Review",
    PENDING: "Pending",
  };
  return map[v] ?? v;
}

export function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    FINANCIAL: "Financial",
    TECHNICAL: "Technical",
    COMPLIANCE: "Compliance",
    COMPLETENESS: "Completeness",
  };
  return map[c] ?? c;
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
