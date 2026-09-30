"use client";

import { useEffect, useMemo, useState } from "react";

import { launchAiApp } from "@/lib/ai-app-links";
import { PresetNumberSelectWithCustom, SelectWithCustom } from "@/components/select-with-custom";
import { KnowledgeDiffSummary } from "@/components/knowledge-refresh/knowledge-diff-summary";
import { KnowledgeChannelGuide, KnowledgeRefreshHistory } from "@/components/knowledge-refresh/knowledge-refresh-static-sections";
import { KnowledgeQualityAnalyzer } from "@/components/knowledge-refresh/knowledge-quality-analyzer";
import { KnowledgeSourceHealthPanel } from "@/components/knowledge-refresh/knowledge-source-health-panel";
import {
  formatKnowledgeDate,
  knowledgeAutomationActionLabel,
  knowledgeRefreshStatusLabel,
} from "@/components/knowledge-refresh/knowledge-refresh-display";
import {
  adminGetKnowledgeAutomationAiConfig,
  adminGetKnowledgeAutomationStatus,
  adminGetKnowledgeProductionHealth,
  adminGetKnowledgeRefreshChannels,
  adminGetKnowledgeSourceRiskReport,
  adminListKnowledgeAutomationCandidates,
  adminListKnowledgeAutomationSources,
  adminListKnowledgeRefreshRequests,
  adminPreviewKnowledgeRefreshBundleDiff,
  adminPrepareSourceDiversityResearch,
  adminPublishKnowledgeRefreshBundle,
  adminRequestKnowledgeAutomationRun,
  adminRequestKnowledgeRefresh,
  adminRetryKnowledgeAutomationCandidateAi,
  adminReviewKnowledgeAutomationCandidate,
  adminSetKnowledgeAutomationAiConfig,
  adminSetKnowledgeAutomationSourceEnabled,
  adminStartKnowledgeRefresh,
  buildKnowledgeAutomationCandidateBundle,
  buildKnowledgeRefreshResearchPrompt,
  parseKnowledgeRefreshBundle,
  type KnowledgeAutomationAiConfig,
  type KnowledgeAutomationCandidate,
  type KnowledgeAutomationSource,
  type KnowledgeAutomationStatus,
  type KnowledgeProductionHealth,
  type KnowledgeRefreshChannelState,
  type KnowledgeRefreshDiff,
  type KnowledgeRefreshRequest,
  type KnowledgeSourceRiskReport,
} from "@/lib/knowledge-auto-update";
import { getSupabaseClient } from "@/lib/supabase";

function candidateAnalysisPresentation(
  candidate: KnowledgeAutomationCandidate,
  config: KnowledgeAutomationAiConfig | null,
): { className: string; label: string; note: string } {
  if (candidate.analysisStatus === "failed") {
    return { className: "failed", label: "解析失敗", note: "エラー内容を確認して再試行できます。" };
  }
  if (candidate.analysisStatus === "completed") {
    return candidate.analysisProvider === "deterministic"
      ? { className: "deterministic", label: "自動判定済み", note: "モデルAPIを使わずに安全な定型判定を完了しています。" }
      : { className: "completed", label: "AI解析完了", note: "提案内容は管理者レビュー後も自動公開されません。" };
  }
  if (candidate.candidateAction === "recheck" || candidate.candidateAction === "retire") {
    return { className: "automatic", label: "自動判定待ち", note: "次回Worker実行でモデルAPIを使わずに判定します。" };
  }
  if (!config?.enabled) {
    return { className: "held", label: "AI OFF・手動確認待ち", note: "AI APIは呼び出しません。公式ソース監視だけ継続しています。" };
  }
  if (!config.apiKeyConfigured) {
    return { className: "held", label: "APIキー未設定・保留", note: "APIキーをVaultへ設定するまでAI APIは呼び出しません。" };
  }
  return { className: "pending", label: "AI解析待ち", note: "次回Worker実行で設定済みAIによる候補JSON生成を行います。" };
}

