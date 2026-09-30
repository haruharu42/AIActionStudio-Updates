"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AppLoadingScreen } from "@/components/app-loading-screen";

import {
  listArticleLibraryPage,
  type ArticleLibraryItem,
} from "@/lib/article-library-v2";
import {
  articleExportBody,
  articleExportFilename,
  articleExportHtml,
  articleExportJson,
  articleExportMarkdown,
  articleExportText,
  buildArticleExportFiles,
  createStoredZip,
  safeArticleBaseName,
  type ArticleExportFile,
} from "@/lib/article-export";
import { copyNoteRichText } from "@/lib/note-rich-text";
import {
  getCloudArticleDetail,
  type ArticleDetail,
  type ArticleStatus,
} from "@/lib/phase7-articles";

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "下書き",
  writing: "執筆中",
  ready: "完成",
  waiting_publish: "公開待ち",
  published: "公開済み",
  on_hold: "保留",
  archived: "アーカイブ",
};

function isDesktopBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function safeGroupName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80) || "AAS_articles";
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ArticleExportPage() {
  const { state: accessState, client } = useSharedAccessState();
  const [loadError, setLoadError] = useState("");
  const [articles, setArticles] = useState<ArticleLibraryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [detail, setDetail] = useState<ArticleDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [magazineFilter, setMagazineFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | "">("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDesktop(isDesktopBrowser()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (accessState.kind !== "ready" || !client) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setLoadError("");
    });
    void listArticleLibraryPage(client, accessState.profile.id, { limit: 100, sort: "updated_desc" }).then(
      (page) => {
        if (!active) return;
        setArticles(page.items);
        setTotalCount(page.totalCount);
      },
      (error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "記事ライブラリを読み込めませんでした。");
      },
    );
    return () => { active = false; };
  }, [accessState, client]);

  const body = useMemo(() => detail ? articleExportBody(detail) : "", [detail]);
  const filename = useMemo(() => detail ? articleExportFilename(detail) : "", [detail]);
  const magazineOptions = useMemo(
    () => [...new Set(articles.filter((article) => article.magazineEnabled && article.magazineName).map((article) => article.magazineName as string))].sort((a, b) => a.localeCompare(b, "ja")),
    [articles],
  );
  const bulkCandidates = useMemo(() => articles
    .filter((article) => !magazineFilter || article.magazineName === magazineFilter)
    .filter((article) => !statusFilter || article.status === statusFilter)
    .sort((a, b) => {
      if (magazineFilter) {
        const orderA = a.seriesOrder ?? 9999;
        const orderB = b.seriesOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
      }
      return a.title.localeCompare(b.title, "ja");
    }), [articles, magazineFilter, statusFilter]);

  const choose = async (articleId: string) => {
    if (accessState.kind !== "ready" || !client) return;
    setDetail(null); setMessage("");
    if (!articleId) return;
    setBusy(true);
    try { setDetail(await getCloudArticleDetail(client, accessState.profile.id, articleId)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "記事を読み込めませんでした。"); }
    finally { setBusy(false); }
  };

  const copyMarkdown = async () => {
    if (!body) return;
    try { await navigator.clipboard.writeText(body); setMessage("Markdown形式の掲載用本文をコピーしました。"); }
    catch { setMessage("自動コピーできません。本文欄から手動でコピーしてください。"); }
  };

  const copyPlain = async () => {
    if (!detail) return;
    const plain = articleExportText(detail).trimEnd();
    if (!plain) return;
    try { await navigator.clipboard.writeText(plain); setMessage("装飾記号を外したプレーンテキストをコピーしました。"); }
    catch { setMessage("プレーンテキストを自動コピーできませんでした。"); }
  };

  const copyForNote = async () => {
    if (!detail || detail.publicationTarget !== "note" || !body) return;
    try {
      await copyNoteRichText(body);
      setMessage("note用の装飾付き本文をコピーしました。note本文欄へCtrl+Vしてください。noteが対応する装飾のみ反映されます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "note用の装飾付きコピーに失敗しました。");
    }
  };

  const downloadCurrent = (format: "md" | "txt" | "html" | "json") => {
    if (!detail || !desktop) return;
    const base = safeArticleBaseName(detail);
    const choices = {
      md: { content: articleExportMarkdown(detail), type: "text/markdown;charset=utf-8", name: `${base}.md` },
      txt: { content: articleExportText(detail), type: "text/plain;charset=utf-8", name: `${base}.txt` },
      html: { content: articleExportHtml(detail), type: "text/html;charset=utf-8", name: `${base}.html` },
      json: { content: articleExportJson(detail), type: "application/json;charset=utf-8", name: `${base}.json` },
    } as const;
    const selected = choices[format];
    saveBlob(new Blob([selected.content], { type: selected.type }), selected.name);
    setMessage(`${selected.name} をPCへ保存しました。`);
  };

  const downloadCurrentZip = () => {
    if (!detail || !desktop) return;
    saveBlob(createStoredZip(buildArticleExportFiles(detail)), `${safeArticleBaseName(detail)}_AAS.zip`);
    setMessage("記事一式ZIPをこのPC内で作成して保存しました。");
  };

  const downloadBulkZip = async () => {
    if (accessState.kind !== "ready" || !client || !desktop || bulkBusy || !bulkCandidates.length) return;
    if (bulkCandidates.length > 100) { setMessage("一度の一括保存は100記事以内にしてください。"); return; }
    setBulkBusy(true); setMessage("");
    try {
      const details: ArticleDetail[] = [];
      for (const item of bulkCandidates) {
        details.push(await getCloudArticleDetail(client, accessState.profile.id, item.id));
      }
      const files: ArticleExportFile[] = details.map((item, index) => ({
        name: `${String(index + 1).padStart(3, "0")}_${safeArticleBaseName(item)}.md`,
        content: articleExportMarkdown(item),
        type: "text/markdown;charset=utf-8",
      }));
      files.push({
        name: "aas-backup.json",
        content: `${JSON.stringify({
          exportVersion: 1,
          exportedAt: new Date().toISOString(),
          filter: { magazine: magazineFilter || null, status: statusFilter || null },
          articles: details.map((item) => JSON.parse(articleExportJson(item)) as unknown),
        }, null, 2)}\n`,
        type: "application/json;charset=utf-8",
      });
      const group = magazineFilter || (statusFilter ? `AAS_${STATUS_LABELS[statusFilter]}` : "AAS_articles");
      saveBlob(createStoredZip(files), `${safeGroupName(group)}_backup.zip`);
      setMessage(`${details.length}記事をZIPへまとめ、PCへ保存しました。ZIP生成はブラウザ内だけで行っています。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "一括保存に失敗しました。");
    } finally { setBulkBusy(false); }
  };

  if (accessState.kind === "loading") {
    return <AppLoadingScreen message="記事出力を準備しています…" />;
  }

  if (accessState.kind !== "ready" || !client) {
    return (
      <main className="standalone-page"><section className="standalone-card">
        <p className="eyebrow">ARTICLE OUTPUT</p><h1>記事出力</h1>
        {accessState.kind === "unavailable" && <p className="route-notice error">AASへ接続できませんでした。通信状態を確認してください。</p>}
        {accessState.kind === "signed_out" && <p className="route-notice error">先にログインしてください。</p>}
        {accessState.kind === "pending" && <p className="route-notice">アカウント承認後に利用できます。</p>}
        {(accessState.kind === "suspended" || accessState.kind === "disabled") && <p className="route-notice error">現在のアカウント状態では利用できません。</p>}
        {accessState.kind === "entitlement_denied" && <p className="route-notice error">PWA利用権が必要です。</p>}
        <Link className="route-back" href="/tools">← 機能一覧へ戻る</Link>
      </section></main>
    );
  }

  return (
    <main className="creator-page">
      <header className="creator-head">
        <div><p className="eyebrow">ARTICLE OUTPUT</p><h1>記事をコピー・PC保存</h1><p>{accessState.profile.aas_user_id} / note装飾コピー・Markdown・TXT・HTML・JSON・ZIP</p></div>
        <Link className="route-back" href="/tools">← 機能一覧</Link>
      </header>
      <section className="creator-card">
        {loadError && <div className="route-notice error" role="alert">{loadError}</div>}
        {!desktop && <div className="route-notice">ファイル保存・ZIP一括バックアップはPC版Chrome / Edge等から利用してください。スマホではテキストコピーを利用できます。</div>}
        {totalCount > articles.length && <div className="route-notice">現在の一括保存画面は先頭100記事までを対象にします。記事ライブラリ側では50件単位のページングで全記事を閲覧できます。</div>}

        <label className="route-field"><span>記事</span><select defaultValue="" disabled={busy || bulkBusy} onChange={(event) => void choose(event.target.value)}><option value="">選択してください</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.title} / {STATUS_LABELS[article.status]}</option>)}</select></label>
        {detail && <>
          <dl className="route-meta"><div><dt>タイトル</dt><dd>{detail.title}</dd></div><div><dt>掲載先</dt><dd>{detail.publicationTarget}</dd></div><div><dt>revision</dt><dd>{detail.revision}</dd></div><div><dt>標準ファイル名</dt><dd>{filename}</dd></div></dl>
          <label className="route-field"><span>掲載用本文</span><textarea className="body-area" readOnly value={body} /></label>
          {detail.publicationTarget === "note" && desktop && <div className="route-notice" role="note">「note用・装飾付きコピー」は見出し・太字・リスト・引用・リンク・区切り・コード等をリッチテキストとしてコピーします。note側が対応する装飾だけが貼り付け時に反映されます。</div>}
          <div className="wizard-actions">
            {detail.publicationTarget === "note" && desktop && <button className="primary-action" type="button" disabled={!body} onClick={() => void copyForNote()}>note用・装飾付きコピー</button>}
            <button className="secondary-action" type="button" disabled={!body} onClick={() => void copyMarkdown()}>Markdownをコピー</button>
            <button className="secondary-action" type="button" disabled={!body} onClick={() => void copyPlain()}>プレーンをコピー</button>
            {desktop && <><button className="secondary-action" type="button" onClick={() => downloadCurrent("md")}>Markdown保存</button><button className="secondary-action" type="button" onClick={() => downloadCurrent("txt")}>TXT保存</button><button className="secondary-action" type="button" onClick={() => downloadCurrent("html")}>装飾HTML保存</button><button className="secondary-action" type="button" onClick={() => downloadCurrent("json")}>JSONバックアップ</button><button className="primary-action" type="button" onClick={downloadCurrentZip}>記事一式ZIP</button></>}
          </div>
        </>}

        <hr />
        <h2>一括バックアップ</h2>
        <p className="panel-muted">マガジンや状態で対象を絞り、Markdown記事と復元用JSONを1つのZIPへまとめます。ZIPの組み立てはPCのブラウザ内で行い、サーバーへファイル生成処理を依頼しません。</p>
        <div className="creator-form-grid">
          <label className="route-field"><span>noteマガジン</span><select value={magazineFilter} onChange={(event) => setMagazineFilter(event.target.value)}><option value="">すべて</option>{magazineOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label className="route-field"><span>状態</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ArticleStatus | "")}><option value="">すべて</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="wizard-actions"><span>{bulkCandidates.length}記事</span><button className="primary-action" type="button" disabled={!desktop || bulkBusy || !bulkCandidates.length} onClick={() => void downloadBulkZip()}>{bulkBusy ? "記事を取得中…" : "条件一致の記事をZIP保存"}</button></div>

        {message && <div className="route-notice">{message}</div>}
        <p className="panel-muted">外部サービスへの自動投稿は行いません。装飾付きコピーはクリップボード内だけで処理し、noteへ自動送信しません。JSONバックアップには自分の記事・Workspace・noteマガジン管理情報が含まれます。画像本体は端末保存方式のためZIPには含めません。</p>
      </section>
    </main>
  );
}
