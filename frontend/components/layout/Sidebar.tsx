"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";
import {
  LayoutDashboard, FileText, Shield, ClipboardCheck,
  LogOut, ChevronRight, Cpu, Settings, Eye,
  Activity, Building2, FolderOpen
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const OFFICER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tenders",   href: "/tenders",   icon: FileText },
];

const BIDDER_NAV: NavItem[] = [
  { label: "My Dashboard",   href: "/dashboard",       icon: LayoutDashboard },
  { label: "Open Tenders",   href: "/tenders",         icon: FileText },
  { label: "My Submissions", href: "/my-submissions",  icon: FolderOpen },
];

const REVIEW_NAV: NavItem[] = [
  {
    label: "Review Queue",
    href: "/reviews",
    icon: ClipboardCheck,
    roles: ["PROCUREMENT_OFFICER", "SENIOR_OFFICER", "SYSTEM_ADMIN"],
  },
];

const SYSTEM_NAV: NavItem[] = [
  {
    label: "Audit Trail",
    href: "/audit",
    icon: Shield,
    roles: ["SENIOR_OFFICER", "SYSTEM_ADMIN"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["SYSTEM_ADMIN"],
  },
];

const ROLE_META: Record<UserRole, { label: string; color: string; icon: React.ElementType }> = {
  PROCUREMENT_OFFICER: { label: "Procurement Officer", color: "bg-blue-500",   icon: FileText        },
  SENIOR_OFFICER:      { label: "Senior Officer",       color: "bg-purple-500", icon: ClipboardCheck  },
  SYSTEM_ADMIN:        { label: "System Admin",          color: "bg-rose-500",   icon: Activity        },
  AUDIT_REVIEWER:      { label: "Audit Reviewer",        color: "bg-amber-500",  icon: Eye             },
  BIDDER:              { label: "Bidder",                color: "bg-teal-500",   icon: Building2       },
};

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-400 hover:bg-[#1e293b] hover:text-slate-200"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {active && <ChevronRight className="w-3 h-3 opacity-60" />}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const role = user?.role as UserRole | undefined;

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const canSee = (item: NavItem) =>
    !item.roles || !role || item.roles.includes(role);

  const roleMeta = role ? ROLE_META[role] : null;
  const RoleIcon = roleMeta?.icon ?? FileText;

  const isBidder = role === "BIDDER";
  const isAuditReviewer = role === "AUDIT_REVIEWER";

  function handleSignOut() {
    clearAuth();
    router.push("/");
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#0f172a] flex flex-col z-40 border-r border-[#1e293b]">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1e293b]">
        <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">TenderGraph</div>
            <div className="text-blue-400 text-[10px] font-semibold tracking-wider">AI+ PLATFORM</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {isBidder ? (
          <>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-2">
              Bidder Portal
            </p>
            {BIDDER_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </>
        ) : isAuditReviewer ? (
          <>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-2">
              Audit
            </p>
            <NavLink href="/audit" icon={Shield} label="Audit Trail" active={isActive("/audit")} />
          </>
        ) : (
          <>
            {/* Procurement group */}
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-2">
              Procurement
            </p>
            {OFFICER_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
            ))}

            {/* Review group */}
            {REVIEW_NAV.filter(canSee).length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-2 mt-5">
                  Review
                </p>
                {REVIEW_NAV.filter(canSee).map((item) => (
                  <NavLink key={item.href} {...item} active={isActive(item.href)} />
                ))}
              </>
            )}

            {/* System group */}
            {SYSTEM_NAV.filter(canSee).length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-2 mt-5">
                  System
                </p>
                {SYSTEM_NAV.filter(canSee).map((item) => (
                  <NavLink key={item.href} {...item} active={isActive(item.href)} />
                ))}
              </>
            )}
          </>
        )}
      </nav>

      {/* User card */}
      <div className="px-3 py-3 border-t border-[#1e293b]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#1e293b] group transition-colors">
          <div className="w-7 h-7 rounded-full bg-[#1e3a8a] flex items-center justify-center flex-shrink-0 relative">
            <span className="text-white text-xs font-bold">
              {(user?.full_name ?? user?.username ?? "U").charAt(0).toUpperCase()}
            </span>
            {roleMeta && (
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a] ${roleMeta.color}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-200 text-xs font-medium truncate">
              {user?.full_name ?? user?.username ?? "User"}
            </div>
            <div className="text-slate-500 text-[10px] truncate flex items-center gap-1">
              {roleMeta && <RoleIcon className="w-2.5 h-2.5" />}
              {roleMeta?.label ?? "—"}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-red-400 transition-colors" />
          </button>
        </div>
      </div>
    </aside>
  );
}
