"use client";
import { motion } from "framer-motion";
import { LucideIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: "blue" | "emerald" | "amber" | "red" | "purple" | "slate";
  loading?: boolean;
}

const colorMap = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600", iconBg: "bg-blue-100", border: "border-blue-100" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", iconBg: "bg-emerald-100", border: "border-emerald-100" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", iconBg: "bg-amber-100", border: "border-amber-100" },
  red: { bg: "bg-red-50", icon: "text-red-600", iconBg: "bg-red-100", border: "border-red-100" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", iconBg: "bg-purple-100", border: "border-purple-100" },
  slate: { bg: "bg-slate-50", icon: "text-slate-600", iconBg: "bg-slate-100", border: "border-slate-200" },
};

export function MetricCard({ label, value, icon: Icon, trend, color = "blue", loading }: MetricCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow"
    >
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-2/3" />
          <div className="h-7 bg-slate-200 rounded w-1/3" />
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-1.5">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="text-[11px] text-emerald-600">{trend}</span>
              </div>
            )}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", c.iconBg)}>
            <Icon className={cn("w-5 h-5", c.icon)} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
