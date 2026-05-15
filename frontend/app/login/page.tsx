"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Cpu, Eye, EyeOff, Shield, FileCheck, Lock,
  FileText, ClipboardCheck, Activity, ArrowLeft, Building2
} from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/authStore";
import { toast } from "sonner";

const ROLE_CARDS = [
  { icon: Building2,     label: "Bidder",               color: "teal",   desc: "Self-register for tenders, upload documents, track outcomes" },
  { icon: FileText,      label: "Procurement Officer",  color: "blue",   desc: "View tenders, trigger evaluations, manage review tasks" },
  { icon: ClipboardCheck,label: "Senior Procurement Officer",       color: "purple", desc: "Upload tenders, approve criteria, override verdicts" },
  { icon: Activity,      label: "System Admin",         color: "rose",   desc: "Full access, user management, system configuration" },
  { icon: Eye,           label: "Audit Reviewer",       color: "amber",  desc: "Read-only access to audit trail and reports" },
];

const COLOR_DOT: Record<string, string> = {
  blue: "bg-blue-500", purple: "bg-purple-500", rose: "bg-rose-500",
  amber: "bg-amber-500", teal: "bg-teal-500",
};

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await authApi.login(username, password);
      const { default: apiClient } = await import("@/lib/api/client");
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token.access_token}`;
      localStorage.setItem("tg_token", token.access_token);
      const { data } = await apiClient.get("/api/auth/me");
      setAuth(token.access_token, data);
      toast.success("Signed in successfully");
      router.push("/dashboard");
    } catch {
      toast.error("Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[520px] flex-col justify-between p-10 border-r border-[#1e293b] bg-[#0a1120]">
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

          <h2 className="text-white text-2xl font-bold leading-snug mb-3">
            Explainable AI for<br />Government Procurement
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            AI extracts structured evidence from tender and bidder documents.
            A deterministic rule engine makes every eligibility decision.
            Every action is immutably audited.
          </p>

          <div className="space-y-3 mb-8">
            {[
              { icon: FileCheck, label: "Criterion-Level Explainability",  desc: "Every verdict traces to a specific document page and clause" },
              { icon: Shield,    label: "Tamper-Evident Audit Trail",       desc: "SHA-256 hash-chained event log, verifiable by any auditor" },
              { icon: Building2, label: "Bidder Self-Registration",         desc: "Bidders register independently and upload documents directly" },
              { icon: Lock,      label: "Deterministic Rule Engine",        desc: "AI extracts — rules decide — never probabilistic verdicts" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-slate-200 text-sm font-medium">{label}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Role legend */}
          <div className="bg-[#1e293b]/60 border border-[#334155] rounded-xl p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Platform Roles</p>
            <div className="space-y-2">
              {ROLE_CARDS.map(({ icon: Icon, label, color, desc }) => (
                <div key={label} className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${COLOR_DOT[color]}`} />
                  <div>
                    <div className="text-slate-200 text-[11px] font-medium">{label}</div>
                    <div className="text-slate-500 text-[10px]">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-slate-600 text-xs flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          TenderGraph AI+ · Enterprise Procurement Intelligence Platform
        </div>
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
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 text-xs">Back to home</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold">TenderGraph AI+</span>
            </div>
          </div>

          {/* Desktop back link */}
          <div className="hidden lg:block mb-6">
            <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back to home
            </Link>
          </div>

          <h2 className="text-white text-2xl font-bold mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-8">Sign in to your procurement workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all"
                placeholder="your_username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all pr-10"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
              ) : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-slate-500 text-xs">Don&apos;t have an account? </span>
            <Link href="/register" className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
              Register here
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
