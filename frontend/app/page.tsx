"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Cpu, Shield, FileCheck, Users, ArrowRight, CheckCircle,
  Brain, BarChart3, Lock, Eye, ChevronRight, GitBranch,
  FileText, AlertTriangle, ClipboardCheck, Activity, Building2,
  Table, Layers, Search, Database, Fingerprint, Network,
  Code2, Zap, ScanLine, Filter, BookOpen, TrendingUp,
} from "lucide-react";

// ── Static data ────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  {
    step: "01",
    label: "Multi-Format OCR",
    tech: "PyMuPDF + pdfplumber + GPT-4o Vision",
    desc: "Native PDFs are parsed with PyMuPDF for text and pdfplumber for table extraction. Scanned pages are detected via a text-density heuristic (< 50 chars + embedded images) and routed to GPT-4o Vision at 300 dpi. Tables are serialised to GitHub-Flavoured Markdown before chunking so no financial schedule is silently dropped.",
    badge: "OCR LAYER",
    color: "blue",
    icon: ScanLine,
  },
  {
    step: "02",
    label: "Entity Resolution & Normalisation",
    tech: "Regex + Jaccard token similarity + Indian unit normalisers",
    desc: "Company names are stripped of legal suffixes (Pvt Ltd, LLP, Corp) and reduced to canonical uppercase tokens. Jaccard similarity across token sets resolves aliases (\"TCS\", \"Tata Consultancy Services Ltd\", \"T.C.S. Pvt. Ltd.\"). Financial amounts are normalised to absolute INR via Crore/Lakh/Million multipliers. Dates are parsed across 15+ Indian government formats.",
    badge: "NORMALISATION",
    color: "purple",
    icon: Network,
  },
  {
    step: "03",
    label: "Structured Criterion Extraction",
    tech: "GPT-4o · JSON mode · Jinja2 prompt templates",
    desc: "A Jinja2 template constructs a domain-specific prompt that instructs GPT-4o to return a strict JSON array of criterion objects — each with category, threshold_json, mandatory_status, required_document, source_clause, and extraction_confidence. Output is validated, markdown fences stripped, and parsed deterministically. Ambiguity flags are stored for every criterion.",
    badge: "LLM EXTRACTION",
    color: "emerald",
    icon: Brain,
  },
  {
    step: "04",
    label: "RAG-Style Chunk Retrieval",
    tech: "Keyword scoring · Sliding window chunking · Overlap 400 chars",
    desc: "Bidder documents are chunked with a 3,000-char window and 400-char overlap. For each criterion, chunks are scored by keyword overlap with the criterion description and the top-k are selected as context. Each chunk carries its page number and OCR confidence so evidence citations are source-traceable.",
    badge: "RETRIEVAL",
    color: "amber",
    icon: Search,
  },
  {
    step: "05",
    label: "Deterministic Rule Engine",
    tech: "Python rules · Confidence gates · Near-threshold logic",
    desc: "GPT-4o never makes eligibility decisions. A pure Python rule engine dispatches to category-specific functions (financial.py, technical.py, compliance.py) that apply threshold comparisons, date-validity checks, and GSTIN/PAN format validation. Any verdict within 10% of a numeric threshold AND below the confidence floor is auto-escalated to NEEDS_MANUAL_REVIEW.",
    badge: "RULE ENGINE",
    color: "rose",
    icon: Filter,
  },
  {
    step: "06",
    label: "KYC & Counterparty Verification",
    tech: "GSTN API · ITD PAN API · CVC Debarment · MCA21 (sandbox)",
    desc: "Bidder identifiers are cross-checked against four government registries: GSTN (GST registration status), ITD NSDL (PAN active/deactivated), CVC debarment orders, and MCA21 company status (Active / Struck-off / Under Liquidation). Runs in sandbox mode during evaluation; production endpoints are credential-swappable without logic changes.",
    badge: "KYC",
    color: "teal",
    icon: Fingerprint,
  },
  {
    step: "07",
    label: "Hash-Chained Audit Trail",
    tech: "SHA-256 · Append-only · Tamper-evident",
    desc: "Every system and human action — OCR completion, criterion extraction, verdict emission, manual override, report generation — is written as an AuditEvent row with SHA-256(payload + prev_hash). The chain can be verified end-to-end by any auditor; a broken link unambiguously identifies the tampered record.",
    badge: "AUDIT",
    color: "indigo",
    icon: Lock,
  },
];

