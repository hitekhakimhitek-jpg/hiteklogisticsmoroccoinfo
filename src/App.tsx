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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/regulatory" element={<RegulatoryChanges />} />
            <Route path="/finance-regulation" element={<FinanceRegulation />} />
            <Route path="/weekly" element={<WeeklyReport />} />
            <Route path="/monthly" element={<MonthlySummary />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/chat" element={<ChatAssistant />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
