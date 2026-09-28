"use client";

import { useEffect, useMemo, useState } from "react";

import {
  loadAdminSellerSettings,
  updateAdminSellerSettings,
  type CommerceSellerSettings,
} from "@/lib/seller-settings";
import { getSupabaseClient } from "@/lib/supabase";

const EMPTY: CommerceSellerSettings = {
  sellerType: "individual",
  disclosureMode: "on_request",
  name: "",
  address: "",
  phone: "",
  email: "",
  supportUrl: "",
  ready: false,
};

export function SellerSettingsPanel() {
  const [settings, setSettings] = useState<CommerceSellerSettings>(EMPTY);
  const [saved, setSaved] = useState<CommerceSellerSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void loadAdminSellerSettings(getSupabaseClient()).then(
      (value) => {
        if (!active) return;
        setSettings(value);
        setSaved(value);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setMessage("販売者情報を取得できませんでした。");
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, []);

  const changed = JSON.stringify(settings) !== JSON.stringify(saved);
  const completed = useMemo(
    () => [settings.name, settings.address, settings.phone, settings.email, settings.supportUrl]
      .filter((value) => value.trim()).length,
    [settings],
  );

  const set = <K extends keyof CommerceSellerSettings,>(key: K, value: CommerceSellerSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (busy || !changed) return;
    setBusy(true);
    setMessage("");
    try {
      await updateAdminSellerSettings(getSupabaseClient(), settings);
      const next = await loadAdminSellerSettings(getSupabaseClient());
      setSettings(next);
      setSaved(next);
      setMessage("販売者情報を保存しました。公開ページには開示方式に応じた情報だけを表示します。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "販売者情報を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-panel sales-settings-section seller-settings-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">SELLER & LEGAL</p>
          <h2>販売者情報・公開方法</h2>
          <p>特商法・開示請求・購入前サポートに使う情報です。直接公開するか、請求時開示にするかを選べます。</p>
        </div>
        <strong className={completed === 5 ? "ready" : "action"}>{completed} / 5</strong>
      </div>

      {loading && <p className="route-notice">販売者情報を確認しています…</p>}
      {message && <p className="route-notice">{message}</p>}

      {!loading && (
        <>
          <div className="seller-settings-grid">
            <label className="sales-url-field">
              <span><strong>販売者区分</strong><small>個人または法人・事業者を選択します。</small></span>
              <select value={settings.sellerType} onChange={(event) => set("sellerType", event.target.value === "business" ? "business" : "individual")}>
                <option value="individual">個人</option>
                <option value="business">法人・事業者</option>
              </select>
            </label>

            <label className="sales-url-field">
              <span><strong>氏名・名称の開示方法</strong><small>個人販売では請求時開示を選べます。実際の法令・販売形態に合わせて確認してください。</small></span>
              <select value={settings.disclosureMode} onChange={(event) => set("disclosureMode", event.target.value === "public" ? "public" : "on_request")}>
                <option value="on_request">請求があった場合に開示</option>
                <option value="public">公開ページへ表示</option>
              </select>
            </label>

            <label className="sales-url-field">
              <span><strong>販売者氏名・名称</strong><small>公開方式が請求時開示でも、内部設定には正式情報を保持します。</small></span>
              <input type="text" autoComplete="organization" value={settings.name} onChange={(event) => set("name", event.target.value)} />
            </label>

            <label className="sales-url-field">
              <span><strong>所在地</strong><small>販売者の正式な所在地を入力します。</small></span>
              <input type="text" autoComplete="street-address" value={settings.address} onChange={(event) => set("address", event.target.value)} />
            </label>

            <label className="sales-url-field">
              <span><strong>電話番号</strong><small>販売者への連絡に使用する番号です。</small></span>
              <input type="tel" autoComplete="tel" value={settings.phone} onChange={(event) => set("phone", event.target.value)} />
            </label>

            <label className="sales-url-field">
              <span><strong>メールアドレス</strong><small>問い合わせ・開示請求対応用の連絡先です。</small></span>
              <input type="email" autoComplete="email" value={settings.email} onChange={(event) => set("email", event.target.value)} />
            </label>

            <label className="sales-url-field seller-settings-wide">
              <span><strong>公開サポートURL</strong><small>購入前・ログインできない利用者もアクセスできるHTTPSの問い合わせ窓口です。</small></span>
              <input
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://..."
                value={settings.supportUrl}
                onChange={(event) => set("supportUrl", event.target.value)}
              />
            </label>
          </div>

          <p className={completed === 5 ? "sales-readiness-summary ready" : "sales-readiness-summary action"}>
            {completed === 5
              ? "販売者情報は入力済みです。保存後、特商法表示と公開サポート導線を確認してください。"
              : "販売開始前に、氏名・所在地・電話・メール・公開サポートURLの5項目を入力してください。"}
          </p>

          <div className="sales-save-bar seller-save-bar">
            <button type="button" className="primary-action" disabled={busy || !changed} onClick={() => void save()}>
              {busy ? "保存中…" : changed ? "販売者情報を保存" : "保存済み"}
            </button>
            {changed && (
              <button type="button" className="secondary-action" disabled={busy} onClick={() => setSettings(saved)}>
                変更を元に戻す
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
