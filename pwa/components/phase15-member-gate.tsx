"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AppLoadingScreen } from "@/components/app-loading-screen";

export function Phase15MemberGate({ children }: { children: ReactNode }) {
  const { state } = useSharedAccessState();

  if (state.kind === "ready") return <>{children}</>;
  if (state.kind === "loading") {
    return <AppLoadingScreen message="会員機能の利用権を確認しています…" />;
  }

  const canRegisterInvite =
    state.kind === "pending" || state.kind === "entitlement_denied";

  let message = "この機能を利用できません。";
  if (state.kind === "signed_out") {
    message = "この機能を利用するにはログインしてください。";
  } else if (state.kind === "pending") {
    message = "アカウント承認後にこの機能を利用できます。";
  } else if (state.kind === "entitlement_denied") {
    message = "この機能を利用するにはPWA利用権が必要です。";
  } else if (state.kind === "suspended" || state.kind === "disabled") {
    message = "現在のアカウント状態ではこの機能を利用できません。";
  } else if (state.kind === "unavailable") {
    message = "アカウントとPWA利用権を確認できませんでした。";
  }

  return (
    <main className="standalone-page">
      <section className="standalone-card">
        <p className="eyebrow">AI ACTION STUDIO · MEMBER TOOL</p>
        <h1>利用権を確認</h1>
        <div className="route-notice error">{message}</div>
        {canRegisterInvite && (
          <Link className="route-back" href="/invite">PWA招待コードを登録 →</Link>
        )}
        <br />
        <Link className="route-back" href="/">← ホームへ戻る</Link>
      </section>
    </main>
  );
}
