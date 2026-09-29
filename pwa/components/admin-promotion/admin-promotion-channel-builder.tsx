"use client";

import { useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AiSelectionStep } from "@/components/article-create/article-create-steps";
import {
  currentAiLaunchOptions,
  readClipboardText,
} from "@/components/article-create/article-create-step-shared";
import {
  SelectField,
  SelectWithCustomField,
  SocialWritingStyleSettings,
} from "@/components/admin-promotion/admin-promotion-fields";
import { AdminPromotionScreenshotAnalyzer } from "@/components/admin-promotion/admin-promotion-screenshot-analyzer";
import { AdminPromotionContentWorkspace } from "@/components/admin-promotion/admin-promotion-content-workspace";
import {
  AUDIENCE_OPTIONS,
  CTA_OPTIONS,
  PROMOTION_PHASE_OPTIONS,
  PURPOSE_OPTIONS,
} from "@/components/admin-promotion/admin-promotion-options";
import { launchAiApp } from "@/lib/ai-app-links";
import {
  defaultSocialLengthPreset,
  sanitizeSocialTargetChars,
  socialLengthPresetsFor,
  type AdminProductFacts,
  type AdminSocialPlatform,
} from "@/lib/admin-promotion";
import {
  ADMIN_PROMOTION_CHANNELS,
  buildAdminChannelBodyPrompt,
  buildAdminChannelDirectScreenshotPrompt,
  buildAdminChannelPromotionPrompt,
  buildAdminChannelTitlePrompt,
  resolveAdminPromotionCta,
  type AdminChannelPromotionInput,
  type AdminPromotionChannel,
} from "@/lib/admin-promotion-channel";
import { markdownToNoteHtml } from "@/lib/note-rich-text";
import { parseTitleCandidates } from "@/lib/phase11-create";
import type { PromotionScreenshotAnalysis, PromotionScreenshotChannel } from "@/lib/promotion-screenshot-analysis";
import {
  DEFAULT_ADMIN_SOCIAL_WRITING_STYLE,
  type AdminSocialWritingStyle,
} from "@/lib/social-writing-style";
import {
  createDefaultWritingProfile,
  loadWritingProfile,
  saveWritingProfile,
  setRuntimeWritingProfile,
  type UserWritingProfile,
} from "@/lib/user-personalization";

const CHANNEL_ORDER: AdminPromotionChannel[] = [
  "note",
  "brain",
  "tips",
  "x",
  "threads",
  "instagram",
];

const PROMOTION_CREATE_STEPS = [
  "使用AI選択",
  "媒体選択",
  "画像・スクショ",
  "発信条件",
  "タイトル・フック",
  "本文・投稿",
  "内容確認",
  "保存・コピー",
] as const;

