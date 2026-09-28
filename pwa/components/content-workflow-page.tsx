"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { PresetNumberSelectWithCustom, SelectWithCustom } from "@/components/select-with-custom";
import { ActiveWorkspacePresetBadge } from "@/features/presets/active-workspace-preset-badge";
import { workspacePresetSocialDefaults, workspacePresetWorkflowDefaults } from "@/features/presets/preset-adapters";
import { useWorkspacePreset } from "@/features/presets/workspace-preset-provider";
import { launchAiApp } from "@/lib/ai-app-links";
import {
  buildArticleReusePrompt,
  buildPrePublishReviewPrompt,
  buildSeriesPlanPrompt,
  buildWorkflowTasks,
  deleteContentSeriesPlan,
  extractSeriesPlanFromAi,
  listContentSeriesPlans,
  runPrePublishChecks,
  saveContentSeriesPlan,
  seriesArticleCreateHref,
  type ContentSeriesPlan,
  type ReuseChannelPlan,
  type ReusePlatform,
  type SeriesPlatform,
} from "@/features/workflow";
import {
  listNoteSchedule,
  setNoteScheduleStatus,
  todayJstDateKey,
  type NoteScheduleItem,
} from "@/features/note";
import {
  getCloudArticleDetail,
  listCloudArticles,
  type ArticleDetail,
  type ArticleSummary,
} from "@/features/article";
import { getSupabaseClient } from "@/lib/supabase";
import { AI_PROVIDER_LABELS, type AiProvider } from "@/lib/user-personalization";

type WorkflowTab = "today" | "preflight" | "reuse" | "series";

const REUSE_PLATFORM_OPTIONS: readonly { value: ReusePlatform; label: string; chars: number; delay: number }[] = [
  { value: "x", label: "X", chars: 280, delay: 0 },
  { value: "threads", label: "Threads", chars: 500, delay: 1 },
  { value: "instagram", label: "Instagram", chars: 300, delay: 2 },
  { value: "tiktok", label: "TikTok", chars: 150, delay: 3 },
  { value: "youtube", label: "YouTube Shorts", chars: 300, delay: 4 },
] as const;

const SERIES_AUDIENCES = [
  "そのジャンルの完全初心者",
  "会社員・働く人",
  "副業を始めたい人",
  "クリエイター・発信者",
  "個人事業主・経営者",
  "幅広い読者",
] as const;

const SERIES_PURPOSES = [
  "初心者が順番に学べるシリーズ",
  "実践記録・検証シリーズ",
  "専門性を体系的に伝える",
  "無料記事から有料記事へ自然につなぐ",
  "検索・SNSから継続して読まれる導線を作る",
] as const;

const SERIES_MONETIZATION = [
  "無料記事中心",
  "無料記事から有料記事へ自然につなぐ",
  "一部を有料の深掘り記事にする",
  "収益化せず継続発信を優先",
] as const;

