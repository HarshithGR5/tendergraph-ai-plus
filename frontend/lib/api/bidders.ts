import apiClient from "./client";
import type { Bidder, BidderDocument, BidderEvidence } from "@/lib/types";

export const biddersApi = {
  list: async (tenderId: string): Promise<Bidder[]> => {
    const { data } = await apiClient.get<Bidder[]>(`/api/tenders/${tenderId}/bidders/`);
    return data;
  },

  get: async (tenderId: string, bidderId: string): Promise<Bidder> => {
    const { data } = await apiClient.get<Bidder>(`/api/tenders/${tenderId}/bidders/${bidderId}`);
    return data;
  },

  create: async (tenderId: string, payload: {
    company_name: string;
    gstin?: string;
    pan?: string;
    email?: string;
    contact_name?: string;
  }): Promise<Bidder> => {
    const { data } = await apiClient.post<Bidder>(`/api/tenders/${tenderId}/bidders/`, payload);
    return data;
  },

  uploadDocument: async (tenderId: string, bidderId: string, formData: FormData): Promise<BidderDocument> => {
    const { data } = await apiClient.post<BidderDocument>(
      `/api/tenders/${tenderId}/bidders/${bidderId}/documents`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  listDocuments: async (tenderId: string, bidderId: string): Promise<BidderDocument[]> => {
    const { data } = await apiClient.get<BidderDocument[]>(`/api/tenders/${tenderId}/bidders/${bidderId}/documents`);
    return data;
  },

  triggerEvaluation: async (tenderId: string, bidderId: string): Promise<{ status: string; bidder_id: string }> => {
    const { data } = await apiClient.post(`/api/tenders/${tenderId}/bidders/${bidderId}/evaluate`);
    return data;
  },

  getEvidence: async (tenderId: string, bidderId: string): Promise<BidderEvidence[]> => {
    const { data } = await apiClient.get<BidderEvidence[]>(`/api/tenders/${tenderId}/bidders/${bidderId}/evidence`);
    return data;
  },
};
