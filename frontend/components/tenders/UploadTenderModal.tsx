"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { tendersApi } from "@/lib/api/tenders";
import { toast } from "sonner";
import type { Tender } from "@/lib/types";

interface Props { onClose: () => void; onCreated: (t: Tender) => void; }

export function UploadTenderModal({ onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [authority, setAuthority] = useState("");
  const [nit, setNit] = useState("");
  const [closing, setClosing] = useState("");
  const [emd, setEmd] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((files: File[]) => { if (files[0]) setFile(files[0]); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [], "image/*": [] },
    maxFiles: 1,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) return;
    setLoading(true);
    const timer = setInterval(() => setProgress((p) => Math.min(p + 8, 85)), 300);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      if (authority) fd.append("issuing_authority", authority);
      if (nit) fd.append("nit_number", nit);
      if (closing) fd.append("closing_date", closing);
      if (emd) fd.append("emd_amount", emd);
      const tender = await tendersApi.upload(fd);
      setProgress(100);
      toast.success("Tender uploaded — AI is extracting criteria in background");
      onCreated(tender);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Upload Tender Document</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">GPT-4o will extract eligibility criteria automatically</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Drop zone */}
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragActive ? "border-blue-400 bg-blue-50" : file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"}`}>
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-emerald-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">Drop tender document here</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, DOCX, or image · Max 50 MB</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Tender Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="e.g. CRPF Construction Services Tender 2024-25" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Issuing Authority</label>
                <input value={authority} onChange={(e) => setAuthority(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="e.g. CRPF, MHA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">NIT Number</label>
                <input value={nit} onChange={(e) => setNit(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="e.g. CRPF/NIT/2024/001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Closing Date</label>
                <input type="datetime-local" value={closing} onChange={(e) => setClosing(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">EMD Amount (₹)</label>
                <input type="number" value={emd} onChange={(e) => setEmd(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="e.g. 500000" />
              </div>
            </div>

            {loading && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Uploading &amp; queuing for AI extraction…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-blue-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ ease: "easeOut" }} />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" disabled={!file || !title || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : "Upload Tender"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
