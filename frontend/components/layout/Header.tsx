"use client";
import { usePathname } from "next/navigation";
import { Shield, Bell } from "lucide-react";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tenders": "Tenders",
};

function getTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.includes("/matrix")) return "Bidder Matrix";
  if (pathname.includes("/reviews")) return "Review Queue";
  if (pathname.includes("/audit")) return "Audit Trail";
  if (pathname.includes("/reports")) return "Reports";
  if (pathname.includes("/tenders/")) return "Tender Overview";
  return "TenderGraph AI+";
}

export function Header() {
  const pathname = usePathname();
  return (
    <header className="fixed top-0 right-0 left-[240px] h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30">
      <div>
        <h1 className="text-sm font-semibold text-slate-800">{getTitle(pathname)}</h1>
        <p className="text-[11px] text-slate-500">AI-Powered Procurement Intelligence Platform</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          System Operational
        </div>
        <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors relative">
          <Bell className="w-4 h-4 text-slate-500" />
        </button>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg">
          <Shield className="w-3 h-3" />
          Audit Active
        </div>
      </div>
    </header>
  );
}
