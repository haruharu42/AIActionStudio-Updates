import { Phase15MemberGate } from "@/components/phase15-member-gate";
import { SideHustleRoadmapsPage } from "@/components/side-hustle-roadmaps-page";

export default function SideHustleRoadmapsRoute() {
  return (
    <Phase15MemberGate>
      <SideHustleRoadmapsPage />
    </Phase15MemberGate>
  );
}
