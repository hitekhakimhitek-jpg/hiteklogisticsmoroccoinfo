import { useState } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Menu, X, LayoutDashboard, FileBarChart, CalendarDays, Archive, MessageSquare, Settings, Scale, Landmark, Monitor } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Regulatory Changes", url: "/regulatory", icon: Scale },
  { title: "Finance Regulation", url: "/finance-regulation", icon: Landmark },
  { title: "IT News", url: "/it-news", icon: Monitor },
  { title: "Weekly Report", url: "/weekly", icon: FileBarChart },
  { title: "Monthly Summary", url: "/monthly", icon: CalendarDays },
  { title: "Chat Assistant", url: "/chat", icon: MessageSquare },
  { title: "Archive", url: "/archive", icon: Archive },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
          <Ship className="w-5 h-5 text-secondary-foreground" />
        </div>
        <span className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">
          Hitek Info
        </span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
              <Ship className="w-5 h-5 text-secondary-foreground" />
            </div>
            <span className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">
              Hitek Info
            </span>
          </div>
          <nav className="py-4 space-y-1 px-2">
            {navItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                end
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeClassName="bg-sidebar-accent text-sidebar-primary-foreground"
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
