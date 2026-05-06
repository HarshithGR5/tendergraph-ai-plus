"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Cpu, Eye, EyeOff, ArrowLeft,
  FileText, ClipboardCheck, Activity, Eye as EyeIcon, CheckCircle
} from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { toast } from "sonner";
import type { UserRole } from "@/lib/types";

interface RoleOption {
  value: UserRole;
  label: string;
  icon: React.ElementType;
  color: string;
  iconBg: string;
  iconColor: string;
  permissions: string[];
}

const ROLES: RoleOption[] = [
  {
    value: "PROCUREMENT_OFFICER",
    label: "Procurement Officer",
    icon: FileText,
    color: "border-blue-600 bg-blue-950/40",
    iconBg: "bg-blue-900/60",
    iconColor: "text-blue-400",
    permissions: ["Upload & manage tenders", "Register bidders", "Run evaluations", "Download reports"],
  },
  {
    value: "SENIOR_OFFICER",
    label: "Senior Officer",
    icon: ClipboardCheck,
    color: "border-purple-600 bg-purple-950/40",
    iconBg: "bg-purple-900/60",
    iconColor: "text-purple-400",
    permissions: ["All Officer permissions", "Approve criteria schemas", "Override verdicts", "Sign reports"],
  },
  {
    value: "SYSTEM_ADMIN",
    label: "System Admin",
    icon: Activity,
    color: "border-rose-600 bg-rose-950/40",
    iconBg: "bg-rose-900/60",
    iconColor: "text-rose-400",
    permissions: ["Full system access", "Manage user accounts", "Configure thresholds", "Export audit data"],
  },
  {
    value: "AUDIT_REVIEWER",
    label: "Audit Reviewer",
    icon: EyeIcon,
    color: "border-amber-600 bg-amber-950/40",
    iconBg: "bg-amber-900/60",
    iconColor: "text-amber-400",
    permissions: ["Read-only access", "View audit trail", "Verify hash chain", "Export audit JSON"],
  },
];

const DEFAULT_BORDER = "border-[#334155] bg-transparent hover:border-[#475569]";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    confirmPassword: "",
    role: "PROCUREMENT_OFFICER" as UserRole,
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        username: form.username,
        email: form.email,
        password: form.password,
        full_name: form.full_name || undefined,
        role: form.role,
      });
      toast.success("Account created! Please sign in.");
      router.push("/login");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Registration failed. Try a different username or email.");
    } finally {
      setLoading(false);
    }
  }

  const selectedRole = ROLES.find((r) => r.value === form.role)!;

  return (
    <div className="min-h-screen bg-[#0f172a] flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[480px] flex-col justify-between p-10 border-r border-[#1e293b] bg-[#0a1120]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 mb-10 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight">TenderGraph AI+</div>
              <div className="text-blue-400 text-[10px] tracking-widest font-semibold">PROCUREMENT INTELLIGENCE</div>
            </div>
          </Link>

          <h2 className="text-white text-2xl font-bold mb-3">Choose Your Role</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Select the role that matches your position in the procurement process. Permissions are scoped to your role and cannot be changed after registration without Admin approval.
          </p>

          <div className="space-y-3">
            {ROLES.map(({ value, label, icon: Icon, color, iconBg, iconColor, permissions }) => (
              <button
                key={value}
                type="button"
                onClick={() => set("role", value)}
                className={`w-full text-left border-2 rounded-xl p-4 transition-all ${
                  form.role === value ? color : DEFAULT_BORDER
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${form.role === value ? iconBg : "bg-[#1e293b]"} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${form.role === value ? iconColor : "text-slate-400"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.role === value ? "text-white" : "text-slate-300"}`}>{label}</span>
                  {form.role === value && (
                    <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 pl-11">
                  {permissions.map((p) => (
                    <span key={p} className="text-[10px] text-slate-500">· {p}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">CRPF Government Procurement · Theme 3</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-6">
            <Link href="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 text-xs">Back to home</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-sm">TenderGraph AI+</span>
            </div>
          </div>

          {/* Desktop back link */}
          <div className="hidden lg:block mb-6">
            <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back to home
            </Link>
          </div>

          <h2 className="text-white text-2xl font-bold mb-1">Create Account</h2>
          <p className="text-slate-400 text-sm mb-6">
            Registering as{" "}
            <span className="text-white font-medium">{selectedRole.label}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all"
                  placeholder="Rajesh Kumar"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Username <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, "_"))}
                  className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all"
                  placeholder="officer_rajesh"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all"
                  placeholder="officer@crpf.gov.in"
                  required
                />
              </div>
            </div>

            {/* Role selector - mobile only */}
            <div className="lg:hidden">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role <span className="text-red-400">*</span></label>
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                className="w-full bg-[#1e293b] border border-[#334155] text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all pr-10"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
              <input
                type={showPw ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                className={`w-full bg-[#1e293b] border text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${
                  form.confirmPassword && form.password !== form.confirmPassword
                    ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/20"
                    : "border-[#334155] focus:border-blue-500 focus:ring-blue-500/40"
                }`}
                placeholder="Re-enter password"
                required
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || (!!form.confirmPassword && form.password !== form.confirmPassword)}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account…</>
              ) : "Create Account"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <span className="text-slate-500 text-xs">Already have an account? </span>
            <Link href="/login" className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