function formatDate(value: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function copyText(value: string): Promise<void> {
  if (!value.trim()) throw new Error("コピーする内容がありません。");
  await navigator.clipboard.writeText(value);
}

export function ContentWorkflowPage() {
  const { state } = useSharedAccessState();
  const { preference: workspacePreference } = useWorkspacePreset();
  const [tab, setTab] = useState<WorkflowTab>("today");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [schedule, setSchedule] = useState<NoteScheduleItem[]>([]);
  const [series, setSeries] = useState<ContentSeriesPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [preflightArticleId, setPreflightArticleId] = useState("");
  const [preflightDetail, setPreflightDetail] = useState<ArticleDetail | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);

  const [reuseArticleId, setReuseArticleId] = useState("");
  const [reuseDetail, setReuseDetail] = useState<ArticleDetail | null>(null);
  const [reuseBusy, setReuseBusy] = useState(false);
  const [reuseChannels, setReuseChannels] = useState<ReuseChannelPlan[]>(
    REUSE_PLATFORM_OPTIONS.map((item) => ({
      platform: item.value,
      targetChars: item.chars,
      delayDays: item.delay,
    })),
  );
  const [reuseEnabled, setReuseEnabled] = useState<Record<ReusePlatform, boolean>>({
    x: true,
    threads: true,
    instagram: true,
    tiktok: false,
    youtube: false,
  });

  const [provider, setProvider] = useState<AiProvider>("chatgpt");
  const [seriesPlatform, setSeriesPlatform] = useState<SeriesPlatform>("note");
  const [seriesName, setSeriesName] = useState("");
  const [seriesAudience, setSeriesAudience] = useState<string>(SERIES_AUDIENCES[0]);
  const [seriesPurpose, setSeriesPurpose] = useState<string>(SERIES_PURPOSES[0]);
  const [seriesMonetization, setSeriesMonetization] = useState<string>(SERIES_MONETIZATION[1]);
  const [seriesCount, setSeriesCount] = useState(6);
  const [seriesResponse, setSeriesResponse] = useState("");
  const [seriesBusy, setSeriesBusy] = useState(false);
  const workspacePresetAppliedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    const article = params.get("article") ?? "";
    queueMicrotask(() => {
      if (!active) return;
      if (requested === "preflight" || requested === "reuse" || requested === "series" || requested === "today") {
        setTab(requested);
      }
      if (requested === "preflight") setPreflightArticleId(article);
      if (requested === "reuse") setReuseArticleId(article);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (workspacePresetAppliedRef.current || !workspacePreference?.applyWorkflow) return;
    workspacePresetAppliedRef.current = true;
    const workflowDefaults = workspacePresetWorkflowDefaults(workspacePreference);
    if (!workflowDefaults) return;
    queueMicrotask(() => {
      setSeriesCount(workflowDefaults.defaultSeriesCount);
      setReuseChannels((current) => current.map((item) => {
        const social = workspacePresetSocialDefaults(workspacePreference, item.platform);
        return {
          ...item,
          targetChars: social?.targetCharacters ?? item.targetChars,
          delayDays: workflowDefaults.reuseDelayDays[item.platform],
        };
      }));
    });
  }, [workspacePreference]);

  const ownerId = state.kind === "ready" ? state.profile.id : "";

  const reload = useCallback(async () => {
    if (!ownerId) return;
    queueMicrotask(() => setLoading(true));
    try {
      const client = getSupabaseClient();
      const today = todayJstDateKey();
      const [nextArticles, nextSchedule, nextSeries] = await Promise.all([
        listCloudArticles(client, ownerId, 200),
        listNoteSchedule(client, ownerId, today, today),
        listContentSeriesPlans(client, ownerId),
      ]);
      setArticles(nextArticles);
      setSchedule(nextSchedule);
      setSeries(nextSeries);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "運営データを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void reload();
    });
    return () => { active = false; };
  }, [ownerId, reload]);

  useEffect(() => {
    let active = true;
    if (!preflightArticleId || !ownerId) {
      queueMicrotask(() => {
        if (active) setPreflightDetail(null);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (active) setPreflightBusy(true);
    });
    void getCloudArticleDetail(getSupabaseClient(), ownerId, preflightArticleId).then(
      (detail) => {
        if (active) setPreflightDetail(detail);
      },
      (error) => {
        if (active) setMessage(error instanceof Error ? error.message : "記事を読み込めませんでした。");
      },
    ).finally(() => {
      if (active) setPreflightBusy(false);
    });
    return () => { active = false; };
  }, [preflightArticleId, ownerId]);

  useEffect(() => {
    let active = true;
    if (!reuseArticleId || !ownerId) {
      queueMicrotask(() => {
        if (active) setReuseDetail(null);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (active) setReuseBusy(true);
    });
    void getCloudArticleDetail(getSupabaseClient(), ownerId, reuseArticleId).then(
      (detail) => {
        if (active) setReuseDetail(detail);
      },
      (error) => {
        if (active) setMessage(error instanceof Error ? error.message : "記事を読み込めませんでした。");
      },
    ).finally(() => {
      if (active) setReuseBusy(false);
    });
    return () => { active = false; };
  }, [reuseArticleId, ownerId]);

  const tasks = useMemo(
    () => buildWorkflowTasks(articles, schedule, series, todayJstDateKey()),
    [articles, schedule, series],
  );
  const preflightReport = useMemo(
    () => preflightDetail ? runPrePublishChecks(preflightDetail) : null,
    [preflightDetail],
  );
  const preflightPrompt = preflightDetail && preflightReport
    ? buildPrePublishReviewPrompt(preflightDetail, preflightReport)
    : "";
  const enabledReuseChannels = useMemo(
    () => reuseChannels.filter((item) => reuseEnabled[item.platform]),
    [reuseChannels, reuseEnabled],
  );
  const reusePrompt = reuseDetail
    ? buildArticleReusePrompt(reuseDetail, enabledReuseChannels)
    : "";
  const seriesPrompt = buildSeriesPlanPrompt({
    platform: seriesPlatform,
    name: seriesName,
    audience: seriesAudience,
    purpose: seriesPurpose,
    monetization: seriesMonetization,
    articleCount: seriesCount,
  });

  const changeTab = (next: WorkflowTab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    params.delete("article");
    window.history.replaceState({}, "", `/workflow?${params.toString()}`);
  };

  const markSchedule = async (item: NoteScheduleItem, status: "done" | "skipped") => {
    if (state.kind !== "ready" || !item.id) return;
    try {
      await setNoteScheduleStatus(getSupabaseClient(), state.profile.id, item.id, status);
      setSchedule((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
      setMessage(status === "done" ? "今日の予定を完了にしました。" : "今日の予定をスキップにしました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "予定を更新できませんでした。");
    }
  };

  const copyAndLaunch = async (prompt: string, label: string) => {
    try {
      await copyText(prompt);
      setMessage(`${label}をコピーしました。AIで実行してください。`);
      launchAiApp(provider);
    } catch {
      setMessage("自動コピーできませんでした。プロンプト欄から手動でコピーしてください。");
    }
  };

  const importAndSaveSeries = async () => {
    if (state.kind !== "ready") return;
    setSeriesBusy(true);
    setMessage("");
    try {
      const draft = extractSeriesPlanFromAi(seriesResponse, {
        userId: state.profile.id,
        platform: seriesPlatform,
        name: seriesName,
        audience: seriesAudience,
        purpose: seriesPurpose,
        monetization: seriesMonetization,
      });
      const saved = await saveContentSeriesPlan(getSupabaseClient(), draft);
      setSeries((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSeriesResponse("");
      setSeriesName(saved.name);
      setMessage(`「${saved.name}」をシリーズ計画へ保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "シリーズ計画を保存できませんでした。");
    } finally {
      setSeriesBusy(false);
    }
  };

  const updateSeriesStatus = async (plan: ContentSeriesPlan, status: ContentSeriesPlan["status"]) => {
    if (state.kind !== "ready") return;
    setSeriesBusy(true);
    try {
      const saved = await saveContentSeriesPlan(getSupabaseClient(), { ...plan, status }, plan.id);
      setSeries((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage("シリーズの状態を更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "シリーズ状態を更新できませんでした。");
    } finally {
      setSeriesBusy(false);
    }
  };

  const removeSeries = async (plan: ContentSeriesPlan) => {
    if (state.kind !== "ready") return;
    if (!window.confirm(`「${plan.name}」を削除しますか？ 記事そのものは削除されません。`)) return;
    setSeriesBusy(true);
    try {
      await deleteContentSeriesPlan(getSupabaseClient(), state.profile.id, plan.id);
      setSeries((current) => current.filter((item) => item.id !== plan.id));
      setMessage("シリーズ計画を削除しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "シリーズ計画を削除できませんでした。");
    } finally {
      setSeriesBusy(false);
    }
  };

  if (state.kind !== "ready") {
    return (
      <main className="standalone-page"><section className="standalone-card">
        <p className="eyebrow">CONTENT WORKFLOW</p>
        <h1>AAS運営自動化</h1>
        {state.kind === "signed_out" && <p className="route-notice error">先にログインしてください。</p>}
        {state.kind !== "loading" && state.kind !== "signed_out" && <p className="route-notice error">activeなAASアカウントと利用権が必要です。</p>}
        <Link className="route-back" href="/">← ホーム</Link>
      </section></main>
    );
  }

  return (
    <main className="creator-page workflow-page">
      <header className="creator-head">
        <div>
          <p className="eyebrow">CONTENT LIFECYCLE</p>
          <h1>AAS運営コックピット</h1>
          <p>計画 → 記事 → 公開前確認 → SNS再利用 → シリーズ化を1つの流れで管理します。</p>
        </div>
        <Link className="route-back" href="/">← ホーム</Link>
      </header>

      <ActiveWorkspacePresetBadge feature="workflow" />

      <nav className="workflow-tabs" aria-label="運営自動化メニュー">
        <button className={tab === "today" ? "active" : ""} type="button" onClick={() => changeTab("today")}>今日やること</button>
        <button className={tab === "preflight" ? "active" : ""} type="button" onClick={() => changeTab("preflight")}>公開前チェック</button>
        <button className={tab === "reuse" ? "active" : ""} type="button" onClick={() => changeTab("reuse")}>記事→SNS再利用</button>
        <button className={tab === "series" ? "active" : ""} type="button" onClick={() => changeTab("series")}>シリーズ設計</button>
      </nav>

      {message && <div className="route-notice workflow-message" role="status">{message}</div>}

      {tab === "today" && (
        <section className="workflow-panel">
          <div className="workflow-panel-head">
            <div><span>TODAY</span><h2>今日やること</h2><p>note運営予定・下書き・公開前記事・再告知・シリーズの次回記事から自動整理します。</p></div>
            <button type="button" disabled={loading} onClick={() => void reload()}>{loading ? "更新中…" : "再読み込み"}</button>
          </div>

          <div className="workflow-metrics">
            <div><span>今日のnote予定</span><strong>{schedule.filter((item) => item.status === "planned").length}</strong></div>
            <div><span>下書き・執筆中</span><strong>{articles.filter((item) => item.status === "draft" || item.status === "writing").length}</strong></div>
            <div><span>公開準備</span><strong>{articles.filter((item) => item.status === "ready" || item.status === "waiting_publish").length}</strong></div>
            <div><span>進行中シリーズ</span><strong>{series.filter((item) => item.status === "planning" || item.status === "active").length}</strong></div>
          </div>

          {schedule.some((item) => item.status === "planned") && (
            <div className="workflow-today-schedule">
              <h3>今日のnote運営予定</h3>
              {schedule.filter((item) => item.status === "planned").map((item) => (
                <div key={item.id ?? `${item.scheduledTime}:${item.title}`}>
                  <span><b>{item.scheduledTime}</b><strong>{item.title}</strong><small>{item.theme}</small></span>
                  <span className="workflow-task-actions">
                    <button type="button" onClick={() => void markSchedule(item, "done")}>完了</button>
                    <button type="button" onClick={() => void markSchedule(item, "skipped")}>スキップ</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="workflow-task-list">
            {tasks.length ? tasks.map((task) => (
              <Link key={task.id} className={`workflow-task ${task.priority}`} href={task.href}>
                <span>{task.kind === "preflight" ? "✓" : task.kind === "reuse" ? "↗" : task.kind === "series" ? "▤" : task.kind === "schedule" ? "◷" : "✎"}</span>
                <span><strong>{task.title}</strong><small>{task.detail}</small></span>
                <b>›</b>
              </Link>
            )) : (
              <div className="support-empty">今日の自動タスクはありません。新しい記事やシリーズを作ることもできます。</div>
            )}
          </div>

          <div className="workflow-quick-actions">
            <Link href="/create">＋ 記事を作る</Link>
            <Link href="/note-operations">note運営計画</Link>
            <button type="button" onClick={() => changeTab("series")}>シリーズを設計</button>
          </div>
        </section>
      )}

      {tab === "preflight" && (
        <section className="workflow-panel">
          <div className="workflow-panel-head">
            <div><span>PRE-PUBLISH</span><h2>公開前チェックセンター</h2><p>AAS内で機械的に確認できる項目を先に洗い出し、最終判断はユーザーが行います。</p></div>
          </div>
          <label className="workflow-field">
            <span>確認する記事</span>
            <select value={preflightArticleId} onChange={(event) => setPreflightArticleId(event.target.value)}>
              <option value="">記事を選択</option>
              {articles.map((article) => <option key={article.id} value={article.id}>{article.title} / {article.status}</option>)}
            </select>
          </label>

          {preflightBusy && <div className="reference-route-loading"><span /><small>記事確認中</small></div>}
          {preflightDetail && preflightReport && (
            <>
              <div className="workflow-preflight-summary">
                <div className={preflightReport.blockers ? "danger" : "ok"}><span>公開停止候補</span><strong>{preflightReport.blockers}</strong></div>
                <div className={preflightReport.reviews ? "review" : "ok"}><span>人の確認</span><strong>{preflightReport.reviews}</strong></div>
                <div className="ok"><span>確認済み</span><strong>{preflightReport.passes}</strong></div>
              </div>
              <p className={preflightReport.readyForManualPublish ? "workflow-readiness ready" : "workflow-readiness blocked"}>
                {preflightReport.readyForManualPublish
                  ? "自動チェック上の公開停止項目はありません。残りの確認項目を人が確認してください。"
                  : "公開前に解消した方がよい停止項目があります。"}
              </p>
              <div className="workflow-checks">
                {preflightReport.checks.map((check) => (
                  <article key={check.id} className={check.severity}>
                    <span>{check.severity === "pass" ? "✓" : check.severity === "review" ? "!" : "×"}</span>
                    <div><strong>{check.label}</strong><p>{check.detail}</p></div>
                  </article>
                ))}
              </div>
              <div className="workflow-prompt-actions">
                <select value={provider} onChange={(event) => setProvider(event.target.value as AiProvider)}>
                  {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((key) => <option key={key} value={key}>{AI_PROVIDER_LABELS[key]}</option>)}
                </select>
                <button type="button" onClick={() => void copyAndLaunch(preflightPrompt, "公開前レビュー用プロンプト")}>AIで追加確認</button>
                <Link href="/?section=library">記事を修正</Link>
                <Link href="/publish">公開管理へ</Link>
              </div>
              <details className="workflow-prompt-details"><summary>公開前レビュー用プロンプトを確認</summary><textarea readOnly value={preflightPrompt} /></details>
            </>
          )}
        </section>
      )}

      {tab === "reuse" && (
        <section className="workflow-panel">
          <div className="workflow-panel-head">
            <div><span>REPURPOSE</span><h2>記事 → SNS再利用</h2><p>1本の記事から媒体別の告知・再告知へ展開し、同じ文面の使い回しを減らします。</p></div>
          </div>
          <label className="workflow-field">
            <span>元記事</span>
            <select value={reuseArticleId} onChange={(event) => setReuseArticleId(event.target.value)}>
              <option value="">記事を選択</option>
              {articles.map((article) => <option key={article.id} value={article.id}>{article.title} / {article.status}</option>)}
            </select>
          </label>

          {reuseBusy && <div className="reference-route-loading"><span /><small>記事読込中</small></div>}

          <div className="workflow-reuse-grid">
            {REUSE_PLATFORM_OPTIONS.map((platform) => {
              const plan = reuseChannels.find((item) => item.platform === platform.value) ?? {
                platform: platform.value,
                targetChars: platform.chars,
                delayDays: platform.delay,
              };
              return (
                <article key={platform.value} className={reuseEnabled[platform.value] ? "enabled" : ""}>
                  <label className="workflow-toggle"><input type="checkbox" checked={reuseEnabled[platform.value]} onChange={(event) => setReuseEnabled((current) => ({ ...current, [platform.value]: event.target.checked }))} /><strong>{platform.label}</strong></label>
                  <PresetNumberSelectWithCustom
                    label="目標文字数"
                    value={plan.targetChars}
                    disabled={!reuseEnabled[platform.value]}
                    presets={[100, 150, 280, 300, 500, 1000, 2000, 5000, 10000]}
                    min={1}
                    max={25000}
                    suffix="文字"
                    onChange={(targetChars) => setReuseChannels((current) => current.map((item) => item.platform === platform.value ? { ...item, targetChars } : item))}
                  />
                  <PresetNumberSelectWithCustom
                    label="公開から何日後"
                    value={plan.delayDays}
                    disabled={!reuseEnabled[platform.value]}
                    presets={[0, 1, 2, 3, 4, 5, 7, 10, 14, 21, 30]}
                    min={0}
                    max={30}
                    suffix="日"
                    onChange={(delayDays) => setReuseChannels((current) => current.map((item) => item.platform === platform.value ? { ...item, delayDays } : item))}
                  />
                </article>
              );
            })}
          </div>

          {reuseDetail && (
            <>
              <div className="workflow-prompt-actions">
                <select value={provider} onChange={(event) => setProvider(event.target.value as AiProvider)}>
                  {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((key) => <option key={key} value={key}>{AI_PROVIDER_LABELS[key]}</option>)}
                </select>
                <button type="button" disabled={!enabledReuseChannels.length} onClick={() => void copyAndLaunch(reusePrompt, "SNS再利用プロンプト")}>再利用プロンプトをコピーしてAIを開く</button>
                <Link href="/sns">単発SNS投稿作成</Link>
              </div>
              <details className="workflow-prompt-details"><summary>SNS再利用プロンプトを確認</summary><textarea readOnly value={reusePrompt} /></details>
            </>
          )}
        </section>
      )}

      {tab === "series" && (
        <section className="workflow-panel">
          <div className="workflow-panel-head">
            <div><span>SERIES PLANNER</span><h2>記事シリーズ・マガジン設計</h2><p>単発記事ではなく、無料/有料の役割と読む順番を含めたシリーズ全体を先に設計します。</p></div>
          </div>

          <div className="workflow-series-form">
            <label><span>掲載先</span><select value={seriesPlatform} onChange={(event) => setSeriesPlatform(event.target.value as SeriesPlatform)}><option value="note">note</option><option value="tips">Tips</option><option value="brain">Brain</option><option value="blog">ブログ</option></select></label>
            <label><span>シリーズ名</span><input value={seriesName} maxLength={200} onChange={(event) => setSeriesName(event.target.value)} placeholder="空欄でもAIに提案してもらえます" /></label>
            <SelectWithCustom
              label="想定読者"
              value={seriesAudience}
              onChange={setSeriesAudience}
              options={SERIES_AUDIENCES}
              customPlaceholder="その他の想定読者を入力"
            />
            <SelectWithCustom
              label="シリーズの目的"
              value={seriesPurpose}
              onChange={setSeriesPurpose}
              options={SERIES_PURPOSES}
              customPlaceholder="その他の目的を入力"
            />
            <SelectWithCustom
              label="収益化方針"
              value={seriesMonetization}
              onChange={setSeriesMonetization}
              options={SERIES_MONETIZATION}
              customPlaceholder="その他の収益化方針を入力"
            />
            <PresetNumberSelectWithCustom
              label="記事数"
              value={seriesCount}
              onChange={setSeriesCount}
              presets={[3, 4, 5, 6, 8, 10, 12, 15, 20]}
              min={1}
              max={100}
              suffix="記事"
            />
          </div>

          <div className="workflow-prompt-actions">
            <select value={provider} onChange={(event) => setProvider(event.target.value as AiProvider)}>
              {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((key) => <option key={key} value={key}>{AI_PROVIDER_LABELS[key]}</option>)}
            </select>
            <button type="button" onClick={() => void copyAndLaunch(seriesPrompt, "シリーズ設計プロンプト")}>シリーズ設計プロンプトをコピーしてAIを開く</button>
          </div>
          <details className="workflow-prompt-details"><summary>シリーズ設計プロンプトを確認</summary><textarea readOnly value={seriesPrompt} /></details>

          <label className="workflow-field">
            <span>AI回答を貼り付けてクラウド保存</span>
            <textarea value={seriesResponse} onChange={(event) => setSeriesResponse(event.target.value)} placeholder="ChatGPT / Gemini / ClaudeのJSON回答全文を貼り付け" />
          </label>
          <button className="primary-action" type="button" disabled={seriesBusy || !seriesResponse.trim()} onClick={() => void importAndSaveSeries()}>
            {seriesBusy ? "保存中…" : "AI回答を読み込んでシリーズ保存"}
          </button>

          <div className="workflow-series-list">
            <div className="workflow-panel-head compact"><div><span>SAVED SERIES</span><h3>保存済みシリーズ</h3></div><small>{series.length}件</small></div>
            {series.length === 0 ? <div className="support-empty">保存済みシリーズはありません。</div> : series.map((plan) => (
              <article key={plan.id} className="workflow-series-card">
                <header>
                  <div><strong>{plan.name}</strong><small>{plan.platform} / {plan.items.length}記事 / {formatDate(plan.updatedAt)}</small></div>
                  <select value={plan.status} disabled={seriesBusy} onChange={(event) => void updateSeriesStatus(plan, event.target.value as ContentSeriesPlan["status"])}><option value="planning">設計中</option><option value="active">進行中</option><option value="completed">完了</option><option value="archived">アーカイブ</option></select>
                </header>
                <p>{plan.purpose}</p>
                <ol>
                  {plan.items.map((item) => (
                    <li key={`${plan.id}:${item.order}`}>
                      <span><b>#{item.order}</b><strong>{item.title}</strong><small>{item.articleType === "paid" ? "有料" : "無料"} / {item.role}</small></span>
                      <Link href={seriesArticleCreateHref(plan, item)}>この記事を作る ›</Link>
                    </li>
                  ))}
                </ol>
                <button className="workflow-delete" type="button" disabled={seriesBusy} onClick={() => void removeSeries(plan)}>シリーズ計画を削除</button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
