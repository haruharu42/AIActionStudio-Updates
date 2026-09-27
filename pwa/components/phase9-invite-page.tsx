"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { redeemPwaInvite } from "@/lib/phase9-invite";

type State =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "ready"; aasId: string; status: string }
  | { kind: "error"; message: string };

export function Phase9InvitePage() {
  const { state: accessState, client, refresh } = useSharedAccessState();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);

  const state = useMemo<State>(() => {
    if (accessState.kind === "loading") return { kind: "loading" };
    if (accessState.kind === "signed_out") return { kind: "signed_out" };
    if (accessState.kind === "unavailable") {
      return { kind: "error", message: "AASへ接続できませんでした。通信状態を確認してください。" };
    }

    const profile = accessState.profile;
    if (profile.role !== "user") {
      return { kind: "error", message: "利用コードは一般ユーザーアカウントで利用してください。" };
    }
    if (profile.status !== "pending" && profile.status !== "active") {
      return { kind: "error", message: "現在のアカウント状態では利用コードを利用できません。" };
    }
    return { kind: "ready", aasId: profile.aas_user_id, status: profile.status };
  }, [accessState]);

  const redeem = async () => {
    if (inFlight.current || !client) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const result = await redeemPwaInvite(client, code);
      await refresh();
      setSuccess(true);
      setMessage(
        result.profileStatus === "active"
          ? "PWA利用権を有効化しました。ホームへ戻ると利用できます。"
          : "PWA利用権を登録しました。管理者のアカウント承認後に利用できます。",
      );
      setCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "利用コードの利用に失敗しました。");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (state.kind === "loading") return null;

  return (
    <main className="standalone-page">
      <section className="standalone-card">
        <p className="eyebrow">PWA ACCESS CODE</p>
        <h1>PWA利用コード</h1>
        <p className="standalone-lead">購入・案内で受け取った利用コードを、このAASアカウントへ登録します。登録後のPWA利用権はPC・スマホ・タブレットで共通です。</p>

        {state.kind === "signed_out" && (
          <div className="route-notice error">先にホームからログインしてください。</div>
        )}
        {state.kind === "error" && <div className="route-notice error">{state.message}</div>}
        {state.kind === "ready" && (
          <>
            <dl className="route-meta">
              <div><dt>AAS ID</dt><dd>{state.aasId}</dd></div>
              <div><dt>アカウント状態</dt><dd>{state.status}</dd></div>
            </dl>
            <label className="route-field">
              <span>利用コード</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="done"
              />
            </label>
            {message && <div className={success ? "route-notice" : "route-notice error"}>{message}</div>}
            <button className="primary-action" type="button" disabled={busy || !code.trim()} onClick={() => void redeem()}>
              {busy ? "確認中…" : "利用コードを登録"}
            </button>
          </>
        )}
        <Link className="route-back" href="/">← ホームへ戻る</Link>
      </section>
    </main>
  );
}
