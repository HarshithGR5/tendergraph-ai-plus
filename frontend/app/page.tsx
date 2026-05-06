"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Cpu, Shield, FileCheck, Users, ArrowRight, CheckCircle,
  Brain, BarChart3, Lock, Eye, ChevronRight, GitBranch,
  FileText, AlertTriangle, ClipboardCheck, Activity
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    color: "blue",
    title: "AI Extracts. Rules Decide.",
    desc: "GPT-4o reads unstructured documents and extracts structured evidence. A deterministic Python rule engine makes all final eligibility decisions — never the AI directly.",
  },
  {
    icon: FileCheck,
    color: "emerald",
    title: "Criterion-Level Explainability",
    desc: "Every verdict cites the exact tender clause, bidder document, page number, and extracted value. No black-box decisions — every ruling is fully traceable.",
  },
  {
    icon: Lock,
    color: "purple",
    title: "Tamper-Evident Audit Trail",
    desc: "SHA-256 hash-chained event log. Every automated and human action is cryptographically sealed. Verifiable by the CVC, High Courts, or any external auditor.",
  },
  {
    icon: AlertTriangle,
    color: "amber",
    title: "Zero Silent Disqualifications",
    desc: "Any extraction with confidence below threshold is automatically escalated to human review. No bidder is silently rejected due to uncertain AI output.",
  },
  {
    icon: Users,
    color: "teal",
    title: "Role-Based Access Control",
    desc: "Four distinct roles — Procurement Officer, Senior Officer, System Admin, Audit Reviewer — each with precisely scoped permissions aligned to government procurement hierarchy.",
  },
  {
    icon: BarChart3,
    color: "indigo",
    title: "Bidder Comparison Matrix",
    desc: "Colour-coded eligibility matrix across all bidders × criteria. Filter by verdict, drill into evidence chains, export evaluation reports as signed PDFs.",
  },
];

const WORKFLOW = [
  { step: "01", label: "Upload Tender", desc: "PDF, DOCX, or scanned document. AI extracts all eligibility criteria automatically." },
  { step: "02", label: "Review Criteria", desc: "Officer reviews and approves the AI-extracted criteria schema before evaluation begins." },
  { step: "03", label: "Register Bidders", desc: "Upload bidder submission packages. OCR pipeline processes every document format." },
  { step: "04", label: "AI Evaluation", desc: "Rule engine applies deterministic checks on extracted evidence. Verdicts emitted per criterion." },
  { step: "05", label: "Human Review & Report", desc: "Ambiguous cases queued for officer decision. Signed PDF evaluation report generated." },
];

const ROLES = [
  {
    role: "Procurement Officer",
    badge: "PROCUREMENT_OFFICER",
    color: "blue",
    icon: FileText,
    permissions: [
      "Upload and manage tender documents",
      "Register bidders and upload submissions",
      "Trigger AI evaluation pipeline",
      "View and download evaluation reports",
      "Complete manual review tasks",
    ],
  },
  {
    role: "Senior Officer",
    badge: "SENIOR_OFFICER",
    color: "purple",
    icon: ClipboardCheck,
    permissions: [
      "All Procurement Officer permissions",
      "Approve extracted criteria schemas",
      "Override AI verdicts with logged reason",
      "Sign and countersign evaluation reports",
      "Assign review tasks to junior officers",
    ],
  },
  {
    role: "System Admin",
    badge: "SYSTEM_ADMIN",
    color: "rose",
    icon: Activity,
    permissions: [
      "All Senior Officer permissions",
      "Create and manage user accounts",
      "Configure system-wide thresholds",
      "Access full audit trail across all tenders",
      "Export tamper-evident audit JSON for CVC",
    ],
  },
  {
    role: "Audit Reviewer",
    badge: "AUDIT_REVIEWER",
    color: "amber",
    icon: Eye,
    permissions: [
      "Read-only access to all tenders",
      "View complete audit event log",
      "Verify SHA-256 hash chain integrity",
      "Export audit trail for external review",
      "Cannot modify any data or verdicts",
    ],
  },
];