const TABLE_OCR_POINTS = [
  {
    title: "pdfplumber Structural Extraction",
    desc: "pdfplumber uses PDF character bounding-box geometry to reconstruct table borders without relying on visible grid lines. This correctly handles the borderless and lightly-ruled tables common in NIT annexures and financial schedule forms.",
  },
  {
    title: "GFM Serialisation Before Chunking",
    desc: "Extracted tables are converted to GitHub-Flavoured Markdown (pipe-delimited rows + header separator) and appended to the page text before chunking. This means table rows survive the sliding-window chunker and are visible to GPT-4o during evidence extraction.",
  },
  {
    title: "GPT-4o Table-Aware Scanned OCR",
    desc: "For scanned pages, a specialised prompt instructs GPT-4o to return a JSON object with a 'tables_markdown' array alongside prose text. The model is explicitly told to preserve every cell, row, and column header — unlike a generic OCR prompt that would flatten the table into prose.",
  },
  {
    title: "Space-Aligned Column Heuristic",
    desc: "Some government PDFs use whitespace alignment instead of borders. We detect these via a numeric-density heuristic: if > 30% of lines contain Indian numeric patterns (comma-separated figures, Crore/Lakh keywords), the page is flagged for table-aware GPT-4o processing even if pdfplumber finds no formal table.",
  },
];

const ENTITY_RES_POINTS = [
  {
    title: "Legal Suffix Stripping",
    desc: "A priority-ordered regex strips all legal entity suffixes before comparison: Private Limited, Pvt. Ltd., LLP, Corporation, Inc., Co. Ltd. — so the canonical form used for deduplication contains only the trading name.",
  },
  {
    title: "Token-Level Jaccard Similarity",
    desc: "After normalisation, each name is tokenised on whitespace. Jaccard similarity (|A ∩ B| / |A ∪ B|) between token sets identifies aliases regardless of word order. Threshold ≥ 0.72 triggers a deduplication merge.",
  },
  {
    title: "Indian Financial Unit Normalisation",
    desc: "Amounts are parsed with a regex that captures the numeric value and unit, then multiplied: × 10,000,000 for Crore/Cr, × 100,000 for Lakh/Lac, × 1,000,000 for Million. Currency symbols (₹, Rs., INR) are stripped. All figures land in absolute INR for threshold comparison.",
  },
  {
    title: "Multi-Format Date Parsing",
    desc: "15+ date formats common in Indian government documents are attempted in order: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD Mon YYYY, YYYY-MM-DD, DD-Mon-YY. Ordinal suffixes (1st, 22nd) are stripped before parsing. The resolved date is stored as ISO-8601 and compared against the tender closing date for certificate expiry checks.",
  },
];

const KYC_CHECKS = [
  {
    label: "GSTN API",
    desc: "Validates GSTIN against the CBIC 15-character specification (2-digit state code + PAN + entity code + Z + checksum). Queries GSTN registry for Active / Cancelled / Suspended status and registration date.",
    status: "Sandbox",
    icon: "🏛️",
  },
  {
    label: "ITD PAN Verification",
    desc: "Validates PAN format (AAAAA9999A) and queries ITD NSDL for Active / Deactivated status. Entity type (Individual / Company / HUF) is verified against the company's legal form.",
    status: "Sandbox",
    icon: "📋",
  },
  {
    label: "CVC Debarment Registry",
    desc: "Company canonical name (after suffix stripping) is SHA-256 hashed and checked against the Central Vigilance Commission debarment list. Debarred companies immediately trigger a FAIL verdict regardless of financial/technical scores.",
    status: "Sandbox",
    icon: "🚫",
  },
  {
    label: "MCA21 Company Status",
    desc: "Checks the Ministry of Corporate Affairs21 registry for company status: Active, Struck Off, Under Liquidation, or Dormant. Struck-off companies cannot legally enter government contracts.",
    status: "Sandbox",
    icon: "🏢",
  },
];

