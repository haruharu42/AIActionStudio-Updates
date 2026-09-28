"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { NotePostAssistant } from "@/components/article-library/note-post-assistant";
import { noteMagazineFromWorkspace } from "@/lib/article-library-v2";
import { articleExportBody } from "@/lib/article-export";
""import type { ArticleDetail } from "@/lib/phase7-articles";
import {
  ARTICLE_STATUS_LABELS,
  MAGAZINE_ROLE_LABELS,
  MAGAZINE_TYPE_LABELS,
  formatArticleLibraryDate,
} from "@/lib/article-library-view";

export function ArticleLibraryDetailView({
  detail,
  busy,
  desktopDownloads,
  onBack,
  onEdit,
  onDuplicate,
  onArchiveToggle,
  onDownload,
  onDelete,
  images,
  aiTools,
}: {
  detail: ArticleDetail;
  busy: boolean;
  desktopDownloads: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchiveToggle: () => void;
  onDownload: () => void;
  onDelete: () => void;
  images: ReactNode;
  aiTools: ReactNode;
}) {
  const magazine = noteMagazineFromWorkspace(detail.workspace.workspaceJson);
  return (
    <>
      <div className="library-toolbar detail-toolbar">
        <button className="back-action" type="button" onClick={onBack} disabled={busy}>← 一覧へ</button>
        <div>
          {desktopDownloads && (
            <button className="secondary-action" type="button" onClick={onDownload} disabled={busy}>PCへMarkdown保存</button>
          )}
          <Link className="secondary-action" href={`/workflow?tab=preflight&article=${encodeURIComponent(detail.id)}`}>公開前チェック</Link>
          <Link className="secondary-action" href={`/workflow?tab=reuse&article=${encodeURIComponent(detail.id)}`}>SNS再利用</Link>
          <button className="secondary-action" type="button" onClick={onDuplicate} disabled={busy}>複製</button>
          <button className="secondary-action" type="button" onClick={onArchiveToggle} disabled={busy}>
            {detail.status === "archived" ? "アーカイブから戻す" : "アーカイブ"}
          </button>
          <button className="secondary-action" type="button" onClick={onEdit} disabled={busy}>編集</button>
          <button className="danger-action" type="button" onClick={onDelete} disabled={busy}>削除</button>
        </div>
      </div>

      <article className="article-detail">
        <header>
          <div className="detail-badges">
            <span>{detail.publicationTarget}</span>
            <span>{detail.articleType === "paid" ? `有料 ¥${detail.price ?? 0}` : "無料"}</span>
            <span>{ARTICLE_STATUS_LABELS[detail.status]}</span>
            {magazine.enabled && <span>noteマガジン</span>}
          </div>
          <h2>{detail.title || "無題の記事"}</h2>
          <p>更新 {formatArticleLibraryDate(detail.updatedAt)} · revision {detail.revision}</p>
        </header>

        {detail.publicationTarget === "note" && (
          <NotePostAssistant detail={detail} body={articleExportBody(detail)} />
        )}

        <dl className="detail-meta">
          <div><dt>ジャンル</dt><dd>{detail.genre || "—"}</dd></div>
          <div><dt>サブジャンル</dt><dd>{detail.subgenre || "—"}</dd></div>
          <div><dt>タグ</dt><dd>{detail.tags.length ? detail.tags.join(" / ") : "—"}</dd></div>
          <div><dt>作成日時</dt><dd>{formatArticleLibraryDate(detail.createdAt)}</dd></div>
          {magazine.enabled && (
            <>
              <div><dt>マガジン名</dt><dd>{magazine.name || "—"}</dd></div>
              <div><dt>マガジン種別</dt><dd>{MAGAZINE_TYPE_LABELS[magazine.type]}</dd></div>
              <div><dt>シリーズ</dt><dd>{magazine.seriesName || "—"}</dd></div>
              <div><dt>順番 / 役割</dt><dd>{magazine.order ?? "—"} / {MAGAZINE_ROLE_LABELS[magazine.role]}</dd></div>
            </>
          )}
        </dl>

        {images}
        {aiTools}

        <BodySection title="完成本文" value={detail.body} />
        <BodySection title="掲載用本文" value={detail.workspace.publishBody} />
        <BodySection title="元記事" value={detail.workspace.sourceBody} />
      </article>
    </>
  );
}

function BodySection({ title, value }: { title: string; value: string | null }) {
  return (
    <section className="body-section">
      <h3>{title}</h3>
      <pre>{value || "（本文なし）"}</pre>
    </section>
  );
}