const colorMap: Record<string, { border: string; iconBg: string; icon: string; badge: string; badgeText: string; dot: string }> = {
  blue:   { border: "border-blue-200",   iconBg: "bg-blue-50",   icon: "text-blue-600",   badge: "bg-blue-100",   badgeText: "text-blue-700",   dot: "bg-blue-500"   },
  emerald:{ border: "border-emerald-200",iconBg: "bg-emerald-50",icon: "text-emerald-600",badge: "bg-emerald-100",badgeText: "text-emerald-700",dot: "bg-emerald-500" },
  purple: { border: "border-purple-200", iconBg: "bg-purple-50", icon: "text-purple-600", badge: "bg-purple-100", badgeText: "text-purple-700", dot: "bg-purple-500" },
  amber:  { border: "border-amber-200",  iconBg: "bg-amber-50",  icon: "text-amber-600",  badge: "bg-amber-100",  badgeText: "text-amber-700",  dot: "bg-amber-500"  },
  teal:   { border: "border-teal-200",   iconBg: "bg-teal-50",   icon: "text-teal-600",   badge: "bg-teal-100",   badgeText: "text-teal-700",   dot: "bg-teal-500"   },
  indigo: { border: "border-indigo-200", iconBg: "bg-indigo-50", icon: "text-indigo-600", badge: "bg-indigo-100", badgeText: "text-indigo-700", dot: "bg-indigo-500" },
  rose:   { border: "border-rose-200",   iconBg: "bg-rose-50",   icon: "text-rose-600",   badge: "bg-rose-100",   badgeText: "text-rose-700",   dot: "bg-rose-500"   },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[#1e293b] bg-[#0f172a]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-sm">TenderGraph</span>
              <span className="text-blue-400 font-bold text-sm"> AI+</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/presentation"
              className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1e293b] transition-colors">
              Presentation
            </Link>
            <Link href="/login"
              className="text-slate-300 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1e293b] transition-colors">
              Sign In
            </Link>
            <Link href="/register"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-transparent to-purple-950/20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              CRPF · Theme 3 · Government Procurement AI
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
              Explainable AI for<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Government Procurement
              </span>
            </h1>

            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              AI extracts. Rules decide. Humans review.<br />
              Every action is criterion-level explainable and cryptographically audited.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/login"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm shadow-lg shadow-blue-900/40">
                Access Platform <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/register"
                className="flex items-center gap-2 bg-[#1e293b] hover:bg-[#263347] text-slate-200 font-semibold px-6 py-3 rounded-xl transition-all text-sm border border-[#334155]">
                Create Account <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {[
              { value: "120+", label: "Checks per 10-bidder tender" },
              { value: "< 60s", label: "Criteria extraction time" },
              { value: "0.75", label: "Confidence threshold for auto-verdict" },
              { value: "SHA-256", label: "Hash-chained audit trail" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-[#1e293b]/50 border border-[#334155] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Architecture Principle Banner */}
      <section className="border-y border-[#1e293b] bg-[#0a1120]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5 text-center">
            Core Architecture Principle
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { icon: "🤖", label: "AI Extracts", desc: "GPT-4o OCR + evidence extraction", color: "border-blue-800/50 bg-blue-950/30" },
              { icon: "⚖️", label: "Rule Engine Decides", desc: "100% deterministic — never AI direct verdict", color: "border-purple-800/50 bg-purple-950/30" },
              { icon: "👤", label: "Human Reviews", desc: "Ambiguous cases auto-escalated", color: "border-amber-800/50 bg-amber-950/30" },
              { icon: "🔒", label: "Audit Records", desc: "Hash-chained immutable event log", color: "border-emerald-800/50 bg-emerald-950/30" },
            ].map(({ icon, label, desc, color }, i, arr) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-2.5 border ${color} rounded-xl px-4 py-2.5`}>
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-[11px] text-slate-400">{desc}</p>
                  </div>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Built for Legal Defensibility</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            Every feature is designed to meet the auditability, reproducibility, and transparency requirements of government procurement law.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, title, desc }, i) => {
            const c = colorMap[color];
            return (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="bg-[#1e293b]/40 border border-[#334155] rounded-xl p-5 hover:border-[#475569] transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${c.icon}`} />
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* How it Works */}
      <section className="border-t border-[#1e293b] bg-[#0a1120]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">End-to-End Workflow</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              From raw tender document to signed evaluation report — fully automated with human oversight at every critical decision point.
            </p>
          </div>
          <div className="relative">
            <div className="absolute top-5 left-[2.5rem] right-[2.5rem] h-px bg-gradient-to-r from-transparent via-[#334155] to-transparent hidden md:block" />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {WORKFLOW.map(({ step, label, desc }) => (
                <div key={step} className="text-center relative">
                  <div className="w-10 h-10 rounded-full bg-[#1e293b] border-2 border-blue-800 flex items-center justify-center mx-auto mb-3 relative z-10">
                    <span className="text-blue-400 text-xs font-bold">{step}</span>
                  </div>
                  <h4 className="text-white text-sm font-semibold mb-1">{label}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Role-Based Access Tiers</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Four distinct roles aligned to government procurement hierarchy — each with precisely scoped permissions.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map(({ role, badge, color, icon: Icon, permissions }) => {
            const c = colorMap[color];
            return (
              <div key={role} className="bg-[#1e293b]/40 border border-[#334155] rounded-xl p-5 flex flex-col">
                <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${c.icon}`} />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{role}</h3>
                <span className={`inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${c.badge} ${c.badgeText} mb-4`}>
                  {badge}
                </span>
                <ul className="space-y-1.5 flex-1">
                  {permissions.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-xs text-slate-400">
                      <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#1e293b] bg-gradient-to-br from-blue-950/40 to-[#0f172a]">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-5">
            <GitBranch className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Ready to Evaluate?</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-8">
            Sign in to your procurement workspace or create a new account to get started.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm">
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/register"
              className="flex items-center gap-2 bg-[#1e293b] hover:bg-[#263347] text-slate-200 font-semibold px-6 py-3 rounded-xl transition-all text-sm border border-[#334155]">
              Register Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e293b]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <Cpu className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-500 text-xs">TenderGraph AI+ · CRPF Government Procurement · Theme 3</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>AI Extraction · Rule Engine · Human Review · Audit Trail</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
