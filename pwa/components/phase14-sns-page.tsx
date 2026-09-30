"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AppLoadingScreen } from "@/components/app-loading-screen";
import { PresetSelect } from "@/components/preset-select";
import { ActiveWorkspacePresetBadge } from "@/features/presets/active-workspace-preset-badge";
import { workspacePresetSocialDefaults } from "@/features/presets/preset-adapters";
import { useWorkspacePreset } from "@/features/presets/workspace-preset-provider";
import { consumeFreeTrialUsage, trialUsageMessage } from "@/lib/free-trial";
import { buildSocialPrompt, type SocialGoal, type SocialPlatform } from "@/features/social";
import { getCloudArticleDetail, listCloudArticles, type ArticleDetail, type ArticleSummary } from "@/lib/phase7-articles";
import { SOCIAL_PLATFORM_OPTIONS, socialLaunchHint, socialPlatformLabel, socialPlatformUrl } from "@/lib/social-links";
import { getSupabaseClient } from "@/lib/supabase";
import { CHARACTER_LIMIT_OPTIONS, TONE_OPTIONS } from "@/lib/tool-options";
import {
  readSnsComposerProgress,
  writeSnsComposerProgress,
} from "@/lib/phase14-sns-progress";

const GOAL_OPTIONS: readonly { value: SocialGoal; label: string }[] = [
  { value: "article_traffic", label: "記事・ブログへの導線" },
  { value: "engagement", label: "交流・反応を増やす" },
  { value: "product_interest", label: "商品・有料コンテンツへの関心" },
  { value: "profile_growth", label: "プロフィール・フォロー導線" },
  { value: "community", label: "コミュニティ・会話づくり" },
  { value: "lead_generation", label: "相談・問い合わせ導線" },
  { value: "brand_awareness", label: "認知・専門テーマの定着" },
];

