"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  PromptOutput,
  SelectField,
  SelectWithCustomField,
  SocialWritingStyleSettings,
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
  buildAdminChannelDirectScreenshotPrompt,
  buildAdminChannelPromotionPrompt,
  resolveAdminPromotionCta,
  type AdminPromotionChannel,
} from "@/lib/admin-promotion-channel";
import type { PromotionScreenshotAnalysis, PromotionScreenshotChannel } from "@/lib/promotion-screenshot-analysis";
import { launchAiApp } from "@/lib/ai-app-links";
import { copyNoteRichText } from "@/lib/note-rich-text";
import {
  DEFAULT_ADMIN_SOCIAL_WRITING_STYLE,
  normalizeAdminSocialWritingStyle,
  type AdminSocialWritingStyle,
} from "@/lib/social-writing-style";

const CHANNEL_ORDER: AdminPromotionChannel[] = [
  "note",
  "brain",
  "tips",
  "x",
  "threads",
  "instagram",
];

const PROMOTION_WIZARD_STEPS = [
  "媒体選択",
  "発信フェーズ",
  "目的",
  "想定読者",
  "紹介内容",
  "CTA・出力設定",
  "画像・スクショ",
  "内容確認・生成",
] as const;

const PROMOTION_WIZARD_STORAGE_PREFIX = "aas-admin-promotion-channel-wizard-v1";

type StoredPromotionWizard = {
  channel?: AdminPromotionChannel;
  phase?: string;
  purpose?: string;
  audience?: string;
  focus?: string;
  cta?: string;
  variants?: number;
  lengthPresetId?: string;
  targetChars?: number;
  socialStyle?: Partial<AdminSocialWritingStyle>;
  step?: number;
  generatedContent?: string;
};

function promotionWizardStorageKey(userId: string): string {
  return `${PROMOTION_WIZARD_STORAGE_PREFIX}:${userId}`;
}

function isPromotionChannel(value: unknown): value is AdminPromotionChannel {
  return typeof value === "string" && CHANNEL_ORDER.includes(value as AdminPromotionChannel);
}

function boundedWizardStep(value: unknown): number {
  const step = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(0, Math.min(PROMOTION_WIZARD_STEPS.length - 1, step));
}

