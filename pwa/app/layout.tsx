import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AccessStateProvider } from "@/components/access-state-provider";
import { AdminHomeTopbar } from "@/components/admin-home-topbar";
import { AppErrorReporter } from "@/components/app-error-reporter";
import { FreeTrialBanner } from "@/components/free-trial-banner";
import { FeatureAccessGate } from "@/components/feature-access-gate";
import { WorkspacePresetProvider } from "@/features/presets/workspace-preset-provider";
import { KnowledgeRuntimeBootstrap } from "@/components/knowledge-runtime-bootstrap";
import { PersistentMobileNav } from "@/components/persistent-mobile-nav";
import { ReleaseAudienceGate } from "@/components/release-audience-gate";
import { ReleaseUpdateManager } from "@/components/release-update-manager";
import { RouteScrollToTop } from "@/components/route-scroll-to-top";
import "./globals.css";
import "./phase9-11.css";
import "./phase12-17.css";
import "./phase18-beginner.css";
import "./phase19-dashboard.css";
import "./phase20-device-e2e.css";
import "./openai-links.css";
import "./phase21-transition-icons.css";
import "./phase22-persistent-nav.css";
import "./phase23-admin-dashboard.css";
import "./phase24-admin-promotion.css";
import "./phase25-user-personalization.css";
import "./phase25-selected-ai.css";
import "./phase26-knowledge.css";
import "./phase27-commerce.css";
import "./phase28-free-trial.css";
import "./phase29-admin-compact-entitlements.css";
import "./phase30-security-operations.css";
import "./phase31-help-nav.css";
import "./phase31-nav-flex.css";
import "./phase32-sales-settings.css";
import "./phase33-reference-ui.css";
import "./phase34-article-presets.css";
import "./phase35-device-layout.css";
import "./phase36-desktop-nav.css";
import "./phase37-release-management.css";
import "./phase38-note-operations.css";
import "./phase39-readability.css";
import "./phase40-account-design.css";
import "./phase41-support-center.css";
import "./phase42-route-transition.css";
import "./phase43-content-workflow.css";
import "./phase44-shared-presets.css";
import "./phase46-account-presets-dev-prompts.css";
import "./phase47-admin-usability.css";
import "./phase48-action-studio.css";
import "./phase49-prompt-library.css";
import "./phase50-admin-action-prompts.css";
import "./phase51-side-hustle-wizard.css";
import "./phase52-infrastructure-usage.css";
import "./phase53-crystal-ui.css";
import "./phase54-feature-control.css";
import "./phase55-notifications.css";

export const metadata: Metadata = {
  title: "AI Action Studio PWA",
  description:
    "AI Action Studio（AAS）— AIで副業を、もっと簡単に。記事・SNS・画像・副業支援を、スマホとPCから手軽に進められるAIアクション支援PWAです。",
  applicationName: "AI Action Studio",
  manifest: "/manifest.webmanifest?v=20260928-axia-v2",
  robots: { index: false, follow: false },
  other: {
    "aas-phase": "17",
    "aas-release-stage": "production-preview",
    "aas-build-sha": process.env.NEXT_PUBLIC_AAS_BUILD_SHA ?? "dev",
  },
  icons: {
    icon: "/aas-axia-icon-192.png?v=20260928-axia-v2",
    shortcut: "/aas-axia-icon-192.png?v=20260928-axia-v2",
    apple: "/aas-axia-icon-180.png?v=20260928-axia-v2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f9ff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="aas-crystal-theme">
        <ReleaseAudienceGate>
          <AccessStateProvider>
            <FeatureAccessGate>
            <WorkspacePresetProvider>
              <AppErrorReporter />
              <Suspense fallback={null}><RouteScrollToTop /></Suspense>
              <KnowledgeRuntimeBootstrap />
              <AdminHomeTopbar />
              <div className="free-trial-global-shell"><FreeTrialBanner /></div>
              <ReleaseUpdateManager />
              {children}
              <PersistentMobileNav />
            </WorkspacePresetProvider>
            </FeatureAccessGate>
          </AccessStateProvider>
        </ReleaseAudienceGate>
      </body>
    </html>
  );
}
