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

export interface BidderDashboardStats {
  registered_tenders: number;
  evaluations_complete: number;
  eligible: number;
  not_eligible: number;
  needs_review: number;
  pending: number;
  total_documents: number;
}

export const dashboardApi = {
  getStats: (): Promise<DashboardStats> =>
    api.get("/api/dashboard/stats").then((r) => r.data),

  getBidderStats: (): Promise<BidderDashboardStats> =>
    api.get("/api/dashboard/bidder-stats").then((r) => r.data),
};
