import { Outlet } from "react-router-dom";
import { AdminLayout } from "@factosys/ui";
import { ImpersonationBanner } from "@/modules/app/components/ImpersonationBanner";
import { LegalReacceptModal } from "@/modules/app/components/LegalReacceptModal";
import { AppHeader } from "./layout/AppHeader";
import { AppSidebar } from "./layout/AppSidebar";

/** Both portal roles consume the same TailAdmin layout from the UI package. */
export function AppShell() {
  return (
    <AdminLayout
      sidebar={<AppSidebar />}
      header={<AppHeader />}
      beforeHeader={<ImpersonationBanner />}
      overlay={<LegalReacceptModal />}
      closeSidebarLabel="Cerrar menú lateral"
    >
      <Outlet />
    </AdminLayout>
  );
}
