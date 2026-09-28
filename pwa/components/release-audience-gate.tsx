"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  appDeploymentAudience,
  clearEffectiveRelease,
  loadMyAppReleaseState,
  type AppReleaseState,
} from "@/lib/app-release";
import { getSupabaseClient } from "@/lib/supabase";

const ALWAYS_PUBLIC_PREVIEW_PATHS = ["/auth/callback", "/logout", "/terms", "/privacy", "/ai-terms", "/commercial-transactions", "/support", "/plans"];

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

  useEffect(() => {
    if (audience === "public") return;
    let active = true;
    const client = getSupabaseClient();

    const refresh = async () => {
      try {
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (!active) return;
        if (sessionError || !session) {
          clearEffectiveRelease();
          setGate({ kind: "signed_out" });
          return;
        }
        const next = await loadMyAppReleaseState(client, "preview");
        if (!active) return;
        if (!next.signed_in) {
          setGate({ kind: "signed_out" });
          return;
        }
        if (next.active === false || next.preview_allowed === false) {
          setGate({ kind: "denied", state: next });
          return;
        }
        setGate({ kind: "allowed", state: next });
      } catch {
        if (active) setGate({ kind: "error" });
      }
    };

    void refresh();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        clearEffectiveRelease();
        setGate({ kind: "signed_out" });
        return;
      }
      window.setTimeout(() => { if (active) void refresh(); }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [audience]);

  if (audience === "public" || gate.kind === "public" || alwaysPublicPreviewPath(pathname) || gate.kind === "allowed") return <>{children}</>;

  if (gate.kind === "signed_out" && pathname === "/") return <>{children}</>;
  if (gate.kind === "loading") return null;

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
