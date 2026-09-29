"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AdminPromotionChannelBuilder } from "@/components/admin-promotion/admin-promotion-channel-builder";
import { ActiveWorkspacePresetBadge } from "@/features/presets/active-workspace-preset-badge";
import { useWorkspacePreset } from "@/features/presets/workspace-preset-provider";
import { WORKSPACE_PRESETS } from "@/features/presets/workspace-presets";
import {
  PromptOutput,
  SelectField,
  SelectWithCustomField,
  SocialLengthSettings,
  SocialWritingStyleSettings,
  TextField,
} from "@/components/admin-promotion/admin-promotion-fields";
import {
  AUDIENCE_OPTIONS,
  CAMPAIGN_GOAL_OPTIONS,
  CHANNEL_PRESET_OPTIONS,
  CTA_OPTIONS,
  DEFAULT_SOCIAL_PRESET_IDS,
  EDITION_OPTIONS,
  LIMITATION_OPTIONS,
  MODES,
  OFFER_OPTIONS,
  PREVIEW_UPDATE_OPTIONS,
  PROMOTION_PHASE_OPTIONS,
  PURPOSE_OPTIONS,
  RELEASE_STAGE_OPTIONS,
  SUPPORT_OPTIONS,
  TESTED_PLATFORM_OPTIONS,
  TESTING_STATUS_OPTIONS,
  type Mode,
} from "@/components/admin-promotion/admin-promotion-options";
import {
  ADMIN_PRODUCT_FACTS_STORAGE_KEY,
  DEFAULT_ADMIN_PRODUCT_FACTS,
  DEFAULT_SOCIAL_LENGTH_PLAN,
  buildAdminArticlePromotionPrompt,
  buildAdminCampaignPrompt,
  buildAdminPreviewPromotionPrompt,
  buildAdminSocialPromotionPrompt,
  sanitizeSocialTargetChars,
  socialLengthPresetsFor,
  type AdminArticlePromotionInput,
  type AdminProductFacts,
  type AdminSocialLengthPlan,
  type AdminSocialPlatform,
} from "@/lib/admin-promotion";
import {
  DEFAULT_ADMIN_SOCIAL_WRITING_STYLE,
  type AdminSocialWritingStyle,
} from "@/lib/social-writing-style";

