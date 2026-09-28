import { NotificationsPage } from "@/components/notifications-page";
import { Phase15MemberGate } from "@/components/phase15-member-gate";

export default function NotificationsRoute() {
  return (
    <Phase15MemberGate>
      <NotificationsPage />
    </Phase15MemberGate>
  );
}
