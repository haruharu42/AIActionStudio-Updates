import type { Metadata } from "next";

import { AdminDevelopmentPromptsPage } from "@/components/admin-development-prompts-page";

export const metadata: Metadata = {
  title: "AAS開発依頼プロンプト | AI Action Studio",
  robots: { index: false, follow: false },
};

export default function AdminDevelopmentPromptsRoute() {
  return <AdminDevelopmentPromptsPage />;
}
