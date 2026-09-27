"use client";

import { useMemo, useState } from "react";

import {
  PromptOutput,
  SelectField,
  SelectWithCustomField,
} from "@/components/admin-promotion/admin-promotion-fields";
import { AdminPromotionScreenshotAnalyzer } from "@/components/admin-promotion/admin-promotion-screenshot-analyzer";
import {
  AUDIENCE_OPTIONS,
  CTA_OPTIONS,
  PROMOTION_PHASE_OPTIONS,
  PURPOSE_OPTIONS,
} from "@/components/admin-promotion/admin-promotion-options";
import {
  defaultSocialLengthPreset,
  sanitizeSocialTargetChars,
  socialLengthPresetsFor,
  type AdminProductFacts,
  type AdminSocialPlatform,
} from "@/lib/admin-promotion";
import {
  ADMIN_PROMOTION_CHANNELS,
  buildAdminChannelPromotionPrompt,
  type AdminPromotionChannel,
} from "@/lib/admin-promotion-channel";
import type { PromotionScreenshotAnalysis } from "@/lib/promotion-screenshot-analysis";

const CHANNEL_ORDER: AdminPromotionChannel[] = [
  "note",
  "brain",
  "tips",
  "x",
  "threads",
  "instagram",
];

export function AdminPromotionChannelBuilder({
  facts,
  featureOptions,
  onCopy,
}: {
  facts: AdminProductFacts;
  featureOptions: readonly string[];
  onCopy(prompt: string): void;
}) {
  const [channel, setChannel] = useState<AdminPromotionChannel>("note");
  const [phase, setPhase] = useState("実運用テスト中（販売前）");
  const [purpose, setPurpose] = useState(ADMIN_PROMOTION_CHANNELS.note.defaultPurpose);
  const [audience, setAudience] = useState(facts.targetAudience || "副業初心者");
  const [focus, setFocus] = useState("製品全体");
  const [cta, setCta] = useState(ADMIN_PROMOTION_CHANNELS.note.defaultCta);
  const [variants, setVariants] = useState(3);
  const initialLength = defaultSocialLengthPreset("x");
  const [lengthPresetId, setLengthPresetId] = useState(initialLength.id);
  const [targetChars, setTargetChars] = useState(initialLength.targetChars);
  const [screenshotAnalysis, setScreenshotAnalysis] = useState<PromotionScreenshotAnalysis | null>(null);

  const meta = ADMIN_PROMOTION_CHANNELS[channel];
  const socialPlatform = meta.socialPlatform;

  const prompt = useMemo(
    () => buildAdminChannelPromotionPrompt(facts, {
      channel,
      phase,
      purpose,
      audience,
      focus,
      cta,
      variants,
      targetChars,
      screenshotAnalysis,
    }),
    [facts, channel, phase, purpose, audience, focus, cta, variants, targetChars, screenshotAnalysis],
  );

  const selectChannel = (next: AdminPromotionChannel) => {
    const nextMeta = ADMIN_PROMOTION_CHANNELS[next];
    setChannel(next);
    setPurpose(nextMeta.defaultPurpose);
    setCta(nextMeta.defaultCta);
    setScreenshotAnalysis(null);

    if (nextMeta.socialPlatform) {
      const preset = defaultSocialLengthPreset(nextMeta.socialPlatform);
      setLengthPresetId(preset.id);
      setTargetChars(preset.targetChars);
    }
  };

  const renderLengthSetting = (platform: AdminSocialPlatform) => {
    const presets = socialLengthPresetsFor(platform);
    const selected = presets.find((item) => item.id === lengthPresetId);
    const custom = lengthPresetId === "__custom__";

    return (
      <div className="admin-promo-channel-length">
        <label className="admin-promo-field">
          <span>投稿の長さ</span>
          <select
            value={lengthPresetId}
            onChange={(event) => {
              const nextId = event.target.value;
              setLengthPresetId(nextId);
              if (nextId === "__custom__") return;
              const preset = presets.find((item) => item.id === nextId);
              if (preset) setTargetChars(preset.targetChars);
            }}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
            <option value="__custom__">その他・自由入力</option>
          </select>
        </label>
        {custom && (
          <label className="admin-promo-field">
            <span>目標文字数</span>
            <input
              type="number"
              min={1}
              max={25000}
              inputMode="numeric"
              value={targetChars}
              onChange={(event) => setTargetChars(sanitizeSocialTargetChars(Number(event.target.value)))}
            />
          </label>
        )}
        <small>{selected?.note ?? `カスタム: 約${targetChars}文字`}</small>
      </div>
    );
  };

  return (
    <section className="admin-promo-channel-builder" aria-label="媒体から選ぶかんたんプロモーション">
      <div className="admin-promo-channel-head">
        <div>
          <p className="eyebrow">CHANNEL FIRST</p>
          <h2>まず、投稿する場所を選ぶ</h2>
          <p>note・Brain・Tips・X・Threads・Instagramから1つ選ぶだけで、その媒体専用の設定とプロンプトへ切り替わります。</p>
        </div>
        <strong>媒体ごとに専用設計</strong>
      </div>

      <label className="admin-promo-channel-select">
        <span>① どこでプロモーションしますか？</span>
        <select value={channel} onChange={(event) => selectChannel(event.target.value as AdminPromotionChannel)}>
          {CHANNEL_ORDER.map((key) => {
            const item = ADMIN_PROMOTION_CHANNELS[key];
            return <option key={key} value={key}>{item.label} — {item.summary}</option>;
          })}
        </select>
      </label>

      <div className="admin-promo-channel-overview">
        <div>
          <span>選択中</span>
          <strong>{meta.label}</strong>
          <p>{meta.summary}</p>
        </div>
        <div>
          <span>おすすめ構成</span>
          <p>{meta.recommendedFormat}</p>
        </div>
        <div>
          <span>スクショ目安</span>
          <p>{meta.screenshotSummary}</p>
        </div>
      </div>

      <div className="admin-promo-channel-form">
        <div className="admin-promo-channel-step">
          <div><span>②</span><strong>内容を選ぶ</strong></div>
          <p>迷った場合は初期設定のままでも作れます。</p>
        </div>
        <div className="admin-promo-form-grid compact">
          <SelectWithCustomField
            label="発信フェーズ"
            value={phase}
            onChange={setPhase}
            options={PROMOTION_PHASE_OPTIONS}
            customPlaceholder="現在の発信フェーズを入力"
          />
          <SelectWithCustomField
            label="目的"
            value={purpose}
            onChange={setPurpose}
            options={PURPOSE_OPTIONS}
            customPlaceholder="今回の目的を入力"
          />
          <SelectWithCustomField
            label="想定読者"
            value={audience}
            onChange={setAudience}
            options={AUDIENCE_OPTIONS}
            customPlaceholder="想定読者を入力"
          />
          <SelectWithCustomField
            label="特に紹介したい内容"
            value={focus}
            onChange={setFocus}
            options={featureOptions}
            customPlaceholder="紹介したい機能・内容を入力"
          />
          <SelectWithCustomField
            label="CTA・誘導先"
            value={cta}
            onChange={setCta}
            options={CTA_OPTIONS}
            customPlaceholder="CTA・誘導先を入力"
          />
          {meta.kind === "social" && (
            <SelectField
              label="作成数"
              value={String(variants)}
              onChange={(value) => setVariants(Number(value) || 1)}
              options={["1", "2", "3", "4", "5"]}
            />
          )}
        </div>
        {socialPlatform && renderLengthSetting(socialPlatform)}
      </div>

      {meta.kind === "social" && socialPlatform && (
        <>
          <div className="admin-promo-channel-step">
            <div><span>③</span><strong>紹介したいスクショを追加（任意）</strong></div>
            <p>アップロードした実画面をAASが読み取り、画像から確認できる事実・訴求ポイント・隠すべき情報をSNS専用プロンプトへ反映します。</p>
          </div>
          <AdminPromotionScreenshotAnalyzer
            key={channel}
            channel={socialPlatform}
            onAnalysisChange={setScreenshotAnalysis}
          />
        </>
      )}

      <div className="admin-promo-channel-step">
        <div><span>{meta.kind === "social" ? "④" : "③"}</span><strong>プロンプトをコピーしてAIへ渡す</strong></div>
        <p>{meta.kind === "social"
          ? "解析済みスクショがある場合は、その画面内容と添付順まで含めた専用プロンプトになります。スクショなしでも従来どおり作成できます。"
          : "スクリーンショットは自分で撮影します。記事系は本文中の最適位置へ挿入マーカーを入れ、必要な画面・撮影範囲・挿入位置を指示します。"}</p>
      </div>

      <PromptOutput
        prompt={prompt}
        onCopy={() => onCopy(prompt)}
        note={`${meta.label}専用プロンプトです。スクリーンショットは自動取得せず、必要な画面・撮影範囲・挿入または添付位置だけを具体的に指示します。`}
      />
    </section>
  );
}
