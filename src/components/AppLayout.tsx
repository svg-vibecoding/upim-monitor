import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { toast } from "sonner";
import { useCallback } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const handleInactivityLogout = useCallback(() => {
    toast.info("Tu sesión se cerró por inactividad");
    logout();
  }, [logout]);

  useInactivityTimeout(isAuthenticated, handleInactivityLogout);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Block PIM Managers from admin
  if (user?.role !== "usuario_pro" && (location.pathname.startsWith("/admin") || location.pathname.startsWith("/insights"))) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{user?.name}</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {user?.role === "usuario_pro" ? "UsuarioPRO" : "PIM Manager"}
              </span>
              <button onClick={logout} className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Cerrar sesión
              </button>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
