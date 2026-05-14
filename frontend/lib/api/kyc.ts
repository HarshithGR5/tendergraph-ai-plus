import apiClient from "./client";
import type { KYCResult } from "@/lib/types";

export const kycApi = {
  fullCheck: async (payload: {
    company_name: string;
    gstin?: string | null;
    pan?: string | null;
    cin?: string | null;
  }): Promise<KYCResult> => {
    const { data } = await apiClient.post<KYCResult>("/api/kyc/full-check", payload);
    return data;
  },
};
