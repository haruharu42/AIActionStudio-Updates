import { ActionPromptLibraryPage } from "@/components/action-prompt-library-page";
import { Phase15MemberGate } from "@/components/phase15-member-gate";

export default function PromptsPage() {
  return (
    <div data-clarity-mask="true">
      <Phase15MemberGate>
        <ActionPromptLibraryPage />
      </Phase15MemberGate>
    </div>
  );
}
