import type { Metadata } from "next";
import { SupportRequestPage } from "@/components/support-request-page";

export const metadata: Metadata = {
  title: "お問い合わせ・開示請求 | AI Action Studio",
  robots: { index: false, follow: false },
};

export default function SupportPage() {
  return <SupportRequestPage />;
}
