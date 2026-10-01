"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { useEffect, useState, type ReactNode } from "react";

import {
  appDeploymentAudience,
  clearEffectiveRelease,
  loadMyAppReleaseState,
  type AppReleaseState,
} from "@/lib/app-release";
import { getSupabaseClient } from "@/lib/supabase";

const ALWAYS_PUBLIC_PREVIEW_PATHS = ["/auth/callback", "/login", "/logout", "/terms", "/privacy", "/ai-terms", "/commercial-transactions", "/support", "/plans"];
const PUBLIC_PWA_URL = process.env.NEXT_PUBLIC_AAS_PUBLIC_URL?.trim() || "https://ai-article-studio-pwa.ai-article-studio.workers.dev/";

function alwaysPublicPreviewPath(pathname: string): boolean {
  return ALWAYS_PUBLIC_PREVIEW_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

type GateState =
  | { kind: "public" }
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "allowed"; state: AppReleaseState }
  | { kind: "denied"; state: AppReleaseState | null }
  | { kind: "error" };

export function ReleaseAudienceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const audience = appDeploymentAudience();
  const [gate, setGate] = useState<GateState>(() => audience === "public" ? { kind: "public" } : { kind: "loading" });
  const [viewerId, setViewerId] = useState("");
  const [acceptedTesterReleaseId, setAcceptedTesterReleaseId] = useState("");

  useEffect(() => {
    if (audience === "public") return;
    let active = true;
    const client = getSupabaseClient();

    let refreshing = false;
    let lastRefreshAt = 0;
    const refresh = async (force = false) => {
      if (refreshing) return;
      const now = Date.now();
      if (!force && now - lastRefreshAt < 30_000) return;
      refreshing = true;
      lastRefreshAt = now;
      try {
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (!active) return;
        if (sessionError || !session) {
          clearEffectiveRelease();
          setViewerId("");
          setAcceptedTesterReleaseId("");
          setGate({ kind: "signed_out" });
          return;
        }
        setViewerId(session.user.id);
        const next = await loadMyAppReleaseState(client, "preview");
        if (!active) return;
        if (!next.signed_in) {
          setGate({ kind: "signed_out" });
          return;
        }
        if (next.active === false || next.preview_allowed === false) {
          setAcceptedTesterReleaseId("");
          setGate({ kind: "denied", state: next });
          return;
        }
        if (next.is_tester_preview && next.effective_release) {
          try {
            const stored = window.localStorage.getItem("aas.tester-preview.accepted." + session.user.id) ?? "";
            setAcceptedTesterReleaseId(stored === next.effective_release.id ? stored : "");
          } catch {
            setAcceptedTesterReleaseId("");
          }
        } else {
          setAcceptedTesterReleaseId("");
        }
        setGate({ kind: "allowed", state: next });
      } catch {
        if (active) setGate({ kind: "error" });
      } finally {
        refreshing = false;
      }
    };

    const refreshWhenVisible = () => {
      if (!active || document.visibilityState === "hidden") return;
      void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 5 * 60_000);

    void refresh(true);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        clearEffectiveRelease();
        setViewerId("");
        setAcceptedTesterReleaseId("");
        setGate({ kind: "signed_out" });
        return;
      }
      window.setTimeout(() => { if (active) void refresh(true); }, 0);
    });
    return () => {
      active = false;
      window.clearInterval(interval);
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [audience]);

  if (audience === "public" || gate.kind === "public" || alwaysPublicPreviewPath(pathname)) return <>{children}</>;

  if (gate.kind === "allowed") {
    const testerRelease = gate.state.is_tester_preview ? gate.state.effective_release : null;
    if (testerRelease && acceptedTesterReleaseId !== testerRelease.id) {
      const applyTesterRelease = () => {
        try {
          if (viewerId) window.localStorage.setItem("aas.tester-preview.accepted." + viewerId, testerRelease.id);
        } catch {
          // Session state still allows the tester to continue when storage is unavailable.
        }
        setAcceptedTesterReleaseId(testerRelease.id);
      };

      return (
        <main className="standalone-page release-tester-consent-page">
          <section className="standalone-card release-update-card release-tester-consent-card">
            <p className="eyebrow">TESTER UPDATE</p>
            <h1>テスト版を適用しますか？</h1>
            <div className="release-version-row">
              <span>現在 v{gate.state.current_release?.version ?? "-"}</span>
              <b>→</b>
              <strong>v{testerRelease.version}</strong>
            </div>
            <h2>{testerRelease.title}</h2>
            {testerRelease.notes && <p className="release-notes">{testerRelease.notes}</p>}
            <p className="release-confirm-note">指定テスター向けの候補版です。適用後、主要導線と通知センターを確認してください。</p>
            <div className="release-confirm-actions">
              <button className="primary-action" type="button" onClick={applyTesterRelease}>テスト版を適用</button>
              <button type="button" onClick={() => { window.location.href = PUBLIC_PWA_URL; }}>あとで確認</button>
            </div>
          </section>
        </main>
      );
    }
    return <>{children}</>;
  }

  if (gate.kind === "signed_out" && pathname === "/") return <>{children}</>;
  if (gate.kind === "loading") return <AppLoadingScreen message="候補版の利用権を確認しています…" />;

  const message = gate.kind === "denied" && gate.state?.is_release_tester
    ? "現在は第1段階の管理者確認中です。管理者が第2段階へ進めると、この一般ユーザーテストアカウントで候補版を確認できます。"
    : gate.kind === "denied"
      ? "この候補版は管理者と、管理者が指定した一般ユーザーテスターだけが利用できます。"
      : "候補版の利用権を確認できませんでした。";

  return (
    <main className="standalone-page">
      <section className="standalone-card">
        <p className="eyebrow">PRE-RELEASE ACCESS</p>
        <h1>アップデート確認専用</h1>
        <p className={gate.kind === "error" ? "route-notice error" : "route-notice"}>{message}</p>
        {gate.kind === "signed_out" ? (
          <Link className="primary-action" href="/">ログイン画面へ</Link>
        ) : (
          <div className="status-actions">
            <Link className="primary-action" href="/logout">ログアウトして別のアカウントでログイン</Link>
            <Link className="route-back" href="/">← ホームへ戻る</Link>
          </div>
        )}
      </section>
    </main>
  );
}
