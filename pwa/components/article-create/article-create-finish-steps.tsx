import { useState } from "react";

import {
  publicationBodyForCopy,
  publicationEditorLink,
  type ArticleCreationDraft,
  type SaveStatus,
} from "@/lib/phase11-create";
import { copyNoteRichText } from "@/lib/note-rich-text";
import type { ImagePromptItem } from "@/lib/phase13-image-prompts";
import {
  AI_LAUNCH_OPTIONS,
  CopyAndOpenAiButton,
  CopyButton,
  type ArticleDraftPatch,
  type MessageSetter,
} from "@/components/article-create/article-create-step-shared";

export function PreviewStep({
  draft,
  imagePrompts,
  combinedImagePrompt,
  onBeforeExternalLaunch,
  setMessage,
}: {
  draft: ArticleCreationDraft;
  imagePrompts: ImagePromptItem[];
  combinedImagePrompt: string;
  onBeforeExternalLaunch: () => void;
  setMessage: MessageSetter;
}) {
  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 7</p><h2>内容を確認しましょう</h2>
      <div className="preview-meta"><span>{draft.publicationTarget}</span><span>{draft.articleType === "paid" ? "有料" : "無料"}</span><span>{draft.genre || "ジャンル未指定"}</span><span>{draft.subgenre || "サブジャンル未指定"}</span><span>{draft.body.length.toLocaleString()}文字</span></div>
      <h3>{draft.title || "タイトル未入力"}</h3>
      <pre className="creator-preview">{draft.body || "本文がまだありません。"}</pre>

      {imagePrompts.length > 0 && combinedImagePrompt && (
        <section className="creator-image-prompts" aria-label="記事画像生成プロンプト">
          <div className="creator-image-prompts-head">
            <h3>画像生成プロンプト（一括・個別）</h3>
            <p className="panel-muted">STEP 3の画像設定と完成本文をもとに、一括作成用と画像ごとの個別作成用プロンプトを用意しています。</p>
          </div>
          <article className="creator-image-prompt-card">
            <div className="creator-image-prompt-title">
              <strong>まとめて画像作成プロンプト</strong>
              <span>{imagePrompts.length}枚分</span>
            </div>
            <textarea className="prompt-area large" readOnly value={combinedImagePrompt} />
            <div className="openai-prompt-actions">
              <CopyButton value={combinedImagePrompt} label="まとめて画像プロンプトをコピー" setMessage={setMessage} />
              {AI_LAUNCH_OPTIONS.map((app) => (
                <CopyAndOpenAiButton
                  key={app.key}
                  value={combinedImagePrompt}
                  appKey={app.key}
                  appLabel={app.label}
                  onBeforeExternalLaunch={onBeforeExternalLaunch}
                  setMessage={setMessage}
                />
              ))}
            </div>
            <div className="creator-image-prompt-meta">
              {imagePrompts.map((item) => (
                <small key={item.kind + "-" + item.order}>
                  {item.kind === "cover" ? "アイキャッチ" : "挿絵 " + item.order}
                  {item.insertionMarker ? " / <!-- " + item.insertionMarker + " -->" : ""}
                  {" / " + item.suggestedFilename}
                </small>
              ))}
            </div>
          </article>
          <div className="route-notice">
            <strong>画像生成では一時チャットは使用不可</strong><br />
            ChatGPTで画像を作成する場合は通常チャットを使用してください。一括作成・個別作成のどちらでも同じです。
          </div>
          <div className="creator-image-prompts-head">
            <h4>個別に画像を作成</h4>
            <p className="panel-muted">必要な画像だけ作り直したい場合は、下の各プロンプトを1つずつコピーして画像生成AIへ貼り付けてください。</p>
          </div>
          {imagePrompts.map((item) => {
            const label = item.kind === "cover" ? "アイキャッチ" : "挿絵 " + item.order;
            return (
              <article className="creator-image-prompt-card" key={item.kind + "-individual-" + item.order}>
                <div className="creator-image-prompt-title">
                  <strong>{label}・個別作成プロンプト</strong>
                  <span>{item.suggestedFilename}</span>
                </div>
                <textarea className="prompt-area large" readOnly value={item.prompt} />
                <div className="openai-prompt-actions">
                  <CopyButton value={item.prompt} label={label + "の個別画像プロンプトをコピー"} setMessage={setMessage} />
                  {AI_LAUNCH_OPTIONS.map((app) => (
                    <CopyAndOpenAiButton
                      key={app.key}
                      value={item.prompt}
                      appKey={app.key}
                      appLabel={app.label}
                      onBeforeExternalLaunch={onBeforeExternalLaunch}
                      setMessage={setMessage}
                    />
                  ))}
                </div>
                <div className="creator-image-prompt-meta">
                  <small>
                    {item.insertionMarker ? "差し込み位置: <!-- " + item.insertionMarker + " --> / " : ""}
                    {"保存名: " + item.suggestedFilename + " / alt候補: " + item.altText}
                  </small>
                </div>
              </article>
            );
          })}
          <p className="beginner-help">一括作成は全画像を同じ世界観でまとめて依頼する時、個別作成は特定の画像だけ作成・再作成する時に使います。どちらも一時チャットは使用せず、通常チャットで画像生成してください。</p>
        </section>
      )}
    </div>
  );
}