export function AdminPromotionChannelBuilder({
  facts,
  featureOptions,
  onCopy,
}: {
  facts: AdminProductFacts;
  featureOptions: readonly string[];
  onCopy(prompt: string): void;
}) {
  const { state: accessState, client } = useSharedAccessState();
  const ownerId = accessState.kind === "ready" ? accessState.profile.id : "";

  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [writingProfile, setWritingProfile] = useState<UserWritingProfile | null>(null);

  const [channel, setChannel] = useState<AdminPromotionChannel>("note");
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(true);
  const [screenshotCount, setScreenshotCount] = useState(3);
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

  const [titleCandidatesText, setTitleCandidatesText] = useState("");
  const [selectedTitle, setSelectedTitle] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");

  useEffect(() => {
    if (!client || !ownerId) return;
    let active = true;
    void loadWritingProfile(client, ownerId)
      .catch(() => createDefaultWritingProfile(ownerId))
      .then((profile) => {
        if (!active) return;
        setWritingProfile(profile);
        setRuntimeWritingProfile(profile);
      });
    return () => { active = false; };
  }, [client, ownerId]);

  const meta = ADMIN_PROMOTION_CHANNELS[channel];
  const socialPlatform = meta.socialPlatform;
  const titleCandidates = useMemo(() => parseTitleCandidates(titleCandidatesText).slice(0, 5), [titleCandidatesText]);

  const promotionInput = useMemo<AdminChannelPromotionInput>(() => ({
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
    screenshotsEnabled,
    screenshotCount: screenshotsEnabled ? screenshotCount : 0,
  }), [
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
    screenshotsEnabled,
    screenshotCount,
  ]);

  const fullPrompt = useMemo(
    () => buildAdminChannelPromotionPrompt(facts, promotionInput),
    [facts, promotionInput],
  );
  const titlePrompt = useMemo(
    () => buildAdminChannelTitlePrompt(facts, promotionInput),
    [facts, promotionInput],
  );
  const bodyPrompt = useMemo(
    () => buildAdminChannelBodyPrompt(facts, promotionInput, selectedTitle),
    [facts, promotionInput, selectedTitle],
  );
  const directScreenshotPrompt = useMemo(
    () => meta.kind === "social"
      ? buildAdminChannelDirectScreenshotPrompt(facts, { ...promotionInput, directScreenshotAttachment: true })
      : "",
    [facts, meta.kind, promotionInput],
  );
  const ctaResolution = useMemo(
    () => resolveAdminPromotionCta(facts, { phase, cta }),
    [cta, facts, phase],
  );

  const selectChannel = (next: AdminPromotionChannel) => {
    const nextMeta = ADMIN_PROMOTION_CHANNELS[next];
    setChannel(next);
    setPurpose(nextMeta.defaultPurpose);
    setCta(nextMeta.defaultCta);
    setScreenshotAnalysis(null);
    setTitleCandidatesText("");
    setSelectedTitle("");
    setBodyDraft("");
    if (nextMeta.socialPlatform) {
      const preset = defaultSocialLengthPreset(nextMeta.socialPlatform);
      setLengthPresetId(preset.id);
      setTargetChars(preset.targetChars);
    }
  };

  const updateWritingProfile = (profile: UserWritingProfile) => {
    setWritingProfile(profile);
    setRuntimeWritingProfile(profile);
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

  const next = async () => {
    setMessage("");

    if (step === 0) {
      if (!writingProfile || !client) {
        setMessage("使用AIの設定を読み込めませんでした。");
        return;
      }
      setBusy(true);
      try {
        const saved = await saveWritingProfile(client, writingProfile);
        setWritingProfile(saved);
        setRuntimeWritingProfile(saved);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "使用AI設定を保存できませんでした。");
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }

    if (step === 4 && !selectedTitle.trim()) {
      setMessage(meta.kind === "article" ? "タイトルを1つ選択または入力してください。" : "フックを1つ選択または入力してください。");
      return;
    }
    if (step === 5 && !bodyDraft.trim()) {
      setMessage(meta.kind === "article" ? "AIが作成した本文を貼り付けてください。" : "AIが作成した投稿文を貼り付けてください。");
      return;
    }

    setStep((current) => Math.min(PROMOTION_CREATE_STEPS.length - 1, current + 1));
  };

  const back = () => {
    setMessage("");
    setStep((current) => Math.max(0, current - 1));
  };

  const jumpBackToStep = (target: number) => {
    if (target < 0 || target >= step || busy) return;
    setMessage("");
    setStep(target);
  };

  const aiLaunchOptions = currentAiLaunchOptions();

  return (
    <section className="admin-promo-channel-builder admin-promo-eight-step" aria-label="8ステップ販売プロモーション作成">
      <div className="admin-promo-channel-head">
        <div>
          <p className="eyebrow">PROMOTION CREATOR</p>
          <h2>8ステップで販売・プロモーション素材を作成</h2>
          <p>通常の記事作成と同じ流れで進みます。違いは、note・Brain・Tipsに加えてX・Threads・Instagramも選べる点です。</p>
        </div>
        <strong>{meta.kind === "article" ? "記事" : "SNS"}モード</strong>
      </div>

      <ol className="wizard-steps admin-promo-wizard-steps" aria-label="販売プロモーション作成の進行状況">
        {PROMOTION_CREATE_STEPS.map((label, index) => {
          const canJumpBack = index < step && !busy;
          return (
            <li
              key={label}
              className={index === step ? "active" : index < step ? "done" : ""}
              aria-current={index === step ? "step" : undefined}
            >
              <button
                type="button"
                disabled={!canJumpBack}
                onClick={() => jumpBackToStep(index)}
                aria-label={canJumpBack ? `STEP ${index + 1}「${label}」へ戻る` : `STEP ${index + 1}「${label}」`}
              >
                <span>{index + 1}</span>
                <small>{label}</small>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="admin-promo-wizard-card">
        {step === 0 && writingProfile && (
          <AiSelectionStep profile={writingProfile} onChange={updateWritingProfile} />
        )}
        {step === 0 && !writingProfile && (
          <div className="wizard-pane"><p className="panel-muted">使用AI設定を読み込んでいます…</p></div>
        )}

        {step === 1 && (
          <div className="wizard-pane">
            <p className="eyebrow">STEP 2 · 媒体選択</p>
            <h2>どこでプロモーションしますか？</h2>
            <p className="panel-muted">記事媒体とSNSを同じ作成フローから選択できます。</p>
            <label className="admin-promo-channel-select">
              <span>掲載・投稿先</span>
              <select value={channel} onChange={(event) => selectChannel(event.target.value as AdminPromotionChannel)}>
                {CHANNEL_ORDER.map((key) => {
                  const item = ADMIN_PROMOTION_CHANNELS[key];
                  return <option key={key} value={key}>{item.label} — {item.summary}</option>;
                })}
              </select>
            </label>
            <div className="admin-promo-channel-overview">
              <div><span>選択中</span><strong>{meta.label}</strong><p>{meta.summary}</p></div>
              <div><span>おすすめ構成</span><p>{meta.recommendedFormat}</p></div>
              <div><span>スクショ目安</span><p>{meta.screenshotSummary}</p></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-pane">
            <p className="eyebrow">STEP 3 · 画像・スクショ</p>
            <h2>{meta.kind === "article" ? "記事にスクリーンショットを入れますか？" : "投稿にスクリーンショットを添付しますか？"}</h2>
            <label className="choice-card">
              <input type="checkbox" checked={screenshotsEnabled} onChange={(event) => setScreenshotsEnabled(event.target.checked)} />
              <span>
                <strong>スクリーンショットを使用する</strong>
                <small>実画面を根拠として使います。最終画像はSTEP 8でAAS本体へ保存します。</small>
              </span>
            </label>
            {screenshotsEnabled && (
              <label className="admin-promo-field">
                <span>使用するスクショ枚数の目安</span>
                <select value={screenshotCount} onChange={(event) => setScreenshotCount(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}>
                  {[1,2,3,4,5,6,7,8,9,10].map((count) => <option key={count} value={count}>{count}枚</option>)}
                </select>
              </label>
            )}

            {screenshotsEnabled && meta.kind === "social" && socialPlatform && (
              <div className="admin-promo-channel-optional">
                <AdminPromotionScreenshotAnalyzer
                  key={channel}
                  channel={channel as PromotionScreenshotChannel}
                  onAnalysisChange={setScreenshotAnalysis}
                />
                <details className="admin-promo-direct-screenshot">
                  <summary>
                    <div><span>API不要</span><strong>ChatGPTへスクショを直接渡す</strong></div>
                    <small>AAS側の画像解析APIを使わない方法</small>
                  </summary>
                  <div className="admin-promo-direct-screenshot-body">
                    <p>専用プロンプトをコピーし、ChatGPTへスクショと一緒に渡せます。</p>
                    <div className="admin-promo-direct-screenshot-actions">
                      <button type="button" className="primary-action" onClick={() => onCopy(directScreenshotPrompt)}>直接添付用プロンプトをコピー</button>
                      <button type="button" className="secondary-action" onClick={() => launchAiApp("chatgpt")}>ChatGPTを開く</button>
                    </div>
                  </div>
                </details>
              </div>
            )}
            {screenshotsEnabled && meta.kind === "article" && (
              <p className="beginner-help">本文生成時に最適な挿入位置をAIへ指示し、STEP 8で実際のスクショをAAS本体へ保存して本文へ差し込みます。</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-pane">
            <p className="eyebrow">STEP 4 · 発信条件</p>
            <h2>プロモーションの基本条件を選んでください</h2>
            <div className="admin-promo-form-grid compact">
              <SelectWithCustomField label="発信フェーズ" value={phase} onChange={setPhase} options={PROMOTION_PHASE_OPTIONS} customPlaceholder="現在の発信フェーズを入力" />
              <SelectWithCustomField label="目的" value={purpose} onChange={setPurpose} options={PURPOSE_OPTIONS} customPlaceholder="今回の目的を入力" />
              <SelectWithCustomField label="想定読者" value={audience} onChange={setAudience} options={AUDIENCE_OPTIONS} customPlaceholder="想定読者を入力" />
              <SelectWithCustomField label="特に紹介したい内容" value={focus} onChange={setFocus} options={featureOptions} customPlaceholder="紹介したい機能・内容を入力" />
              <div>
                <SelectWithCustomField label="CTA・誘導先" value={cta} onChange={setCta} options={CTA_OPTIONS} customPlaceholder="CTA・誘導先を入力" />
                {ctaResolution.corrected && <small className="admin-promo-cta-safety">{ctaResolution.reason}</small>}
              </div>
              {meta.kind === "social" && (
                <SelectField label="作成数" value={String(variants)} onChange={(value) => setVariants(Number(value) || 1)} options={["1", "2", "3", "4", "5"]} />
              )}
            </div>
            {socialPlatform && renderLengthSetting(socialPlatform)}
            {socialPlatform && <SocialWritingStyleSettings value={socialStyle} onChange={setSocialStyle} />}
          </div>
        )}

        {step === 4 && (
          <div className="wizard-pane">
            <p className="eyebrow">STEP 5 · タイトル・フック</p>
            <h2>{meta.kind === "article" ? "タイトルを5候補から選んでください" : "冒頭フックを5候補から選んでください"}</h2>
            <label className="route-field">
              <span>AI用{meta.kind === "article" ? "タイトル" : "フック"}プロンプト</span>
              <textarea className="prompt-area" readOnly value={titlePrompt} />
            </label>
            <div className="openai-prompt-actions">
              <button type="button" className="secondary-action" onClick={() => onCopy(titlePrompt)}>{meta.kind === "article" ? "タイトル" : "フック"}プロンプトをコピー</button>
              {aiLaunchOptions.map((app) => (
                <button key={app.key} type="button" className="openai-launch-action" onClick={() => launchAiApp(app.key)}>選択中の{app.label}を開く ↗</button>
              ))}
            </div>
            <label className="route-field title-candidate-paste">
              <span>AIが生成した5候補をまとめて貼り付け</span>
              <textarea value={titleCandidatesText} onChange={(event) => setTitleCandidatesText(event.target.value.slice(0, 10000))} placeholder={"1. 候補A\n2. 候補B\n3. 候補C\n4. 候補D\n5. 候補E"} />
            </label>
            <div className="clipboard-edit-actions">
              <button className="secondary-action" type="button" onClick={() => void readClipboardText(setMessage).then((value) => { if (value !== null) setTitleCandidatesText(value.slice(0, 10000)); })}>クリップボードから5候補を貼り付け</button>
            </div>
            {titleCandidates.length > 0 && (
              <div className="title-candidates">
                {titleCandidates.map((candidate, index) => (
                  <button type="button" key={`${index}-${candidate}`} className={candidate === selectedTitle ? "selected" : ""} onClick={() => setSelectedTitle(candidate)}>
                    <span>{index + 1}</span>{candidate}
                  </button>
                ))}
              </div>
            )}
            <label className="route-field">
              <span>採用する{meta.kind === "article" ? "タイトル" : "フック"}</span>
              <input value={selectedTitle} onChange={(event) => setSelectedTitle(event.target.value.slice(0, 500))} placeholder="候補を選択するか自由入力" />
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="wizard-pane">
            <p className="eyebrow">STEP 6 · 本文・投稿</p>
            <h2>{meta.kind === "article" ? "完成記事本文を作成してください" : "完成投稿を作成してください"}</h2>
            <p className="panel-muted">記事作成と同じように、プロンプトを選択中のAIへ渡し、返ってきた完成稿をAASへ貼り付けます。</p>
            <label className="route-field">
              <span>AI用完成稿プロンプト</span>
              <textarea className="prompt-area" readOnly value={bodyPrompt} />
            </label>
            <div className="openai-prompt-actions">
              <button type="button" className="secondary-action" onClick={() => onCopy(bodyPrompt)}>完成稿プロンプトをコピー</button>
              {aiLaunchOptions.map((app) => (
                <button key={app.key} type="button" className="openai-launch-action" onClick={() => launchAiApp(app.key)}>選択中の{app.label}を開く ↗</button>
              ))}
            </div>
            <label className="route-field">
              <span>AIが作成した{meta.kind === "article" ? "本文" : "投稿文"}を貼り付け</span>
              <textarea className="body-area admin-promo-wizard-body" value={bodyDraft} onChange={(event) => setBodyDraft(event.target.value.slice(0, 200000))} />
            </label>
            <div className="clipboard-edit-actions">
              <button className="secondary-action" type="button" onClick={() => void readClipboardText(setMessage).then((value) => { if (value !== null) setBodyDraft(value.slice(0, 200000)); })}>クリップボードから貼り付け</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="wizard-pane">
            <p className="eyebrow">STEP 7 · 内容確認</p>
            <h2>公開前に内容を確認してください</h2>
            <dl className="route-meta">
              <div><dt>媒体</dt><dd>{meta.label}</dd></div>
              <div><dt>{meta.kind === "article" ? "タイトル" : "フック"}</dt><dd>{selectedTitle}</dd></div>
              <div><dt>発信フェーズ</dt><dd>{phase}</dd></div>
              <div><dt>スクショ</dt><dd>{screenshotsEnabled ? `最大${screenshotCount}枚` : "使用しない"}</dd></div>
            </dl>
            {meta.kind === "article" ? (
              <div className="admin-promo-wizard-preview" dangerouslySetInnerHTML={{ __html: markdownToNoteHtml(bodyDraft) }} />
            ) : (
              <pre className="admin-promo-wizard-social-preview">{bodyDraft}</pre>
            )}
            <p className="beginner-help">未確認の価格・公開日・成果・売上・PV・レビューが事実として入っていないか確認してください。</p>
          </div>
        )}

        {step === 7 && (
          <div className="wizard-pane">
            <p className="eyebrow">STEP 8 · 保存・コピー</p>
            <h2>AAS本体へ保存して公開用にコピー</h2>
            <div className="admin-promo-selected-title">
              <span>{meta.kind === "article" ? "採用タイトル" : "採用フック"}</span>
              <strong>{selectedTitle}</strong>
            </div>
            <AdminPromotionContentWorkspace
              key={channel}
              channel={channel}
              initialBody={bodyDraft}
              onBodyChange={setBodyDraft}
            />
          </div>
        )}

        {message && <div className="route-notice" role="status" aria-live="polite">{message}</div>}

        <footer className="wizard-actions">
          <button className="secondary-action" type="button" disabled={step === 0 || busy} onClick={back}>戻る</button>
          {step < PROMOTION_CREATE_STEPS.length - 1 && (
            <button className="primary-action" type="button" disabled={busy || (step === 0 && !writingProfile)} onClick={() => void next()}>次へ →</button>
          )}
        </footer>

        <details className="admin-promo-wizard-full-prompt">
          <summary>現在の条件で従来の一括プロンプトも確認</summary>
          <pre>{fullPrompt}</pre>
        </details>
      </div>
    </section>
  );
}
