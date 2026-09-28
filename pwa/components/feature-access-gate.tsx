"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import {
  featureByKey,
  featureForPath,
  loadMyAppFeatureControls,
  type AppFeatureControl,
  type AppFeatureState,
} from "@/lib/feature-control";

type FeatureContextValue = {
  loading: boolean;
  isAdmin: boolean;
  state: AppFeatureState | null;
};

const FeatureContext = createContext<FeatureContextValue>({ loading: true, isAdmin: false, state: null });

const EMERGENCY_ADMIN_PATHS = ["/admin/features", "/admin/releases", "/admin/operations"];

function emergencyAdminPath(pathname: string): boolean {
  return EMERGENCY_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

export function useAppFeatureAccess(featureKey: string): {
  loading: boolean;
  allowed: boolean;
  feature: AppFeatureControl | null;
} {
  const context = useContext(FeatureContext);
  if (context.isAdmin) return { loading: false, allowed: true, feature: null };
  const feature = context.state ? featureByKey(context.state.features, featureKey) : null;
  return {
    loading: context.loading,
    allowed: feature ? feature.allowed : true,
    feature,
  };
}

function BlockedFeature({ feature, isTester }: { feature: AppFeatureControl; isTester: boolean }) {
  const maintenance = feature.maintenanceMode;
  const heading = maintenance
    ? "現在メンテナンス中です"
    : feature.rolloutStage === "tester"
      ? "現在テスト公開中です"
      : "現在管理者確認中です";
  const detail = feature.maintenanceMessage || (
    maintenance
      ? "この機能は一時的に一般ユーザーの利用を停止しています。確認と修正が完了後、管理者から再公開します。"
      : feature.rolloutStage === "tester"
        ? "この機能は管理者が指定した一般ユーザーテストアカウントで動作確認中です。確認完了後に全体公開します。"
        : "この機能は管理者アカウントで先行確認中です。"
  );

  return (
    <main className="standalone-page feature-unavailable-page">
      <section className="standalone-card feature-unavailable-card">
        <p className="eyebrow">{maintenance ? "MAINTENANCE" : "FEATURE PREVIEW"}</p>
        <h1>{feature.title}</h1>
        <h2>{heading}</h2>
        <p className="route-notice">{detail}</p>
        {isTester && feature.rolloutStage === "admin" && (
          <p className="feature-tester-note">AAS一般ユーザーテスターとして登録済みです。管理者が「テスターへ反映」に進めると、このアカウントで確認できます。</p>
        )}
        <div className="status-actions">
          <Link className="primary-action" href="/">ホームへ戻る</Link>
          <Link className="route-back" href="/logout">別のアカウントでログイン</Link>
        </div>
      </section>
    </main>
  );
}

export function FeatureAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state: accessState, client } = useSharedAccessState();
  const [featureState, setFeatureState] = useState<AppFeatureState | null>(null);
  const [loading, setLoading] = useState(false);

  const activeAdmin = accessState.kind === "ready"
    && accessState.profile.role === "admin"
    && accessState.profile.status === "active";

  useEffect(() => {
    if (activeAdmin || accessState.kind !== "ready" || !client) {
      queueMicrotask(() => {
        setFeatureState(null);
        setLoading(false);
      });
      return;
    }

    let active = true;
    const refresh = async () => {
      setLoading(true);
      try {
        const next = await loadMyAppFeatureControls(client);
        if (active) setFeatureState(next);
      } catch {
        if (active) setFeatureState(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    queueMicrotask(() => { if (active) void refresh(); });
    const timer = window.setInterval(() => { if (active) void refresh(); }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [accessState.kind, activeAdmin, client]);

  const matched = useMemo(
    () => featureState ? featureForPath(featureState.features, pathname) : null,
    [featureState, pathname],
  );

  const contextValue = useMemo<FeatureContextValue>(() => ({
    loading,
    isAdmin: activeAdmin,
    state: featureState,
  }), [activeAdmin, featureState, loading]);

  if (activeAdmin || emergencyAdminPath(pathname)) {
    return <FeatureContext.Provider value={contextValue}>{children}</FeatureContext.Provider>;
  }

  if (accessState.kind !== "ready" || pathname === "/") {
    return <FeatureContext.Provider value={contextValue}>{children}</FeatureContext.Provider>;
  }

  if (loading && matched === null && featureState === null) return null;

  if (matched && !matched.allowed) {
    return (
      <FeatureContext.Provider value={contextValue}>
        <BlockedFeature feature={matched} isTester={featureState?.isReleaseTester === true} />
      </FeatureContext.Provider>
    );
  }

  return <FeatureContext.Provider value={contextValue}>{children}</FeatureContext.Provider>;
}
