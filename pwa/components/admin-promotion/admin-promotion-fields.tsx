"use client";

import { AdminSelectWithCustom } from "@/components/admin-form-controls";

import { AI_APP_LINKS, launchAiApp, type AiAppKey } from "@/lib/ai-app-links";
import {
  sanitizeSocialTargetChars,
  socialLengthPresetsFor,
  type AdminSocialLengthPlan,
  type AdminSocialPlatform,
} from "@/lib/admin-promotion";

const SOCIAL_PLATFORM_OPTIONS: readonly { key: AdminSocialPlatform; label: string }[] = [
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "threads", label: "Threads" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube Shorts" },
];

export function TextField({
  label,
  value,
  onChange,
  placeholder = "",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="admin-promo-field">
      <span>{label}</span>
      {multiline
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={5} />
        : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  optionLabels,
  placeholder = "選択してください",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  optionLabels?: Readonly<Record<string, string>>;
  placeholder?: string;
}) {
  return (
    <label className="admin-promo-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{optionLabels?.[option] ?? option}</option>)}
      </select>
    </label>
  );
}

export function SelectWithCustomField({
  label,
  value,
  onChange,
  options,
  placeholder = "選択してください",
  customPlaceholder = "自由入力してください",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  customPlaceholder?: string;
}) {
  return (
    <AdminSelectWithCustom
      className="admin-promo-field"
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      customPlaceholder={customPlaceholder}
    />
  );
}

export function SocialLengthSettings({
  presetIds,
  plan,
  onChange,
}: {
  presetIds: Record<AdminSocialPlatform, string>;
  plan: AdminSocialLengthPlan;
  onChange: (platform: AdminSocialPlatform, presetId: string, targetChars: number) => void;
}) {
  return (
    <section className="admin-promo-length-settings" aria-labelledby="admin-promo-length-title">
      <div className="admin-promo-length-head">
        <div>
          <span>SNS LENGTH</span>
          <h3 id="admin-promo-length-title">SNSごとの文字数設定</h3>
        </div>
        <small>選んだ設定はSNS販促・テスト公開予告・キャンペーンで共通利用します。</small>
      </div>
      <div className="admin-promo-length-grid">
        {SOCIAL_PLATFORM_OPTIONS.map((platform) => {
          const presets = socialLengthPresetsFor(platform.key);
          const presetId = presetIds[platform.key];
          const selected = presets.find((item) => item.id === presetId);
          const custom = presetId === "__custom__";
          return (
            <div className="admin-promo-length-card" key={platform.key}>
              <strong>{platform.label}</strong>
              <select
                value={presetId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  if (nextId === "__custom__") {
                    onChange(platform.key, nextId, plan[platform.key]);
                    return;
                  }
                  const preset = presets.find((item) => item.id === nextId);
                  if (preset) onChange(platform.key, preset.id, preset.targetChars);
                }}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
                <option value="__custom__">その他・自由入力</option>
              </select>
              {custom && (
                <label>
                  <span>目標文字数</span>
                  <input
                    type="number"
                    min={1}
                    max={25000}
                    inputMode="numeric"
                    value={plan[platform.key]}
                    onChange={(event) => onChange(
                      platform.key,
                      "__custom__",
                      sanitizeSocialTargetChars(Number(event.target.value)),
                    )}
                  />
                </label>
              )}
              <small>
                {selected?.note ?? `カスタム: 約${plan[platform.key]}文字。投稿前に各SNSの最新仕様を確認してください。`}
              </small>
            </div>
          );
        })}
      </div>
      <p className="admin-promo-length-footnote">
        Xは標準投稿とPremium長文を分けて選択できます。Threadsは通常投稿500文字と最大10,000文字の添付テキストを分けています。YouTube Shortsはタイトル100文字以内＋概要欄文字数として扱います。
      </p>
    </section>
  );
}

export function PromptOutput({
  prompt,
  onCopy,
  note = "プロンプトをコピーしてAIへ渡すと、確認済み情報だけを基準にテスト報告・公開予告・紹介記事・SNS素材を作成できます。",
}: {
  prompt: string;
  onCopy: () => void;
  note?: string;
}) {
  return (
    <section className="admin-promo-output" aria-label="生成用プロンプト">
      <div className="admin-promo-output-head">
        <div><span>AI PROMPT</span><h3>生成用プロンプト</h3></div>
        <button type="button" onClick={onCopy}>コピー</button>
      </div>
      <pre>{prompt}</pre>
      <div className="admin-promo-ai-actions">
        {(Object.keys(AI_APP_LINKS) as AiAppKey[]).map((key) => (
          <button key={key} type="button" onClick={() => launchAiApp(key)}>{AI_APP_LINKS[key].name}を開く</button>
        ))}
      </div>
      <p>{note}</p>
    </section>
  );
}
