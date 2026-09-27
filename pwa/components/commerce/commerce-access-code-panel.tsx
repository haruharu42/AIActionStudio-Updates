"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { redeemPwaInvite } from "@/lib/phase9-invite";

export function CommerceAccessCodePanel({ enabled }: { enabled: boolean }) {
  const { state, client, refresh } = useSharedAccessState();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);

  const profile = useMemo(() => {
    if (state.kind === "ready" || state.kind === "entitlement_denied" || state.kind === "pending") return state.profile;
    return null;
  }, [state]);

  if (!enabled || !profile || profile.role !== "user") return null;
  if (state.kind === "ready" && !success) return null;

  const redeem = async () => {
    if (inFlight.current) return;
    if (!enabled) {
      setMessage("現在、利用コードの新規受付は停止しています。");
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      if (!client) throw new Error("アカウント接続を確認できません。");
      const result = await redeemPwaInvite(client, code);
      await refresh();
      setCode("");
      setSuccess(true);
      setMessage(
        result.profileStatus === "active"
          ? "利用コードを適用し、PWA利用権を再確認しました。AI Action Studioを利用できます。"
          : "利用コードを登録しました。管理者のアカウント承認後に利用できます。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "利用コードの登録に失敗しました。");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="commerce-invite" aria-labelledby="commerce-invite-title">
      <div>
        <p className="eyebrow">ACCESS CODE</p>
        <h2 id="commerce-invite-title">利用コードをお持ちの方</h2>
        <p>購入後に案内された利用コードを、このAASアカウントへ登録できます。</p>
        <small>AAS ID: {profile.aas_user_id}</small>
      </div>
      <div className="commerce-invite-form">
        <label>
          <span>利用コード</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            autoComplete="off"
            inputMode="text"
          />
        </label>
        <button type="button" disabled={busy || !code.trim()} onClick={() => void redeem()}>
          {busy ? "確認中…" : "利用コードを登録"}
        </button>
      </div>
      {message && (
        <p className={success ? "commerce-invite-message success" : "commerce-invite-message error"} role="status">
          {message}
          {success && state.kind === "ready" && <> <Link href="/">ホームへ進む</Link></>}
        </p>
      )}
    </section>
  );
}