export function SaveStep({
  draft,
  patch,
  tagsText,
  setTagsText,
  busy,
  createdId,
  onSave,
  setMessage,
  stockSummary,
  stockSummaryError,
  saveQuotaReached,
}: {
  draft: ArticleCreationDraft;
  patch: ArticleDraftPatch;
  tagsText: string;
  setTagsText: (value: string) => void;
  busy: boolean;
  createdId: string;
  onSave: () => Promise<void>;
  setMessage: MessageSetter;
  stockSummary: ArticleStockSummary | null;
  stockSummaryError: string;
  saveQuotaReached: boolean;
}) {
  const [publicationCopied, setPublicationCopied] = useState(false);
  const publicationBody = publicationBodyForCopy(draft.body, draft.title, {
    articleType: draft.articleType,
    inlineEnabled: draft.inlineEnabled,
    inlineCount: draft.inlineCount,
  });
  const editorLink = publicationEditorLink(draft.publicationTarget);
  const publicationLabel = draft.publicationTarget === "note"
    ? "note"
    : draft.publicationTarget === "tips"
      ? "Tips"
      : draft.publicationTarget === "brain"
        ? "Brain"
        : "ブログ";

  const copyPublicationBody = async () => {
    if (!publicationBody) return;
    try {
      const mode = await copyNoteRichText(publicationBody);
      setPublicationCopied(true);
      window.setTimeout(() => setPublicationCopied(false), 2600);
      setMessage(publicationLabel + "へ貼り付ける装飾付き本文をコピーしました（" + (mode === "rich" ? "HTML形式" : "リッチテキスト形式") + "）。");
    } catch (error) {
      setPublicationCopied(false);
      setMessage(error instanceof Error ? error.message : "装飾付きコピーに失敗しました。");
    }
  };
  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 8</p><h2>タグを設定して記事ライブラリへ保存</h2>
      <p className="panel-muted">タグは記事内容が完成してから決めます。ジャンル・サブジャンルに合わせて投稿前の最終設定として入力してください。</p>
      <section className="creator-publish-copy" aria-label="掲載用コピー">
        <h3>完成記事を掲載先へコピー</h3>
        <p className="panel-muted">タイトルと本文を分けてコピーします。本文は見出し・太字・引用・リスト等を装飾付きでコピーし、挿絵位置と有料エリア位置には貼り付け後も作業しやすい空きスペースと目印を残します。</p>
        <div className="openai-prompt-actions">
          <CopyButton value={draft.title} label="タイトルをコピー" setMessage={setMessage} />
          <button className="primary-action" type="button" disabled={!publicationBody} onClick={() => void copyPublicationBody()}>{publicationCopied ? "装飾付きでコピーしました ✓" : "完成本文を装飾付きコピー"}</button>
        </div>
        {draft.articleType === "paid" && (
          <div className="note-paid-area-guide">
            <strong>{publicationLabel}の有料記事を仕上げる</strong>
            <small>
              {draft.publicationTarget === "note"
                ? "本文をnoteへ貼り付けると「【ここから有料エリア】」の前後に空きスペースが残ります。その位置でnoteの有料エリアを設定し、設定後に目印の文字だけ削除してください。"
                : draft.publicationTarget === "tips"
                  ? "本文をTipsへ貼り付けると「【ここから有料エリア】」の前後に空きスペースが残ります。その位置をTipsの有料エリア境界として調整し、設定後に目印の文字だけ削除してください。"
                  : draft.publicationTarget === "brain"
                    ? "本文をBrainへ貼り付けた後、「【ここから有料エリア】」の目印を基準に、Brain側の現在の販売・公開設定に合わせて無料説明部分と購入者向け本文の境界を調整してください。設定後は目印の文字を削除してください。"
                    : "利用中のブログ／販売サービスへ貼り付けた後、「【ここから有料エリア】」の目印を基準に、そのサービスの販売・公開設定に合わせて無料部分と購入者向け本文の境界を調整してください。設定後は目印の文字を削除してください。"}
            </small>
          </div>
        )}
        {draft.inlineEnabled && (
          <div className="note-image-marker-guide">
            <strong>挿絵の差し込み</strong>
            <small>「【挿絵1をここに挿入】」などの目印の前後に空きスペースが残ります。そのスペースへ画像を挿入し、画像配置後に目印の文字だけ削除してください。</small>
          </div>
        )}
        {editorLink
          ? <a className="openai-launch-action creator-publication-link" href={editorLink} target="_blank" rel="noreferrer">{publicationLabel}の投稿先を開く ↗</a>
          : <p className="beginner-help">「ブログ」は特定サービスを指さないため外部URLを固定していません。利用中のブログ管理画面を開いて貼り付けてください。</p>}
      </section>
      <label className="route-field"><span>タグ（任意・投稿前に設定）</span><input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="例：恋愛, 人間関係, 職場" /></label>
      <label className="route-field"><span>保存状態</span><select value={draft.saveStatus} onChange={(event) => patch("saveStatus", event.target.value as SaveStatus)}><option value="draft">下書き</option><option value="writing">執筆中</option><option value="ready">完成</option></select></label>
      <dl className="route-meta"><div><dt>タイトル</dt><dd>{draft.title || "未入力"}</dd></div><div><dt>掲載先</dt><dd>{draft.publicationTarget}</dd></div><div><dt>ジャンル</dt><dd>{draft.genre} / {draft.subgenre}</dd></div><div><dt>本文</dt><dd>{draft.body.length.toLocaleString()}文字</dd></div><div><dt>画像</dt><dd>cover {draft.coverEnabled ? "ON" : "OFF"} / inline {draft.inlineEnabled ? draft.inlineCount : 0}</dd></div></dl>
      {!createdId && (
        <div className={`article-create-stock-status ${saveQuotaReached ? "reached" : ""}`}>
          {stockSummary ? (
            <>
              <div>
                <strong>{stockSummary.isUnlimited ? "保存枠: 無制限" : `保存枠: 残り${stockSummary.remainingArticles ?? 0}件 / ${stockSummary.maxArticles ?? 0}件`}</strong>
                <span>
                  {saveQuotaReached
                    ? "保存上限に達しています。不要な記事を整理するか、利用プランを確認してください。"
                    : "保存ボタンを押す直前にも最新の保存枠を再確認します。"}
                </span>
              </div>
              {saveQuotaReached && <Link href="/plans">利用プランを確認 →</Link>}
            </>
          ) : stockSummaryError ? (
            <div>
              <strong>保存枠を事前確認できませんでした。</strong>
              <span>{stockSummaryError}</span>
            </div>
          ) : (
            <div>
              <strong>保存枠を確認しています。</strong>
              <span>記事ライブラリの残り保存件数を確認中です。</span>
            </div>
          )}
        </div>
      )}
      {!createdId && <button className="primary-action" type="button" disabled={busy || !draft.title.trim() || saveQuotaReached} onClick={() => void onSave()}>{busy ? "保存中…" : "記事ライブラリへ保存"}</button>}
      {createdId && <div className="route-notice"><strong>保存完了</strong><br />Article ID: {createdId}</div>}
    </div>
  );
}
