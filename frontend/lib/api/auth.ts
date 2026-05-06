import apiClient from "./client";
import type { AuthToken, User } from "@/lib/types";

export const authApi = {
  login: async (username: string, password: string): Promise<AuthToken> => {
    const form = new URLSearchParams({ username, password });
    const { data } = await apiClient.post<AuthToken>("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  register: async (payload: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: string;
  }): Promise<User> => {
    const { data } = await apiClient.post<User>("/api/auth/register", payload);
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>("/api/auth/me");
    return data;
  },
};
