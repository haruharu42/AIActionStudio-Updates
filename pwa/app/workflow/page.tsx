import type { Metadata } from "next";

import { ContentWorkflowPage } from "@/components/content-workflow-page";

export const metadata: Metadata = {
  title: "AAS運営コックピット | AI Action Studio",
  robots: { index: false, follow: false },
};

export default function WorkflowRoute() {
  return <ContentWorkflowPage />;
}