export function AdminPromotionChannelBuilder({
  facts,
  featureOptions,
  onCopy,
  userId,
}: {
  facts: AdminProductFacts;
  featureOptions: readonly string[];
  onCopy(prompt: string): void;
  userId: string;
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
  const [socialStyle, setSocialStyle] = useState<AdminSocialWritingStyle>({ ...DEFAULT_ADMIN_SOCIAL_WRITING_STYLE });
  const [screenshotAnalysis, setScreenshotAnalysis] = useState<PromotionScreenshotAnalysis | null>(null);
  const [step, setStep] = useState(0);
  const [generatedContent, setGeneratedContent] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const restoredUserIdRef = useRef("");

  const persistWizardProgress = useCallback(() => {
    if (!userId || restoredUserIdRef.current !== userId) return;
    const payload: StoredPromotionWizard = {
      channel,
      phase,
      purpose,
      audience,
      focus,
      cta,
      variants,
      lengthPresetId,
      targetChars,
      socialStyle,
      step,
      generatedContent,
    };
    try {
      window.localStorage.setItem(promotionWizardStorageKey(userId), JSON.stringify(payload));
    } catch {
      // Keep the current in-memory workflow usable when storage is unavailable.
    }
  }, [
    audience,
    channel,
    cta,
    focus,
    generatedContent,
    lengthPresetId,
    phase,
    purpose,
    socialStyle,
    step,
    targetChars,
    userId,
    variants,
  ]);

  useEffect(() => {
    restoredUserIdRef.current = "";
    if (!userId) return;
    let active = true;
    let saved: StoredPromotionWizard | null = null;
    try {
      const raw = window.localStorage.getItem(promotionWizardStorageKey(userId));
      if (raw) saved = JSON.parse(raw) as StoredPromotionWizard;
    } catch {
      saved = null;
    }

    queueMicrotask(() => {
      if (!active) return;
      if (saved) {
        const restoredChannel = isPromotionChannel(saved.channel) ? saved.channel : "note";
        setChannel(restoredChannel);
        if (typeof saved.phase === "string") setPhase(saved.phase);
        if (typeof saved.purpose === "string") setPurpose(saved.purpose);
        if (typeof saved.audience === "string") setAudience(saved.audience);
        if (typeof saved.focus === "string") setFocus(saved.focus);
        if (typeof saved.cta === "string") setCta(saved.cta);
        if (typeof saved.variants === "number") setVariants(Math.max(1, Math.min(5, Math.trunc(saved.variants))));
        if (typeof saved.lengthPresetId === "string") setLengthPresetId(saved.lengthPresetId);
        if (typeof saved.targetChars === "number") setTargetChars(sanitizeSocialTargetChars(saved.targetChars));
        setSocialStyle(normalizeAdminSocialWritingStyle(saved.socialStyle));
        setStep(boundedWizardStep(saved.step));
        if (typeof saved.generatedContent === "string") setGeneratedContent(saved.generatedContent);
        setResultMessage("前回のプロモーション作業を復元しました。");
      }
      restoredUserIdRef.current = userId;
    });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    persistWizardProgress();
  }, [persistWizardProgress]);

  useEffect(() => {
    const persistBeforeLeave = () => persistWizardProgress();
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persistWizardProgress();
    };
    window.addEventListener("pagehide", persistBeforeLeave);
    window.addEventListener("beforeunload", persistBeforeLeave);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("pagehide", persistBeforeLeave);
      window.removeEventListener("beforeunload", persistBeforeLeave);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [persistWizardProgress]);

  const meta = ADMIN_PROMOTION_CHANNELS[channel];
  const socialPlatform = meta.socialPlatform;
  const ctaResolution = useMemo(
    () => resolveAdminPromotionCta(facts, { phase, cta }),
    [cta, facts, phase],
  );

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
      socialStyle,
      screenshotAnalysis,
    }),
    [facts, channel, phase, purpose, audience, focus, cta, variants, targetChars, socialStyle, screenshotAnalysis],
  );

  const directScreenshotPrompt = useMemo(
    () => meta.kind === "social"
      ? buildAdminChannelDirectScreenshotPrompt(facts, {
          channel,
          phase,
          purpose,
          audience,
          focus,
          cta,
          variants,
          targetChars,
          socialStyle,
        })
      : "",
    [facts, channel, meta.kind, phase, purpose, audience, focus, cta, variants, targetChars, socialStyle],
  );

  const selectChannel = (next: AdminPromotionChannel) => {
    const nextMeta = ADMIN_PROMOTION_CHANNELS[next];
    setChannel(next);
    setPurpose(nextMeta.defaultPurpose);
    setCta(nextMeta.defaultCta);
    setScreenshotAnalysis(null);
    setGeneratedContent("");
    setResultMessage("");

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

  const goPrevious = () => setStep((current) => Math.max(0, current - 1));
  const goNext = () => setStep((current) => Math.min(PROMOTION_WIZARD_STEPS.length - 1, current + 1));

  const pasteGeneratedContent = async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error("clipboard-read-unavailable");
      const pasted = await navigator.clipboard.readText();
      if (!pasted.trim()) {
        setResultMessage("クリップボードに貼り付けられる文章がありません。");
        return;
      }
      setGeneratedContent(pasted);
      setResultMessage("AIの完成文を貼り付けました。内容を確認してからコピーしてください。");
    } catch {
      setResultMessage("自動貼付できませんでした。下の欄へAIの完成文を手動で貼り付けてください。");
    }
  };

  const copyGeneratedPlain = async () => {
    if (!generatedContent.trim()) {
      setResultMessage("コピーする完成文がありません。");
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedContent);
      setResultMessage(meta.kind === "social" ? "SNS投稿用の完成文をコピーしました。" : "完成文をMarkdown形式でコピーしました。");
    } catch {
      setResultMessage("自動コピーできませんでした。完成文欄から手動でコピーしてください。");
    }
  };

  const copyGeneratedRich = async () => {
    if (!generatedContent.trim()) {
      setResultMessage("コピーする完成文がありません。");
      return;
    }
    try {
      await copyNoteRichText(generatedContent);
      setResultMessage(channel === "note"
        ? "note用の装飾付き本文をコピーしました。note本文欄へ貼り付けてください。"
        : meta.label + "用の装飾付き本文をコピーしました。貼り付け先が対応する装飾だけ反映されます。");
    } catch (error) {
      setResultMessage(error instanceof Error ? error.message : "装飾付きコピーに失敗しました。");
    }
  };

  return (
    <section className="admin-promo-channel-builder" aria-label="媒体から選ぶ8ステッププロモーション">
      <div className="admin-promo-channel-head">
        <div>
          <p className="eyebrow">CHANNEL FIRST · 8 STEP</p>
          <h2>8ステップでプロモーション素材を作る</h2>
          <p>
            記事作成と同じように、媒体 → 発信フェーズ → 目的 → 読者 → 紹介内容 → CTA → 画像 → 完成素材の順で進めます。
            迷った場合は初期設定のままでも作れます。
          </p>
        </div>
        <strong>媒体ごとに専用設計</strong>
      </div>

      <nav className="admin-promo-wizard-progress" aria-label="プロモーション作成ステップ">
        {PROMOTION_WIZARD_STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === step ? "active" : index < step ? "done" : ""}
            aria-current={index === step ? "step" : undefined}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>

      <div className="admin-promo-wizard-pane" aria-live="polite">
        {step === 0 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>1</span><strong>媒体を選ぶ</strong></div>
              <p>記事系とSNS系を同じ8ステップで進め、媒体専用の構成へ自動で切り替えます。</p>
            </div>
            <label className="admin-promo-channel-select">
              <span>どこでプロモーションしますか？</span>
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
          </>
        )}

        {step === 1 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>2</span><strong>発信フェーズを選ぶ</strong></div>
              <p>販売前・テスト中・販売開始後など、現在の状態に合わせて誤認を防ぎます。</p>
            </div>
            <SelectWithCustomField
              label="発信フェーズ"
              value={phase}
              onChange={setPhase}
              options={PROMOTION_PHASE_OPTIONS}
              customPlaceholder="現在の発信フェーズを入力"
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>3</span><strong>今回の目的を選ぶ</strong></div>
              <p>認知・解説・販売・進捗共有など、1つの主目的を決めて文章の軸を固定します。</p>
            </div>
            <SelectWithCustomField
              label="目的"
              value={purpose}
              onChange={setPurpose}
              options={PURPOSE_OPTIONS}
              customPlaceholder="今回の目的を入力"
            />
          </>
        )}

        {step === 3 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>4</span><strong>想定読者を選ぶ</strong></div>
              <p>誰に向けた素材かを決め、説明の粒度と専門用語の使い方を調整します。</p>
            </div>
            <SelectWithCustomField
              label="想定読者"
              value={audience}
              onChange={setAudience}
              options={AUDIENCE_OPTIONS}
              customPlaceholder="想定読者を入力"
            />
          </>
        )}

        {step === 4 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>5</span><strong>紹介する内容を選ぶ</strong></div>
              <p>確認済み製品情報の中から、今回もっとも伝えたい機能・価値へ絞ります。</p>
            </div>
            <SelectWithCustomField
              label="特に紹介したい内容"
              value={focus}
              onChange={setFocus}
              options={featureOptions}
              customPlaceholder="紹介したい機能・内容を入力"
            />
          </>
        )}

        {step === 5 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>6</span><strong>CTA・出力設定</strong></div>
              <p>{meta.kind === "social"
                ? "誘導先に加え、作成数・文字数・SNSの書き方を設定します。"
                : "記事の最後に置く自然な誘導先を設定します。販売前の不適切なCTAは自動補正します。"}</p>
            </div>
            <div className="admin-promo-form-grid compact">
              <div>
                <SelectWithCustomField
                  label="CTA・誘導先"
                  value={cta}
                  onChange={setCta}
                  options={CTA_OPTIONS}
                  customPlaceholder="CTA・誘導先を入力"
                />
                {ctaResolution.corrected && (
                  <small className="admin-promo-cta-safety">{ctaResolution.reason}</small>
                )}
              </div>
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
            {socialPlatform && (
              <SocialWritingStyleSettings value={socialStyle} onChange={setSocialStyle} />
            )}
          </>
        )}

        {step === 6 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>7</span><strong>画像・スクショ設定</strong></div>
              <p>{meta.kind === "social"
                ? "実画面がある場合だけ追加します。解析結果は媒体専用プロンプトへ反映されます。"
                : "スクリーンショットは自分で撮影します。完成記事には必要な画面・撮影範囲・挿入位置を指示します。"}</p>
            </div>

            {meta.kind === "social" && socialPlatform ? (
              <>
                <div className="admin-promo-channel-optional">
                  <strong>紹介したいスクショを追加</strong>
                  <p>{meta.screenshotSummary}</p>
                  <AdminPromotionScreenshotAnalyzer
                    key={channel}
                    channel={channel as PromotionScreenshotChannel}
                    onAnalysisChange={setScreenshotAnalysis}
                  />
                  {screenshotAnalysis && (
                    <p className="route-notice" role="status">解析済みスクショをStep 8の専用プロンプトへ反映しています。</p>
                  )}
                </div>

                <details className="admin-promo-direct-screenshot">
                  <summary>
                    <div>
                      <span>API不要</span>
                      <strong>ChatGPTへスクショを直接渡す</strong>
                    </div>
                    <small>AAS側の画像解析APIを使わない方法</small>
                  </summary>
                  <div className="admin-promo-direct-screenshot-body">
                    <p>
                      ① 下の専用プロンプトをコピー → ② ChatGPTを開く → ③ 紹介したいスクショを同じチャットへ添付 →
                      ④ プロンプトを送信、の順で使います。
                    </p>
                    <div className="admin-promo-direct-screenshot-actions">
                      <button type="button" className="primary-action" onClick={() => onCopy(directScreenshotPrompt)}>
                        ChatGPT直接添付用プロンプトをコピー
                      </button>
                      <button type="button" className="secondary-action" onClick={() => { persistWizardProgress(); launchAiApp("chatgpt"); }}>
                        ChatGPTを開く
                      </button>
                    </div>
                    <pre>{directScreenshotPrompt}</pre>
                    <small>
                      この方法ではAASのOpenAI APIキー・画像解析APIを使いません。スクショはChatGPT側へ直接添付してください。
                      ChatGPT側の利用条件・プラン上限は、利用中のChatGPTプランに従います。
                    </small>
                  </div>
                </details>
              </>
            ) : (
              <div className="admin-promo-channel-optional">
                <strong>{meta.label}記事のスクリーンショット方針</strong>
                <p>{meta.screenshotSummary}</p>
                <p>
                  AASがスクリーンショット画像そのものを取得・生成するのではなく、AIへ渡すプロンプト内で
                  「どの画面を・どの範囲で・本文のどこへ入れるか」を明示します。
                </p>
              </div>
            )}
          </>
        )}

        {step === 7 && (
          <>
            <div className="admin-promo-channel-step">
              <div><span>8</span><strong>内容確認・生成</strong></div>
              <p>設定を確認してプロンプトをAIへ渡し、生成された完成文をAASへ貼り戻して公開用にコピーできます。</p>
            </div>

            <div className="admin-promo-review-grid">
              <div><span>媒体</span><strong>{meta.label}</strong></div>
              <div><span>発信フェーズ</span><strong>{phase || "未指定"}</strong></div>
              <div><span>目的</span><strong>{purpose || "未指定"}</strong></div>
              <div><span>想定読者</span><strong>{audience || "未指定"}</strong></div>
              <div><span>紹介内容</span><strong>{focus || "未指定"}</strong></div>
              <div><span>CTA</span><strong>{ctaResolution.cta}</strong></div>
              {meta.kind === "social" && <div><span>作成数</span><strong>{variants}案</strong></div>}
              {meta.kind === "social" && <div><span>目標文字数</span><strong>約{targetChars}文字</strong></div>}
            </div>

            <PromptOutput
              prompt={prompt}
              onCopy={() => onCopy(prompt)}
              note={screenshotAnalysis
                ? meta.label + "専用プロンプトです。アップロード済みスクショの解析結果・裏付け可能な主張・公開前の注意を反映しています。"
                : meta.label + "専用プロンプトです。スクリーンショットを追加しない場合は、必要な画面・撮影範囲・挿入または添付位置だけを具体的に指示します。"}
            />

            <section className="admin-promo-result-workspace" aria-label="AI生成結果をAASへ戻す">
              <div className="admin-promo-result-head">
                <div>
                  <span>AI RESULT</span>
                  <h3>AIで生成した完成文を貼り戻す</h3>
                  <p>
                    外部AIの回答を貼り付け、内容・スクショ位置・販売状態を確認してから公開用にコピーしてください。
                  </p>
                </div>
                <button type="button" className="secondary-action" onClick={() => void pasteGeneratedContent()}>
                  クリップボードから貼付
                </button>
              </div>
              <textarea
                className="admin-promo-result-textarea"
                value={generatedContent}
                onChange={(event) => {
                  setGeneratedContent(event.target.value);
                  setResultMessage("");
                }}
                placeholder={meta.kind === "article"
                  ? "AIが作成した完成記事をここへ貼り付けます。Markdownの見出し・太字・リスト・スクショ挿入位置を残したままで構いません。"
                  : "AIが作成したSNS投稿をここへ貼り付けます。"}
              />
              <div className="admin-promo-result-actions">
                {meta.kind === "article" && (
                  <button
                    type="button"
                    className="primary-action"
                    disabled={!generatedContent.trim()}
                    onClick={() => void copyGeneratedRich()}
                  >
                    {channel === "note" ? "note用・装飾付きコピー" : "装飾付きコピー"}
                  </button>
                )}
                <button
                  type="button"
                  className={meta.kind === "social" ? "primary-action" : "secondary-action"}
                  disabled={!generatedContent.trim()}
                  onClick={() => void copyGeneratedPlain()}
                >
                  {meta.kind === "social" ? "SNS投稿をコピー" : "Markdownをコピー"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!generatedContent}
                  onClick={() => {
                    setGeneratedContent("");
                    setResultMessage("完成文欄をクリアしました。");
                  }}
                >
                  クリア
                </button>
              </div>
              {resultMessage && <p className="route-notice" role="status">{resultMessage}</p>}
              <small>
                装飾付きコピーはブラウザのクリップボード内だけで処理します。AASからnote・Brain・Tipsへ自動投稿は行いません。
              </small>
            </section>
          </>
        )}
      </div>

      <div className="admin-promo-wizard-actions">
        <button type="button" className="secondary-action" disabled={step === 0} onClick={goPrevious}>← 前へ</button>
        <span>{step + 1} / {PROMOTION_WIZARD_STEPS.length}</span>
        {step < PROMOTION_WIZARD_STEPS.length - 1 ? (
          <button type="button" className="primary-action" onClick={goNext}>次へ →</button>
        ) : (
          <button type="button" className="secondary-action" onClick={() => setStep(0)}>最初から確認</button>
        )}
      </div>
    </section>
  );
}