export function Phase14SnsPage() {
  const { state: accessState, client } = useSharedAccessState();
  const { preference: workspacePreference } = useWorkspacePreset();
  const userId = accessState.kind === "ready" ? accessState.profile.id : "";
  const [loadError, setLoadError] = useState("");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [articleId, setArticleId] = useState("");
  const [detail, setDetail] = useState<ArticleDetail | null>(null);
  const [platform, setPlatform] = useState<SocialPlatform>("x");
  const [goal, setGoal] = useState<SocialGoal>("article_traffic");
  const [tone, setTone] = useState("親しみやすく具体的");
  const [maxCharacters, setMaxCharacters] = useState("140");
  const [hashtags, setHashtags] = useState(true);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generatedFingerprint, setGeneratedFingerprint] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const generateInFlightRef = useRef(false);
  const workspacePresetAppliedRef = useRef(false);
  const progressOwnerRef = useRef("");
  const restoredProgressRef = useRef(false);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState("");

  useEffect(() => {
    if (!userId || !client) return;
    let active = true;
    progressOwnerRef.current = "";
    workspacePresetAppliedRef.current = false;

    const boot = async () => {
      const restored = readSnsComposerProgress(userId);
      let nextArticles: ArticleSummary[] = [];
      let nextLoadError = "";
      let nextDetail: ArticleDetail | null = null;
      let restoreMessage = "";

      try {
        nextArticles = await listCloudArticles(client, userId, 200);
      } catch (error) {
        nextLoadError = error instanceof Error ? error.message : "記事ライブラリを読み込めませんでした。";
      }

      if (restored?.articleId) {
        try {
          nextDetail = await getCloudArticleDetail(client, userId, restored.articleId);
        } catch {
          restoreMessage = "前回選択していた記事を読み込めなかったため、記事選択だけ解除しました。SNS条件は復元しています。";
        }
      }

      queueMicrotask(() => {
        if (!active) return;
        setArticles(nextArticles);
        setLoadError(nextLoadError);
        setArticleId(nextDetail ? restored?.articleId ?? "" : "");
        setDetail(nextDetail);
        setPlatform(restored?.platform ?? "x");
        setGoal(restored?.goal ?? "article_traffic");
        setTone(restored?.tone ?? "親しみやすく具体的");
        setMaxCharacters(restored?.maxCharacters ?? "140");
        setHashtags(restored?.hashtags ?? true);
        setGeneratedPrompt(nextDetail ? restored?.generatedPrompt ?? "" : "");
        setGeneratedFingerprint(nextDetail ? restored?.generatedFingerprint ?? "" : "");
        restoredProgressRef.current = Boolean(restored);
        progressOwnerRef.current = userId;
        setHydratedUserId(userId);
        setProgressHydrated(true);
        if (restoreMessage) {
          setMessage(restoreMessage);
        } else if (restored) {
          setMessage("前回のSNS投稿作成条件を復元しました。");
        }
      });
    };

    void boot();
    return () => { active = false; };
  }, [client, userId]);

  useEffect(() => {
    if (!progressHydrated || restoredProgressRef.current) return;
    if (workspacePresetAppliedRef.current || !workspacePreference?.applySns) return;
    workspacePresetAppliedRef.current = true;
    const preferred = ["x", "instagram", "threads", "tiktok", "youtube"].includes(
      workspacePresetSocialDefaults(workspacePreference, "x")?.preferredPlatform ?? "",
    )
      ? workspacePresetSocialDefaults(workspacePreference, "x")?.preferredPlatform
      : null;
    const nextPlatform = (preferred ?? "x") as SocialPlatform;
    const defaults = ["x", "instagram", "threads", "tiktok", "youtube"].includes(nextPlatform)
      ? workspacePresetSocialDefaults(workspacePreference, nextPlatform as "x" | "instagram" | "threads" | "tiktok" | "youtube")
      : null;
    queueMicrotask(() => {
      setPlatform(nextPlatform);
      if (defaults) setMaxCharacters(String(defaults.targetCharacters));
    });
  }, [progressHydrated, workspacePreference]);

  const changePlatform = (next: SocialPlatform) => {
    setPlatform(next);
    if (!workspacePreference?.applySns) return;
    if (!["x", "instagram", "threads", "tiktok", "youtube"].includes(next)) return;
    const defaults = workspacePresetSocialDefaults(
      workspacePreference,
      next as "x" | "instagram" | "threads" | "tiktok" | "youtube",
    );
    if (defaults) setMaxCharacters(String(defaults.targetCharacters));
  };

  const persistComposerProgress = useCallback(() => {
    if (!userId || !progressHydrated || progressOwnerRef.current !== userId) return;
    writeSnsComposerProgress(userId, {
      articleId,
      platform,
      goal,
      tone,
      maxCharacters,
      hashtags,
      generatedPrompt,
      generatedFingerprint,
    });
  }, [
    articleId,
    generatedFingerprint,
    generatedPrompt,
    goal,
    hashtags,
    maxCharacters,
    platform,
    progressHydrated,
    tone,
    userId,
  ]);

  useEffect(() => {
    persistComposerProgress();
  }, [persistComposerProgress]);

  useEffect(() => {
    if (!progressHydrated || progressOwnerRef.current !== userId) return;
    const persist = () => persistComposerProgress();
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persistComposerProgress();
    };
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [persistComposerProgress, progressHydrated, userId]);

  const loadArticle = async (id: string) => {
    if (accessState.kind !== "ready" || !client) return;
    setArticleId(id); setDetail(null); setGeneratedPrompt(""); setGeneratedFingerprint(""); setMessage("");
    if (!id) return;
    setBusy(true);
    try { setDetail(await getCloudArticleDetail(client, accessState.profile.id, id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "記事を読み込めませんでした。"); }
    finally { setBusy(false); }
  };

  const promptFingerprint = useMemo(() => detail ? JSON.stringify({ id: detail.id, revision: detail.revision, platform, goal, tone, maxCharacters, hashtags }) : "", [detail, goal, hashtags, maxCharacters, platform, tone]);
  const promptReady = Boolean(generatedPrompt) && generatedFingerprint === promptFingerprint;

  const generatePrompt = async () => {
    if (!detail || generateInFlightRef.current) return;

    const trimmedMax = maxCharacters.trim();
    let parsedMax: number | null = null;
    if (trimmedMax) {
      const candidate = Number(trimmedMax);
      if (!Number.isFinite(candidate) || candidate < 1 || candidate > 100000) {
        setMessage("編集上の文字数目安は1〜100000の数字で入力してください。無効な入力では利用回数を消費しません。");
        return;
      }
      parsedMax = Math.trunc(candidate);
    }

    generateInFlightRef.current = true; setGenerateBusy(true); setMessage("");
    try {
      const result = await consumeFreeTrialUsage(getSupabaseClient(), "sns_generate");
      if (!result.allowed) { setGeneratedPrompt(""); setGeneratedFingerprint(""); setMessage(trialUsageMessage(result)); return; }
      const prompt = buildSocialPrompt(detail, {
        platform, goal, tone,
        maxCharacters: parsedMax,
        hashtags,
      });
      setGeneratedPrompt(prompt); setGeneratedFingerprint(promptFingerprint);
      setMessage(result.bypassLimits ? "SNS投稿プロンプトを作成しました。" : `SNS投稿プロンプトを1回作成しました。${trialUsageMessage(result)}`);
    } catch (error) {
      setGeneratedPrompt(""); setGeneratedFingerprint("");
      setMessage(error instanceof Error ? error.message : "SNS投稿作成の利用回数を確認できませんでした。");
    } finally { generateInFlightRef.current = false; setGenerateBusy(false); }
  };

  const copy = async () => {
    if (!promptReady) return;
    try { await navigator.clipboard.writeText(generatedPrompt); setMessage("SNS投稿生成プロンプトをコピーしました。"); }
    catch { setMessage("自動コピーできません。テキスト欄からコピーしてください。"); }
  };

  if (accessState.kind === "loading") {
    return <AppLoadingScreen message="SNS投稿作成を準備しています…" />;
  }

  if (accessState.kind !== "ready" || !client) return (
    <main className="standalone-page"><section className="standalone-card">
      <p className="eyebrow">SNS CONTENT</p><h1>SNS投稿作成</h1>
      {accessState.kind === "unavailable" && <p className="route-notice error">AASへ接続できませんでした。通信状態を確認してください。</p>}
      {accessState.kind === "signed_out" && <p className="route-notice error">先にログインしてください。</p>}
      {accessState.kind === "pending" && <p className="route-notice">アカウント承認後に利用できます。</p>}
      {(accessState.kind === "suspended" || accessState.kind === "disabled") && <p className="route-notice error">現在のアカウント状態では利用できません。</p>}
      {accessState.kind === "entitlement_denied" && <p className="route-notice error">PWA利用権が必要です。</p>}
      <Link className="route-back" href="/tools">← 機能一覧へ戻る</Link>
    </section></main>
  );

  if (!progressHydrated || hydratedUserId !== userId) {
    return <AppLoadingScreen message="SNS投稿作成の作業状態を復元しています…" />;
  }

  return (
    <main className="creator-page">
      <header className="creator-head">
        <div><p className="eyebrow">SNS CONTENT</p><h1>記事からSNS投稿を作る</h1><p>{accessState.profile.aas_user_id} / SNSごとの投稿プロンプトを選択式で作成できます</p></div>
        <Link className="route-back" href="/tools">← 機能一覧</Link>
      </header>
      <ActiveWorkspacePresetBadge feature="sns" />

      {loadError && <div className="route-notice error" role="alert">{loadError}</div>}
      <section className="creator-card">
        <div className="creator-form-grid">
          <label className="route-field full"><span>元記事</span><select value={articleId} onChange={(event) => void loadArticle(event.target.value)} disabled={busy || generateBusy}><option value="">記事を選択</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}</select></label>
          <label className="route-field"><span>SNS</span><select value={platform} onChange={(event) => changePlatform(event.target.value as SocialPlatform)}>{SOCIAL_PLATFORM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="route-field"><span>目的</span><select value={goal} onChange={(event) => setGoal(event.target.value as SocialGoal)}>{GOAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <PresetSelect label="トーン" value={tone} onChange={setTone} options={TONE_OPTIONS} customPlaceholder="例: 静かで落ち着いた専門家風" />
          <PresetSelect label="編集上の文字数目安" value={maxCharacters} onChange={setMaxCharacters} options={CHARACTER_LIMIT_OPTIONS} customPlaceholder="数字を入力（例: 2500）" customInputType="number" customMin={1} customMax={100000} />
          <label className="choice-card compact"><input type="checkbox" checked={hashtags} onChange={(event) => setHashtags(event.target.checked)} /><span><strong>ハッシュタグ候補を含める</strong></span></label>
        </div>

        <div className="route-notice">
          <strong>{socialPlatformLabel(platform)}を開く:</strong>{" "}
          <a href={socialPlatformUrl(platform)} target="_blank" rel="noreferrer">{socialPlatformLabel(platform)}を開く ↗</a>
          <div><small>{socialLaunchHint()}</small></div>
        </div>

        {detail && <>
          <div className="route-notice"><strong>選択中:</strong> {detail.title}</div>
          <p className="panel-muted">記事選択やSNS条件の変更だけでは回数を消費しません。「SNS投稿プロンプトを作成」を押した時だけSNS生成1回として記録されます。</p>
          <button className="primary-action" type="button" disabled={generateBusy} onClick={() => void generatePrompt()}>{generateBusy ? "利用回数を確認中…" : promptReady ? "SNS投稿プロンプトを作り直す" : "SNS投稿プロンプトを作成"}</button>
          {promptReady && <>
            <label className="route-field"><span>AI用SNS投稿プロンプト</span><textarea className="prompt-area large" readOnly value={generatedPrompt} /></label>
            <button className="secondary-action" type="button" onClick={() => void copy()}>プロンプトをコピー</button>
            <p className="beginner-help">生成後のコピーでは追加消費しません。再読み込みからの復元では追加消費しません。条件を変えて作り直した時だけ次の1回として記録されます。</p>
          </>}
        </>}
        {!detail && articles.length === 0 && <p className="panel-muted">記事ライブラリに記事がありません。先に記事を作成してください。</p>}
        {message && <div className="route-notice">{message}</div>}
      </section>
    </main>
  );
}
