"use client";

import {
  formatKnowledgeDate,
  knowledgeSourceHost,
} from "@/components/knowledge-refresh/knowledge-refresh-display";
import type {
  KnowledgeProductionHealth,
  KnowledgeSourceRiskReport,
} from "@/lib/knowledge-auto-update";

export function KnowledgeQualityAnalyzer({
  productionHealth,
  sourceRiskReport,
  busy,
  onPrepareSourceDiversity,
}: {
  productionHealth: KnowledgeProductionHealth | null;
  sourceRiskReport: KnowledgeSourceRiskReport | null;
  busy: boolean;
  onPrepareSourceDiversity(): void;
}) {
  return (
    <section className="knowledge-quality-analyzer" aria-label="Knowledge品質カバレッジ分析">
      <div className="knowledge-quality-head">
        <div>
          <p className="eyebrow">QUALITY & COVERAGE</p>
          <strong>Knowledge品質・カバレッジ分析</strong>
          <p>正式Knowledge / Promptの根拠数と根拠ドメインの偏りを確認します。ここでの分析・リサーチ準備だけでは公開されません。</p>
        </div>
        <button
          type="button"
          disabled={busy || !sourceRiskReport || sourceRiskReport.reviewItems.length === 0}
          onClick={onPrepareSourceDiversity}
        >
          追加根拠リサーチを準備
        </button>
      </div>

      <div className="knowledge-quality-metrics">
        <article><span>正式Knowledge</span><strong>{productionHealth?.activeKnowledge ?? "-"}</strong></article>
        <article><span>Prompt最適化</span><strong>{productionHealth?.activePromptOptimizations ?? "-"}</strong></article>
        <article className={(sourceRiskReport?.zeroSourceCount ?? 0) > 0 ? "warning" : "healthy"}>
          <span>根拠0件</span><strong>{sourceRiskReport?.zeroSourceCount ?? "-"}</strong>
        </article>
        <article className={(sourceRiskReport?.singleSourceCount ?? 0) > 0 ? "warning" : ""}>
          <span>単一ソース</span><strong>{sourceRiskReport?.singleSourceCount ?? "-"}</strong>
        </article>
        <article><span>複数ドメイン</span><strong>{sourceRiskReport?.multiDomainCount ?? "-"}</strong></article>
        <article><span>根拠ドメイン</span><strong>{sourceRiskReport?.uniqueDomainCount ?? "-"}</strong></article>
        <article><span>Fresh</span><strong>v{productionHealth?.freshVersion ?? "-"}</strong></article>
        <article><span>Stable</span><strong>v{productionHealth?.stableVersion ?? "-"}</strong></article>
      </div>

      {sourceRiskReport && (
        <>
          <div className="knowledge-quality-concentration">
            <div>
              <span>最多ドメインへの集中率</span>
              <strong>{sourceRiskReport.topDomainSharePercent}%</strong>
              <small>{sourceRiskReport.topDomainItemCount} / {sourceRiskReport.itemCount} 項目</small>
            </div>
            <div className="knowledge-quality-domain-list">
              {sourceRiskReport.domains.slice(0, 8).map((domain) => (
                <span key={domain.domain}>{domain.domain} · {domain.itemCount}項目</span>
              ))}
            </div>
          </div>

          <details className="knowledge-quality-review" open={sourceRiskReport.zeroSourceCount > 0}>
            <summary>追加根拠を確認する項目（{sourceRiskReport.reviewItems.length}件）</summary>
            <div>
              {sourceRiskReport.reviewItems.map((item) => (
                <article key={`${item.itemType}:${item.key}`}>
                  <header>
                    <span>{item.itemType === "knowledge" ? "Knowledge" : "Prompt"}</span>
                    <strong>{item.label || item.key}</strong>
                    <small>v{item.catalogVersion}</small>
                  </header>
                  <p>{item.key}</p>
                  <dl>
                    <div><dt>ソース</dt><dd>{item.sourceCount}</dd></div>
                    <div><dt>ドメイン</dt><dd>{item.domainCount}</dd></div>
                    <div><dt>最終確認</dt><dd>{formatKnowledgeDate(item.sourceCheckedAt)}</dd></div>
                  </dl>
                  {item.sourceUrls.length > 0 && (
                    <div className="knowledge-quality-links">
                      {item.sourceUrls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">{knowledgeSourceHost(url)}</a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </details>
        </>
      )}

      {productionHealth && (
        <small className="knowledge-quality-foot">
          最終根拠確認: Knowledge {formatKnowledgeDate(productionHealth.lastKnowledgeCheckedAt)} / Prompt {formatKnowledgeDate(productionHealth.lastPromptCheckedAt)}
          {" · "}更新キュー: 待機 {productionHealth.pendingRequests} / 処理中 {productionHealth.processingRequests} / 失敗履歴 {productionHealth.failedRequests}
        </small>
      )}
    </section>
  );
}
