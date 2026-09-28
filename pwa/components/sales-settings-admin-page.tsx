"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { SalesReadinessPanel } from "@/components/admin-sales/sales-readiness-panel";
import { SalesReleasePreflightPanel } from "@/components/admin-sales/sales-release-preflight-panel";
import { SalesSelectSetting } from "@/components/admin-sales/sales-select-setting";
import { SellerSettingsPanel } from "@/components/admin-sales/seller-settings-panel";

import {
  loadAdminSalesSettings,
  updateAdminSalesSettings,
  type SalesSettings,
} from "@/lib/sales-settings";
import { getSupabaseClient } from "@/lib/supabase";
import {
  SALES_PRESETS,
  applySalesPresetToSettings,
  inferSalesPreset,
  type SalesPresetKey,
} from "@/lib/sales-presets";

type Gate =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "denied" }
  | { kind: "ready"; aasId: string }
  | { kind: "error"; message: string };

const EMPTY: SalesSettings = {
  externalSalesEnabled: true,
  accessCodeEnabled: true,
  externalSalesUrl: "",
  stripeCheckoutEnabled: false,
  pwa7DayEnabled: false,
  pwaMonthlyEnabled: false,
};

export function SalesSettingsAdminPage() {
  const { state: accessState, client } = useSharedAccessState();
  const [initError, setInitError] = useState("");
  const [settings, setSettings] = useState<SalesSettings>(EMPTY);
  const [saved, setSaved] = useState<SalesSettings>(EMPTY);
  const [salesPreset, setSalesPreset] = useState<SalesPresetKey>("custom");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const gate = useMemo<Gate>(() => {
    if (accessState.kind === "ready") {
      if (accessState.profile.role !== "admin" || accessState.profile.status !== "active") return { kind: "denied" };
      if (initError) return { kind: "error", message: initError };
      return { kind: "ready", aasId: accessState.profile.aas_user_id };
    }
    if (accessState.kind === "loading") return { kind: "loading" };
    if (accessState.kind === "signed_out") return { kind: "signed_out" };
    if (accessState.kind === "unavailable") {
      return { kind: "error", message: "AASへ接続できませんでした。通信状態を確認してください。" };
    }
    return { kind: "denied" };
  }, [accessState, initError]);

  useEffect(() => {
    if (
      accessState.kind !== "ready" ||
      accessState.profile.role !== "admin" ||
      accessState.profile.status !== "active" ||
      !client
    ) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setInitError("");
    });
    const boot = async () => {
      try {
        const next = await loadAdminSalesSettings(client);
        if (!active) return;
        setSettings(next);
        setSaved(next);
        setSalesPreset(inferSalesPreset(next));
      } catch (error) {
        if (active) setInitError(error instanceof Error ? error.message : "販売設定を初期化できませんでした。");
      }
    };
    void boot();
    return () => { active = false; };
  }, [accessState, client]);

  const changed = JSON.stringify(settings) !== JSON.stringify(saved);
  const set = <K extends keyof SalesSettings,>(key: K, value: SalesSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const applySalesPreset = (preset: SalesPresetKey) => {
    setSalesPreset(preset);
    if (preset === "custom") return;
    const next = applySalesPresetToSettings(settings, preset);
    setSettings(next);
    setMessage("販売モードプリセットを反映しました。保存するまで本番設定は変わりません。");
  };

  const save = async () => {
    if (busy || !changed) return;
    setBusy(true); setMessage("");
    try {
      await updateAdminSalesSettings(getSupabaseClient(), settings);
      const next = await loadAdminSalesSettings(getSupabaseClient());
      setSettings(next); setSaved(next); setSalesPreset(inferSalesPreset(next));
      setMessage("販売・決済設定を保存しました。既存の契約・利用権は変更していません。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "販売・決済設定を保存できませんでした。");
    } finally { setBusy(false); }
  };

  if (gate.kind === "loading") return null;

  if (gate.kind !== "ready") return (
    <main className="standalone-page"><section className="standalone-card">
      <p className="eyebrow">SALES & BILLING</p><h1>販売・決済設定</h1>
      {gate.kind === "signed_out" && <p className="route-notice error">先にログインしてください。</p>}
      {gate.kind === "denied" && <p className="route-notice error">active管理者のみ利用できます。</p>}
      {gate.kind === "error" && <p className="route-notice error">{gate.message}</p>}
      <Link className="route-back" href="/admin">← 管理ダッシュボード</Link>
    </section></main>
  );

  return (
    <main className="admin-page sales-settings-page">
      <header className="admin-head admin-dashboard-head">
        <div><p className="eyebrow">SALES & PROMOTION</p><h1>販売センター</h1><p>{gate.aasId} / AI Action Studio（AAS）のPWA新規販売受付を、プルダウン中心で管理します。</p></div>
        <div className="admin-head-actions"><Link className="route-back" href="/admin/promotion">プロモーション作成</Link><Link className="route-back" href="/admin">← 管理ダッシュボード</Link></div>
      </header>

      <div className="route-notice">OFFにしても、既存の契約・利用期間・利用権は停止・取消しされません。新規受付だけを止めます。</div>
      {message && <div className="route-notice">{message}</div>}

      <section className="admin-panel sales-quick-settings">
        <div className="admin-panel-heading"><div><p className="eyebrow">QUICK SALES MODE</p><h2>販売モードを選ぶ</h2><p>まず運用方法を1つ選ぶだけで、下の受付設定をまとめて切り替えられます。</p></div></div>
        <label className="sales-preset-field">
          <span>販売モードプリセット</span>
          <select value={salesPreset} onChange={(event) => applySalesPreset(event.target.value as SalesPresetKey)}>
            {SALES_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label} — {preset.note}</option>)}
          </select>
          <small>プリセット選択だけでは保存されません。内容を確認してから最下部の「変更を保存」を押してください。</small>
        </label>
      </section>

      <section className="admin-panel sales-settings-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">EXTERNAL SALES</p><h2>外部販売・利用コード</h2></div></div>
        <SalesSelectSetting checked={settings.externalSalesEnabled} onChange={(value) => set("externalSalesEnabled", value)} title="note / Brain / Tips等の外部販売" description="外部サービスで販売する運用を受付中として表示します。" />
        <SalesSelectSetting checked={settings.accessCodeEnabled} onChange={(value) => set("accessCodeEnabled", value)} title="利用コード受付" description="購入者へ渡した利用コード（既存の招待コード基盤）の新規登録を許可します。" />
        <label className="sales-url-field">
          <span><strong>購入ページURL（note等）</strong><small>無料利用回数を使い切ったユーザーへ表示する購入先です。空欄なら購入ボタンは表示しません。HTTPSのみ設定できます。</small></span>
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://note.com/..."
            value={settings.externalSalesUrl}
            onChange={(event) => set("externalSalesUrl", event.target.value)}
          />
          {settings.externalSalesUrl.trim().startsWith("https://") && (
            <a href={settings.externalSalesUrl.trim()} target="_blank" rel="noopener noreferrer">設定中の購入ページを確認 ↗</a>
          )}
        </label>
      </section>

      <SellerSettingsPanel />

      <section className="admin-panel sales-settings-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">STRIPE</p><h2>PWA Stripe新規決済</h2></div></div>
        <SalesSelectSetting checked={settings.stripeCheckoutEnabled} onChange={(value) => set("stripeCheckoutEnabled", value)} title="Stripe新規購入受付" description="PWA向けStripeプラン共通のマスタースイッチです。OFFならCheckoutをサーバー側でも拒否します。" />
        <div className="sales-plan-grid">
          <SalesSelectSetting checked={settings.pwa7DayEnabled} onChange={(value) => set("pwa7DayEnabled", value)} title="PWA 7日利用パス" description="自動更新なしの7日券を表示・受付します。" />
          <SalesSelectSetting checked={settings.pwaMonthlyEnabled} onChange={(value) => set("pwaMonthlyEnabled", value)} title="PWA 月額プラン" description="PWA版の月額新規契約を表示・受付します。" />
        </div>
        {!settings.stripeCheckoutEnabled && <p className="sales-master-off">StripeマスタースイッチがOFFのため、個別プランをONにしても現在は購入できません。後日の販売準備として設定を保存できます。</p>}
      </section>

      <SalesReadinessPanel settings={settings} hasUnsavedChanges={changed} />
      <SalesReleasePreflightPanel settings={settings} hasUnsavedChanges={changed} />

      <section className="admin-panel sales-current-mode">
        <h2>現在の販売モード</h2>
        <p><strong>外部販売:</strong> {settings.externalSalesEnabled ? "ON" : "OFF"} / <strong>利用コード:</strong> {settings.accessCodeEnabled ? "ON" : "OFF"} / <strong>Stripe:</strong> {settings.stripeCheckoutEnabled ? "ON" : "OFF"}</p>
        <p><strong>購入ページ:</strong> {settings.externalSalesUrl.trim() ? "設定済み" : "未設定"}</p>
        <p>初期運用は「外部販売 ON・利用コード ON・Stripe OFF」です。無料枠終了時は、外部販売ONかつ購入ページURL設定済みの場合だけ購入案内を表示します。</p>
      </section>

      <div className="sales-save-bar">
        <button type="button" className="primary-action" disabled={busy || !changed} onClick={() => void save()}>{busy ? "保存中…" : changed ? "変更を保存" : "保存済み"}</button>
        {changed && <button type="button" className="secondary-action" disabled={busy} onClick={() => { setSettings(saved); setSalesPreset(inferSalesPreset(saved)); }}>変更を元に戻す</button>}
      </div>
    </main>
  );
}
