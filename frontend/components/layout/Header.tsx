"use client";
import { usePathname } from "next/navigation";
import { Shield, Bell, Cpu } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import type { UserRole } from "@/lib/types";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard",        subtitle: "Procurement intelligence overview" },
  "/tenders":   { title: "Tender Management", subtitle: "Upload documents · AI extracts criteria · Evaluate bidders" },
  "/reviews":   { title: "Manual Review Queue", subtitle: "NEEDS_MANUAL_REVIEW cases awaiting officer decision" },
  "/audit":     { title: "Audit Trail",       subtitle: "Immutable hash-chained event log" },
  "/settings":  { title: "System Settings",   subtitle: "Platform configuration and user management" },
};

function getPageMeta(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.includes("/matrix"))  return { title: "Bidder Matrix",      subtitle: "Criterion-level verdict comparison across all bidders" };
  if (pathname.includes("/reviews")) return { title: "Review Queue",        subtitle: "Pending manual review tasks" };
  if (pathname.includes("/audit"))   return { title: "Audit Trail",         subtitle: "Immutable hash-chained event log" };
  if (pathname.includes("/reports")) return { title: "Evaluation Reports",  subtitle: "Generated PDF evaluation reports" };
  if (pathname.includes("/tenders/"))return { title: "Tender Overview",     subtitle: "Criteria · Bidders · Evaluation status" };
  return { title: "TenderGraph AI+", subtitle: "AI-Powered Procurement Intelligence Platform" };
}

const ROLE_BADGE: Record<UserRole, { label: string; color: string }> = {
  PROCUREMENT_OFFICER: { label: "Procurement Officer", color: "text-blue-600   bg-blue-50   border-blue-200"   },
  SENIOR_OFFICER:      { label: "Senior Officer",       color: "text-purple-600 bg-purple-50 border-purple-200" },
  SYSTEM_ADMIN:        { label: "System Admin",          color: "text-rose-600   bg-rose-50   border-rose-200"   },
  AUDIT_REVIEWER:      { label: "Audit Reviewer",        color: "text-amber-600  bg-amber-50  border-amber-200"  },
};

export function Header() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { title, subtitle } = getPageMeta(pathname);
  const role = user?.role as UserRole | undefined;
  const badge = role ? ROLE_BADGE[role] : null;

  return (
    <header className="fixed top-0 right-0 left-[240px] h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold text-slate-800 truncate">{title}</h1>
        <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Role badge */}
        {badge && (
          <span className={`hidden sm:inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
        )}

        {/* System status */}
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">Operational</span>
        </div>

        {/* Notifications */}
        <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
          <Bell className="w-4 h-4 text-slate-500" />
        </button>

        {/* Audit active */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg">
          <Shield className="w-3 h-3" />
          Audit Active
        </div>
      </div>
    </header>
  );
}
