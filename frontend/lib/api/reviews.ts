import apiClient from "./client";
import type { ReviewTask, ReviewTaskStatus, VerdictValue, GlobalReviewTask } from "@/lib/types";

export const reviewsApi = {
  list: async (tenderId: string, status?: ReviewTaskStatus): Promise<ReviewTask[]> => {
    const params = status ? `?status=${status}` : "";
    const { data } = await apiClient.get<ReviewTask[]>(`/api/tenders/${tenderId}/reviews/${params}`);
    return data;
  },

  listAll: async (status?: ReviewTaskStatus): Promise<GlobalReviewTask[]> => {
    const params = status ? `?status=${status}` : "";
    const { data } = await apiClient.get<GlobalReviewTask[]>(`/api/reviews/${params}`);
    return data;
  },

  assign: async (tenderId: string, taskId: string): Promise<ReviewTask> => {
    const { data } = await apiClient.post<ReviewTask>(`/api/tenders/${tenderId}/reviews/${taskId}/assign`);
    return data;
  },

  resolve: async (tenderId: string, taskId: string, payload: {
    resolution_verdict: VerdictValue;
    resolution_notes: string;
  }): Promise<ReviewTask> => {
    const { data } = await apiClient.post<ReviewTask>(`/api/tenders/${tenderId}/reviews/${taskId}/resolve`, payload);
    return data;
  },
};
