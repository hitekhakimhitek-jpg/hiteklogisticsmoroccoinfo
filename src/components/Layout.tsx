import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
