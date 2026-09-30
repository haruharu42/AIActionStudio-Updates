"use client";

import Link from "next/link";
import { useState } from "react";

import type { ArticleLibraryItem, ArticleStockSummary } from "@/lib/article-library-v2";
import type { ArticleStatus } from "@/lib/phase7-articles";
import {
  ARTICLE_LIBRARY_PAGE_SIZE,
  ARTICLE_STATUS_LABELS,
  formatArticleLibraryDate,
  type LibraryFilters,
} from "@/lib/article-library-view";

type FilterChange = <Key extends keyof LibraryFilters>(key: Key, value: LibraryFilters[Key]) => void;

export function ArticleLibraryListView({
  articles,
  totalCount,
  stockSummary,
  stockSummaryError,
  hasMore,
  loading,
  loadingMore,
  error,
  filters,
  filtersActive,
  desktopDownloads,
  genres,
  subgenres,
  magazines,
  onFilterChange,
  onResetFilters,
  onReload,
  onOpen,
  onLoadMore,
}: {
  articles: ArticleLibraryItem[];
  totalCount: number;
  stockSummary: ArticleStockSummary | null;
  stockSummaryError: string;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  filters: LibraryFilters;
  filtersActive: boolean;
  desktopDownloads: boolean;
  genres: string[];
  subgenres: string[];
  magazines: string[];
  onFilterChange: FilterChange;
  onResetFilters: () => void;
  onReload: () => void;
  onOpen: (articleId: string) => void;
  onLoadMore: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const stockState = stockSummary && !stockSummary.isUnlimited
    ? stockSummary.remainingArticles === 0
      ? "reached"
      : stockSummary.remainingArticles !== null
        && stockSummary.maxArticles !== null
        && stockSummary.remainingArticles <= Math.max(2, Math.ceil(stockSummary.maxArticles * 0.1))
        ? "warning"
        : "normal"
    : "normal";

  return (
    <>
      <section className={`library-filter-panel ${filtersOpen ? "open" : "closed"}`}>
        <button
          className="library-filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="article-library-filters"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          <span>
            <strong>検索・絞り込み</strong>
            <small>{filtersActive ? "絞り込み条件を指定中" : "条件なし・すべての記事"}</small>
          </span>
          <span className="library-filter-toggle-state" aria-hidden="true">
            {filtersOpen ? "閉じる ▲" : "開く ▼"}
          </span>
        </button>

        {filtersOpen && (
          <div id="article-library-filters" className="editor-card library-filter-fields">
        <label className="editor-field full">
          <span>検索</span>
          <input
            value={filters.query}
            onChange={(event) => onFilterChange("query", event.target.value)}
            placeholder="タイトル・ジャンル・タグ・マガジン・シリーズ"
          />
        </label>
        <label className="editor-field">
          <span>状態</span>
          <select
            value={filters.status}
            onChange={(event) => onFilterChange("status", event.target.value as ArticleStatus | "")}
          >
            <option value="">すべて</option>
            {Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="editor-field">
          <span>掲載先</span>
          <select
            value={filters.publicationTarget}
            onChange={(event) => onFilterChange("publicationTarget", event.target.value)}
          >
            <option value="">すべて</option>
            <option value="note">note</option>
            <option value="tips">Tips</option>
            <option value="brain">Brain</option>
            <option value="blog">ブログ</option>
          </select>
        </label>
        <label className="editor-field">
          <span>無料 / 有料</span>
          <select
            value={filters.articleType}
            onChange={(event) => onFilterChange("articleType", event.target.value as "free" | "paid" | "")}
          >
            <option value="">すべて</option>
            <option value="free">無料</option>
            <option value="paid">有料</option>
          </select>
        </label>
        <label className="editor-field">
          <span>ジャンル</span>
          <input
            list="library-genres"
            value={filters.genre}
            onChange={(event) => onFilterChange("genre", event.target.value)}
            placeholder="完全一致 / 空欄ですべて"
          />
          <datalist id="library-genres">{genres.map((value) => <option key={value} value={value} />)}</datalist>
        </label>
        <label className="editor-field">
          <span>サブジャンル</span>
          <input
            list="library-subgenres"
            value={filters.subgenre}
            onChange={(event) => onFilterChange("subgenre", event.target.value)}
            placeholder="完全一致 / 空欄ですべて"
          />
          <datalist id="library-subgenres">{subgenres.map((value) => <option key={value} value={value} />)}</datalist>
        </label>
        <label className="editor-field">
          <span>noteマガジン</span>
          <input
            list="library-magazines"
            value={filters.magazineName}
            onChange={(event) => onFilterChange("magazineName", event.target.value)}
            placeholder="マガジン名 / 空欄ですべて"
          />
          <datalist id="library-magazines">{magazines.map((value) => <option key={value} value={value} />)}</datalist>
        </label>
        <label className="editor-field">
          <span>並び替え</span>
          <select value={filters.sort} onChange={(event) => onFilterChange("sort", event.target.value as LibraryFilters["sort"])}>
            <option value="updated_desc">更新が新しい順</option>
            <option value="updated_asc">更新が古い順</option>
            <option value="created_desc">作成が新しい順</option>
            <option value="created_asc">作成が古い順</option>
            <option value="title_asc">タイトル順</option>
            <option value="status_asc">状態順</option>
            <option value="genre_asc">ジャンル順</option>
            <option value="subgenre_asc">サブジャンル順</option>
            <option value="magazine_asc">マガジン順</option>
          </select>
        </label>
        <div className="wizard-actions full">
          <button className="secondary-action" type="button" onClick={onResetFilters} disabled={!filtersActive}>条件をリセット</button>
          <button className="secondary-action" type="button" onClick={onReload} disabled={loading}>一覧を更新</button>
          {desktopDownloads && <Link className="secondary-action" href="/export">PC一括保存へ</Link>}
        </div>
          </div>
        )}
      </section>

      {stockSummary ? (
        <section className={`library-stock-summary ${stockState}`} aria-label="記事ライブラリ保存状況">
          <div className="library-stock-metric">
            <span>保存済み</span>
            <strong>{stockSummary.currentArticles}件</strong>
          </div>
          <div className="library-stock-metric">
            <span>保存上限</span>
            <strong>{stockSummary.isUnlimited ? "無制限" : `${stockSummary.maxArticles ?? 0}件`}</strong>
          </div>
          <div className="library-stock-metric">
            <span>残り保存可能</span>
            <strong>{stockSummary.isUnlimited ? "制限なし" : `${stockSummary.remainingArticles ?? 0}件`}</strong>
          </div>
          <div className="library-stock-guidance">
            {stockState === "reached" ? (
              <>
                <strong>保存上限に達しています。</strong>
                <span>不要な記事を整理するか、Creator Club特典を確認してください。</span>
                <Link href="/membership">Creator Club特典を確認 →</Link>
              </>
            ) : stockState === "warning" ? (
              <>
                <strong>保存上限が近づいています。</strong>
                <span>新しい記事を作る前に残り件数を確認してください。</span>
                <Link href="/membership">Creator Club特典を確認 →</Link>
              </>
            ) : (
              <>
                <strong>現在の保存枠</strong>
                <span>{stockSummary.isUnlimited ? "記事数を気にせず保存できます。" : "作成・複製すると残り件数が1件減ります。"}</span>
              </>
            )}
          </div>
        </section>
      ) : stockSummaryError ? (
        <div className="library-stock-summary unavailable" role="note">
          <div className="library-stock-guidance">
            <strong>保存上限を確認できませんでした。</strong>
            <span>{stockSummaryError} 記事一覧はそのまま利用できます。</span>
          </div>
        </div>
      ) : null}

      <div className="library-toolbar">
        <span>{articles.length} / {totalCount} 件を表示</span>
        <small>一覧は本文なし・最大{ARTICLE_LIBRARY_PAGE_SIZE}件ずつ取得</small>
      </div>

      {loading ? (
        <div className="library-loading" role="status"><span className="spinner" />記事を読み込んでいます…</div>
      ) : articles.length === 0 && !error ? (
        <EmptyLibrary onReload={onReload} filtered={filtersActive} />
      ) : (
        <>
          <ArticleList articles={articles} onOpen={onOpen} />
          {hasMore && (
            <div className="image-save">
              <span>残り {Math.max(0, totalCount - articles.length)} 件</span>
              <button className="secondary-action" type="button" disabled={loadingMore} onClick={onLoadMore}>
                {loadingMore ? "読み込み中…" : `さらに${ARTICLE_LIBRARY_PAGE_SIZE}件読み込む`}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function EmptyLibrary({ onReload, filtered }: { onReload: () => void; filtered: boolean }) {
  return (
    <section className="library-empty">
      <span aria-hidden="true">▤</span>
      <h2>{filtered ? "条件に一致する記事がありません" : "クラウド記事はまだありません"}</h2>
      <p>
        {filtered
          ? "絞り込み条件を変更するか、条件をリセットしてください。"
          : "PWAで作成した記事や、これまでに同期済みの記事がここに表示されます。"}
      </p>
      <button className="secondary-action" type="button" onClick={onReload}>一覧を更新</button>
    </section>
  );
}

function ArticleList({ articles, onOpen }: { articles: ArticleLibraryItem[]; onOpen: (id: string) => void }) {
  return (
    <div className="article-list" role="list">
      {articles.map((article) => (
        <button className="article-row" key={article.id} type="button" role="listitem" onClick={() => onOpen(article.id)}>
          <span className="article-main">
            <strong>{article.title || "無題の記事"}</strong>
            <small>
              {article.publicationTarget} · {article.articleType === "paid" ? "有料" : "無料"}
              {article.genre ? ` · ${article.genre}` : ""}
              {article.subgenre ? ` / ${article.subgenre}` : ""}
            </small>
            {article.magazineEnabled && article.magazineName && (
              <small>noteマガジン: {article.magazineName}{article.seriesOrder !== null ? ` · #${article.seriesOrder}` : ""}</small>
            )}
          </span>
          <span className={`article-status status-${article.status}`}>{ARTICLE_STATUS_LABELS[article.status]}</span>
          <span className="article-date">
            <small>更新</small>
            {formatArticleLibraryDate(article.updatedAt)}
          </span>
          <span className="row-arrow" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}
