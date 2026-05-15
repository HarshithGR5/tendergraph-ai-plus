"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "violet";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel, onConfirm]);

  const confirmCls = {
    danger: "bg-red-600 hover:bg-red-500 text-white",
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    violet: "bg-violet-600 hover:bg-violet-500 text-white",
  }[variant];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm pointer-events-auto">
              <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div className="flex items-start gap-3">
                  {variant === "danger" && (
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center flex-shrink-0 ml-2"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
              <div className="flex items-center gap-2 px-5 py-4 justify-end border-t border-slate-100 mt-1">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className={cn("px-4 py-2 text-xs font-semibold rounded-lg transition-colors", confirmCls)}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
