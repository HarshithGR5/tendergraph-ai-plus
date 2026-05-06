"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";
import {
  LayoutDashboard, FileText, Users, Shield, BarChart3,
  LogOut, ChevronRight, Cpu, Settings
} from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tenders", href: "/tenders", icon: FileText },
];

const SECONDARY = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#0f172a] flex flex-col z-40 border-r border-[#1e293b]">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1e293b]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">TenderGraph</div>
            <div className="text-blue-400 text-[10px] font-medium tracking-wider">AI+ PLATFORM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">
          Procurement
        </div>
        {NAV.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
              isActive(href)
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-[#1e293b] hover:text-slate-200"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {isActive(href) && <ChevronRight className="w-3 h-3 opacity-70" />}
          </Link>
        ))}

        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2 mt-5">
          System
        </div>
        {SECONDARY.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-[#1e293b] hover:text-slate-200 transition-all"
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-[#1e293b]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#1e293b] group cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">
              {(user?.full_name ?? user?.username ?? "U").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-200 text-xs font-medium truncate">{user?.full_name ?? user?.username}</div>
            <div className="text-slate-500 text-[10px] truncate">{user?.role?.replace(/_/g, " ")}</div>
          </div>
          <button
            onClick={clearAuth}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}