export function KnowledgeRefreshPanel() {
  const [requests, setRequests] = useState<KnowledgeRefreshRequest[]>([]);
  const [channels, setChannels] = useState<KnowledgeRefreshChannelState[]>([]);
  const [automationStatus, setAutomationStatus] = useState<KnowledgeAutomationStatus | null>(null);
  const [productionHealth, setProductionHealth] = useState<KnowledgeProductionHealth | null>(null);
  const [sourceRiskReport, setSourceRiskReport] = useState<KnowledgeSourceRiskReport | null>(null);
  const [automationSources, setAutomationSources] = useState<KnowledgeAutomationSource[]>([]);
  const [automationCandidates, setAutomationCandidates] = useState<KnowledgeAutomationCandidate[]>([]);
  const [automationAiConfig, setAutomationAiConfig] = useState<KnowledgeAutomationAiConfig | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState("gpt-5.6");
  const [aiMaxCandidates, setAiMaxCandidates] = useState(6);
  const [aiApiKey, setAiApiKey] = useState("");
  const [preparedAutomationCandidateId, setPreparedAutomationCandidateId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bundleText, setBundleText] = useState("");
  const [diffPreview, setDiffPreview] = useState<KnowledgeRefreshDiff | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  );
  const freshState = channels.find((channel) => channel.channel === "fresh") ?? null;
  const stableState = channels.find((channel) => channel.channel === "stable") ?? null;
  const candidateAnalysisSummary = useMemo(() => {
    let deterministicCompleted = 0;
    let aiCompleted = 0;
    let held = 0;
    let failed = 0;
    let automaticPending = 0;
    for (const candidate of automationCandidates) {
      if (candidate.analysisStatus === "failed") {
        failed += 1;
      } else if (candidate.analysisStatus === "completed") {
        if (candidate.analysisProvider === "deterministic") deterministicCompleted += 1;
        else aiCompleted += 1;
      } else if (candidate.candidateAction === "recheck" || candidate.candidateAction === "retire") {
        automaticPending += 1;
      } else {
        held += 1;
      }
    }
    return {
      total: automationCandidates.length,
      deterministicCompleted,
      aiCompleted,
      held,
      failed,
      automaticPending,
    };
  }, [automationCandidates]);
  const reload = async () => {
    const client = getSupabaseClient();
    const [nextRequests, nextChannels, nextAutomationStatus, nextProductionHealth, nextSourceRiskReport, nextAutomationSources, nextAutomationCandidates, nextAiConfig] = await Promise.all([
      adminListKnowledgeRefreshRequests(client, null, 30),
      adminGetKnowledgeRefreshChannels(client),
      adminGetKnowledgeAutomationStatus(client),
      adminGetKnowledgeProductionHealth(client),
      adminGetKnowledgeSourceRiskReport(client),
      adminListKnowledgeAutomationSources(client, 200),
      adminListKnowledgeAutomationCandidates(client, "pending", 200),
      adminGetKnowledgeAutomationAiConfig(client),
    ]);
    setRequests(nextRequests);
    setChannels(nextChannels);
    setAutomationStatus(nextAutomationStatus);
    setProductionHealth(nextProductionHealth);
    setSourceRiskReport(nextSourceRiskReport);
    setAutomationSources(nextAutomationSources);
    setAutomationCandidates(nextAutomationCandidates);
    setAutomationAiConfig(nextAiConfig);
    setAiEnabled(nextAiConfig.enabled);
    setAiModel(nextAiConfig.model);
    setAiMaxCandidates(nextAiConfig.maxCandidatesPerRun);
    if (selectedId === null) {
      const active = nextRequests.find((request) => request.status === "processing" || request.status === "pending");
      if (active) setSelectedId(active.id);
    }
  };

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        const client = getSupabaseClient();
        const [nextRequests, nextChannels, nextAutomationStatus, nextProductionHealth, nextSourceRiskReport, nextAutomationSources, nextAutomationCandidates, nextAiConfig] = await Promise.all([
          adminListKnowledgeRefreshRequests(client, null, 30),
          adminGetKnowledgeRefreshChannels(client),
          adminGetKnowledgeAutomationStatus(client),
          adminGetKnowledgeProductionHealth(client),
          adminGetKnowledgeSourceRiskReport(client),
          adminListKnowledgeAutomationSources(client, 200),
          adminListKnowledgeAutomationCandidates(client, "pending", 200),
          adminGetKnowledgeAutomationAiConfig(client),
        ]);
        if (!active) return;
        setRequests(nextRequests);
        setChannels(nextChannels);
        setAutomationStatus(nextAutomationStatus);
        setProductionHealth(nextProductionHealth);
        setSourceRiskReport(nextSourceRiskReport);
        setAutomationSources(nextAutomationSources);
        setAutomationCandidates(nextAutomationCandidates);
        setAutomationAiConfig(nextAiConfig);
        setAiEnabled(nextAiConfig.enabled);
        setAiModel(nextAiConfig.model);
        setAiMaxCandidates(nextAiConfig.maxCandidatesPerRun);
        const firstActive = nextRequests.find((request) => request.status === "processing" || request.status === "pending");
        if (firstActive) setSelectedId(firstActive.id);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "更新キューを読み込めませんでした。");
      }
    };
    void boot();
    return () => { active = false; };
  }, []);

  const saveAutomationAiConfig = async () => {
    setBusy(true);
    setMessage("");
    try {
      await adminSetKnowledgeAutomationAiConfig(getSupabaseClient(), {
        enabled: aiEnabled,
        provider: "openai",
        model: aiModel,
        maxCandidatesPerRun: aiMaxCandidates,
        apiKey: aiApiKey,
      });
      setAiApiKey("");
      await reload();
      setMessage(aiEnabled
        ? "AI候補JSON自動生成を有効化しました。APIキーはVaultへ保存され、画面には再表示しません。"
        : "AI候補JSON自動生成を無効化しました。公式ソース監視は継続します。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI自動解析設定を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const setAutomationSourceEnabled = async (
    source: KnowledgeAutomationSource,
    enabled: boolean,
  ) => {
    setBusy(true);
    setMessage("");
    try {
      await adminSetKnowledgeAutomationSourceEnabled(getSupabaseClient(), source.id, enabled);
      await reload();
      setMessage(enabled
        ? "公式ソース監視を再開しました。次回の自動調査で再確認します。"
        : "公式ソース監視を停止しました。履歴と既存候補は保持しています。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "公式ソース監視状態を変更できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const retryAutomationAi = async (candidate: KnowledgeAutomationCandidate) => {
    setBusy(true);
    setMessage("");
    try {
      await adminRetryKnowledgeAutomationCandidateAi(getSupabaseClient(), candidate.id);
      await reload();
      setMessage("AI解析を再試行待ちへ戻しました。次回の自動調査で再解析されます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI解析を再試行状態へ戻せませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const prepareAutomationCandidate = async (candidate: KnowledgeAutomationCandidate) => {
    const bundle = buildKnowledgeAutomationCandidateBundle(candidate);
    if (!bundle) {
      setMessage("この候補にはFresh差分へ取り込めるAI提案JSONがありません。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      const requestId = await adminRequestKnowledgeRefresh(client, "fresh");
      setSelectedId(requestId);
      setPreparedAutomationCandidateId(candidate.id);
      setBundleText(JSON.stringify(bundle, null, 2));
      setDiffPreview(null);
      await reload();
      setSelectedId(requestId);
      setPreparedAutomationCandidateId(candidate.id);
      setMessage("AI提案をFresh差分レビューへ取り込みました。候補状態もまだ確定していません。「変更点を確認」後、公開に成功した場合だけ処理済みにします。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI提案をFresh差分レビューへ取り込めませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const runAutomation = async () => {
    setBusy(true);
    setMessage("");
    try {
      const runId = await adminRequestKnowledgeAutomationRun(getSupabaseClient());
      await reload();
      setMessage(`公式ソース自動調査 #${runId} を開始しました。候補は自動公開されません。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "公式ソース自動調査を開始できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const prepareSourceDiversity = async () => {
    if (!sourceRiskReport || sourceRiskReport.reviewItems.length === 0) {
      setMessage("追加根拠リサーチが必要なKnowledge / Promptはありません。");
      return;
    }
    if (!window.confirm("根拠が1ソースまたは1ドメインに偏る項目をFreshリサーチ対象として準備しますか？ 自動公開はされません。")) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await adminPrepareSourceDiversityResearch(getSupabaseClient(), 12);
      setSelectedId(result.requestId);
      await reload();
      setSelectedId(result.requestId);
      setMessage(`追加根拠リサーチ ${result.itemCount}件をFresh更新 #${result.requestId} へ準備しました。差分確認・公開操作を行うまで正式Knowledgeは変わりません。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "追加根拠リサーチを準備できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const copyAutomationPrompt = async (candidate: KnowledgeAutomationCandidate) => {
    try {
      await navigator.clipboard.writeText(candidate.researchPrompt);
      setMessage("候補専用の検証プロンプトをコピーしました。Web検索できるAIで公式ソースを再確認してください。");
    } catch {
      setMessage("クリップボードへコピーできませんでした。");
    }
  };

  const reviewAutomationCandidate = async (
    candidate: KnowledgeAutomationCandidate,
    decision: "approved" | "rejected",
  ) => {
    setBusy(true);
    setMessage("");
    try {
      await adminReviewKnowledgeAutomationCandidate(
        getSupabaseClient(),
        candidate.id,
        decision,
        decision === "approved"
          ? "管理者が調査継続候補として承認。正式公開は別途Quality Gateと差分確認が必要。"
          : "管理者が自動調査候補を却下。",
      );
      await reload();
      setMessage(decision === "approved"
        ? "候補を承認しました。まだ正式Knowledgeには公開されていません。"
        : "候補を却下しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "候補のレビュー結果を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const enqueue = async (channel: "fresh" | "stable") => {
    setBusy(true);
    setMessage("");
    setDiffPreview(null);
    try {
      const id = await adminRequestKnowledgeRefresh(getSupabaseClient(), channel);
      setSelectedId(id);
      setPreparedAutomationCandidateId(null);
      await reload();
      setMessage(channel === "fresh"
        ? "Fresh（先行確認版）の更新をキューへ追加しました。"
        : "Stable（標準版）の更新をキューへ追加しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新を追加できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const start = async (request: KnowledgeRefreshRequest) => {
    setBusy(true);
    setMessage("");
    setDiffPreview(null);
    try {
      await adminStartKnowledgeRefresh(getSupabaseClient(), request.id);
      setSelectedId(request.id);
      await reload();
      setMessage("更新を調査・確認中へ変更しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新を開始できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const copyResearchPrompt = async (request: KnowledgeRefreshRequest) => {
    const prompt = buildKnowledgeRefreshResearchPrompt(request.channel);
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("最新情報調査プロンプトをコピーしました。Web検索できるAIへ貼り付けてください。");
    } catch {
      setMessage("クリップボードへコピーできませんでした。");
    }
  };

  const previewDiff = async () => {
    if (!bundleText.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const bundle = parseKnowledgeRefreshBundle(bundleText);
      const diff = await adminPreviewKnowledgeRefreshBundleDiff(getSupabaseClient(), bundle);
      setDiffPreview(diff);
      setMessage("現在の正式データとの差分を確認しました。内容を確認してから公開してください。");
    } catch (error) {
      setDiffPreview(null);
      setMessage(error instanceof Error ? error.message : "変更点を比較できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!selected || !diffPreview || (selected.status !== "pending" && selected.status !== "processing")) return;

    const changedCount =
      diffPreview.knowledge.added + diffPreview.knowledge.updated +
      diffPreview.prompt.added + diffPreview.prompt.updated;
    const channelLabel = selected.channel === "fresh" ? "Fresh（先行確認版）" : "Stable（標準版）";

    if (!window.confirm(
      `${channelLabel}へ公開しますか？\n追加・変更される項目は合計 ${changedCount}件です。\n差分内容を確認済みの場合のみ続行してください。`,
    )) return;

    setBusy(true);
    setMessage("");
    try {
      const bundle = parseKnowledgeRefreshBundle(bundleText);
      const client = getSupabaseClient();
      const result = await adminPublishKnowledgeRefreshBundle(client, selected.id, bundle);
      if (preparedAutomationCandidateId !== null) {
        await adminReviewKnowledgeAutomationCandidate(
          client,
          preparedAutomationCandidateId,
          "converted",
          "Fresh差分確認と管理者公開が完了したため、AI自動提案候補を処理済みに変更。",
        );
      }
      setPreparedAutomationCandidateId(null);
      setBundleText("");
      setDiffPreview(null);
      await reload();
      setMessage(
        `${result.channel === "fresh" ? "Fresh（先行確認版）" : "Stable（標準版）"} v${result.publishedVersion} を公開しました。Knowledge ${result.knowledgeCount}件 / Prompt ${result.promptCount}件です。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新Bundleを公開できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const activeRequests = requests.filter((request) => request.status === "pending" || request.status === "processing");
  const recentRequests = requests.filter((request) => request.status !== "pending" && request.status !== "processing").slice(0, 8);

  return (
    <section className="knowledge-admin-panel knowledge-refresh-panel">
      <div className="knowledge-panel-head">
        <div>
          <p className="eyebrow">AUTO UPDATE CONTROL</p>
          <h2>Knowledge / Prompt 更新</h2>
          <p>記事・SNS・画像に加え、各副業専用Knowledge / Promptも更新対象です。更新期限は自動でキュー化し、管理者が差分と根拠を確認してからFresh / Stableへ版管理して公開します。</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void reload()}>再読込</button>
      </div>

      <KnowledgeChannelGuide
        freshState={freshState}
        stableState={stableState}
        busy={busy}
        onEnqueue={enqueue}
      />

      <section className="knowledge-automation-panel" aria-label="公式ソース自動監視">
        <div className="knowledge-automation-head">
          <div>
            <p className="eyebrow">OFFICIAL SOURCE MONITOR</p>
            <h3>公式ソース自動監視</h3>
            <p>登録済みの公式・一次情報を自動巡回し、本文ハッシュ・HTTP状態・Changelog更新から「新規 / 更新 / 再確認 / 廃止」の候補だけを作ります。</p>
          </div>
          <button type="button" disabled={busy || automationStatus?.enabled === false} onClick={() => void runAutomation()}>
            今すぐ公式ソースを調査
          </button>
        </div>

        <div className="knowledge-automation-guard">
          <strong>自動調査 ≠ 自動公開</strong>
          <span>候補承認は「詳しく確認する価値がある」という状態変更だけです。正式反映には従来のQuality Gate・差分確認・Fresh / Stable公開操作が必要です。</span>
        </div>

        <div className="knowledge-ai-config">
          <div className="knowledge-ai-config-head">
            <div>
              <strong>AI候補JSON自動生成</strong>
              <p>公式ソースの取得・差分検知後にAIが候補JSONを作成します。AIが候補を作っても自動公開はされません。</p>
            </div>
            <span className={automationAiConfig?.apiKeyConfigured ? "configured" : "missing"}>
              APIキー {automationAiConfig?.apiKeyConfigured ? "Vault設定済み" : "未設定"}
            </span>
          </div>
          <div className="knowledge-ai-config-grid">
            <label className="knowledge-ai-toggle">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(event) => setAiEnabled(event.target.checked)}
              />
              <span>AI自動解析を有効にする</span>
            </label>
            <SelectWithCustom
              label="モデル"
              value={aiModel}
              onChange={setAiModel}
              options={[
                { value: "gpt-6-luna", label: "GPT-6 Luna（低コスト・大量処理向け）" },
                { value: "gpt-5.6-luna", label: "GPT-5.6 Luna（低コスト）" },
                { value: "gpt-5.6-terra", label: "GPT-5.6 Terra（バランス）" },
                { value: "gpt-5.6", label: "GPT-5.6 Sol（高精度）" },
              ]}
              description="候補作成用AIです。新しいモデルIDを使う場合は「その他・自由入力」を選べます。"
              customPlaceholder="OpenAI APIのモデルIDを入力"
            />
            <PresetNumberSelectWithCustom
              label="1回の最大解析候補数"
              value={aiMaxCandidates}
              onChange={setAiMaxCandidates}
              presets={[1, 3, 6, 10, 15, 20]}
              min={1}
              max={20}
              suffix="件"
              description="API費用を抑えたい場合は1〜3件から始める設定がおすすめです。"
            />
            <label>
              <span>OpenAI APIキー（変更時のみ入力）</span>
              <input
                type="password"
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.target.value)}
                placeholder={automationAiConfig?.apiKeyConfigured ? "設定済み・変更する場合だけ入力" : "APIキーを入力"}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="knowledge-ai-config-actions">
            <small>APIキーはSupabase Vaultへ保存し、この画面では再表示しません。AI解析が無効でも公式ソース監視は動き続けます。</small>
            <button type="button" disabled={busy || !aiModel.trim()} onClick={() => void saveAutomationAiConfig()}>
              AI自動解析設定を保存
            </button>
          </div>
        </div>

        <dl className="knowledge-automation-metrics">
          <div><dt>監視中</dt><dd>{automationStatus?.trackedSources ?? "-"} URL</dd></div>
          <div><dt>次回対象</dt><dd>{automationStatus?.dueSources ?? "-"} URL</dd></div>
          <div><dt>未確認候補</dt><dd>{automationStatus?.pendingCandidates ?? "-"} 件</dd></div>
          <div><dt>承認済み候補</dt><dd>{automationStatus?.approvedCandidates ?? "-"} 件</dd></div>
          <div><dt>最終成功</dt><dd>{formatKnowledgeDate(automationStatus?.lastSuccessAt ?? null)}</dd></div>
          <div>
            <dt>直近実行</dt>
            <dd>
              {automationStatus?.latestRunId
                ? `#${automationStatus.latestRunId} / ${automationStatus.latestRunSourcesChecked} URL / 候補 ${automationStatus.latestRunCandidatesCreated}`
                : "-"}
            </dd>
          </div>
        </dl>

        <KnowledgeSourceHealthPanel
          sources={automationSources}
          dueSources={automationStatus?.dueSources}
          busy={busy}
          onSetSourceEnabled={(source, enabled) => void setAutomationSourceEnabled(source, enabled)}
        />

        <KnowledgeQualityAnalyzer
          productionHealth={productionHealth}
          sourceRiskReport={sourceRiskReport}
          busy={busy}
          onPrepareSourceDiversity={() => void prepareSourceDiversity()}
        />

        {automationStatus?.lastError && (
          <p className="knowledge-automation-error">直近エラー: {automationStatus.lastError}</p>
        )}

        <div className={`knowledge-ai-mode-status ${automationAiConfig?.enabled ? (automationAiConfig.apiKeyConfigured ? "ready" : "action") : "paused"}`}>
          <div>
            <strong>
              {automationAiConfig?.enabled
                ? automationAiConfig.apiKeyConfigured
                  ? "AI候補生成: ON"
                  : "AI候補生成: APIキー未設定"
                : "AI候補生成: OFF"}
            </strong>
            <span>
              {automationAiConfig?.enabled
                ? automationAiConfig.apiKeyConfigured
                  ? "new / update候補は次回WorkerでAI解析します。公開は管理者レビュー後のみです。"
                  : "VaultへAPIキーを設定するまでnew / update候補は保留し、APIは呼び出しません。"
                : "new / update候補は保留し、AI APIは呼び出しません。recheck / retireの無料自動判定と公式ソース監視は継続します。"}
            </span>
          </div>
          <small>{automationAiConfig?.model ?? "gpt-5.6"} / 1回最大 {automationAiConfig?.maxCandidatesPerRun ?? 6}候補</small>
        </div>

        <div className="knowledge-candidate-analysis-summary" aria-label="自動調査候補の解析状態">
          <div><small>レビュー待ち</small><strong>{candidateAnalysisSummary.total}</strong></div>
          <div><small>無料判定済み</small><strong>{candidateAnalysisSummary.deterministicCompleted}</strong></div>
          <div><small>AI解析済み</small><strong>{candidateAnalysisSummary.aiCompleted}</strong></div>
          <div><small>AI保留</small><strong>{candidateAnalysisSummary.held}</strong></div>
          <div><small>無料判定待ち</small><strong>{candidateAnalysisSummary.automaticPending}</strong></div>
          <div><small>解析失敗</small><strong>{candidateAnalysisSummary.failed}</strong></div>
        </div>

        {automationCandidates.length === 0 ? (
          <p className="knowledge-empty">現在、管理者確認が必要な自動調査候補はありません。</p>
        ) : (
          <div className="knowledge-automation-candidates">
            {automationCandidates.map((candidate) => (
              <article key={candidate.id}>
                <header>
                  <span className={"automation-action " + candidate.candidateAction}>
                    {knowledgeAutomationActionLabel(candidate.candidateAction)}
                  </span>
                  <strong>{candidate.sourceTitle || candidate.existingItemKey || candidate.sourceUrl}</strong>
                  <small>信頼度 {candidate.confidence}% / 検出 {formatKnowledgeDate(candidate.detectedAt)}</small>
                </header>

                <p>{candidate.reason}</p>
                {candidate.matchedTasks.length > 0 && (
                  <div className="knowledge-automation-tasks">
                    {candidate.matchedTasks.map((task) => <span key={task}>{task}</span>)}
                  </div>
                )}
                {candidate.existingItemKey && (
                  <small className="knowledge-automation-existing">
                    現行: {candidate.existingItemType ?? "item"} / {candidate.existingItemKey}
                  </small>
                )}
                {candidate.sourceExcerpt && (
                  <details>
                    <summary>自動取得した抜粋を見る</summary>
                    <p>{candidate.sourceExcerpt}</p>
                  </details>
                )}

                <div className={"knowledge-ai-analysis " + candidateAnalysisPresentation(candidate, automationAiConfig).className}>
                  <div>
                    <strong>解析状態: {candidateAnalysisPresentation(candidate, automationAiConfig).label}</strong>
                    {candidate.analysisDecision && <span>判定: {candidate.analysisDecision}</span>}
                    {candidate.analysisModel && <span>{candidate.analysisProvider} / {candidate.analysisModel}</span>}
                  </div>
                  {candidate.analysisStatus === "pending" && (
                    <p>{candidateAnalysisPresentation(candidate, automationAiConfig).note}</p>
                  )}
                  {candidate.analysisReason && <p>{candidate.analysisReason}</p>}
                  {candidate.analysisError && <p className="knowledge-automation-error">{candidate.analysisError}</p>}
                  {candidate.verifiedSourceUrls.length > 0 && (
                    <div className="knowledge-ai-sources">
                      {candidate.verifiedSourceUrls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">確認済み根拠</a>
                      ))}
                    </div>
                  )}
                  {candidate.proposedPayload && (
                    <details>
                      <summary>AI提案JSONを見る</summary>
                      <pre>{JSON.stringify(candidate.proposedPayload, null, 2)}</pre>
                    </details>
                  )}
                </div>

                <div className="knowledge-automation-actions">
                  <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">公式ソースを開く</a>
                  <button type="button" disabled={busy} onClick={() => void copyAutomationPrompt(candidate)}>
                    検証プロンプトをコピー
                  </button>
                  <button type="button" disabled={busy} onClick={() => launchAiApp("chatgpt")}>
                    ChatGPTを開く
                  </button>
                  {candidate.analysisStatus === "failed" && (
                    <button type="button" disabled={busy} onClick={() => void retryAutomationAi(candidate)}>
                      AI解析を再試行
                    </button>
                  )}
                  {buildKnowledgeAutomationCandidateBundle(candidate) && (
                    <button type="button" className="prepare" disabled={busy} onClick={() => void prepareAutomationCandidate(candidate)}>
                      Fresh差分へ取り込む
                    </button>
                  )}
                  <button
                    type="button"
                    className="approve"
                    disabled={busy}
                    onClick={() => void reviewAutomationCandidate(candidate, "approved")}
                  >
                    候補承認（公開しない）
                  </button>
                  <button
                    type="button"
                    className="reject"
                    disabled={busy}
                    onClick={() => void reviewAutomationCandidate(candidate, "rejected")}
                  >
                    却下
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {message && <div className="route-notice knowledge-message">{message}</div>}

      {activeRequests.length === 0 ? (
        <p className="knowledge-empty">現在、処理待ちの更新はありません。期限到達時はDBスケジューラが自動でキューへ追加します。</p>
      ) : (
        <div className="knowledge-refresh-list">
          {activeRequests.map((request) => (
            <article key={request.id} className={selectedId === request.id ? "active" : ""}>
              <button type="button" className="knowledge-refresh-select" onClick={() => {
                setSelectedId(request.id);
                setPreparedAutomationCandidateId(null);
                setDiffPreview(null);
                setBundleText("");
              }}>
                <span className={"channel-label " + request.channel}>
                  {request.channel === "fresh" ? "Fresh・先行確認" : "Stable・標準版"} / {knowledgeRefreshStatusLabel(request.status)}
                </span>
                <strong>更新 #{request.id}</strong>
                <small>要求 {formatKnowledgeDate(request.requestedAt)} / 開始 {formatKnowledgeDate(request.startedAt)}</small>
              </button>
              <div className="knowledge-refresh-row-actions">
                {request.status === "pending" && <button type="button" disabled={busy} onClick={() => void start(request)}>調査開始</button>}
                <button type="button" disabled={busy} onClick={() => void copyResearchPrompt(request)}>調査プロンプトをコピー</button>
                <button type="button" disabled={busy} onClick={() => launchAiApp("chatgpt")}>ChatGPTを開く</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (selected.status === "pending" || selected.status === "processing") && (
        <div className="knowledge-refresh-import">
          <div>
            <strong>{selected.channel === "fresh" ? "Fresh・先行確認版" : "Stable・標準版"} 更新 #{selected.id} のレビュー済みJSON</strong>
            <p>調査AIの出力を貼り付けたら、公開前に必ず「変更点を確認」を押してください。現在の正式Knowledge / Promptと自動比較します。</p>
          </div>
          <textarea
            rows={14}
            value={bundleText}
            onChange={(event) => {
              setBundleText(event.target.value);
              setDiffPreview(null);
            }}
            placeholder='{"summary":"...","knowledge_rules":[],"prompt_optimizations":[]}'
            spellCheck={false}
          />
          <div className="knowledge-refresh-publish-actions">
            <button type="button" disabled={busy || !bundleText.trim()} onClick={() => void previewDiff()}>
              変更点を確認
            </button>
            <button type="button" className="approve" disabled={busy || !diffPreview} onClick={() => void publish()}>
              差分確認後に公開
            </button>
          </div>

          {diffPreview && (
            <div className="knowledge-diff-preview">
              <div>
                <p className="eyebrow">CHANGE REVIEW</p>
                <strong>今回どこが変わるか</strong>
                <p>「追加」「変更」「変更なし」を正式データと比較した結果です。変更箇所と根拠要約を確認してください。</p>
              </div>
              <KnowledgeDiffSummary diff={diffPreview} />
            </div>
          )}
        </div>
      )}

      <KnowledgeRefreshHistory recentRequests={recentRequests} />
    </section>
  );
}
