import apiClient from "./client";
import type { EvaluationReport } from "@/lib/types";

export const reportsApi = {
  list: async (tenderId: string): Promise<EvaluationReport[]> => {
    const { data } = await apiClient.get<EvaluationReport[]>(`/api/tenders/${tenderId}/reports/`);
    return data;
  },

  generateAndDownload: async (tenderId: string): Promise<void> => {
    const response = await apiClient.post(
      `/api/tenders/${tenderId}/reports/generate`,
      {},
      { responseType: "blob" }
    );
    const blob = new Blob([response.data as BlobPart], { type: "application/pdf" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const cd   = (response.headers?.["content-disposition"] as string) ?? "";
    const m    = cd.match(/filename="([^"]+)"/);
    a.download  = m?.[1] ?? `TenderGraph_Report_${tenderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  },

  downloadById: async (tenderId: string, reportId: string): Promise<void> => {
    const response = await apiClient.get(
      `/api/tenders/${tenderId}/reports/${reportId}/download`,
      { responseType: "blob" }
    );
    const blob = new Blob([response.data as BlobPart], { type: "application/pdf" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `TenderGraph_Report_${tenderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  },
};
