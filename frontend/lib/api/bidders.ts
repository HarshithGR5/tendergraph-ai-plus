import apiClient from "./client";
import type { Bidder, BidderSubmission, BidderDocument, BidderEvidence } from "@/lib/types";

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

  selfRegister: async (tenderId: string, payload: {
    company_name: string;
    gstin?: string;
    pan?: string;
    email?: string;
    contact_name?: string;
  }): Promise<Bidder> => {
    const { data } = await apiClient.post<Bidder>(`/api/tenders/${tenderId}/bidders/self-register`, payload);
    return data;
  },

  getMyRegistration: async (tenderId: string): Promise<Bidder> => {
    const { data } = await apiClient.get<Bidder>(`/api/tenders/${tenderId}/bidders/my-registration`);
    return data;
  },

  getMySubmissions: async (): Promise<BidderSubmission[]> => {
    const { data } = await apiClient.get<BidderSubmission[]>("/api/bidder/my-submissions");
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

  uploadDocumentsBulk: async (tenderId: string, bidderId: string, formData: FormData): Promise<BidderDocument[]> => {
    const { data } = await apiClient.post<BidderDocument[]>(
      `/api/tenders/${tenderId}/bidders/${bidderId}/documents/bulk`,
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

  evaluateAll: async (tenderId: string): Promise<{ status: string; triggered_count: number; bidder_ids: string[] }> => {
    const { data } = await apiClient.post(`/api/tenders/${tenderId}/bidders/evaluate-all`);
    return data;
  },

  confirmSubmission: async (tenderId: string, bidderId: string): Promise<{
    status: string;
    bidder_id: string;
    company_name: string;
    document_count: number;
    kyc_status: string;
    message: string;
  }> => {
    const { data } = await apiClient.post(`/api/tenders/${tenderId}/bidders/${bidderId}/confirm-submission`);
    return data;
  },

  getEvidence: async (tenderId: string, bidderId: string): Promise<BidderEvidence[]> => {
    const { data } = await apiClient.get<BidderEvidence[]>(`/api/tenders/${tenderId}/bidders/${bidderId}/evidence`);
    return data;
  },

  deleteDocument: async (tenderId: string, bidderId: string, docId: string): Promise<void> => {
    await apiClient.delete(`/api/tenders/${tenderId}/bidders/${bidderId}/documents/${docId}`);
  },
};
