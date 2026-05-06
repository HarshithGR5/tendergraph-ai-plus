import apiClient from "./client";
import type { BidderMatrixRow, CriterionVerdict, VerdictValue } from "@/lib/types";

export const verdictsApi = {
  list: async (tenderId: string, bidderId?: string): Promise<CriterionVerdict[]> => {
    const params = bidderId ? `?bidder_id=${bidderId}` : "";
    const { data } = await apiClient.get<CriterionVerdict[]>(`/api/tenders/${tenderId}/verdicts${params}`);
    return data;
  },

  getMatrix: async (tenderId: string): Promise<BidderMatrixRow[]> => {
    const { data } = await apiClient.get<BidderMatrixRow[]>(`/api/tenders/${tenderId}/matrix`);
    return data;
  },

  override: async (tenderId: string, bidderId: string, verdictId: string, payload: {
    new_verdict: VerdictValue;
    override_reason: string;
  }): Promise<CriterionVerdict> => {
    const { data } = await apiClient.post<CriterionVerdict>(
      `/api/tenders/${tenderId}/bidders/${bidderId}/verdicts/${verdictId}/override`,
      payload
    );
    return data;
  },
};
