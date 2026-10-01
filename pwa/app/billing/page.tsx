import type { Metadata } from "next";
import { BillingAccountPage } from "@/components/billing-account-page";

export const metadata: Metadata = {
  title: "契約・利用権 | AI Action Studio",
  description: "AI Action Studioの契約と利用権を確認します。",
  robots: { index: false, follow: false },
};

export default function BillingPage() {
  return <div data-clarity-mask="true"><BillingAccountPage /></div>;
}
