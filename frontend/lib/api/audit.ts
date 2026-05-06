import apiClient from "./client";
import type { AuditEvent, AuditEventType, ChainVerification } from "@/lib/types";

export const auditApi = {
  list: async (tenderId: string, params?: {
    event_type?: AuditEventType;
    actor_id?: string;
    bidder_id?: string;
    limit?: number;
  }): Promise<AuditEvent[]> => {
    const query = new URLSearchParams();
    if (params?.event_type) query.set("event_type", params.event_type);
    if (params?.actor_id) query.set("actor_id", params.actor_id);
    if (params?.bidder_id) query.set("bidder_id", params.bidder_id);
    if (params?.limit) query.set("limit", String(params.limit));
    const { data } = await apiClient.get<AuditEvent[]>(`/api/tenders/${tenderId}/audit/?${query}`);
    return data;
  },

  listAll: async (params?: {
    event_type?: AuditEventType;
    actor_id?: string;
    tender_id?: string;
    limit?: number;
  }): Promise<AuditEvent[]> => {
    const query = new URLSearchParams();
    if (params?.event_type) query.set("event_type", params.event_type);
    if (params?.actor_id) query.set("actor_id", params.actor_id);
    if (params?.tender_id) query.set("tender_id", params.tender_id);
    if (params?.limit) query.set("limit", String(params.limit));
    const { data } = await apiClient.get<AuditEvent[]>(`/api/audit/?${query}`);
    return data;
  },

  verifyChain: async (tenderId: string): Promise<ChainVerification> => {
    const { data } = await apiClient.get<ChainVerification>(`/api/tenders/${tenderId}/audit/verify-chain`);
    return data;
  },

  verifyChainGlobal: async (): Promise<ChainVerification> => {
    const { data } = await apiClient.get<ChainVerification>(`/api/audit/verify-chain`);
    return data;
  },
};
