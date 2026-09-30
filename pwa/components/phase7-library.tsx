"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ArticleAiTools } from "@/components/article-ai-tools";
import { ArticleLibraryDetailView } from "@/components/article-library/article-library-detail";
import { ArticleLibraryEditor } from "@/components/article-library/article-library-editor";
import { ArticleLibraryListView } from "@/components/article-library/article-library-list";
import { Phase8Images } from "@/components/phase8-images";
import { articleExportFilename, articleExportMarkdown } from "@/lib/article-export";
import {
  duplicateCloudArticle,
  getArticleStockSummary,
  listArticleLibraryPage,
  withNoteMagazineWorkspace,
  type ArticleLibraryItem,
  type ArticleStockSummary,
  type NoteMagazineSettings,
} from "@/lib/article-library-v2";
import {
  ARTICLE_LIBRARY_PAGE_SIZE,
  DEFAULT_LIBRARY_FILTERS,
  areLibraryFiltersActive,
  articlePatchFromDetail,
  collectArticleLibraryFilterOptions,
  isDesktopArticleLibraryUserAgent,
  statusFromArchiveWorkspace,
  type LibraryFilters,
  type LibraryView,
} from "@/lib/article-library-view";
import {
  ArticleLibraryError,
  articleLibraryMessage,
  buildCompatibleWorkspacePatch,
  deleteCloudArticle,
  getCloudArticleDetail,
  updateCloudArticle,
  type ArticleDetail,
  type ArticlePatch,
} from "@/lib/phase7-articles";

