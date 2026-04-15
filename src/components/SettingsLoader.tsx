import { Loader2 } from "lucide-react";

const SettingsLoader = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
    <Loader2 className="w-10 h-10 animate-spin text-secondary" />
    <p className="mt-4 text-sm font-medium text-muted-foreground">
      Applying settings…
    </p>
  </div>
);

export default SettingsLoader;
