"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, ChevronRight, Calendar, Hash, Building2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Tender } from "@/lib/types";

export function TenderCard({ tender, index }: { tender: Tender; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/tenders/${tender.tender_id}`}>
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-card-hover transition-all group cursor-pointer">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                  {tender.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                  {tender.issuing_authority && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Building2 className="w-3 h-3" /> {tender.issuing_authority}
                    </span>
                  )}
                  {tender.nit_number && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Hash className="w-3 h-3" /> {tender.nit_number}
                    </span>
                  )}
                  {tender.closing_date && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Calendar className="w-3 h-3" /> {formatDate(tender.closing_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <StatusBadge status={tender.status} />
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-800">{tender.criteria_count}</div>
              <div className="text-[10px] text-slate-500">Criteria</div>
            </div>
            {tender.emd_amount && (
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">{formatCurrency(tender.emd_amount)}</div>
                <div className="text-[10px] text-slate-500">EMD Amount</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-xs font-medium text-slate-600">
                {tender.original_filename ? tender.original_filename.split('.').pop()?.toUpperCase() : "PDF"}
              </div>
              <div className="text-[10px] text-slate-500">Format</div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
