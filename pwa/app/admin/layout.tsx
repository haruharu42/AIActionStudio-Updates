import type { ReactNode } from "react";

import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div data-clarity-mask="true">
      <AdminRouteGuard>{children}</AdminRouteGuard>
    </div>
  );
}