export function AdminPromotionPage() {
  const { state } = useSharedAccessState();
  const { preference: workspacePreference } = useWorkspacePreset();
  const [mode, setMode] = useState<Mode>("preview");
  const [message, setMessage] = useState("");
  const [facts, setFacts] = useState<AdminProductFacts>(DEFAULT_ADMIN_PRODUCT_FACTS);
  const [socialLengths, setSocialLengths] = useState<AdminSocialLengthPlan>({ ...DEFAULT_SOCIAL_LENGTH_PLAN });
  const [socialPresetIds, setSocialPresetIds] = useState<Record<AdminSocialPlatform, string>>({ ...DEFAULT_SOCIAL_PRESET_IDS });
  const [advancedSocialStyle, setAdvancedSocialStyle] = useState<AdminSocialWritingStyle>({ ...DEFAULT_ADMIN_SOCIAL_WRITING_STYLE });
  const [article, setArticle] = useState<AdminArticlePromotionInput>({
    platform: "note",
    phase: "実運用テスト中（販売前）",
    purpose: "実運用テスト状況の共有",
    audience: "AI初心者",
    focus: "製品全体",
    cta: "フォローして続報を待ってもらう",
  });
  const [social, setSocial] = useState({
    platform: "x" as AdminSocialPlatform,
    phase: "実運用テスト中（販売前）",
    purpose: "実運用テスト状況の共有",
    audience: "AI初心者",
    focus: "製品全体",
    cta: "フォローして続報を待ってもらう",
    variants: 3,
  });
  const [campaign, setCampaign] = useState({
    campaignName: "",
    phase: "実運用テスト中（販売前）",
    goal: "実運用テストの共有",
    audience: "AI初心者",
    channels: "note, X, Instagram, Threads, TikTok, YouTube Shorts",
    offer: "販売前・テスト運用中",
    cta: "フォローして続報を待ってもらう",
  });
  const [preview, setPreview] = useState({
    updateType: "note実運用テスト報告",
    testedPlatform: "note",
    verifiedUpdate: "",
    releasePlan: "",
    audience: "AI初心者",
    channels: "note, X, Instagram, Threads",
    cta: "フォローして続報を待ってもらう",
  });
  const workspacePresetAppliedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = window.localStorage.getItem(ADMIN_PRODUCT_FACTS_STORAGE_KEY);
        if (saved) {
          const merged = { ...DEFAULT_ADMIN_PRODUCT_FACTS, ...JSON.parse(saved) } as AdminProductFacts;
          if (merged.productName === "AI Article Studio") merged.productName = "AI Action Studio";
          setFacts(merged);
        }
        const requested = new URLSearchParams(window.location.search).get("mode");
        if (requested && MODES.some((item) => item.key === requested)) setMode(requested as Mode);
      } catch {
        // Keep safe defaults when local data is unavailable or malformed.
      }
    });
  }, []);

  useEffect(() => {
    if (workspacePresetAppliedRef.current || !workspacePreference?.applySns) return;
    workspacePresetAppliedRef.current = true;
    const preset = WORKSPACE_PRESETS[workspacePreference.presetKey];
    const nextLengths = { ...preset.social.targetCharacters };
    const nextPresetIds = { ...DEFAULT_SOCIAL_PRESET_IDS };
    for (const platform of Object.keys(nextLengths) as AdminSocialPlatform[]) {
      const match = socialLengthPresetsFor(platform).find((item) => item.targetChars === nextLengths[platform]);
      nextPresetIds[platform] = match?.id ?? "__custom__";
    }
    queueMicrotask(() => {
      setSocialLengths(nextLengths);
      setSocialPresetIds(nextPresetIds);
      if (workspacePreference.presetKey === "aas_official") {
        setMode((current) => current === "product" ? current : "preview");
      }
    });
  }, [workspacePreference]);

  const isAdmin = state.kind === "ready" && state.profile.role === "admin" && state.profile.status === "active";
  const adminUserId = state.kind === "ready" ? state.profile.id : "";
  const featureOptions = useMemo(() => {
    const confirmed = facts.features
      .split(/\r?\n|、|,/)
      .map((item) => item.trim().replace(/^[-・•]\s*/, ""))
      .filter(Boolean);
    return Array.from(new Set(["製品全体", ...confirmed]));
  }, [facts.features]);

  const articlePrompt = useMemo(() => {
    void workspacePreference; // Prompt context reads the runtime workspace preset.
    return buildAdminArticlePromotionPrompt(facts, article);
  }, [facts, article, workspacePreference]);
  const socialPrompt = useMemo(
    () => {
      void workspacePreference; // Prompt context reads the runtime workspace preset.
      return buildAdminSocialPromotionPrompt(facts, {
        ...social,
        lengthPresetId: socialPresetIds[social.platform],
        targetChars: socialLengths[social.platform],
        socialStyle: advancedSocialStyle,
      });
    },
    [facts, social, socialLengths, socialPresetIds, advancedSocialStyle, workspacePreference],
  );
  const campaignPrompt = useMemo(
    () => {
      void workspacePreference; // Prompt context reads the runtime workspace preset.
      return buildAdminCampaignPrompt(facts, { ...campaign, socialLengths, socialStyle: advancedSocialStyle });
    },
    [facts, campaign, socialLengths, advancedSocialStyle, workspacePreference],
  );
  const previewPrompt = useMemo(
    () => {
      void workspacePreference; // Prompt context reads the runtime workspace preset.
      return buildAdminPreviewPromotionPrompt(facts, { ...preview, socialLengths, socialStyle: advancedSocialStyle });
    },
    [facts, preview, socialLengths, advancedSocialStyle, workspacePreference],
  );
  const updateSocialLength = (platform: AdminSocialPlatform, presetId: string, targetChars: number) => {
    setSocialPresetIds((current) => ({ ...current, [platform]: presetId }));
    setSocialLengths((current) => ({ ...current, [platform]: sanitizeSocialTargetChars(targetChars) }));
  };

  const saveFacts = () => {
    try {
      window.localStorage.setItem(ADMIN_PRODUCT_FACTS_STORAGE_KEY, JSON.stringify(facts));
      setMessage("確認済み製品情報をこの端末に保存しました。");
    } catch {
      setMessage("製品情報を保存できませんでした。");
    }
  };

  const copyPrompt = async (prompt: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("生成用プロンプトをコピーしました。");
      return true;
    } catch {
      setMessage("自動コピーできませんでした。プロンプトを長押ししてコピーしてください。");
      return false;
    }
  };

  if (!isAdmin) {
    return (
      <main className="standalone-page"><section className="standalone-card">
        <p className="eyebrow">ADMIN ONLY</p><h1>販売・プロモーション</h1>
        {state.kind === "signed_out" && <p className="route-notice">先にログインしてください。</p>}
        {state.kind !== "loading" && state.kind !== "signed_out" && <p className="route-notice error">この機能はactive管理者のみ利用できます。</p>}
        <Link className="route-back" href="/">← ホームへ戻る</Link>
      </section></main>
    );
  }

  return (
    <main className="admin-promo-page">
      <header className="admin-promo-head">
        <div><p className="eyebrow">SALES & PROMOTION</p><h1>販売・プロモーションセンター</h1><p>AI Action Studio（AAS）の投稿先を1つ選ぶだけで、その媒体専用のプロモーションプロンプトへ切り替わります。note・Brain・Tips・X・Threads・Instagramに対応しています。</p></div>
        <div><Link href="/admin/sales">販売設定</Link><Link href="/admin">管理ダッシュボード</Link><Link href="/">ホーム</Link></div>
      </header>

      <ActiveWorkspacePresetBadge feature="sns" />
      <div className="admin-promo-safety"><strong>確認済み情報を基準に作成</strong><span>販売前は「テスト中・準備中・公開予定」として扱い、未入力の価格・実績・レビュー・公開日をAIに作らせません。製品情報は現在この端末だけに保存されます。</span></div>

      {message && <div className="route-notice">{message}</div>}

      <AdminPromotionChannelBuilder
        facts={facts}
        featureOptions={featureOptions}
        onCopy={copyPrompt}
        userId={adminUserId}
      />

      <details className="admin-promo-advanced">
        <summary>詳細設定・キャンペーン・製品情報</summary>
        <div className="admin-promo-advanced-body">
      {mode === "product" && (
        <section className="admin-promo-panel">
          <div className="admin-promo-section-title"><div><p className="eyebrow">PRODUCT FACTS</p><h2>製品情報管理</h2></div><button type="button" onClick={saveFacts}>この端末に保存</button></div>
          <p className="admin-promo-help">選べる項目はプルダウンから指定できます。該当するものがない場合だけ「その他・自由入力」を使ってください。価格やURLなど事実確認が必要な内容は、未確定なら空欄のままで構いません。</p>
          <div className="admin-promo-form-grid">
            <TextField label="製品名" value={facts.productName} onChange={(value) => setFacts((current) => ({ ...current, productName: value }))} />
            <SelectWithCustomField label="提供形態" value={facts.editions} onChange={(value) => setFacts((current) => ({ ...current, editions: value }))} options={EDITION_OPTIONS} customPlaceholder="例: PWA版 / Windows版（条件付き提供）" />
            <SelectWithCustomField label="提供状況" value={facts.releaseStage} onChange={(value) => setFacts((current) => ({ ...current, releaseStage: value }))} options={RELEASE_STAGE_OPTIONS} customPlaceholder="提供状況を入力" />
            <SelectWithCustomField label="想定ユーザー" value={facts.targetAudience} onChange={(value) => setFacts((current) => ({ ...current, targetAudience: value }))} options={AUDIENCE_OPTIONS} customPlaceholder="想定ユーザーを入力" />
            <TextField label="確認済み機能" value={facts.features} onChange={(value) => setFacts((current) => ({ ...current, features: value }))} multiline />
            <TextField label="価格・販売条件" value={facts.priceText} onChange={(value) => setFacts((current) => ({ ...current, priceText: value }))} placeholder="未確定なら空欄。確定済みの価格・販売条件だけ入力" multiline />
            <TextField label="販売URL" value={facts.salesUrl} onChange={(value) => setFacts((current) => ({ ...current, salesUrl: value }))} placeholder="未確定なら空欄" />
            <SelectWithCustomField label="サポート" value={facts.support} onChange={(value) => setFacts((current) => ({ ...current, support: value }))} options={SUPPORT_OPTIONS} customPlaceholder="確認済みのサポート方法を入力" />
            <SelectWithCustomField label="制限・注意事項" value={facts.limitations} onChange={(value) => setFacts((current) => ({ ...current, limitations: value }))} options={LIMITATION_OPTIONS} customPlaceholder="確認済みの制限・注意事項を入力" />
            <SelectWithCustomField label="実運用・テスト状況" value={facts.testingStatus} onChange={(value) => setFacts((current) => ({ ...current, testingStatus: value }))} options={TESTING_STATUS_OPTIONS} customPlaceholder="現在のテスト状況を入力" />
            <TextField label="確認済みテスト内容・観察結果" value={facts.testingNotes} onChange={(value) => setFacts((current) => ({ ...current, testingNotes: value }))} placeholder="実際に試した内容・確認できたことだけを入力。PV・売上・効果など未確認の数値は書かない" multiline />
            <TextField label="公開・販売予定" value={facts.releasePlan} onChange={(value) => setFacts((current) => ({ ...current, releasePlan: value }))} placeholder="例: 2026年10月にPWAテスト版を公開予定。未確定なら「時期未定」" />
            <TextField label="テスト記事・案内URL" value={facts.referenceUrl} onChange={(value) => setFacts((current) => ({ ...current, referenceUrl: value }))} placeholder="note等で公開した確認済みURL。未公開なら空欄" />
          </div>
        </section>
      )}

      {mode === "preview" && (
        <section className="admin-promo-panel admin-promo-builder">
          <div className="admin-promo-section-title"><div><p className="eyebrow">PRE-LAUNCH UPDATE</p><h2>テスト・開発進捗・公開予告</h2></div></div>
          <p className="admin-promo-help">まだ販売していない段階でも使えます。自分でnote等を実運用テストした内容、改善中の点、公開予定を「販売中」と誤解されない形で記事・SNSへ展開します。</p>
          <div className="admin-promo-form-grid compact">
            <SelectWithCustomField label="発信内容" value={preview.updateType} onChange={(value) => setPreview((current) => ({ ...current, updateType: value }))} options={PREVIEW_UPDATE_OPTIONS} customPlaceholder="今回の発信内容を入力" />
            <SelectWithCustomField label="テスト・掲載先" value={preview.testedPlatform} onChange={(value) => setPreview((current) => ({ ...current, testedPlatform: value }))} options={TESTED_PLATFORM_OPTIONS} customPlaceholder="例: note / 自分のブログ" />
            <TextField label="今回共有してよい確認済み内容" value={preview.verifiedUpdate} onChange={(value) => setPreview((current) => ({ ...current, verifiedUpdate: value }))} placeholder="例: AASで作った記事を自分のnoteへ掲載し、作成フローと公開までの操作を確認した。確認していない成果や反応は書かない。" multiline />
            <TextField label="今回伝える公開予定" value={preview.releasePlan} onChange={(value) => setPreview((current) => ({ ...current, releasePlan: value }))} placeholder="未確定なら「時期未定」。確定済みの予定だけ入力" />
            <SelectWithCustomField label="想定読者" value={preview.audience} onChange={(value) => setPreview((current) => ({ ...current, audience: value }))} options={AUDIENCE_OPTIONS} customPlaceholder="想定読者を入力" />
            <SelectWithCustomField label="使用媒体" value={preview.channels} onChange={(value) => setPreview((current) => ({ ...current, channels: value }))} options={CHANNEL_PRESET_OPTIONS} customPlaceholder="例: note, X, Instagram" />
            <SelectWithCustomField label="CTA・誘導先" value={preview.cta} onChange={(value) => setPreview((current) => ({ ...current, cta: value }))} options={CTA_OPTIONS} customPlaceholder="CTA・誘導先を入力" />
          </div>
          <div className="admin-promo-prelaunch-note">
            <strong>販売前モード</strong>
            <span>価格・販売URL・公開日が未確定なら断定しません。実際に確認していないPV、売上、反応、レビュー、感想も作成しません。</span>
          </div>
          <SocialLengthSettings presetIds={socialPresetIds} plan={socialLengths} onChange={updateSocialLength} />
          <SocialWritingStyleSettings value={advancedSocialStyle} onChange={setAdvancedSocialStyle} />
          <PromptOutput prompt={previewPrompt} onCopy={() => copyPrompt(previewPrompt)} />
        </section>
      )}

      {mode === "article" && (
        <section className="admin-promo-panel admin-promo-builder">
          <div className="admin-promo-section-title"><div><p className="eyebrow">ARTICLE PROMOTION</p><h2>紹介・販売記事作成</h2></div></div>
          <p className="admin-promo-help">販売前のテスト共有・公開予告から販売開始後の記事まで、発信フェーズを選んで作成できます。</p>
          <div className="admin-promo-form-grid compact">
            <label className="admin-promo-field"><span>掲載先</span><select value={article.platform} onChange={(event) => setArticle((current) => ({ ...current, platform: event.target.value as typeof article.platform }))}><option value="note">note</option><option value="brain">Brain</option><option value="tips">Tips</option><option value="blog">ブログ</option></select></label>
            <SelectWithCustomField label="発信フェーズ" value={article.phase} onChange={(value) => setArticle((current) => ({ ...current, phase: value }))} options={PROMOTION_PHASE_OPTIONS} customPlaceholder="現在の発信フェーズを入力" />
            <SelectWithCustomField label="目的" value={article.purpose} onChange={(value) => setArticle((current) => ({ ...current, purpose: value }))} options={PURPOSE_OPTIONS} customPlaceholder="記事の目的を入力" />
            <SelectWithCustomField label="想定読者" value={article.audience} onChange={(value) => setArticle((current) => ({ ...current, audience: value }))} options={AUDIENCE_OPTIONS} customPlaceholder="想定読者を入力" />
            <SelectWithCustomField label="特に紹介したい内容" value={article.focus} onChange={(value) => setArticle((current) => ({ ...current, focus: value }))} options={featureOptions} customPlaceholder="紹介したい内容を入力" />
            <SelectWithCustomField label="CTA・誘導先" value={article.cta} onChange={(value) => setArticle((current) => ({ ...current, cta: value }))} options={CTA_OPTIONS} customPlaceholder="CTA・誘導先を入力" />
          </div>
          <PromptOutput prompt={articlePrompt} onCopy={() => copyPrompt(articlePrompt)} />
        </section>
      )}

      {mode === "social" && (
        <section className="admin-promo-panel admin-promo-builder">
          <div className="admin-promo-section-title"><div><p className="eyebrow">SOCIAL PROMOTION</p><h2>SNSプロモーション作成</h2></div></div>
          <p className="admin-promo-help">販売前のテスト共有・公開予告にも対応します。X Premiumなど契約・媒体ごとの文字数も下で選べます。</p>
          <div className="admin-promo-form-grid compact">
            <label className="admin-promo-field"><span>SNS</span><select value={social.platform} onChange={(event) => setSocial((current) => ({ ...current, platform: event.target.value as typeof social.platform }))}><option value="x">X</option><option value="instagram">Instagram</option><option value="threads">Threads</option><option value="tiktok">TikTok</option><option value="youtube">YouTube Shorts</option></select></label>
            <SelectWithCustomField label="発信フェーズ" value={social.phase} onChange={(value) => setSocial((current) => ({ ...current, phase: value }))} options={PROMOTION_PHASE_OPTIONS} customPlaceholder="現在の発信フェーズを入力" />
            <SelectWithCustomField label="目的" value={social.purpose} onChange={(value) => setSocial((current) => ({ ...current, purpose: value }))} options={PURPOSE_OPTIONS} customPlaceholder="SNS投稿の目的を入力" />
            <SelectWithCustomField label="想定読者" value={social.audience} onChange={(value) => setSocial((current) => ({ ...current, audience: value }))} options={AUDIENCE_OPTIONS} customPlaceholder="想定読者を入力" />
            <SelectWithCustomField label="紹介テーマ" value={social.focus} onChange={(value) => setSocial((current) => ({ ...current, focus: value }))} options={featureOptions} customPlaceholder="紹介テーマを入力" />
            <SelectWithCustomField label="CTA・誘導先" value={social.cta} onChange={(value) => setSocial((current) => ({ ...current, cta: value }))} options={CTA_OPTIONS} customPlaceholder="CTA・誘導先を入力" />
            <SelectField label="作成数" value={String(social.variants)} onChange={(value) => setSocial((current) => ({ ...current, variants: Number(value) || 1 }))} options={["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]} />
          </div>
          <SocialLengthSettings presetIds={socialPresetIds} plan={socialLengths} onChange={updateSocialLength} />
          <SocialWritingStyleSettings value={advancedSocialStyle} onChange={setAdvancedSocialStyle} />
          <PromptOutput prompt={socialPrompt} onCopy={() => copyPrompt(socialPrompt)} />
        </section>
      )}

      {mode === "campaign" && (
        <section className="admin-promo-panel admin-promo-builder">
          <div className="admin-promo-section-title"><div><p className="eyebrow">CAMPAIGN</p><h2>プロモーションキャンペーン設計</h2></div></div>
          <p className="admin-promo-help">販売前のテスト共有・公開予告から販売開始後まで、記事とSNSをまとめた14日間の発信計画を作れます。</p>
          <div className="admin-promo-form-grid compact">
            <TextField label="キャンペーン名" value={campaign.campaignName} onChange={(value) => setCampaign((current) => ({ ...current, campaignName: value }))} placeholder="例: PWAベータ販売開始" />
            <SelectWithCustomField label="発信フェーズ" value={campaign.phase} onChange={(value) => setCampaign((current) => ({ ...current, phase: value }))} options={PROMOTION_PHASE_OPTIONS} customPlaceholder="現在の発信フェーズを入力" />
            <SelectWithCustomField label="目的" value={campaign.goal} onChange={(value) => setCampaign((current) => ({ ...current, goal: value }))} options={CAMPAIGN_GOAL_OPTIONS} customPlaceholder="キャンペーンの目的を入力" />
            <SelectWithCustomField label="想定読者" value={campaign.audience} onChange={(value) => setCampaign((current) => ({ ...current, audience: value }))} options={AUDIENCE_OPTIONS} customPlaceholder="想定読者を入力" />
            <SelectWithCustomField label="使用媒体" value={campaign.channels} onChange={(value) => setCampaign((current) => ({ ...current, channels: value }))} options={CHANNEL_PRESET_OPTIONS} customPlaceholder="例: note, X, Instagram" />
            <SelectWithCustomField label="販売条件・オファー" value={campaign.offer} onChange={(value) => setCampaign((current) => ({ ...current, offer: value }))} options={OFFER_OPTIONS} customPlaceholder="確認済みの販売条件・オファーを入力" />
            <SelectWithCustomField label="CTA・誘導先" value={campaign.cta} onChange={(value) => setCampaign((current) => ({ ...current, cta: value }))} options={CTA_OPTIONS} customPlaceholder="CTA・誘導先を入力" />
          </div>
          <SocialLengthSettings presetIds={socialPresetIds} plan={socialLengths} onChange={updateSocialLength} />
          <SocialWritingStyleSettings value={advancedSocialStyle} onChange={setAdvancedSocialStyle} />
          <PromptOutput prompt={campaignPrompt} onCopy={() => copyPrompt(campaignPrompt)} />
        </section>
      )}
        </div>
      </details>
    </main>
  );
}
