import type { Metadata } from "next";
import { UserInquiriesPage } from "@/components/user-inquiries-page";

export const metadata: Metadata = {
  title: "お問い合わせ | AI Action Studio",
  robots: { index: false, follow: false },
};

export default function InquiriesPage() {
  return <UserInquiriesPage />;
}
