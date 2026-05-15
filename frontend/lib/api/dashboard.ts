import api from "./client";

export interface DashboardStats {
  total_tenders: number;
  total_bidders: number;
  eligible: number;
  not_eligible: number;
  needs_review: number;
  pending: number;
  open_review_tasks: number;
  evaluation_complete_tenders: number;
}

export const dashboardApi = {
  getStats: (): Promise<DashboardStats> =>
    api.get("/dashboard/stats").then((r) => r.data),
};
