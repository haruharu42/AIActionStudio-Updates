"use client";

import { KnowledgeDiffSummary } from "@/components/knowledge-refresh/knowledge-diff-summary";
import {
  formatKnowledgeCycle,
  formatKnowledgeDate,
  isKnowledgeRefreshAutoRecovery,
  knowledgeRefreshErrorLabel,
  knowledgeRefreshHistoryStatusLabel,
} from "@/components/knowledge-refresh/knowledge-refresh-display";
import type {
  KnowledgeRefreshChannelState,
  KnowledgeRefreshRequest,
} from "@/lib/knowledge-auto-update";

export function KnowledgeChannelGuide({
  freshState,
  stableState,
  busy,
  onEnqueue,
}: {
  freshState: KnowledgeRefreshChannelState | null;
  stableState: KnowledgeRefreshChannelState | null;
  busy: boolean;
  onEnqueue: (channel: "fresh" | "stable") => void | Promise<void>;
}) {
  return (
    <>
      <div className="knowledge-channel-guide" aria-label="FreshとStableの違い">
        <article className="fresh">
          <div className="knowledge-channel-title">
            <span>FRESH</span>
            <strong>先行確認版</strong>
          </div>
          <h3>新しい重要変更を早めに確認</h3>
          <p>管理者 / Creator Membership向けの先行チャネル。公式根拠を確認した変更を早期に試し、一般側へ広げる前に問題がないか確認します。</p>
          <dl>
            <div><dt>更新周期</dt><dd>{formatKnowledgeCycle(freshState?.refreshHours)}</dd></div>
            <div><dt>現在</dt><dd>v{freshState?.currentVersion ?? "-"}</dd></div>
            <div><dt>次回予定</dt><dd>{formatKnowledgeDate(freshState?.nextRefreshDueAt ?? null)}</dd></div>
          </dl>
          <button type="button" disabled={busy} onClick={() => void onEnqueue("fresh")}>Fresh（先行確認）を更新</button>
        </article>

        <article className="stable">
          <div className="knowledge-channel-title">
            <span>STABLE</span>
            <strong>標準版</strong>
          </div>
          <h3>確認済みの内容を通常利用へ</h3>
          <p>一般ユーザー向けの標準チャネル。十分に確認できた仕様やPrompt改善を優先し、変化の速さより安定性を重視します。</p>
          <dl>
            <div><dt>更新周期</dt><dd>{formatKnowledgeCycle(stableState?.refreshHours)}</dd></div>
            <div><dt>現在</dt><dd>v{stableState?.currentVersion ?? "-"}</dd></div>
            <div><dt>次回予定</dt><dd>{formatKnowledgeDate(stableState?.nextRefreshDueAt ?? null)}</dd></div>
          </dl>
          <button type="button" disabled={busy} onClick={() => void onEnqueue("stable")}>Stable（標準版）を更新</button>
        </article>
      </div>

      <div className="knowledge-channel-flow">
        <strong>使い分け</strong>
        <span>Fresh = 早めに確認する場所</span>
        <b aria-hidden="true">→</b>
        <span>Stable = 一般利用の基準</span>
      </div>

      <div className="knowledge-refresh-safety">
        <strong>自動収集＝自動公開ではありません</strong>
        <span>外部Webの内容はそのまま採用しません。公式情報・根拠URL・現在データとの差分を管理者が確認し、「変更点を確認」後にだけ公開できます。</span>
      </div>
    </>
  );
}

export function KnowledgeRefreshHistory({
  recentRequests,
}: {
  recentRequests: KnowledgeRefreshRequest[];
}) {
  if (recentRequests.length === 0) return null;

  return (
    <div className="knowledge-refresh-history">
      <strong>最近の更新履歴・変更点</strong>
      {recentRequests.map((request) => {
        const diff = request.changeDetails;
        const hasDetails = diff.knowledge.items.length > 0 || diff.prompt.items.length > 0;
        const autoRecovered = request.status === "failed" && isKnowledgeRefreshAutoRecovery(request.errorMessage);
        return (
          <article key={request.id}>
            <div className="knowledge-history-head">
              <span className={"channel-label " + request.channel}>
                {request.channel === "fresh" ? "Fresh・先行確認" : "Stable・標準版"} / {knowledgeRefreshHistoryStatusLabel(request)}
              </span>
              <small>
                v{request.publishedVersion ?? "-"} / {formatKnowledgeDate(request.completedAt)}
              </small>
            </div>
            <div className="knowledge-history-counts">
              <span>Knowledge: ＋{diff.knowledge.added} / 変更 {diff.knowledge.updated}</span>
              <span>Prompt: ＋{diff.prompt.added} / 変更 {diff.prompt.updated}</span>
            </div>
            {request.researchSummary && <p>{request.researchSummary}</p>}
            {hasDetails && (
              <details>
                <summary>変更した場所を詳しく見る</summary>
                <KnowledgeDiffSummary diff={diff} />
              </details>
            )}
            {!hasDetails && request.status === "completed" && (
              <small>この更新は旧形式の履歴のため詳細差分は記録されていません。</small>
            )}
            {request.errorMessage && (
              <p className={autoRecovered ? "recovery" : "error"}>
                {knowledgeRefreshErrorLabel(request.errorMessage)}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
