import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import WeeklyReport from "./pages/WeeklyReport";
import MonthlySummary from "./pages/MonthlySummary";
import ArchivePage from "./pages/ArchivePage";
import RegulatoryChanges from "./pages/RegulatoryChanges";
import FinanceRegulation from "./pages/FinanceRegulation";
import ITNews from "./pages/ITNews";
import ChatAssistant from "./pages/ChatAssistant";
import SettingsPage from "./pages/SettingsPage";
import WeeklyDigest from "./pages/WeeklyDigest";
import DisruptionMap from "./pages/DisruptionMap";
import AuthPage from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { Navigate } from "react-router-dom";
import { RegionProvider } from "@/contexts/RegionContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function AdminOnly({ children }: { children: JSX.Element }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin ? children : <Navigate to="/auth" replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <AuthProvider>
    <RegionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/regulatory" element={<RegulatoryChanges />} />
              <Route path="/finance-regulation" element={<FinanceRegulation />} />
              <Route path="/it-news" element={<ITNews />} />
              <Route path="/weekly" element={<WeeklyReport />} />
              <Route path="/monthly" element={<MonthlySummary />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/chat" element={<ChatAssistant />} />
              <Route path="/digest" element={<WeeklyDigest />} />
              <Route path="/map" element={<DisruptionMap />} />
              <Route path="/settings" element={<AdminOnly><SettingsPage /></AdminOnly>} />
            </Route>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </RegionProvider>
    </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
