import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ReportsListPage from "@/pages/ReportsListPage";
import ReportDetailPage from "@/pages/ReportDetailPage";
import NewReportPage from "@/pages/NewReportPage";
import AdminPage from "@/pages/AdminPage";
import CreatePredefinedReportPage from "@/pages/CreatePredefinedReportPage";
import InsightsPage from "@/pages/InsightsPage";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      {!isAuthenticated ? (
        <Route path="*" element={<Navigate to="/login" replace />} />
      ) : (
        <>
          <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
          <Route path="/informes" element={<AppLayout><ReportsListPage /></AppLayout>} />
          <Route path="/informes/:reportId" element={<AppLayout><ReportDetailPage /></AppLayout>} />
          <Route path="/nuevo-informe" element={<AppLayout><NewReportPage /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><AdminPage /></AppLayout>} />
          <Route path="/admin/nuevo-informe" element={<AppLayout><CreatePredefinedReportPage /></AppLayout>} />
          <Route path="/admin/editar-informe/:reportId" element={<AppLayout><CreatePredefinedReportPage /></AppLayout>} />
          <Route path="/insights" element={<AppLayout><InsightsPage /></AppLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
