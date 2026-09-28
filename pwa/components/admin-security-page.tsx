"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SecurityRepairPrompt } from "@/components/security-repair-prompt";
import { getSupabaseClient } from "@/lib/supabase";

type TotpFactor = {
  id: string;
  friendlyName: string;
  status: string;
  createdAt: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function mapTotpFactors(factors: Array<{ id: string; friendly_name?: string; status: string; created_at: string }>): TotpFactor[] {
  return factors.map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name || "TOTP認証器",
    status: factor.status,
    createdAt: factor.created_at,
  }));
}

export function AdminSecurityPage() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [currentAal, setCurrentAal] = useState<"aal1" | "aal2" | null>(null);
  const [sessionFactorId, setSessionFactorId] = useState("");
  const [sessionCode, setSessionCode] = useState("");

  const loadFactors = useCallback(async () => {
    try {
      const client = getSupabaseClient();
      const [factorsResult, aalResult] = await Promise.all([
        client.auth.mfa.listFactors(),
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (factorsResult.error) throw factorsResult.error;
      if (aalResult.error) throw aalResult.error;
      const nextFactors = mapTotpFactors(factorsResult.data.totp);
      setErrorMessage("");
      setFactors(nextFactors);
      setCurrentAal(aalResult.data.currentLevel === "aal2" ? "aal2" : "aal1");
      setSessionFactorId((current) => {
        const currentIsVerified = nextFactors.some((factor) => factor.id === current && factor.status === "verified");
        return currentIsVerified ? current : nextFactors.find((factor) => factor.status === "verified")?.id ?? "";
      });
    } catch {
      setErrorMessage("MFA認証器または現在の認証レベルを取得できませんでした。");
      setCurrentAal(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadFactors();
    });
    return () => {
      active = false;
    };
  }, [loadFactors]);

  const verifiedFactors = useMemo(() => factors.filter((factor) => factor.status === "verified"), [factors]);

  const beginBackupEnrollment = async () => {
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: verifiedFactors.length === 0
          ? "AAS PWA Admin MFA 1"
          : `AAS PWA Admin Backup ${verifiedFactors.length + 1}`,
      });
      if (error) throw error;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch {
      setErrorMessage("予備MFAの登録を開始できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    if (!enrollment) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const client = getSupabaseClient();
      await client.auth.mfa.unenroll({ factorId: enrollment.factorId });
    } finally {
      setEnrollment(null);
      setCode("");
      setBusy(false);
      void loadFactors();
    }
  };

  const verifyEnrollment = async () => {
    if (!enrollment) return;
    const normalized = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(normalized)) {
      setErrorMessage("認証アプリに表示された6桁コードを入力してください。");
      return;
    }
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const client = getSupabaseClient();
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: enrollment.factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code: normalized,
      });
      if (verifyError) throw verifyError;
      setEnrollment(null);
      setCode("");
      setMessage(
        verifiedFactors.length === 0
          ? "MFA認証器を有効化しました。販売開始前に、紛失対策として予備認証器も追加してください。"
          : "予備MFA認証器を追加しました。主端末とは別の安全な場所で保管してください。",
      );
      await loadFactors();
    } catch {
      setErrorMessage("MFAコードを確認できませんでした。新しいコードで再試行してください。");
    } finally {
      setBusy(false);
    }
  };

  const verifyCurrentSession = async () => {
    if (!sessionFactorId) {
      setErrorMessage("確認済みMFA認証器を選択してください。");
      return;
    }
    const normalized = sessionCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(normalized)) {
      setErrorMessage("認証アプリに表示された6桁コードを入力してください。");
      return;
    }
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const client = getSupabaseClient();
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: sessionFactorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({
        factorId: sessionFactorId,
        challengeId: challenge.id,
        code: normalized,
      });
      if (verifyError) throw verifyError;
      const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || aal.currentLevel !== "aal2") throw aalError ?? new Error("aal2_not_reached");
      setCurrentAal("aal2");
      setSessionCode("");
      setMessage("現在の管理者セッションをMFA認証しました。公開販売の最終承認など、AAL2必須操作を実行できます。");
    } catch {
      setErrorMessage("MFAコードを確認できませんでした。新しい6桁コードで再試行してください。");
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (factorId: string) => {
    if (verifiedFactors.length <= 1) {
      setErrorMessage("最後のMFA認証器は削除できません。先に予備認証器を追加してください。");
      return;
    }
    if (!window.confirm("このMFA認証器を削除しますか？\n削除した認証器では管理者認証できなくなります。")) return;
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await client.auth.refreshSession();
      window.location.reload();
    } catch {
      setErrorMessage("MFA認証器を削除できませんでした。現在のMFA認証状態を確認してください。");
      setBusy(false);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow">ADMIN SECURITY</p>
          <h1>管理者MFA・認証器</h1>
          <p>管理者アカウントのTOTP認証器を確認し、紛失対策として予備認証器を追加できます。</p>
        </div>
        <div className="admin-head-actions">
          <Link className="route-back" href="/admin">← 管理ダッシュボードへ</Link>
        </div>
      </header>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">MFA FACTORS</p>
            <h2>登録済み認証器</h2>
          </div>
          <button className="primary-action" type="button" disabled={busy || loading || enrollment !== null} onClick={() => void beginBackupEnrollment()}>
            {verifiedFactors.length === 0 ? "MFA認証器を追加" : "予備認証器を追加"}
          </button>
        </div>

        <p className="trial-admin-note">Supabaseには復旧コードがないため、主端末とは別の端末・認証アプリにも予備TOTPを登録しておくことを推奨します。</p>
        {loading && <p className="route-notice">認証器を確認しています…</p>}
        {!loading && verifiedFactors.length === 0 && (
          <p className="route-notice error">
            確認済みMFAがありません。本番販売前にTOTP認証器を1個以上登録してください。登録後、紛失対策として予備認証器も追加してください。
          </p>
        )}
        {!loading && verifiedFactors.length === 1 && <p className="route-notice">現在、確認済みMFAは1個です。紛失に備えて予備認証器を追加してください。</p>}
        {!loading && verifiedFactors.length >= 2 && <p className="route-notice">確認済みMFAが{verifiedFactors.length}個あります。予備認証器が利用できます。</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {factors.map((factor) => (
            <article className="choice-card compact" key={factor.id}>
              <span>
                <small>{factor.status === "verified" ? "確認済み" : "未確認"}</small>
                <strong>{factor.friendlyName}</strong>
                <small>登録日時: {factor.createdAt ? new Date(factor.createdAt).toLocaleString("ja-JP") : "不明"}</small>
              </span>
              {factor.status === "verified" && (
                <button
                  type="button"
                  disabled={busy || verifiedFactors.length <= 1}
                  onClick={() => void removeFactor(factor.id)}
                  title={verifiedFactors.length <= 1 ? "最後の認証器は削除できません" : "この認証器を削除"}
                >
                  削除
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      {!loading && verifiedFactors.length > 0 && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">CURRENT SESSION MFA</p>
              <h2>現在の管理者セッションをMFA認証</h2>
              <p>公開販売の最終承認など、AAL2が必要な操作を行う前に現在のセッションを認証します。</p>
            </div>
            <strong className={currentAal === "aal2" ? "ready" : "action"}>
              {currentAal === "aal2" ? "AAL2 認証済み" : "AAL2 未認証"}
            </strong>
          </div>

          {currentAal === "aal2" ? (
            <p className="route-notice">このセッションはMFA認証済みです。公開販売の最終承認を実行できます。</p>
          ) : (
            <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
              {verifiedFactors.length > 1 && (
                <label className="editor-field">
                  <span>使用するMFA認証器</span>
                  <select value={sessionFactorId} onChange={(event) => setSessionFactorId(event.target.value)}>
                    {verifiedFactors.map((factor) => (
                      <option key={factor.id} value={factor.id}>{factor.friendlyName}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="editor-field">
                <span>認証アプリの6桁コード</span>
                <input
                  value={sessionCode}
                  onChange={(event) => setSessionCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              </label>
              <button className="primary-action" type="button" disabled={busy || !sessionFactorId} onClick={() => void verifyCurrentSession()}>
                {busy ? "MFA認証中…" : "このセッションをMFA認証する"}
              </button>
            </div>
          )}
        </section>
      )}

      {enrollment && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{verifiedFactors.length === 0 ? "ADMIN TOTP" : "BACKUP TOTP"}</p>
              <h2>{verifiedFactors.length === 0 ? "MFA認証器を登録" : "予備認証器を登録"}</h2>
            </div>
          </div>
          <p className="trial-admin-note">
            {verifiedFactors.length === 0
              ? "認証アプリでQRコードを読み取り、最初の管理者MFAを登録してください。"
              : "主に使っている端末とは別の認証アプリでQRコードを読み取ってください。"}
          </p>
          <div style={{ display: "grid", gap: 14, maxWidth: 520 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCode} alt="AAS管理者予備MFA登録用QRコード" style={{ width: 220, maxWidth: "100%", background: "white", padding: 8, borderRadius: 10 }} />
            <details>
              <summary>QRコードを読めない場合</summary>
              <code style={{ display: "block", overflowWrap: "anywhere", marginTop: 8 }}>{enrollment.secret}</code>
            </details>
            <label className="editor-field">
              <span>6桁の認証コード</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="primary-action" type="button" disabled={busy} onClick={() => void verifyEnrollment()}>
                {busy ? "確認しています…" : verifiedFactors.length === 0 ? "MFAを有効化" : "予備MFAを有効化"}
              </button>
              <button type="button" disabled={busy} onClick={() => void cancelEnrollment()}>キャンセル</button>
            </div>
          </div>
        </section>
      )}

      {message && <p className="route-notice">{message}</p>}
      {errorMessage && <p className="route-notice error">{errorMessage}</p>}
      {errorMessage && (
        <SecurityRepairPrompt
          context="管理者セキュリティ / MFA認証器 (/admin/security)"
          summary={errorMessage}
          details={[
            { label: "画面", value: "/admin/security" },
            { label: "確認済みMFA数", value: verifiedFactors.length },
            { label: "登録中", value: enrollment ? "yes" : "no" },
          ]}
        />
      )}
    </main>
  );
}