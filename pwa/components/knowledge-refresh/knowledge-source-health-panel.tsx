"use client";

import { useMemo } from "react";

import {
  SIDE_HUSTLE_COVERAGE_TASKS,
  formatKnowledgeDate,
  knowledgeSourceHost,
  knowledgeSourceKindLabel,
} from "@/components/knowledge-refresh/knowledge-refresh-display";
import type { KnowledgeAutomationSource } from "@/lib/knowledge-auto-update";

export function KnowledgeSourceHealthPanel({
  sources,
  dueSources,
}: {
  sources: KnowledgeAutomationSource[];
  dueSources: number | null | undefined;
}) {
  const enabledSources = useMemo(
    () => sources.filter((source) => source.enabled),
    [sources],
  );
  const failingSources = useMemo(
    () => enabledSources.filter(
      (source) => source.consecutiveFailures > 0
        || (source.lastHttpStatus !== null && source.lastHttpStatus >= 400),
    ),
    [enabledSources],
  );
  const backoffSources = useMemo(
    () => enabledSources.filter((source) => source.consecutiveFailures >= 3),
    [enabledSources],
  );
  const disabledSources = useMemo(
    () => sources.filter((source) => !source.enabled),
    [sources],
  );
  const orderedSources = useMemo(
    () => [...sources].sort((a, b) => {
      const rank = (source: KnowledgeAutomationSource) => {
        if (!source.enabled) return 2;
        if (source.consecutiveFailures > 0 || (source.lastHttpStatus !== null && source.lastHttpStatus >= 400)) return 0;
        return 1;
      };
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      if (a.consecutiveFailures !== b.consecutiveFailures) return b.consecutiveFailures - a.consecutiveFailures;
      return knowledgeSourceHost(a.sourceUrl).localeCompare(knowledgeSourceHost(b.sourceUrl), "ja");
    }),
    [sources],
  );
  const coverage = useMemo(
    () => SIDE_HUSTLE_COVERAGE_TASKS.map(([task, label]) => ({
      task,
      label,
      count: enabledSources.filter(
        (source) => source.tasks.includes("all") || source.tasks.includes(task),
      ).length,
    })),
    [enabledSources],
  );

  return (
    <section className="knowledge-source-health" aria-label="監視ソース健全性">
      <div className="knowledge-source-health-head">
        <div>
          <strong>監視ソース健全性</strong>
          <p>どの公式URLを監視しているか、取得状態・失敗回数・次回確認時刻を管理者画面だけで確認できます。</p>
        </div>
        <span className={failingSources.length > 0 ? "warning" : "healthy"}>
          {failingSources.length > 0 ? `要確認 ${failingSources.length} URL` : "正常"}
        </span>
      </div>

      <div className="knowledge-source-health-stats">
        <article><span>有効URL</span><strong>{enabledSources.length}</strong></article>
        <article className={failingSources.length > 0 ? "warning" : ""}><span>取得失敗</span><strong>{failingSources.length}</strong></article>
        <article className={backoffSources.length > 0 ? "backoff" : ""}><span>再試行待ち</span><strong>{backoffSources.length}</strong></article>
        <article className={disabledSources.length > 0 ? "disabled" : ""}><span>停止中</span><strong>{disabledSources.length}</strong></article>
        <article><span>次回対象</span><strong>{dueSources ?? "-"}</strong></article>
      </div>

      <div className="knowledge-source-coverage">
        <div>
          <strong>副業Knowledgeカバレッジ</strong>
          <small>「all」指定の公式ソースは各副業にも共通根拠として数えます。</small>
        </div>
        <div className="knowledge-source-coverage-grid">
          {coverage.map((item) => (
            <article key={item.task} className={item.count === 0 ? "missing" : ""}>
              <span>{item.label}</span>
              <strong>{item.count} URL</strong>
            </article>
          ))}
        </div>
      </div>

      <details className="knowledge-source-list" open={failingSources.length > 0}>
        <summary>監視URL一覧（{sources.length}件）</summary>
        <div>
          {orderedSources.map((source) => {
            const isFailing = source.enabled && (
              source.consecutiveFailures > 0
              || (source.lastHttpStatus !== null && source.lastHttpStatus >= 400)
            );
            const isBackoff = source.enabled && source.consecutiveFailures >= 3;
            const statusClass = !source.enabled ? "disabled" : isBackoff ? "backoff" : isFailing ? "warning" : "healthy";
            const statusLabel = !source.enabled ? "停止中" : isBackoff ? "再試行待ち" : isFailing ? "要確認" : "正常";
            return (
              <article key={source.id} className={!source.enabled ? "disabled" : isBackoff ? "backoff" : isFailing ? "warning" : ""}>
                <header>
                  <span className={statusClass}>{statusLabel}</span>
                  <strong>{knowledgeSourceHost(source.sourceUrl)}</strong>
                  <small>{knowledgeSourceKindLabel(source.sourceKind)}</small>
                </header>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl}</a>
                <dl>
                  <div><dt>HTTP</dt><dd>{source.lastHttpStatus ?? "未確認"}</dd></div>
                  <div><dt>連続失敗</dt><dd>{source.consecutiveFailures}回</dd></div>
                  <div><dt>最終確認</dt><dd>{formatKnowledgeDate(source.lastCheckedAt)}</dd></div>
                  <div><dt>次回確認</dt><dd>{formatKnowledgeDate(source.nextCheckAt)}</dd></div>
                </dl>
                {source.tasks.length > 0 && (
                  <div className="knowledge-source-tasks">
                    {source.tasks.map((task) => <span key={task}>{task}</span>)}
                  </div>
                )}
                {source.lastError && <p className="knowledge-source-error">{source.lastError}</p>}
              </article>
            );
          })}
        </div>
      </details>
    </section>
  );
}
