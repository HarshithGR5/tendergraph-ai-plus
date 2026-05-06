"use client";
import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  value: number | null | undefined;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ConfidenceMeter({ value, showLabel = true, size = "md" }: ConfidenceMeterProps) {
  const pct = value != null ? Math.round(value * 100) : 0;
  const color = value == null ? "bg-slate-300"
    : value >= 0.85 ? "bg-emerald-500"
    : value >= 0.70 ? "bg-amber-500"
    : "bg-red-500";

  const textColor = value == null ? "text-slate-400"
    : value >= 0.85 ? "text-emerald-700"
    : value >= 0.70 ? "text-amber-700"
    : "text-red-700";

  return (
    <div className="flex items-center gap-2">
      <div className={cn("bg-slate-100 rounded-full overflow-hidden", size === "sm" ? "w-16 h-1.5" : "w-24 h-2")}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("font-mono font-medium", textColor, size === "sm" ? "text-xs" : "text-sm")}>
          {value != null ? `${pct}%` : "—"}
        </span>
      )}
    </div>
  );
}
