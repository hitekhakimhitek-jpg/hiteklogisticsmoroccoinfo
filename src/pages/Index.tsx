import { KPICards } from "@/components/dashboard/KPICards";
import { TopStories } from "@/components/dashboard/TopStories";
import { MoroccoFocus, ComplianceWatchlist } from "@/components/dashboard/QuickPanels";
import { Search, Calendar } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Freight intelligence overview · Week of Feb 17, 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search intelligence..."
              className="pl-9 pr-4 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-60"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground hover:bg-muted transition-colors">
            <Calendar className="w-4 h-4" />
            This Week
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards />

      {/* Top Stories */}
      <TopStories />

      {/* Quick Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoroccoFocus />
        <ComplianceWatchlist />
      </div>
    </div>
  );
};

export default Dashboard;
