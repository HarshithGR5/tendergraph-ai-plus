"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, initFromStorage } = useAuthStore();

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    if (!isAuthenticated) {
      const token = localStorage.getItem("tg_token");
      if (!token) router.push("/login");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header />
      {/* On desktop, offset by sidebar width. On mobile, full width under fixed header. */}
      <main className="md:ml-[240px] pt-14 min-h-screen">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