const ROLES = [
  {
    role: "Bidder",
    badge: "BIDDER",
    color: "teal",
    icon: Building2,
    permissions: [
      "Self-register to any open tender",
      "Upload company documents (PDF / DOCX / image)",
      "Track OCR processing status in real time",
      "View own criterion-level evaluation outcome",
    ],
  },
  {
    role: "Procurement Officer",
    badge: "PROCUREMENT_OFFICER",
    color: "blue",
    icon: FileText,
    permissions: [
      "View all tenders and registered bidder lists",
      "Trigger AI evaluation pipeline per bidder",
      "Work manual review tasks from the queue",
      "Download signed PDF evaluation reports",
    ],
  },
  {
    role: "Senior Officer",
    badge: "SENIOR_OFFICER",
    color: "purple",
    icon: ClipboardCheck,
    permissions: [
      "Upload and manage tender documents",
      "Approve GPT-4o extracted criteria schemas",
      "Override AI verdicts with a logged reason string",
      "Sign and countersign evaluation reports",
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
      "Configure confidence thresholds system-wide",
      "Export tamper-evident audit chain data",
    ],
  },
  {
    role: "Audit Reviewer",
    badge: "AUDIT_REVIEWER",
    color: "amber",
    icon: Eye,
    permissions: [
      "Read-only access to all tenders and evaluations",
      "View complete SHA-256 hash-chained event log",
      "Verify chain integrity end-to-end in-browser",
      "Cannot modify any record or verdict",
    ],
  },
];