export function Phase7Library({
  client,
  ownerId,
  onUnsavedChange,
  onBusyChange,
}: {
  client: SupabaseClient;
  ownerId: string;
  onUnsavedChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [imageBusy, setImageBusy] = useState(false);
  const [imageUnsaved, setImageUnsaved] = useState(false);
  const [view, setView] = useState<LibraryView>("list");
  const [articles, setArticles] = useState<ArticleLibraryItem[]>([]);
  const [detail, setDetail] = useState<ArticleDetail | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [desktopDownloads, setDesktopDownloads] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stockSummary, setStockSummary] = useState<ArticleStockSummary | null>(null);
  const [stockSummaryError, setStockSummaryError] = useState("");
  const listRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDesktopDownloads(isDesktopArticleLibraryUserAgent(navigator.userAgent)),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    onUnsavedChange?.(imageUnsaved);
    return () => onUnsavedChange?.(false);
  }, [imageUnsaved, onUnsavedChange]);

  useEffect(() => {
    onBusyChange?.(imageBusy || busy);
    return () => onBusyChange?.(false);
  }, [busy, imageBusy, onBusyChange]);

  const leaveImages = () =>
    !imageBusy &&
    (!imageUnsaved || window.confirm("未保存の画像情報を破棄して移動しますか？"));

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const requestId = ++listRequestIdRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const page = await listArticleLibraryPage(client, ownerId, {
        ...filters,
        limit: ARTICLE_LIBRARY_PAGE_SIZE,
        offset,
      });
      if (requestId !== listRequestIdRef.current) return;

      setArticles((current) => append ? [...current, ...page.items] : page.items);
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    } catch (caught) {
      if (requestId === listRequestIdRef.current) {
        setError(articleLibraryMessage(caught));
      }
    } finally {
      if (requestId === listRequestIdRef.current) {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    }
  }, [client, filters, ownerId]);

  const reload = useCallback(async () => {
    await fetchPage(0, false);
  }, [fetchPage]);

  const refreshStockSummary = useCallback(async () => {
    setStockSummaryError("");
    try {
      setStockSummary(await getArticleStockSummary(client));
    } catch {
      setStockSummary(null);
      setStockSummaryError("保存数・上限・残り件数を確認できませんでした。");
    }
  }, [client]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reload();
      void refreshStockSummary();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [reload, refreshStockSummary]);

  const filterOptions = useMemo(() => collectArticleLibraryFilterOptions(articles), [articles]);
  const filtersActive = useMemo(() => areLibraryFiltersActive(filters), [filters]);

  const changeFilter = <Key extends keyof LibraryFilters>(key: Key, value: LibraryFilters[Key]) => {
    listRequestIdRef.current += 1;
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    listRequestIdRef.current += 1;
    setFilters(DEFAULT_LIBRARY_FILTERS);
  };

  const open = async (articleId: string) => {
    const requestId = ++detailRequestIdRef.current;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const nextDetail = await getCloudArticleDetail(client, ownerId, articleId);
      if (requestId !== detailRequestIdRef.current) return;
      setDetail(nextDetail);
      setView("detail");
    } catch (caught) {
      if (requestId === detailRequestIdRef.current) {
        setError(articleLibraryMessage(caught));
      }
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const save = async (
    article: ArticlePatch,
    sourceBody: string | null,
    publishBody: string | null,
    magazine: NoteMagazineSettings,
  ) => {
    if (!detail || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const workspacePatch = buildCompatibleWorkspacePatch(detail, article, sourceBody, publishBody);
      workspacePatch.workspace_json = withNoteMagazineWorkspace(workspacePatch.workspace_json, magazine);
      const updated = await updateCloudArticle(
        client,
        ownerId,
        detail.id,
        detail.revision,
        article,
        workspacePatch,
      );
      setDetail(updated);
      setView("detail");
      setSuccess("記事とnoteマガジン設定を保存しました。");
      await reload();
    } catch (caught) {
      setError(articleLibraryMessage(caught));
      if (caught instanceof ArticleLibraryError && caught.category === "conflict") {
        setView("edit");
      }
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const id = await duplicateCloudArticle(client, ownerId, detail);
      setSuccess("記事を複製しました。複製記事は下書きとして作成されています。");
      await Promise.all([reload(), refreshStockSummary()]);
      await open(id);
    } catch (caught) {
      setError(articleLibraryMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const archiveToggle = async () => {
    if (!detail || busy) return;
    const nextStatus = detail.status === "archived"
      ? statusFromArchiveWorkspace(detail)
      : "archived";
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const article = articlePatchFromDetail(detail, nextStatus);
      const workspacePatch = buildCompatibleWorkspacePatch(
        detail,
        article,
        detail.workspace.sourceBody,
        detail.workspace.publishBody,
      );
      workspacePatch.workspace_json = {
        ...workspacePatch.workspace_json,
        pwa_archive_previous_status: detail.status === "archived" ? null : detail.status,
      };
      const updated = await updateCloudArticle(
        client,
        ownerId,
        detail.id,
        detail.revision,
        article,
        workspacePatch,
      );
      setDetail(updated);
      setSuccess(nextStatus === "archived"
        ? "記事をアーカイブしました。"
        : "記事をアーカイブから戻しました。");
      await reload();
    } catch (caught) {
      setError(articleLibraryMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const downloadCurrent = () => {
    if (!detail || !desktopDownloads) return;
    const blob = new Blob([articleExportMarkdown(detail)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = articleExportFilename(detail);
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setSuccess("記事をPCへMarkdown保存しました。");
  };

  const remove = async () => {
    if (!detail || busy || imageBusy || !leaveImages()) return;
    const confirmed = window.confirm(
      `「${detail.title || "無題の記事"}」を完全削除しますか？\n\nこの操作は元に戻せません。通常は先にアーカイブすることをおすすめします。`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await deleteCloudArticle(client, ownerId, detail.id, detail.revision);
      detailRequestIdRef.current += 1;
      setDetail(null);
      setView("list");
      setSuccess("記事を完全削除しました。");
      await Promise.all([reload(), refreshStockSummary()]);
    } catch (caught) {
      setError(articleLibraryMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (!leaveImages()) return;
    detailRequestIdRef.current += 1;
    setView("list");
    setDetail(null);
    setError("");
  };

  return (
    <section className="library-page" aria-labelledby="library-title">
      <header className="library-head">
        <div>
          <p className="eyebrow">ARTICLE LIBRARY 2.0</p>
          <h1 id="library-title">記事ライブラリ</h1>
          <p>本文を一覧取得せず、必要な記事だけ開く軽量な管理画面です。noteマガジン管理にも対応しています。</p>
        </div>
        <span className="access-badge">● RLSでユーザー分離</span>
      </header>

      {error && (
        <div className="library-notice error" role="alert">
          <strong>処理を完了できませんでした</strong>
          <span>{error}</span>
        </div>
      )}
      {success && <div className="library-notice success" role="status">{success}</div>}

      {view === "list" && (
        <ArticleLibraryListView
          articles={articles}
          totalCount={totalCount}
          stockSummary={stockSummary}
          stockSummaryError={stockSummaryError}
          hasMore={hasMore}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          filters={filters}
          filtersActive={filtersActive}
          desktopDownloads={desktopDownloads}
          genres={filterOptions.genres}
          subgenres={filterOptions.subgenres}
          magazines={filterOptions.magazines}
          onFilterChange={changeFilter}
          onResetFilters={resetFilters}
          onReload={() => void Promise.all([reload(), refreshStockSummary()])}
          onOpen={(articleId) => void open(articleId)}
          onLoadMore={() => void fetchPage(articles.length, true)}
        />
      )}

      {view === "detail" && detail && (
        <ArticleLibraryDetailView
          detail={detail}
          busy={busy || imageBusy}
          desktopDownloads={desktopDownloads}
          onBack={back}
          onEdit={() => { if (leaveImages()) setView("edit"); }}
          onDuplicate={() => void duplicate()}
          onArchiveToggle={() => void archiveToggle()}
          onDownload={downloadCurrent}
          onDelete={() => void remove()}
          images={(
            <Phase8Images
              key={detail.id}
              client={client}
              ownerId={ownerId}
              articleId={detail.id}
              revision={detail.revision}
              onBusyChange={setImageBusy}
              onUnsavedChange={setImageUnsaved}
            />
          )}
          aiTools={(
            <ArticleAiTools
              key={`${detail.id}:${detail.revision}`}
              client={client}
              input={{
                title: detail.title,
                publicationTarget: detail.publicationTarget,
                articleType: detail.articleType,
                genre: detail.genre,
                subgenre: detail.subgenre,
                body: detail.body,
              }}
            />
          )}
        />
      )}

      {view === "edit" && detail && (
        <ArticleLibraryEditor
          key={`${detail.id}:${detail.revision}`}
          detail={detail}
          busy={busy}
          onCancel={() => setView("detail")}
          onSave={save}
        />
      )}
    </section>
  );
}
