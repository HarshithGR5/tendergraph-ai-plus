"use client";
import { create } from "zustand";
import type { User } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  initFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => {
    localStorage.setItem("tg_token", token);
    localStorage.setItem("tg_user", JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem("tg_token");
    localStorage.removeItem("tg_user");
    set({ token: null, user: null, isAuthenticated: false });
  },

  initFromStorage: () => {
    const token = localStorage.getItem("tg_token");
    const userRaw = localStorage.getItem("tg_user");
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User;
        set({ token, user, isAuthenticated: true });
      } catch {
        set({ token: null, user: null, isAuthenticated: false });
      }
    }
  },
}));