const colorMap: Record<string, {
  border: string; iconBg: string; icon: string; badge: string;
  badgeText: string; dot: string; ring: string; glow: string;
}> = {
  blue:    { border: "border-blue-500/30",   iconBg: "bg-blue-950",   icon: "text-blue-400",   badge: "bg-blue-950 border border-blue-800",   badgeText: "text-blue-400",   dot: "bg-blue-500",   ring: "ring-blue-500/20",   glow: "shadow-blue-500/10" },
  emerald: { border: "border-emerald-500/30",iconBg: "bg-emerald-950",icon: "text-emerald-400",badge: "bg-emerald-950 border border-emerald-800",badgeText: "text-emerald-400",dot: "bg-emerald-500",ring: "ring-emerald-500/20",glow: "shadow-emerald-500/10" },
  purple:  { border: "border-purple-500/30", iconBg: "bg-purple-950", icon: "text-purple-400", badge: "bg-purple-950 border border-purple-800", badgeText: "text-purple-400", dot: "bg-purple-500", ring: "ring-purple-500/20", glow: "shadow-purple-500/10" },
  amber:   { border: "border-amber-500/30",  iconBg: "bg-amber-950",  icon: "text-amber-400",  badge: "bg-amber-950 border border-amber-800",  badgeText: "text-amber-400",  dot: "bg-amber-500",  ring: "ring-amber-500/20",  glow: "shadow-amber-500/10" },
  teal:    { border: "border-teal-500/30",   iconBg: "bg-teal-950",   icon: "text-teal-400",   badge: "bg-teal-950 border border-teal-800",   badgeText: "text-teal-400",   dot: "bg-teal-500",   ring: "ring-teal-500/20",   glow: "shadow-teal-500/10" },
  indigo:  { border: "border-indigo-500/30", iconBg: "bg-indigo-950", icon: "text-indigo-400", badge: "bg-indigo-950 border border-indigo-800", badgeText: "text-indigo-400", dot: "bg-indigo-500", ring: "ring-indigo-500/20", glow: "shadow-indigo-500/10" },
  rose:    { border: "border-rose-500/30",   iconBg: "bg-rose-950",   icon: "text-rose-400",   badge: "bg-rose-950 border border-rose-800",   badgeText: "text-rose-400",   dot: "bg-rose-500",   ring: "ring-rose-500/20",   glow: "shadow-rose-500/10" },
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080d14] text-white">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#080d14]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-sm tracking-tight">TenderGraph</span>
              <span className="text-blue-400 font-bold text-sm"> AI+</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/presentation"
              className="text-slate-400 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              Platform Overview
            </Link>
            <Link href="/login"
              className="text-slate-400 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              Sign In
            </Link>
            <Link href="/register"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-white/5">
        {/* Background grids / glows */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/8 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 pt-20 pb-20 text-center relative">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/50 text-blue-300 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Government Procurement Intelligence · AI + Rule Engine + Audit
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
              Explainable AI for<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300">
                Tender Evaluation
              </span>
            </h1>

            <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-4 leading-relaxed">
              GPT-4o extracts structured evidence. A deterministic Python rule engine decides eligibility.
              Every criterion verdict is criterion-level explainable with source-page citations and a SHA-256 hash-chained audit trail.
            </p>
            <p className="text-slate-600 text-sm max-w-xl mx-auto mb-10 font-mono">
              PyMuPDF · pdfplumber · GPT-4o Vision · Jaccard NER · GSTN/PAN/CVC KYC · ReportLab · SHA-256
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/login"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm shadow-xl shadow-blue-600/20">
                Access Platform <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/register"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold px-6 py-3 rounded-xl transition-all text-sm border border-white/10">
                Create Account <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto"
          >
            {[
              { value: "7-stage", label: "OCR → KYC → Verdict pipeline" },
              { value: "< 60s", label: "Criterion extraction from tender PDF" },
              { value: "SHA-256", label: "Hash-chained, tamper-evident log" },
              { value: "conf ≥ 0.75", label: "Auto-verdict confidence floor" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center backdrop-blur-sm">
                <div className="text-xl font-bold text-white mb-1 font-mono">{value}</div>
                <div className="text-[11px] text-slate-500">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Architecture principle banner ── */}
      <section className="border-b border-white/5 bg-[#0a1120]/80">
        <div className="max-w-7xl mx-auto px-6 py-7">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-5 text-center">
            Core Separation of Concerns
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {[
              { icon: "🤖", label: "GPT-4o Extracts", desc: "Structured evidence from unstructured docs", color: "border-blue-800/40 bg-blue-950/30" },
              { icon: "📐", label: "Normaliser", desc: "Entity resolution · INR units · Date parsing", color: "border-purple-800/40 bg-purple-950/30" },
              { icon: "⚖️", label: "Rule Engine Decides", desc: "100% deterministic Python — never AI direct", color: "border-emerald-800/40 bg-emerald-950/30" },
              { icon: "🔍", label: "KYC Validates", desc: "GSTN · PAN · CVC · MCA21 registries", color: "border-teal-800/40 bg-teal-950/30" },
              { icon: "👤", label: "Human Reviews", desc: "Low-confidence cases auto-escalated", color: "border-amber-800/40 bg-amber-950/30" },
              { icon: "🔒", label: "Audit Seals", desc: "SHA-256 hash-chain on every event", color: "border-indigo-800/40 bg-indigo-950/30" },
            ].map(({ icon, label, desc, color }, i, arr) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-2.5 border ${color} rounded-xl px-3.5 py-2`}>
                  <span className="text-lg">{icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-[10px] text-slate-500">{desc}</p>
                  </div>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technical Pipeline (7 stages) ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-3">Technical Methodology</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">The 7-Stage Evaluation Pipeline</h2>
          <p className="text-slate-500 max-w-xl mx-auto text-sm">
            Every evaluation traverses a deterministic sequence. No stage can be skipped.
            Each stage writes to the audit trail before the next begins.
          </p>
        </div>

        <div className="space-y-4">
          {PIPELINE_STEPS.map(({ step, label, tech, desc, badge, color, icon: Icon }, i) => {
            const c = colorMap[color];
            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`group relative border ${c.border} rounded-2xl p-6 bg-white/2 hover:bg-white/4 transition-all duration-200`}
              >
                <div className="flex gap-5">
                  {/* Step number */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl ${c.iconBg} border ${c.border} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${c.icon}`} />
                    </div>
                    <span className={`text-[10px] font-black font-mono ${c.icon} opacity-60`}>{step}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className="text-white font-bold text-base">{label}</h3>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${c.badge} ${c.badgeText}`}>
                        {badge}
                      </span>
                    </div>
                    <p className={`text-[11px] font-mono ${c.icon} opacity-70 mb-3`}>{tech}</p>
                    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Table OCR deep-dive ── */}
      <section className="border-y border-white/5 bg-[#0a1120]/60">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] mb-3">OCR Deep Dive</p>
              <h2 className="text-3xl font-black text-white mb-4">
                How We Handle<br />
                <span className="text-amber-400">Government Tables</span>
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Financial eligibility tables in government tenders — annual turnover schedules,
                project completion registers, EMD payment confirmations — are the most
                data-dense and legally critical content in the entire document.
                Generic OCR systems flatten them to prose and lose column structure.
                TenderGraph AI+ has a four-stage table resolution pipeline:
              </p>
              {/* Code block showing GFM table example */}
              <div className="bg-[#0d1929] border border-white/8 rounded-xl p-4 font-mono text-[11px] text-slate-400 leading-relaxed">
                <p className="text-slate-600 mb-2"># pdfplumber extract → GFM serialisation</p>
                <p><span className="text-amber-400">| Project Name</span> | Value (Cr) | Year |</p>
                <p><span className="text-slate-600">|---|---|---|</span></p>
                <p>| National Highway 48 | 45.20 | 2022 |</p>
                <p>| DMRC Phase IV | 120.00 | 2023 |</p>
                <p>| Kochi Metro Ext | 68.50 | 2021 |</p>
                <p className="mt-3 text-slate-600"># chunk text sent to GPT-4o includes table</p>
                <p className="text-green-400"># → extracted_value: 233.7, unit: "Crore"</p>
                <p className="text-green-400"># → normalised INR: ₹2,337,000,000</p>
              </div>
            </div>

            <div className="space-y-4">
              {TABLE_OCR_POINTS.map(({ title, desc }) => (
                <div key={title} className="border border-amber-500/15 rounded-xl p-5 bg-amber-950/10">
                  <div className="flex items-start gap-3">
                    <Table className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold text-sm mb-1.5">{title}</h4>
                      <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Entity Resolution ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div className="space-y-4 order-2 md:order-1">
            {ENTITY_RES_POINTS.map(({ title, desc }) => (
              <div key={title} className="border border-purple-500/15 rounded-xl p-5 bg-purple-950/10">
                <div className="flex items-start gap-3">
                  <Network className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold text-sm mb-1.5">{title}</h4>
                    <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="order-1 md:order-2">
            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-[0.2em] mb-3">Normalisation Engine</p>
            <h2 className="text-3xl font-black text-white mb-4">
              Entity Resolution &<br />
              <span className="text-purple-400">Canonical Normalisation</span>
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Government documents — especially self-prepared bidder submissions — contain
              the same entity in dozens of inconsistent representations. Without normalisation,
              a rule engine comparing "INR 5,00,000" with a threshold of "Five Lakhs" will
              fail. The normalisation layer resolves these mismatches before a single rule runs.
            </p>

            <div className="bg-[#0d1929] border border-white/8 rounded-xl p-4 font-mono text-[11px] leading-relaxed space-y-2">
              <p className="text-slate-600"># Company name resolution</p>
              <p><span className="text-rose-400">"T.C.S. Private Limited"</span></p>
              <p><span className="text-rose-400">"Tata Consultancy Services Ltd."</span></p>
              <p><span className="text-rose-400">"TCS Pvt. Ltd"</span></p>
              <p className="text-slate-600">→ strip suffixes → tokenise → Jaccard</p>
              <p><span className="text-green-400">canonical: "TATA CONSULTANCY SERVICES"</span></p>
              <p><span className="text-green-400">similarity: 1.0 (same entity)</span></p>
              <div className="border-t border-white/5 pt-2 mt-2">
                <p className="text-slate-600"># Financial normalisation</p>
                <p><span className="text-amber-400">"Rs. 2.5 Crore"</span> → <span className="text-green-400">25,000,000 INR</span></p>
                <p><span className="text-amber-400">"₹ 50,00,000/-"</span> → <span className="text-green-400">5,000,000 INR</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KYC Section ── */}
      <section className="border-y border-white/5 bg-[#0a1120]/60">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold text-teal-500 uppercase tracking-[0.2em] mb-3">KYC Integration</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Know Your Counterparty
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">
              Before any eligibility verdict is issued, bidder identifiers are cross-verified
              against four Indian government registries. Running in sandbox mode — production
              endpoints are credential-swappable without any logic changes.
            </p>
            <div className="inline-flex items-center gap-2 bg-teal-950/60 border border-teal-800/50 text-teal-300 text-[10px] font-semibold px-3 py-1.5 rounded-full mt-4">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
              Currently: Sandbox Mode · Production endpoints ready for credential injection
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {KYC_CHECKS.map(({ label, desc, status, icon }) => (
              <div key={label} className="border border-teal-500/15 rounded-xl p-5 bg-teal-950/5 hover:border-teal-500/30 transition-colors">
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-white font-semibold text-sm">{label}</h4>
                      <span className="text-[9px] font-mono font-bold bg-teal-950 border border-teal-800 text-teal-400 px-2 py-0.5 rounded">
                        {status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* KYC result example */}
          <div className="bg-[#0d1929] border border-white/8 rounded-xl p-5 font-mono text-[11px] max-w-2xl mx-auto">
            <p className="text-slate-600 mb-2"># POST /api/kyc/full-check → composite KYC result</p>
            <p><span className="text-slate-500">overall_kyc_status:</span> <span className="text-green-400">"PASS"</span></p>
            <p><span className="text-slate-500">gstin_check.status:</span> <span className="text-green-400">"Active"</span>  <span className="text-slate-600">// GSTN registry</span></p>
            <p><span className="text-slate-500">pan_check.status:</span>   <span className="text-green-400">"Active"</span>  <span className="text-slate-600">// ITD NSDL</span></p>
            <p><span className="text-slate-500">debarment.debarred:</span> <span className="text-green-400">false</span>    <span className="text-slate-600">// CVC debarment list</span></p>
            <p><span className="text-slate-500">company_status:</span>     <span className="text-green-400">"Active"</span>  <span className="text-slate-600">// MCA21 registry</span></p>
            <p><span className="text-slate-500">issues:</span>             <span className="text-green-400">[]</span></p>
          </div>
        </div>
      </section>

      {/* ── Confidence gating ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.2em] mb-3">Zero Silent Disqualifications</p>
          <h2 className="text-3xl font-black text-white mb-4">Confidence Gating Architecture</h2>
          <p className="text-slate-500 max-w-lg mx-auto text-sm">
            Three thresholds gate automatic verdict emission. Every gate miss routes to human review — never to silent rejection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              threshold: "conf < 0.60",
              label: "OCR Confidence Floor",
              desc: "If the OCR engine returns a page confidence below 0.60, none of the text from that page is used in rule evaluation. The entire criterion is escalated to NEEDS_MANUAL_REVIEW.",
              color: "rose",
            },
            {
              threshold: "conf < 0.75",
              label: "Extraction Confidence Gate",
              desc: "If GPT-4o returns an evidence extraction confidence below 0.75, the rule engine ignores the extracted value and routes to manual review regardless of whether the extracted figure would pass.",
              color: "amber",
            },
            {
              threshold: "value within 10%",
              label: "Near-Threshold Logic",
              desc: "If an extracted financial value is within 10% of the pass/fail threshold AND extraction confidence is below 0.80, the verdict is NEEDS_MANUAL_REVIEW even though the raw figure would have passed.",
              color: "blue",
            },
          ].map(({ threshold, label, desc, color }) => {
            const c = colorMap[color];
            return (
              <div key={label} className={`border ${c.border} rounded-2xl p-6 bg-white/2`}>
                <div className={`font-mono text-lg font-black ${c.icon} mb-3`}>{threshold}</div>
                <h4 className="text-white font-bold text-sm mb-3">{label}</h4>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="border-t border-white/5 bg-[#0a1120]/60">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">Access Control</p>
            <h2 className="text-3xl font-black text-white mb-4">Five Role Tiers</h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto">
              JWT-signed roles enforced at every API endpoint via FastAPI dependency injection.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {ROLES.map(({ role, badge, color, icon: Icon, permissions }) => {
              const c = colorMap[color];
              return (
                <div key={role} className={`border ${c.border} rounded-xl p-5 bg-white/2 flex flex-col`}>
                  <div className={`w-9 h-9 rounded-xl ${c.iconBg} border ${c.border} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${c.icon}`} />
                  </div>
                  <h3 className="text-white font-bold text-sm mb-1">{role}</h3>
                  <span className={`inline-block text-[9px] font-mono font-bold px-2 py-0.5 rounded ${c.badge} ${c.badgeText} mb-4`}>
                    {badge}
                  </span>
                  <ul className="space-y-1.5 flex-1">
                    {permissions.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-[11px] text-slate-500">
                        <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Audit trail ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-3">Tamper Evidence</p>
            <h2 className="text-3xl font-black text-white mb-4">SHA-256 Hash-Chained<br />Audit Trail</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Every system event and human action is written to the <code className="text-indigo-300 bg-indigo-950/50 px-1 py-0.5 rounded text-[11px]">audit_events</code> table
              as an append-only row. Each row's hash is computed over the event payload concatenated
              with the <code className="text-indigo-300 bg-indigo-950/50 px-1 py-0.5 rounded text-[11px]">prev_hash</code> of the preceding row.
              The chain can be verified by any external auditor using the <code className="text-indigo-300 bg-indigo-950/50 px-1 py-0.5 rounded text-[11px]">GET /api/audit/verify-chain</code> endpoint.
              A broken hash unambiguously identifies the tampered record.
            </p>
            <ul className="space-y-2">
              {[
                "OCR completion · criteria extraction · schema approval",
                "Bidder registration · document upload · evidence extraction",
                "Verdict emission · manual override · report generation",
                "Chain verification runs per-request — O(n) walk from genesis",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-500">
                  <Lock className="w-3 h-3 text-indigo-400 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0d1929] border border-white/8 rounded-2xl p-5 font-mono text-[11px] leading-relaxed space-y-2">
            <p className="text-slate-600"># Audit event row (append-only)</p>
            <p><span className="text-indigo-400">event_type:</span>  <span className="text-white">"VERDICT_EMITTED"</span></p>
            <p><span className="text-indigo-400">actor_id:</span>    <span className="text-white">"SYSTEM"</span></p>
            <p><span className="text-indigo-400">payload:</span>     <span className="text-slate-400">{"{ verdict: \"ELIGIBLE\", rule: \"check_financial_criterion:meets_threshold\" }"}</span></p>
            <p><span className="text-indigo-400">prev_hash:</span>   <span className="text-amber-400">"a3f9c2d1..."</span></p>
            <p><span className="text-indigo-400">this_hash:</span>   <span className="text-green-400">SHA256(payload + prev_hash)</span></p>
            <div className="border-t border-white/5 pt-2 mt-2">
              <p className="text-slate-600"># Verification walk</p>
              <p><span className="text-slate-400">for event in chain:</span></p>
              <p><span className="text-slate-400">  expected = SHA256(event.payload + prev)</span></p>
              <p><span className="text-slate-400">  assert event.this_hash == expected</span></p>
              <p><span className="text-green-400">→ chain_valid: true, events_verified: 1,847</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/5 bg-gradient-to-br from-blue-950/20 to-[#080d14]">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-blue-600/30">
            <GitBranch className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3">Ready to Evaluate?</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-8">
            Sign in to your procurement workspace or create an account to run your first tender evaluation.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm shadow-lg shadow-blue-600/20">
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/register"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold px-6 py-3 rounded-xl transition-all text-sm border border-white/10">
              Register Account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <Cpu className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-600 text-xs">TenderGraph AI+ · Procurement Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-700 font-mono">
            <span>PyMuPDF</span><span className="text-slate-800">·</span>
            <span>pdfplumber</span><span className="text-slate-800">·</span>
            <span>GPT-4o</span><span className="text-slate-800">·</span>
            <span>FastAPI</span><span className="text-slate-800">·</span>
            <span>SQLAlchemy</span><span className="text-slate-800">·</span>
            <span>SHA-256</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
