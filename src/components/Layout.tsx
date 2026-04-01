import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Layout() {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen w-full">
      {isMobile ? (
        <>
          <MobileHeader />
          <main className="flex-1 overflow-auto pt-14">
            <Outlet />
          </main>
        </>
      ) : (
        <>
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </>
      )}
    </div>
  );
}
