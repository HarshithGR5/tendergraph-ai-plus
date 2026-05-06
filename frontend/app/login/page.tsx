"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Cpu, Eye, EyeOff, Shield, FileCheck, Users } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/authStore";
import { toast } from "sonner";

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
      const user = await (async () => {
        const { default: apiClient } = await import("@/lib/api/client");
        apiClient.defaults.headers.common["Authorization"] = `Bearer ${token.access_token}`;
        localStorage.setItem("tg_token", token.access_token);
        const { data } = await apiClient.get("/api/auth/me");
        return data;
      })();
      setAuth(token.access_token, user);
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
      <div className="hidden lg:flex w-[480px] flex-col justify-between p-10 border-r border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base">TenderGraph AI+</div>
            <div className="text-blue-400 text-[11px] tracking-widest font-medium">PROCUREMENT INTELLIGENCE</div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-white text-2xl font-bold leading-snug mb-3">
              Explainable AI for<br />Government Procurement
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              AI extracts. Rules decide. Humans review. Every action is immutably audited.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: FileCheck, label: "Criterion-Level Explainability", desc: "Every verdict traces to a specific document page and clause" },
              { icon: Shield, label: "Tamper-Evident Audit Trail", desc: "SHA-256 hash-chained event log, verifiable by any auditor" },
              { icon: Users, label: "Zero Silent Disqualifications", desc: "Uncertain cases always escalated to human review" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-slate-200 text-sm font-medium">{label}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-slate-600 text-xs">
          CRPF Government Procurement · Theme 3 · Hackathon Submission
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
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">TenderGraph AI+</span>
          </div>

          <h2 className="text-white text-xl font-bold mb-1">Sign in</h2>
          <p className="text-slate-400 text-sm mb-7">Access your procurement workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="officer_demo"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] text-white placeholder-slate-600 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all pr-10"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
              ) : "Sign In"}
            </button>
          </form>

          <div className="mt-6 p-3.5 rounded-lg border border-[#1e293b] bg-[#0d1829]">
            <p className="text-[11px] text-slate-500 mb-2 font-medium">Demo credentials</p>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Username</span>
                <span className="text-slate-300 font-mono">officer_demo</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Password</span>
                <span className="text-slate-300 font-mono">SecurePass@123</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
