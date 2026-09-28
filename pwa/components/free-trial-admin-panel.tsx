"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPresetNumberField, AdminSelectWithCustom, AdminSimpleSelect } from "@/components/admin-form-controls";

import {
  getAdminFreeTrialSettings,
  getAdminUserFreeTrial,
  resetAdminUserFreeTrialUsage,
  startAdminUserFreeTrial,
  updateAdminUserFreeTrial,
  type AdminUserFreeTrial,
  type FreeTrialSettings,
} from "@/lib/free-trial";
import {
  getAdminPermanentDailyFreeEnabled,
  updateAdminFreeTierSettings,
} from "@/lib/free-tier-mode";
import type { PwaAdminUser } from "@/lib/pwa-admin-users";
import { getSupabaseClient } from "@/lib/supabase";

function localInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

const RESET_TIMEZONE_OPTIONS = [
  { value: "Asia/Tokyo", label: "日本時間（Asia/Tokyo）", note: "日本向け運用の標準設定です。" },
  { value: "UTC", label: "UTC（世界標準時）" },
  { value: "Asia/Seoul", label: "韓国時間（Asia/Seoul）" },
  { value: "Asia/Singapore", label: "シンガポール時間（Asia/Singapore）" },
  { value: "America/Los_Angeles", label: "米国西海岸（America/Los_Angeles）" },
  { value: "America/New_York", label: "米国東海岸（America/New_York）" },
  { value: "Europe/London", label: "英国（Europe/London）" },
] as const;

const RESET_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
}));

function trialStatusLabel(value: string): string {
  if (value === "active") return "利用中";
  if (value === "expired") return "終了";
  if (value === "stopped") return "停止中";
  return "未利用";
}

function UsageCell({ label, used, limit }: { label: string; used: number; limit: number }) {
  return <div><span>{label}</span><strong>{used} / {limit}</strong></div>;
}

