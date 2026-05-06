"use client";
import { useAuthStore } from "@/lib/stores/authStore";
import { User, Shield, Key, Bell } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-slate-800">Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">Account and platform configuration</p>
      </div>

      {/* Profile */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Profile</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: "Full Name", value: user?.full_name ?? "—" },
            { label: "Username", value: user?.username ?? "—" },
            { label: "Email", value: user?.email ?? "—" },
            { label: "Role", value: user?.role?.replace(/_/g, " ") ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-800">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* System info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">System Information</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: "Platform", value: "TenderGraph AI+ v1.0" },
            { label: "AI Model", value: "GPT-4o (OpenAI)" },
            { label: "Audit Chain", value: "SHA-256 Hash-Chained" },
            { label: "Backend", value: "FastAPI + PostgreSQL" },
            { label: "Compliance", value: "CRPF / CVC Ready" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-700">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
