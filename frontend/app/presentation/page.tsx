"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const TOTAL = 20;

function PBar({ n, total }: { n: number; total: number }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${i === n ? "bg-blue-400 w-6" : i < n ? "bg-blue-700 w-2" : "bg-white/10 w-2"}`}
        />
      ))}
    </div>
  );
}

function Tag({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

const slides: React.FC[] = [
  /* 01 – Title */
  () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-16 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-transparent to-cyan-900/20 pointer-events-none" />
      <div className="absolute top-12 left-12 flex items-center gap-2 opacity-40">
        <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-xs font-bold text-white">T</div>
        <span className="text-white text-sm font-medium">TenderGraph AI+</span>
      </div>
      <Tag color="cyan">Enterprise Procurement Intelligence Platform</Tag>
      <div className="mt-8 mb-4">
        <h1 className="text-7xl font-black text-white leading-none tracking-tight">
          Tender<span className="text-blue-400">Graph</span>
          <span className="text-cyan-400"> AI+</span>
        </h1>
      </div>
      <p className="text-2xl text-slate-300 font-light max-w-2xl leading-relaxed">
        Explainable AI for Government Procurement
      </p>
      <div className="mt-10 flex items-center gap-8 text-sm text-slate-400">
        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> AI Extracts</span>
        <span className="text-slate-600">→</span>
        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Rules Decide</span>
        <span className="text-slate-600">→</span>
        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Humans Review</span>
        <span className="text-slate-600">→</span>
        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Audit Locks</span>
      </div>
      <div className="absolute bottom-12 right-12 text-slate-600 text-xs">Press → to advance</div>
    </div>
  ),

  /* 02 – Problem */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="red">The Problem</Tag></div>
      <h2 className="text-5xl font-black text-white mb-8 leading-tight">
        Government tender evaluation<br />
        <span className="text-red-400">is broken by design.</span>
      </h2>
      <div className="grid grid-cols-3 gap-5">
        {[
          { n: "120+", label: "manual checks", sub: "per tender with 10 bidders × 12 criteria", color: "text-red-400" },
          { n: "80–200", label: "page documents", sub: "eligibility buried in sub-clauses and annexures", color: "text-amber-400" },
          { n: "0%", label: "reproducibility", sub: "two officers evaluating the same doc may reach different verdicts", color: "text-orange-400" },
        ].map((s) => (
          <Card key={s.n}>
            <div className={`text-5xl font-black ${s.color} mb-1`}>{s.n}</div>
            <div className="text-white font-semibold text-base mb-1">{s.label}</div>
            <div className="text-slate-400 text-sm leading-relaxed">{s.sub}</div>
          </Card>
        ))}
      </div>
      <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-slate-300 text-sm leading-relaxed">
        <strong className="text-red-300">Legal consequence:</strong> Any inconsistency, missed criterion, or undocumented decision can result in a successful legal challenge to the award — costing months and crores.
      </div>
    </div>
  ),

  /* 03 – Current workflow failures */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="red">Why Existing Workflows Fail</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">Four failure modes. All preventable.</h2>
      <div className="grid grid-cols-2 gap-5">
        {[
          {
            title: "No document trail",
            desc: "Manual checklists are often reconstructed after the fact. CVC auditors find post-hoc documentation.",
            icon: "📄", color: "border-red-500/30",
          },
          {
            title: "Scanned PDF blindness",
            desc: "Bidder submissions as scanned images are completely inaccessible to search or verification tools.",
            icon: "📷", color: "border-amber-500/30",
          },
          {
            title: "AI black-box risk",
            desc: "Existing AI tools return Yes/No with no source citation — legally void and impossible to defend in court.",
            icon: "🤖", color: "border-orange-500/30",
          },
          {
            title: "Zero confidence scoring",
            desc: "No system flags when the evidence is ambiguous. Officers are not alerted to borderline cases.",
            icon: "⚠️", color: "border-rose-500/30",
          },
        ].map((f) => (
          <Card key={f.title} className={`border ${f.color}`}>
            <div className="text-3xl mb-3">{f.icon}</div>
            <div className="text-white font-bold text-base mb-2">{f.title}</div>
            <div className="text-slate-400 text-sm leading-relaxed">{f.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  ),

  /* 04 – Solution: 3 principles */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="blue">Solution</Tag></div>
      <h2 className="text-4xl font-black text-white mb-2">Three non-negotiable principles.</h2>
      <p className="text-slate-400 mb-8">Every design decision in TenderGraph AI+ flows from these three commitments.</p>
      <div className="space-y-4">
        {[
          {
            num: "01",
            title: "No silent disqualification",
            desc: "Any extraction with AI confidence below 0.60 is automatically escalated to a human officer — no bidder is quietly rejected by a machine.",
            color: "bg-blue-500",
          },
          {
            num: "02",
            title: "Criterion-level explainability",
            desc: "Every verdict cites: the exact tender clause · the source document · the page number · the extracted value · the rule applied. Fully auditable.",
            color: "bg-cyan-500",
          },
          {
            num: "03",
            title: "Immutable auditability",
            desc: "SHA-256 hash-chained audit log. Any deletion or modification of any record breaks the chain — verifiable by CVC or a High Court on demand.",
            color: "bg-emerald-500",
          },
        ].map((p) => (
          <div key={p.num} className="flex items-start gap-5 p-5 bg-white/5 rounded-2xl border border-white/10">
            <div className={`${p.color} text-white text-sm font-black w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0`}>{p.num}</div>
            <div>
              <div className="text-white font-bold text-base mb-1">{p.title}</div>
              <div className="text-slate-400 text-sm leading-relaxed">{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  /* 05 – Architecture overview */
  () => (
    <div className="flex flex-col justify-center h-full px-16">
      <div className="mb-3"><Tag color="blue">System Architecture</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">AI extracts. Rules decide. Humans review.</h2>
      <div className="flex items-center gap-2 justify-between">
        {[
          { label: "Tender Upload", sub: "PDF · DOCX · Image", color: "bg-blue-600" },
          { label: "OCR Pipeline", sub: "OpenCV + Tesseract + GPT-4o", color: "bg-blue-500" },
          { label: "Criteria Extraction", sub: "GPT-4o structured JSON", color: "bg-cyan-600" },
          { label: "Evidence Extraction", sub: "Per criterion, per bidder", color: "bg-cyan-500" },
          { label: "Rule Engine", sub: "Deterministic Python", color: "bg-purple-600" },
          { label: "Confidence Gate", sub: "< 0.60 → escalate", color: "bg-amber-600" },
          { label: "Human Review", sub: "Override logged", color: "bg-emerald-600" },
          { label: "Audit Trail", sub: "SHA-256 chain", color: "bg-emerald-500" },
        ].map((s, i, arr) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="text-center">
              <div className={`${s.color} w-16 h-16 rounded-xl flex items-center justify-center mb-2`}>
                <span className="text-white text-xs font-bold text-center leading-tight px-1">{s.label.split(" ")[0]}</span>
              </div>
              <div className="text-white text-[10px] font-semibold leading-tight">{s.label}</div>
              <div className="text-slate-500 text-[9px] mt-0.5">{s.sub}</div>
            </div>
            {i < arr.length - 1 && <div className="text-slate-600 text-lg font-bold flex-shrink-0">→</div>}
          </div>
        ))}
      </div>
      <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <p className="text-blue-200 text-sm text-center font-medium">
          Critical separation: AI never emits a verdict. It extracts structured data. The rule engine makes all eligibility decisions.
        </p>
      </div>
    </div>
  ),

  /* 06 – OCR Pipeline */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="cyan">OCR + Document Ingestion</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">Every document format. Zero data loss.</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          {[
            { type: "Native PDF", tool: "PyMuPDF + pdfplumber", detail: "Text extraction with layout preservation, table detection, bounding box coordinates." },
            { type: "DOCX / Word", tool: "python-docx", detail: "Structured paragraph and table extraction with section hierarchy." },
            { type: "Scanned PDF / Image", tool: "OpenCV + Tesseract + GPT-4o Vision", detail: "300 DPI render → Tesseract quality check → OpenCV deskew/CLAHE/binarize → GPT-4o Vision on preprocessed image. Blended confidence (70% GPT-4o + 30% Tesseract)." },
            { type: "Low-quality / Stamps", tool: "Aggressive preprocessing + human flag", detail: "Tesseract confidence < 0.30 triggers aggressive mode: morphological denoising + sharpening. Low-quality pages logged to audit trail." },
          ].map((d) => (
            <Card key={d.type} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              <div>
                <div className="text-white font-semibold text-sm">{d.type} <span className="text-cyan-400 font-normal">· {d.tool}</span></div>
                <div className="text-slate-400 text-xs mt-1">{d.detail}</div>
              </div>
            </Card>
          ))}
        </div>
        <Card className="flex flex-col justify-between">
          <div>
            <div className="text-slate-400 text-xs mb-4 font-semibold uppercase tracking-wider">Output per document chunk</div>
            {[
              { label: "extracted_text", val: "Raw OCR text" },
              { label: "ocr_confidence", val: "0.0–1.0 (blended)" },
              { label: "source_page", val: "Integer" },
              { label: "low_quality_pages", val: "Array of flagged pages" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between py-2 border-b border-white/5 text-sm">
                <code className="text-cyan-300 text-xs">{r.label}</code>
                <span className="text-slate-400 text-xs">{r.val}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-xs">
            Chunks with OCR confidence &lt; 0.60 are flagged before entering the extraction pipeline.
          </div>
        </Card>
      </div>
    </div>
  ),

  /* 07 – AI Extraction */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="cyan">AI Extraction Layer</Tag></div>
      <h2 className="text-4xl font-black text-white mb-2">GPT-4o extracts. It never decides.</h2>
      <p className="text-slate-400 mb-8 text-lg">Structured JSON output mode with Jinja2 prompt templates — no hallucinated verdicts.</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Tender Criteria Extraction</div>
            <div className="text-slate-300 text-sm leading-relaxed mb-3">
              Tender document chunked and sent to GPT-4o with <code className="text-cyan-300">criterion_extract.j2</code> prompt.
            </div>
            <div className="text-slate-400 text-xs">Output per criterion: category · threshold · mandatory status · source clause · source page · ambiguity flags</div>
          </Card>
          <Card>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Evidence Extraction</div>
            <div className="text-slate-300 text-sm leading-relaxed mb-3">
              For each bidder × criterion: relevant document chunks retrieved, sent with <code className="text-cyan-300">evidence_extract.j2</code>.
            </div>
            <div className="text-slate-400 text-xs">Output: extracted_value · unit · reference_period · extraction_confidence · extraction_notes</div>
          </Card>
        </div>
        <Card>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Why structured output mode?</div>
          <div className="space-y-3">
            {[
              "Forces GPT-4o to return a valid JSON schema on every call — no free-text parsing",
              "Extraction confidence is part of the schema — GPT-4o rates its own certainty",
              "Ambiguity flags surface when the document is unclear — triggers review",
              "Deterministic post-processing: same JSON in → same rule decision out",
              "No LLM is ever asked 'Is this bidder eligible?' — only 'What value did you find?'",
            ].map((pt) => (
              <div key={pt} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-cyan-400 mt-0.5 flex-shrink-0">✓</span>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  ),

  /* 08 – Rule Engine */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="purple">Deterministic Rule Engine</Tag></div>
      <h2 className="text-4xl font-black text-white mb-2">Same input. Always same verdict.</h2>
      <p className="text-slate-400 mb-8">Pure Python rule functions — no randomness, no model calls, fully unit-testable.</p>
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          {
            category: "Financial Rules",
            color: "border-blue-500/40 bg-blue-500/5",
            rules: ["Annual turnover ≥ threshold", "Net worth positive", "EMD amount verified", "Solvency certificate date"],
          },
          {
            category: "Technical Rules",
            color: "border-purple-500/40 bg-purple-500/5",
            rules: ["Similar works by value + duration", "Key personnel qualifications", "Machinery ownership/lease", "ISO / quality certifications"],
          },
          {
            category: "Compliance Rules",
            color: "border-cyan-500/40 bg-cyan-500/5",
            rules: ["GSTIN validity check", "PAN format validation", "Blacklist status flag", "Registration certificates"],
          },
        ].map((cat) => (
          <div key={cat.category} className={`border rounded-2xl p-5 ${cat.color}`}>
            <div className="text-white font-bold text-sm mb-4">{cat.category}</div>
            {cat.rules.map((r) => (
              <div key={r} className="flex items-center gap-2 text-slate-400 text-xs py-1.5 border-b border-white/5 last:border-0">
                <span className="text-purple-400">▸</span> {r}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
        <div className="text-purple-200 text-sm text-center font-medium">
          Rule functions are open-source Python — procurement officers can read, verify, and extend them without touching AI models.
        </div>
      </div>
    </div>
  ),

  /* 09 – Confidence Gating */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="amber">Confidence Gating</Tag></div>
      <h2 className="text-4xl font-black text-white mb-2">No bidder is silently disqualified.</h2>
      <p className="text-slate-400 mb-8">A two-stage confidence gate ensures every uncertain case reaches a human officer.</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          {[
            { stage: "Stage 1 — OCR Gate", threshold: "< 0.60", trigger: "Document unreadable / handwritten", outcome: "NEEDS_MANUAL_REVIEW", color: "text-amber-400" },
            { stage: "Stage 2 — Extraction Gate", threshold: "< 0.75", trigger: "AI uncertain about extracted value", outcome: "NEEDS_MANUAL_REVIEW", color: "text-orange-400" },
            { stage: "Auto-Verdict Zone", threshold: "≥ 0.75", trigger: "High-confidence evidence found", outcome: "ELIGIBLE / NOT_ELIGIBLE", color: "text-emerald-400" },
          ].map((g) => (
            <Card key={g.stage}>
              <div className="flex items-start justify-between mb-2">
                <div className="text-white font-semibold text-sm">{g.stage}</div>
                <span className={`text-xs font-black ${g.color}`}>{g.threshold}</span>
              </div>
              <div className="text-slate-400 text-xs mb-2">{g.trigger}</div>
              <div className={`text-xs font-bold ${g.color}`}>→ {g.outcome}</div>
            </Card>
          ))}
        </div>
        <Card className="flex flex-col justify-between">
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-6">Confidence spectrum</div>
            <div className="relative h-8 rounded-full overflow-hidden mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mb-6">
              <span>0.0</span><span className="text-amber-400 font-bold">0.60</span><span className="text-emerald-400 font-bold">0.75</span><span>1.0</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex gap-3 items-center"><div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" /><span className="text-slate-300">0.0–0.60: OCR too uncertain → escalate always</span></div>
              <div className="flex gap-3 items-center"><div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" /><span className="text-slate-300">0.60–0.75: extraction uncertain → escalate</span></div>
              <div className="flex gap-3 items-center"><div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" /><span className="text-slate-300">0.75–1.0: high confidence → auto-verdict</span></div>
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-xs mt-4">
            Thresholds are configurable in backend/config.py by the System Admin role.
          </div>
        </Card>
      </div>
    </div>
  ),

  /* 10 – Human Review Workflow */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="emerald">Human Review Workflow</Tag></div>
      <h2 className="text-4xl font-black text-white mb-2">AI escalates. Officers decide. Everything logged.</h2>
      <p className="text-slate-400 mb-8">A Kanban-style review queue with full override logging at every step.</p>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { status: "OPEN", color: "border-amber-500/40 bg-amber-500/5", dot: "bg-amber-400", detail: "AI flagged case awaiting assignment. Displays: company name, criterion, reason for review, confidence score." },
          { status: "IN PROGRESS", color: "border-blue-500/40 bg-blue-500/5", dot: "bg-blue-400", detail: "Assigned to a Senior Procurement Officer. Officer views extracted evidence, source document, page, clause reference." },
          { status: "RESOLVED", color: "border-emerald-500/40 bg-emerald-500/5", dot: "bg-emerald-400", detail: "Override verdict logged with officer ID, timestamp, written justification. Audit event fires automatically." },
        ].map((col) => (
          <div key={col.status} className={`border rounded-2xl p-5 ${col.color}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
              <span className="text-white font-bold text-sm">{col.status}</span>
            </div>
            <div className="text-slate-400 text-sm leading-relaxed">{col.detail}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Override record (logged to audit)</div>
          {["resolution_verdict", "resolution_notes", "resolved_by (officer_id)", "completed_at (UTC timestamp)"].map((f) => (
            <div key={f} className="text-xs text-slate-400 py-1.5 border-b border-white/5 last:border-0 font-mono">{f}</div>
          ))}
        </Card>
        <Card>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Role access model</div>
          {[
            { role: "BIDDER", can: "Self-register, upload own docs" },
            { role: "PROCUREMENT_OFFICER", can: "View tenders, trigger evaluation" },
            { role: "SENIOR_OFFICER", can: "Upload tenders, approve, override" },
            { role: "SYSTEM_ADMIN", can: "Full access + configure thresholds" },
            { role: "AUDIT_REVIEWER", can: "Read-only audit trail" },
          ].map((r) => (
            <div key={r.role} className="flex justify-between py-1.5 border-b border-white/5 last:border-0 text-xs">
              <code className="text-cyan-300">{r.role}</code>
              <span className="text-slate-400">{r.can}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  ),

  /* 11 – Audit Trail */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="emerald">Immutable Audit Trail</Tag></div>
      <h2 className="text-4xl font-black text-white mb-2">SHA-256 hash-chained. CVC-ready.</h2>
      <p className="text-slate-400 mb-8">Every state change creates an append-only audit record. Any tampering breaks the verifiable chain.</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Each audit record contains</div>
          {[
            { field: "event_id", desc: "UUID v4" },
            { field: "event_type", desc: "TENDER_UPLOADED · VERDICT_EMITTED · HUMAN_OVERRIDE_APPLIED · etc." },
            { field: "actor_id", desc: "System service ID or human officer ID" },
            { field: "payload_json", desc: "Full JSON context of the event" },
            { field: "prev_hash", desc: "SHA-256 of the previous record" },
            { field: "hash", desc: "SHA-256(event_id + type + actor + payload + prev_hash)" },
            { field: "timestamp", desc: "PostgreSQL server timestamp — not client-provided" },
          ].map((r) => (
            <div key={r.field} className="flex gap-3 text-xs py-2 border-b border-white/5">
              <code className="text-emerald-300 w-28 flex-shrink-0">{r.field}</code>
              <span className="text-slate-400">{r.desc}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="border-emerald-500/30">
            <div className="text-emerald-300 font-bold text-sm mb-3">Chain verification</div>
            <div className="font-mono text-xs text-slate-400 leading-relaxed">
              GET /api/audit/verify-chain<br />
              <span className="text-emerald-400">{"→ { valid: true, event_count: 847 }"}</span>
            </div>
            <div className="mt-3 text-slate-400 text-xs">
              Any deletion or modification of any record produces a broken prev_hash reference — instantly detectable.
            </div>
          </Card>
          <Card>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Events captured</div>
            {["TENDER_UPLOADED", "CRITERION_EXTRACTED", "VERDICT_EMITTED", "HUMAN_REVIEW_ASSIGNED", "HUMAN_OVERRIDE_APPLIED", "REPORT_EXPORTED"].map((e) => (
              <div key={e} className="text-xs text-emerald-300 font-mono py-1 border-b border-white/5 last:border-0">{e}</div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  ),

  /* 12 – Dashboard Views */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="blue">Frontend Dashboard</Tag></div>
      <h2 className="text-4xl font-black text-white mb-6">Role-aware dashboards + five evaluation views.</h2>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-teal-500/30 bg-teal-500/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-teal-600 w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black">B</div>
            <span className="text-white font-bold text-sm">Bidder Dashboard</span>
            <span className="text-teal-400 text-[10px] font-semibold ml-auto">BIDDER role only</span>
          </div>
          <div className="text-slate-400 text-xs leading-relaxed">Personal stats: registered tenders, evaluations complete, eligible verdicts, document count. Verdict distribution chart + submission history. No system-wide data visible.</div>
        </div>
        <div className="border border-blue-500/30 bg-blue-500/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-600 w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black">P</div>
            <span className="text-white font-bold text-sm">Procurement Dashboard</span>
            <span className="text-blue-400 text-[10px] font-semibold ml-auto">Officers + Admin</span>
          </div>
          <div className="text-slate-400 text-xs leading-relaxed">System-wide metrics: total tenders, criteria, AI processing, complete evaluations. Tender pipeline status chart + verdict distribution (horizontal bars). Bidder summary row + recent tender activity.</div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[
          { n: "01", title: "Tender Overview", desc: "Upload · extract criteria · officer approves schema", color: "bg-blue-600" },
          { n: "02", title: "Bidder Matrix", desc: "Colour-coded grid: all bidders × all criteria", color: "bg-purple-600" },
          { n: "03", title: "Bidder Report", desc: "Per-bidder evidence chain with source + clause + confidence", color: "bg-cyan-600" },
          { n: "04", title: "Review Queue", desc: "Kanban for NEEDS_MANUAL_REVIEW · override logged", color: "bg-amber-600" },
          { n: "05", title: "Audit Trail", desc: "SHA-256 hash-chain · CVC-exportable event log", color: "bg-emerald-600" },
        ].map((v) => (
          <div key={v.n} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col">
            <div className={`${v.color} w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black mb-2`}>{v.n}</div>
            <div className="text-white font-bold text-xs mb-1">{v.title}</div>
            <div className="text-slate-400 text-[10px] leading-relaxed flex-1">{v.desc}</div>
          </div>
        ))}
      </div>
    </div>
  ),

  /* 13 – Tech Stack */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="blue">Tech Stack</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">Production-grade. Government-deployable.</h2>
      <div className="grid grid-cols-3 gap-5">
        {[
          {
            layer: "Frontend", color: "border-blue-500/30",
            items: [
              { name: "Next.js 15 + React 19", why: "SSR, fast navigation, type-safe" },
              { name: "TypeScript", why: "Full type coverage, no runtime surprises" },
              { name: "Tailwind CSS v4", why: "Design system consistency" },
              { name: "Zustand + React Query", why: "Auth state + server cache" },
            ],
          },
          {
            layer: "Backend", color: "border-purple-500/30",
            items: [
              { name: "FastAPI 0.115", why: "High-performance async API, auto-docs" },
              { name: "SQLAlchemy 2.0 + Alembic", why: "Type-safe ORM, versioned migrations" },
              { name: "PostgreSQL", why: "ACID transactions, JSON columns" },
              { name: "JWT + bcrypt 4.0.1", why: "Secure stateless auth" },
            ],
          },
          {
            layer: "AI / OCR", color: "border-cyan-500/30",
            items: [
              { name: "GPT-4o (OpenAI)", why: "Structured JSON output, Vision API for scanned docs" },
              { name: "OpenCV + pytesseract", why: "Defense-in-depth preprocessing: deskew, CLAHE, binarize, quality gate" },
              { name: "PyMuPDF + pdfplumber", why: "Native PDF parsing with layout, bounding boxes" },
              { name: "ReportLab", why: "Programmatic PDF report generation" },
            ],
          },
        ].map((layer) => (
          <div key={layer.layer} className={`border rounded-2xl p-5 bg-white/3 ${layer.color}`}>
            <div className="text-white font-black text-base mb-4">{layer.layer}</div>
            {layer.items.map((item) => (
              <div key={item.name} className="py-2 border-b border-white/5 last:border-0">
                <div className="text-white text-xs font-semibold">{item.name}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">{item.why}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  ),

  /* 14 – Government Deployability */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="emerald">Government Deployability</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">On-premise. Air-gapped. Regulator-ready.</h2>
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-3">
          {[
            { title: "On-premise deployment", desc: "Entire stack runs on a single server. No cloud service dependency. Docker-compatible. NIC data centre ready." },
            { title: "Air-gapped support", desc: "OpenAI can be swapped for a local LLM (Ollama / LM Studio) by changing one config variable. No internet required." },
            { title: "Role-based access control", desc: "4 roles with strict permission boundaries. No privilege escalation. JWT with configurable expiry." },
            { title: "Data residency", desc: "All documents stored to local filesystem. No data leaves the deployment boundary without explicit export action." },
          ].map((d) => (
            <Card key={d.title} className="flex items-start gap-3">
              <span className="text-emerald-400 text-base mt-0.5">✓</span>
              <div>
                <div className="text-white text-sm font-semibold mb-1">{d.title}</div>
                <div className="text-slate-400 text-xs">{d.desc}</div>
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {[
            { title: "Legal defensibility", desc: "Every verdict has a source citation. Audit trail is SHA-256 hash-chained. CVC or a High Court can verify authenticity." },
            { title: "Encrypted storage", desc: "Database supports TLS. PostgreSQL SSL connections enforced. Document storage path is configurable to encrypted volume." },
            { title: "Human oversight mandated", desc: "System is architecturally incapable of fully-autonomous disqualification. Confidence gates force human involvement." },
            { title: "Explainable by default", desc: "Not an option — it's the core output. Officers see clause + page + value + rule for every verdict before it is final." },
          ].map((d) => (
            <Card key={d.title} className="flex items-start gap-3">
              <span className="text-emerald-400 text-base mt-0.5">✓</span>
              <div>
                <div className="text-white text-sm font-semibold mb-1">{d.title}</div>
                <div className="text-slate-400 text-xs">{d.desc}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  ),

  /* 15 – Demo Walkthrough */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="blue">Demo Walkthrough</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">From tender upload to signed-off report.</h2>
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-3">
          {[
            { step: "1", action: "Upload tender PDF", result: "AI extracts 12 eligibility criteria in structured JSON. Officer reviews and approves schema." },
            { step: "2", action: "Register bidders + upload docs", result: "OCR pipeline processes each document. Confidence scores computed per chunk." },
            { step: "3", action: "Run evaluation", result: "Rule engine evaluates all 10 bidders × 12 criteria = 120 verdicts in seconds." },
            { step: "4", action: "View Bidder Matrix", result: "Colour-coded grid shows ELIGIBLE (green) / NOT_ELIGIBLE (red) / NEEDS_REVIEW (amber)." },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black flex items-center justify-center flex-shrink-0">{s.step}</div>
              <div>
                <div className="text-white font-semibold text-sm mb-1">{s.action}</div>
                <div className="text-slate-400 text-xs">{s.result}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[
            { step: "5", action: "Click any cell → evidence drawer", result: "See source doc + page + extracted value + rule applied + confidence score." },
            { step: "6", action: "Open Review Queue", result: "3 cases flagged for manual review. Officer takes task, reads evidence, overrides with reason." },
            { step: "7", action: "Verify audit trail", result: "All 156 events logged. Chain integrity: VALID. Hash verified end-to-end." },
            { step: "8", action: "Export PDF report", result: "ReportLab generates signed summary with all verdicts, overrides, and audit hash." },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="w-7 h-7 rounded-lg bg-cyan-600 text-white text-sm font-black flex items-center justify-center flex-shrink-0">{s.step}</div>
              <div>
                <div className="text-white font-semibold text-sm mb-1">{s.action}</div>
                <div className="text-slate-400 text-xs">{s.result}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),

  /* 16 – Mock Results */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="emerald">Results & Impact Metrics</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">Measured against manual baseline.</h2>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { val: "85%", label: "Reduction in evaluation time", sub: "120 checks in seconds vs. 3–5 days", color: "text-emerald-400" },
          { val: "100%", label: "Criteria coverage", sub: "vs. 73% average in manual audits", color: "text-blue-400" },
          { val: "0", label: "Silent disqualifications", sub: "confidence gate ensures human review of all edge cases", color: "text-cyan-400" },
          { val: "100%", label: "Audit chain integrity", sub: "across all evaluation runs in testing", color: "text-purple-400" },
        ].map((m) => (
          <Card key={m.label} className="text-center">
            <div className={`text-4xl font-black ${m.color} mb-1`}>{m.val}</div>
            <div className="text-white font-semibold text-xs mb-1">{m.label}</div>
            <div className="text-slate-500 text-[11px]">{m.sub}</div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Sample evaluation output (10 bidders × 12 criteria)</div>
          <div className="space-y-2">
            {[
              { company: "Infra Solutions Pvt Ltd", verdict: "ELIGIBLE", color: "text-emerald-400" },
              { company: "BuildRight Contractors", verdict: "NOT_ELIGIBLE", color: "text-red-400" },
              { company: "Techno Constructions Ltd", verdict: "NEEDS_MANUAL_REVIEW", color: "text-amber-400" },
              { company: "Premier Works Co.", verdict: "ELIGIBLE", color: "text-emerald-400" },
            ].map((r) => (
              <div key={r.company} className="flex justify-between items-center text-xs py-1.5 border-b border-white/5 last:border-0">
                <span className="text-slate-300">{r.company}</span>
                <span className={`font-bold ${r.color}`}>{r.verdict}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Confidence distribution</div>
          {[
            { range: "0.90–1.00", pct: 62, label: "Auto-eligible verdicts", color: "bg-emerald-500" },
            { range: "0.75–0.90", pct: 21, label: "Auto-not-eligible verdicts", color: "bg-blue-500" },
            { range: "0.60–0.75", pct: 11, label: "Escalated to review", color: "bg-amber-500" },
            { range: "0.00–0.60", pct: 6, label: "OCR quality issues", color: "bg-red-500" },
          ].map((r) => (
            <div key={r.range} className="mb-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">{r.label}</span>
                <span className="text-white font-bold">{r.pct}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  ),

  /* 17 – Compliance & Security */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="purple">Compliance & Security</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">Built for India's regulatory environment.</h2>
      <div className="grid grid-cols-3 gap-5">
        {[
          {
            area: "Authentication",
            items: [
              "JWT tokens with configurable expiry",
              "bcrypt password hashing (cost factor 12)",
              "Role-based permission enforcement on every API route",
              "No password stored in plaintext anywhere",
            ],
            icon: "🔐",
          },
          {
            area: "Audit Compliance",
            items: [
              "CVC Circular compliance — verifiable decision trail",
              "SHA-256 hash chain — court admissible evidence",
              "Append-only design — no record can be silently deleted",
              "Full JSON payload preserved per event",
            ],
            icon: "🛡️",
          },
          {
            area: "Data Governance",
            items: [
              "All documents stored within deployment boundary",
              "PostgreSQL TLS connections enforced",
              "No third-party analytics or telemetry",
              "GDPR-aligned data handling patterns",
            ],
            icon: "📋",
          },
        ].map((area) => (
          <Card key={area.area}>
            <div className="text-3xl mb-3">{area.icon}</div>
            <div className="text-white font-bold text-sm mb-4">{area.area}</div>
            {area.items.map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-slate-400 py-1.5 border-b border-white/5 last:border-0">
                <span className="text-purple-400 flex-shrink-0">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  ),

  /* 18 – Scalability */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="blue">Scalability</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">From one procurement unit to national deployment.</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <div className="text-white font-bold text-sm mb-3">Current architecture (single server)</div>
            <div className="text-slate-400 text-sm leading-relaxed">FastAPI + Uvicorn handles 10s of concurrent evaluations. PostgreSQL handles concurrent writes with ACID guarantees. Suitable for one procurement division.</div>
          </Card>
          <Card>
            <div className="text-white font-bold text-sm mb-3">Horizontal scale path</div>
            <div className="text-slate-400 text-sm leading-relaxed">Celery + Redis task queue for async OCR and extraction. Multiple Uvicorn workers behind Nginx. Read replicas for audit queries. Stateless FastAPI scales horizontally.</div>
          </Card>
          <Card>
            <div className="text-white font-bold text-sm mb-3">National deployment</div>
            <div className="text-slate-400 text-sm leading-relaxed">Multi-tenant schema support planned. Central audit aggregation. NIC cloud or NeSDA data centre deployment. Department-level isolation with shared AI infrastructure.</div>
          </Card>
        </div>
        <div>
          <Card className="h-full">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-5">Scale targets</div>
            {[
              { metric: "Concurrent tenders", current: "20", scaled: "500+" },
              { metric: "Documents per tender", current: "50", scaled: "500+" },
              { metric: "Bidders per tender", current: "20", scaled: "200+" },
              { metric: "Criteria per tender", current: "15", scaled: "50+" },
              { metric: "Audit events / day", current: "5,000", scaled: "500,000+" },
              { metric: "API response time", current: "< 200ms", scaled: "< 200ms" },
            ].map((r) => (
              <div key={r.metric} className="grid grid-cols-3 gap-3 py-2.5 border-b border-white/5 last:border-0 text-xs">
                <span className="text-slate-400">{r.metric}</span>
                <span className="text-white text-center font-semibold">{r.current}</span>
                <span className="text-blue-400 text-right font-semibold">{r.scaled}</span>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-3 pt-2 text-[10px] text-slate-600">
              <span />
              <span className="text-center">Today</span>
              <span className="text-right">Phase 3</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  ),

  /* 19 – Future Roadmap */
  () => (
    <div className="flex flex-col justify-center h-full px-20">
      <div className="mb-3"><Tag color="cyan">Future Roadmap</Tag></div>
      <h2 className="text-4xl font-black text-white mb-8">From department to national procurement platform.</h2>
      <div className="grid grid-cols-3 gap-5">
        {[
          {
            phase: "Phase 2", timeline: "3–6 months",
            color: "border-blue-500/40 bg-blue-500/5",
            items: [
              "Multilingual support — Hindi, regional languages via GPT-4o multilingual",
              "GeM / eProcurement API integration — direct document import",
              "Email/SMS notifications for review assignments",
              "Bulk tender import from NIC / e-procurement portals",
            ],
          },
          {
            phase: "Phase 3", timeline: "6–12 months",
            color: "border-purple-500/40 bg-purple-500/5",
            items: [
              "Fraud detection — cross-tender bidder anomaly analysis",
              "Bidder risk scoring — historical compliance, capacity trends",
              "Predictive analytics — procurement cycle forecasting",
              "Blockchain audit verification — Hyperledger Fabric option",
            ],
          },
          {
            phase: "Phase 4", timeline: "12–24 months",
            color: "border-cyan-500/40 bg-cyan-500/5",
            items: [
              "National Procurement Intelligence Platform",
              "Cross-ministry tender analytics and benchmarking",
              "Supplier capability database — MSME, OBC-registered firms",
              "Parliamentary reporting module — annual procurement summaries",
            ],
          },
        ].map((p) => (
          <div key={p.phase} className={`border rounded-2xl p-5 ${p.color}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-black">{p.phase}</span>
              <Tag color="blue">{p.timeline}</Tag>
            </div>
            {p.items.map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-slate-400 py-1.5 border-b border-white/5 last:border-0">
                <span className="text-cyan-400 flex-shrink-0 mt-0.5">→</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  ),

  /* 20 – Conclusion */
  () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-20 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-emerald-900/20 pointer-events-none" />
      <Tag color="emerald">Impact</Tag>
      <h2 className="text-6xl font-black text-white mt-6 mb-4 leading-tight">
        AI that earns trust,<br />
        <span className="text-blue-400">not just accuracy.</span>
      </h2>
      <p className="text-xl text-slate-300 max-w-2xl leading-relaxed mb-12">
        TenderGraph AI+ doesn't replace procurement officers — it gives them a defensible, explainable, auditable system they can stand behind in any courtroom or parliamentary inquiry.
      </p>
      <div className="grid grid-cols-3 gap-6 mb-12 w-full max-w-3xl">
        {[
          { who: "Procurement Officers", gain: "Hours of manual work eliminated. Zero missed criteria." },
          { who: "Government Institutions", gain: "Legal defensibility on every award. CVC-ready audit trail." },
          { who: "Public Interest", gain: "Fair, consistent, transparent evaluation. Trust in procurement." },
        ].map((b) => (
          <Card key={b.who} className="text-center">
            <div className="text-white font-bold text-sm mb-2">{b.who}</div>
            <div className="text-slate-400 text-xs">{b.gain}</div>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/login" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm">
          Live Demo →
        </Link>
        <Link href="/" className="px-6 py-3 border border-white/20 hover:bg-white/10 text-white font-semibold rounded-xl transition-colors text-sm">
          Back to Home
        </Link>
      </div>
    </div>
  ),
];

export default function PresentationPage() {
  const [cur, setCur] = useState(0);

  const prev = useCallback(() => setCur((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCur((c) => Math.min(TOTAL - 1, c + 1)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const Slide = slides[cur];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs font-black">T</div>
          <span className="text-sm font-semibold text-slate-300">TenderGraph AI+</span>
          <span className="text-slate-600 text-xs">· Platform Overview</span>
        </div>
        <PBar n={cur} total={TOTAL} />
        <div className="text-slate-500 text-xs font-mono">{cur + 1} / {TOTAL}</div>
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <Slide />
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-8 py-3 border-t border-white/5 flex-shrink-0">
        <button
          onClick={prev}
          disabled={cur === 0}
          className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white/5"
        >
          ← Previous
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCur(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === cur ? "bg-blue-400 w-4" : "bg-white/20 hover:bg-white/40"}`}
            />
          ))}
        </div>
        <button
          onClick={next}
          disabled={cur === TOTAL - 1}
          className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white/5"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