export function FreeTrialAdminPanel({ selectedUser }: { selectedUser: PwaAdminUser | null }) {
  const [settings, setSettings] = useState<FreeTrialSettings | null>(null);
  const [permanentDailyFreeEnabled, setPermanentDailyFreeEnabled] = useState(true);
  const [userTrial, setUserTrial] = useState<AdminUserFreeTrial | null>(null);
  const [userEnd, setUserEnd] = useState("");
  const [manualDays, setManualDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadSettings = useCallback(async () => {
    const client = getSupabaseClient();
    const [next, permanent] = await Promise.all([
      getAdminFreeTrialSettings(client),
      getAdminPermanentDailyFreeEnabled(client),
    ]);
    setSettings(next);
    setPermanentDailyFreeEnabled(permanent);
    setManualDays(next.durationDays);
  }, []);

  const loadUser = useCallback(async () => {
    if (!selectedUser || selectedUser.role !== "user") {
      setUserTrial(null);
      setUserEnd("");
      return;
    }
    const next = await getAdminUserFreeTrial(getSupabaseClient(), selectedUser.id);
    setUserTrial(next);
    setUserEnd(localInput(next.endsAt));
  }, [selectedUser]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadSettings().catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "無料プラン設定を取得できませんでした。");
      });
    });
    return () => { active = false; };
  }, [loadSettings]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadUser().catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "ユーザーの無料利用状態を取得できませんでした。");
      });
    });
    return () => { active = false; };
  }, [loadUser]);

  const patch = <K extends keyof FreeTrialSettings>(key: K, value: FreeTrialSettings[K]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setBusy(true); setMessage("");
    try {
      await updateAdminFreeTierSettings(getSupabaseClient(), settings, permanentDailyFreeEnabled);
      await Promise.all([loadSettings(), loadUser()]);
      setMessage("無料プラン設定を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無料プラン設定を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const runUserAction = async (action: () => Promise<void>, success: string, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setMessage("");
    try {
      await action();
      await loadUser();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無料利用設定を更新できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const effectiveUserEnd = () => {
    if (userEnd) return new Date(userEnd).toISOString();
    return new Date(Date.now() + Math.max(1, settings?.durationDays ?? 7) * 86_400_000).toISOString();
  };

  const featureUsage = useMemo(() => userTrial ? [
    ["記事生成", userTrial.articleGenerateUsed, userTrial.articleGenerateLimit],
    ["タイトル候補", userTrial.titleGenerateUsed, userTrial.titleGenerateLimit],
    ["記事リライト", userTrial.articleRewriteUsed, userTrial.articleRewriteLimit],
    ["SNS投稿生成", userTrial.snsGenerateUsed, userTrial.snsGenerateLimit],
    ["画像生成", userTrial.imageGenerateUsed, userTrial.imageGenerateLimit],
    ["AI補助", userTrial.aiAssistUsed, userTrial.aiAssistLimit],
  ] as const : [], [userTrial]);

  return (
    <section id="admin-free-trial" className="admin-panel free-trial-admin admin-dashboard-section">
      <div className="admin-panel-heading">
        <div><p className="eyebrow">FREE PLAN</p><h2>無料プラン・回数制限管理</h2></div>
        <span className={settings?.enabled ? "admin-count-badge" : "admin-count-badge alert"}>{settings?.enabled ? "ON" : "OFF"}</span>
      </div>

      {message && <div className="route-notice">{message}</div>}

      {!settings ? (
        <div className="admin-empty-state"><strong>設定を読み込んでいます…</strong></div>
      ) : (
        <>
          <div className="trial-admin-toggle-grid">
            <label className="choice-card compact"><input type="checkbox" checked={settings.enabled} onChange={(event) => patch("enabled", event.target.checked)} /><span><strong>無料プランを有効にする</strong><small>OFFにすると無料枠だけのユーザーはPWAを利用できなくなります。</small></span></label>
            <label className="choice-card compact"><input type="checkbox" checked={permanentDailyFreeEnabled} onChange={(event) => setPermanentDailyFreeEnabled(event.target.checked)} /><span><strong>期限なしの日次無料枠</strong><small>ONなら無料登録ユーザーは期限切れせず、毎日設定回数まで利用できます。</small></span></label>
            <label className="choice-card compact"><input type="checkbox" checked={settings.autoStartOnActivation} onChange={(event) => patch("autoStartOnActivation", event.target.checked)} /><span><strong>active承認時に自動開始</strong><small>新規ユーザーが承認された時点から無料枠を利用できるようにします。</small></span></label>
            <label className="choice-card compact"><input type="checkbox" checked={settings.newUsersOnly} onChange={(event) => patch("newUsersOnly", event.target.checked)} /><span><strong>初回新規ユーザーのみ</strong><small>対象開始日時より前の既存ユーザーへ自動付与しません。</small></span></label>
            {!permanentDailyFreeEnabled && <label className="choice-card compact"><input type="checkbox" checked={settings.applyDurationChangesToActive} onChange={(event) => patch("applyDurationChangesToActive", event.target.checked)} /><span><strong>期間変更を利用中ユーザーにも適用</strong><small>保存時に進行中トライアルの終了日時を開始日基準で再計算します。</small></span></label>}
          </div>

          <div className="admin-form-grid trial-admin-settings-grid">
            {!permanentDailyFreeEnabled && <AdminPresetNumberField label="無料期間" value={settings.durationDays} presets={[3, 7, 14, 30, 60, 90, 180, 365]} min={1} max={365} suffix="日" onChange={(value) => patch("durationDays", value)} />}
            <AdminPresetNumberField label="1日の総利用回数" value={settings.dailyTotalLimit} presets={[3, 5, 10, 15, 20, 30, 50, 100]} onChange={(value) => patch("dailyTotalLimit", value)} suffix="回" />
            <AdminPresetNumberField label="記事生成 / 日" value={settings.articleGenerateLimit} presets={[0, 1, 2, 3, 5, 10, 20]} onChange={(value) => patch("articleGenerateLimit", value)} suffix="回" />
            <AdminPresetNumberField label="タイトル候補 / 日" value={settings.titleGenerateLimit} presets={[0, 1, 2, 3, 5, 10, 20]} onChange={(value) => patch("titleGenerateLimit", value)} suffix="回" />
            <AdminPresetNumberField label="記事リライト / 日" value={settings.articleRewriteLimit} presets={[0, 1, 2, 3, 5, 10, 20]} onChange={(value) => patch("articleRewriteLimit", value)} suffix="回" />
            <AdminPresetNumberField label="SNS投稿生成 / 日" value={settings.snsGenerateLimit} presets={[0, 1, 2, 3, 5, 10, 20]} onChange={(value) => patch("snsGenerateLimit", value)} suffix="回" />
            <AdminPresetNumberField label="画像生成 / 日" value={settings.imageGenerateLimit} presets={[0, 1, 2, 3, 5, 10, 20]} onChange={(value) => patch("imageGenerateLimit", value)} suffix="回" />
            <AdminPresetNumberField label="AI補助 / 日" value={settings.aiAssistLimit} presets={[0, 1, 2, 3, 5, 10, 20, 50]} onChange={(value) => patch("aiAssistLimit", value)} suffix="回" />
            <AdminSelectWithCustom label="リセットタイムゾーン" value={settings.resetTimezone} onChange={(value) => patch("resetTimezone", value)} options={RESET_TIMEZONE_OPTIONS} description="通常は日本時間を選択してください。" />
            <AdminSimpleSelect label="リセット時刻" value={String(settings.resetHour)} onChange={(value) => patch("resetHour", Number(value))} options={RESET_HOUR_OPTIONS} description="この時刻を境に新しい利用日へ切り替わります。" />
            <label className="route-field full"><span>新規ユーザー判定の対象開始日時</span><input type="datetime-local" value={localInput(settings.eligibleFrom)} onChange={(event) => event.target.value && patch("eligibleFrom", new Date(event.target.value).toISOString())} /></label>
          </div>
          <p className="trial-admin-note">各機能の上限を0にすると無料ユーザーはその機能を利用できません。期限なしモードでは、日次カウントが指定タイムゾーン・時刻で自動的に新しい利用日へ切り替わります。有料PWA利用権を持つユーザーとactive管理者は回数制限を受けません。カウントはブラウザーではなくSupabase側で管理します。</p>
          <button className="primary-action trial-save-button" type="button" disabled={busy} onClick={() => void saveSettings()}>{busy ? "保存中…" : "無料プラン設定を保存"}</button>
        </>
      )}

      <div className="trial-user-admin">
        <div className="admin-subsection-heading"><h3>ユーザー個別無料枠</h3><small>{selectedUser ? selectedUser.aasUserId : "ユーザーを上の一覧から選択"}</small></div>
        {!selectedUser && <div className="admin-empty-state compact"><strong>ユーザーが選択されていません。</strong><span>ユーザー一覧から対象ユーザーを開くと、ここで状態・本日の回数を管理できます。</span></div>}
        {selectedUser?.role === "admin" && <div className="admin-empty-state compact"><strong>管理者は無料枠の制限対象外です。</strong><span>active管理者はPWAを回数制限なしで利用できます。</span></div>}
        {selectedUser?.role === "user" && userTrial && (
          <>
            <div className="trial-user-summary">
              <div><span>状態</span><strong>{trialStatusLabel(userTrial.trialStatus)}</strong></div>
              <div><span>開始</span><strong>{displayDate(userTrial.startedAt)}</strong></div>
              <div><span>終了</span><strong>{permanentDailyFreeEnabled && userTrial.hasTrial ? "期限なし" : displayDate(userTrial.endsAt)}</strong></div>
              <div><span>本日</span><strong>{userTrial.totalUsed} / {userTrial.dailyTotalLimit} 回</strong></div>
            </div>

            {userTrial.hasTrial ? (
              <>
                <div className="trial-usage-grid">
                  {featureUsage.map(([label, used, limit]) => <UsageCell key={label} label={label} used={used} limit={limit} />)}
                </div>
                {!permanentDailyFreeEnabled && <div className="admin-form-grid trial-user-controls"><label className="route-field full"><span>終了日時</span><input type="datetime-local" value={userEnd} onChange={(event) => setUserEnd(event.target.value)} /></label></div>}
                <div className="admin-actions trial-user-actions">
                  <button className="primary-action" disabled={busy || (!permanentDailyFreeEnabled && !userEnd)} type="button" onClick={() => void runUserAction(() => updateAdminUserFreeTrial(getSupabaseClient(), selectedUser.id, "active", effectiveUserEnd()), permanentDailyFreeEnabled ? "無料枠を有効化しました。" : "トライアルを有効化し、終了日時を更新しました。")}>有効化</button>
                  <button className="secondary-action" disabled={busy || (!permanentDailyFreeEnabled && !userEnd)} type="button" onClick={() => void runUserAction(() => updateAdminUserFreeTrial(getSupabaseClient(), selectedUser.id, "stopped", effectiveUserEnd()), "無料枠を停止しました。", "このユーザーの無料枠を停止しますか？")}>停止</button>
                  <button className="secondary-action" disabled={busy} type="button" onClick={() => void runUserAction(() => resetAdminUserFreeTrialUsage(getSupabaseClient(), selectedUser.id), "本日の利用回数を0へリセットしました。", "本日の利用回数を0へリセットしますか？")}>本日の回数をリセット</button>
                </div>
              </>
            ) : (
              <div className="trial-manual-start">
                {!permanentDailyFreeEnabled && <AdminPresetNumberField label="手動開始する日数" value={manualDays} presets={[3, 7, 14, 30, 60, 90, 180, 365]} min={1} max={365} suffix="日" onChange={setManualDays} />}
                <button className="primary-action" disabled={busy || selectedUser.status !== "active"} type="button" onClick={() => void runUserAction(() => startAdminUserFreeTrial(getSupabaseClient(), selectedUser.id, permanentDailyFreeEnabled ? (settings?.durationDays ?? 7) : manualDays), permanentDailyFreeEnabled ? "期限なし日次無料枠を開始しました。" : "無料トライアルを開始しました。")}>{permanentDailyFreeEnabled ? "このユーザーの無料枠を開始" : "このユーザーの初回トライアルを開始"}</button>
                {selectedUser.status !== "active" && <small>手動開始にはactive一般ユーザーが必要です。</small>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}