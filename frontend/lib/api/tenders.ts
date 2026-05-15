import apiClient from "./client";
import type { Tender, TenderCriterion } from "@/lib/types";

export const tendersApi = {
  list: async (): Promise<Tender[]> => {
    const { data } = await apiClient.get<Tender[]>("/api/tenders/");
    return data;
  },

  get: async (id: string): Promise<Tender> => {
    const { data } = await apiClient.get<Tender>(`/api/tenders/${id}`);
    return data;
  },

  upload: async (formData: FormData): Promise<Tender> => {
    const { data } = await apiClient.post<Tender>("/api/tenders/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  getCriteria: async (tenderId: string): Promise<TenderCriterion[]> => {
    const { data } = await apiClient.get<TenderCriterion[]>(`/api/tenders/${tenderId}/criteria`);
    return data;
  },

  approveAllCriteria: async (tenderId: string): Promise<{ approved_count: number; status: string }> => {
    const { data } = await apiClient.post(`/api/tenders/${tenderId}/criteria/approve-all`);
    return data;
  },

  approveCriterion: async (tenderId: string, criterionId: string, reviewerNotes?: string): Promise<TenderCriterion> => {
    const { data } = await apiClient.post<TenderCriterion>(
      `/api/tenders/${tenderId}/criteria/${criterionId}/approve`,
      reviewerNotes ? { reviewer_notes: reviewerNotes } : undefined
    );
    return data;
  },

  updateCriterion: async (tenderId: string, criterionId: string, payload: Partial<TenderCriterion>): Promise<TenderCriterion> => {
    const { data } = await apiClient.patch<TenderCriterion>(`/api/tenders/${tenderId}/criteria/${criterionId}`, payload);
    return data;
  },

  addCriterion: async (tenderId: string, payload: Partial<TenderCriterion>): Promise<TenderCriterion> => {
    const { data } = await apiClient.post<TenderCriterion>(`/api/tenders/${tenderId}/criteria`, payload);
    return data;
  },

  deleteCriterion: async (tenderId: string, criterionId: string): Promise<void> => {
    await apiClient.delete(`/api/tenders/${tenderId}/criteria/${criterionId}`);
  },
};
