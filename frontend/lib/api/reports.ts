import apiClient from "./client";
import type { EvaluationReport } from "@/lib/types";

export const reportsApi = {
  list: async (tenderId: string): Promise<EvaluationReport[]> => {
    const { data } = await apiClient.get<EvaluationReport[]>(`/api/tenders/${tenderId}/reports/`);
    return data;
  },

  generate: async (tenderId: string): Promise<EvaluationReport> => {
    const { data } = await apiClient.post<EvaluationReport>(`/api/tenders/${tenderId}/reports/generate`);
    return data;
  },

  downloadUrl: (tenderId: string, reportId: string): string => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return `${base}/api/tenders/${tenderId}/reports/${reportId}/download`;
  },
};
