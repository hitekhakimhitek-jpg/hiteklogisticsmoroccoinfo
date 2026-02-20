import { Settings as SettingsIcon } from "lucide-react";

const SettingsPage = () => (
  <div className="p-6 lg:p-8 max-w-7xl mx-auto">
    <div className="flex items-center gap-3 mb-6">
      <div className="bg-secondary/10 p-2 rounded-lg">
        <SettingsIcon className="w-5 h-5 text-secondary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your FreightPulse preferences</p>
      </div>
    </div>
    <div className="bg-card rounded-lg border border-border card-elevated p-8 text-center">
      <p className="text-muted-foreground">Settings page coming in Phase 8.</p>
    </div>
  </div>
);

export default SettingsPage;
