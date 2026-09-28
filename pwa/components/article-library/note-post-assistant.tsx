"use client";

import { useEffect, useMemo, useState } from "react";

import { DirectRuntimeImage } from "@/components/direct-runtime-image";

import {
  deleteLocalArticleImage,
  listLocalArticleImages,
  saveLocalArticleImage,
  type LocalArticleImageKind,
  type LocalArticleImageRecord,
} from "@/lib/local-article-images";
import {
  buildNotePostSequence,
  copyImageBlobToClipboard,
  copyNotePostSequenceWithImages,
  inlineImageOrders,
  readNotePostImagePlanMetadata,
  type NotePostSequenceItem,
} from "@/lib/note-post-assistant";
import { copyNoteRichText, markdownToNoteHtml } from "@/lib/note-rich-text";
import type { ArticleDetail } from "@/lib/phase7-articles";

function recordKey(kind: LocalArticleImageKind, order: number): string {
  return `${kind}-${order}`;
}

export function NotePostAssistant({ detail, body }: { detail: ArticleDetail; body: string }) {
  const imagePlanMetadata = useMemo(
    () => readNotePostImagePlanMetadata(detail.workspace.imagePlanJson),
    [detail.workspace.imagePlanJson],
  );
  const sequence = useMemo(
    () => buildNotePostSequence(body, detail.title, {
      articleType: detail.articleType,
      inlineEnabled: imagePlanMetadata.inlineEnabled,
      inlineCount: imagePlanMetadata.inlineCount,
    }),
    [body, detail.articleType, detail.title, imagePlanMetadata.inlineCount, imagePlanMetadata.inlineEnabled],
  );
  const inlineOrders = useMemo(() => inlineImageOrders(sequence), [sequence]);
  const [images, setImages] = useState<LocalArticleImageRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [nextStep, setNextStep] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const reloadImages = async () => {
    const next = await listLocalArticleImages(detail.userId, detail.id);
    setImages(next);
  };

  useEffect(() => {
    let active = true;
    void listLocalArticleImages(detail.userId, detail.id).then(
      (next) => { if (active) setImages(next); },
      () => { if (active) setMessage("端末内画像を読み込めませんでした。画像はこの画面から選び直せます。"); },
    );
    return () => { active = false; };
  }, [detail.id, detail.userId]);

  useEffect(() => {
    let active = true;
    const next: Record<string, string> = {};
    for (const record of images) {
      next[recordKey(record.kind, record.order)] = URL.createObjectURL(record.blob);
    }
    queueMicrotask(() => {
      if (active) setPreviewUrls(next);
    });
    return () => {
      active = false;
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [images]);

  const imageMap = useMemo(
    () => new Map(images.map((record) => [recordKey(record.kind, record.order), record])),
    [images],
  );

  const cover = imageMap.get(recordKey("cover", 0));

  const missingInlineOrders = useMemo(
    () => inlineOrders.filter((order) => !imageMap.get(recordKey("inline", order))),
    [imageMap, inlineOrders],
  );

  const postingSteps = useMemo(() => {
    const steps: Array<
      | { kind: "title"; id: string; label: string }
      | { kind: "cover"; id: string; label: string; record: LocalArticleImageRecord }
      | { kind: "body"; id: string; label: string; item: Extract<NotePostSequenceItem, { kind: "body" }> }
      | { kind: "paid-boundary"; id: string; label: string }
      | { kind: "inline"; id: string; label: string; item: Extract<NotePostSequenceItem, { kind: "inline-image" }>; record?: LocalArticleImageRecord }
    > = [{ kind: "title", id: "title", label: "タイトル" }];

    if (cover) steps.push({ kind: "cover", id: "cover", label: "アイキャッチ", record: cover });

    let bodyNumber = 1;
    let freeBodyNumber = 1;
    let paidBodyNumber = 1;
    for (const item of sequence) {
      if (item.kind === "body") {
        const label = detail.articleType === "paid"
          ? item.paid
            ? `有料本文 ${paidBodyNumber++}`
            : `無料本文 ${freeBodyNumber++}`
          : `本文 ${bodyNumber++}`;
        steps.push({ kind: "body", id: item.id, label, item });
      } else if (item.kind === "paid-boundary") {
        steps.push({ kind: "paid-boundary", id: item.id, label: "有料エリア" });
      } else {
        steps.push({
          kind: "inline",
          id: item.id,
          label: detail.articleType === "paid" && item.paid ? `有料挿絵 ${item.order}` : `挿絵 ${item.order}`,
          item,
          record: imageMap.get(recordKey("inline", item.order)),
        });
      }
    }
    return steps;
  }, [cover, detail.articleType, imageMap, sequence]);

  const saveImage = async (kind: LocalArticleImageKind, order: number, file?: File) => {
    if (!file) return;
    const key = recordKey(kind, order);
    setBusyKey(key);
    setMessage("");
    try {
      await saveLocalArticleImage({
        userId: detail.userId,
        articleId: detail.id,
        kind,
        order,
        file,
      });
      await reloadImages();
      setMessage(`${kind === "cover" ? "アイキャッチ" : `挿絵${order}`}をこの端末のAASへ保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像を保存できませんでした。");
    } finally {
      setBusyKey("");
    }
  };

  const removeImage = async (kind: LocalArticleImageKind, order: number) => {
    const key = recordKey(kind, order);
    setBusyKey(key);
    setMessage("");
    try {
      await deleteLocalArticleImage(detail.userId, detail.id, kind, order);
      await reloadImages();
      setMessage(`${kind === "cover" ? "アイキャッチ" : `挿絵${order}`}を端末内AASから外しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像を外せませんでした。");
    } finally {
      setBusyKey("");
    }
  };

  const copyPostingStep = async (index: number) => {
    const step = postingSteps[index];
    if (!step) return;
    setBusyKey(step.id);
    setMessage("");
    try {
      if (step.kind === "title") {
        await navigator.clipboard.writeText(detail.title);
      } else if (step.kind === "body") {
        await copyNoteRichText(step.item.markdown);
      } else if (step.kind === "paid-boundary") {
        await navigator.clipboard.writeText("【ここから有料エリア】");
      } else if (step.kind === "cover") {
        await copyImageBlobToClipboard(step.record.blob);
      } else {
        if (!step.record) throw new Error(`挿絵${step.item.order}がまだ選択されていません。`);
        await copyImageBlobToClipboard(step.record.blob);
      }
      setNextStep(Math.min(postingSteps.length, index + 1));
      setMessage(
        step.kind === "paid-boundary"
          ? "有料エリアの目印をコピーしました。noteへ貼り付け、この位置でnoteの有料ラインを設定したら目印を削除してください。"
          : `${step.label}をコピーしました。noteへ貼り付けたら次の項目へ進んでください。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "コピーできませんでした。");
    } finally {
      setBusyKey("");
    }
  };

  const copyAllWithInlineImages = async () => {
    const key = "batch-rich-with-images";
    setBusyKey(key);
    setMessage("");
    try {
      const mode = await copyNotePostSequenceWithImages(
        sequence,
        (order) => imageMap.get(recordKey("inline", order))?.blob,
      );
      setMessage(
        inlineOrders.length > 0
          ? `装飾付き本文と挿絵を一括コピーしました（${mode === "rich" ? "リッチコピー" : "互換コピー"}）。note本文へ貼り付けて、画像位置と有料ラインを最終確認してください。`
          : "装飾付き本文を一括コピーしました。note本文へ貼り付けてください。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "一括コピーできませんでした。上の順番から個別にコピーしてください。");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <section className="note-post-assistant" aria-label="note投稿アシスト">
      <div className="note-post-assistant-head">
        <div>
          <p className="eyebrow">NOTE POST ASSIST</p>
          <h3>画像込みでnoteへ貼り付ける</h3>
          <p className="panel-muted">
            アイキャッチ・挿絵はこの端末内だけで保持します。Supabase Storageへは送信しません。
          </p>
        </div>
        <a className="primary-action" href="https://note.com/new" target="_blank" rel="noreferrer">note投稿画面を開く ↗</a>
      </div>

      <div className="route-notice" role="note">
        AASが本文中の挿絵位置{detail.articleType === "paid" ? "と有料エリア" : ""}を読み取り、投稿順を自動で並べます。noteでは「コピー → 貼り付け」を上から順に進めてください。
      </div>

      {detail.articleType === "paid" && !sequence.some((item) => item.kind === "paid-boundary") && (
        <div className="route-notice" role="alert">
          有料記事ですが有料エリアの位置が見つかりません。記事本文に有料エリアを設定してから投稿アシストを利用してください。
        </div>
      )}

      <section className="note-post-steps" aria-label="noteへ貼り付ける順番">
        <div className="note-post-assistant-head">
          <div>
            <h4>noteへ貼り付ける順番</h4>
            <p className="panel-muted">本文は各工程ごとに装飾付きでコピーできます。タイトルとアイキャッチはnoteの別欄へ貼り付けてください。</p>
          </div>
          <button
            className="primary-action"
            type="button"
            disabled={busyKey === "batch-rich-with-images" || sequence.length === 0 || missingInlineOrders.length > 0}
            onClick={() => void copyAllWithInlineImages()}
          >
            {busyKey === "batch-rich-with-images"
              ? "一括コピー中…"
              : inlineOrders.length > 0
                ? "本文＋挿絵を一括コピー"
                : "本文を装飾付きで一括コピー"}
          </button>
        </div>
        {missingInlineOrders.length > 0 && (
          <p className="beginner-help">画像込み一括コピーを使うには、挿絵 {missingInlineOrders.join("・")} を先に選択してください。</p>
        )}
        {inlineOrders.length > 0 && (
          <p className="beginner-help">画像込み一括コピーは対応ブラウザ・noteエディタ向けです。画像が貼り付かない場合は、下の順番から本文・挿絵を個別にコピーしてください。</p>
        )}
        <ol>
          {postingSteps.map((step, index) => {
            const missingImage = step.kind === "inline" && !step.record;
            const active = index === nextStep;
            const done = index < nextStep;
            return (
              <li key={step.id} className={active ? "active" : done ? "done" : ""}>
                <span className="note-post-step-number">{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>
                    {step.kind === "title" && "noteのタイトル欄へ貼り付け"}
                    {step.kind === "cover" && "noteの見出し画像欄へ貼り付け"}
                    {step.kind === "body" && "note本文の現在位置へ装飾付きで貼り付け"}
                    {step.kind === "paid-boundary" && "この目印を貼り付けた位置でnoteの有料ラインを設定し、公開前に目印を削除"}
                    {step.kind === "inline" && (missingImage ? "画像未設定" : "note本文の現在位置へ画像を貼り付け")}
                  </small>
                </div>
                <button
                  className={active ? "primary-action" : "secondary-action"}
                  type="button"
                  disabled={busyKey === step.id || missingImage}
                  onClick={() => void copyPostingStep(index)}
                >
                  {busyKey === step.id
                    ? "コピー中…"
                    : step.kind === "paid-boundary"
                      ? "位置をコピー"
                      : step.kind === "body"
                        ? "装飾付きコピー"
                        : "コピー"}
                </button>
              </li>
            );
          })}
        </ol>
        {nextStep >= postingSteps.length && postingSteps.length > 0 && (
          <div className="route-notice">すべてのコピー工程が完了しました。note側で画像位置・有料ライン・最終表示を確認して公開してください。</div>
        )}
      </section>

      <div className="note-post-image-slots">
        <ImageSlot
          label="アイキャッチ"
          record={cover}
          previewUrl={previewUrls[recordKey("cover", 0)]}
          busy={busyKey === recordKey("cover", 0)}
          suggestedFilename={imagePlanMetadata.suggestedFilenames[recordKey("cover", 0)]}
          onSelect={(file) => void saveImage("cover", 0, file)}
          onRemove={() => void removeImage("cover", 0)}
        />
        {inlineOrders.map((order) => (
          <ImageSlot
            key={order}
            label={`挿絵 ${order}`}
            record={imageMap.get(recordKey("inline", order))}
            previewUrl={previewUrls[recordKey("inline", order)]}
            busy={busyKey === recordKey("inline", order)}
            suggestedFilename={imagePlanMetadata.suggestedFilenames[recordKey("inline", order)]}
            onSelect={(file) => void saveImage("inline", order, file)}
            onRemove={() => void removeImage("inline", order)}
          />
        ))}
      </div>

      {inlineOrders.length === 0 && (
        <p className="beginner-help">本文内に挿絵マーカーがないため、現在はアイキャッチのみ設定できます。</p>
      )}

      <section className="note-post-preview" aria-label="画像入り完成プレビュー">
        <h4>画像入り完成プレビュー</h4>
        {cover && previewUrls[recordKey("cover", 0)] && (
          <figure className="note-post-cover-preview">
            <DirectRuntimeImage src={previewUrls[recordKey("cover", 0)]} alt="アイキャッチプレビュー" />
            <figcaption>アイキャッチ</figcaption>
          </figure>
        )}
        <div className="note-post-preview-title">{detail.title}</div>
        <div className="note-post-preview-body">
          {sequence.map((item) => {
            if (item.kind === "body") {
              return (
                <div
                  key={item.id}
                  className="note-post-preview-text"
                  dangerouslySetInnerHTML={{ __html: markdownToNoteHtml(item.markdown) }}
                />
              );
            }
            if (item.kind === "paid-boundary") {
              return <div key={item.id} className="route-notice">ここから有料エリア</div>;
            }
            return (
              <InlinePreview
                key={item.id}
                order={item.order}
                record={imageMap.get(recordKey("inline", item.order))}
                previewUrl={previewUrls[recordKey("inline", item.order)]}
              />
            );
          })}
        </div>
      </section>



      {message && <div className="route-notice" role="status" aria-live="polite">{message}</div>}
    </section>
  );
}

function ImageSlot({
  label,
  record,
  previewUrl,
  busy,
  suggestedFilename,
  onSelect,
  onRemove,
}: {
  label: string;
  record?: LocalArticleImageRecord;
  previewUrl?: string;
  busy: boolean;
  suggestedFilename?: string;
  onSelect: (file?: File) => void;
  onRemove: () => void;
}) {
  return (
    <article className="note-post-image-slot">
      <div className="note-post-image-slot-preview">
        {record && previewUrl ? <DirectRuntimeImage src={previewUrl} alt={`${label}プレビュー`} /> : <span>画像未設定</span>}
      </div>
      <div className="note-post-image-slot-info">
        <strong>{label}</strong>
        <small>{record?.filename ?? "PNG・JPEG・WebPなどを選択"}</small>
        {suggestedFilename && !record && <small>推奨保存名: {suggestedFilename}</small>}
        {suggestedFilename && record && record.filename !== suggestedFilename && (
          <small>推奨保存名: {suggestedFilename}（選択済み画像は {record.filename}）</small>
        )}
        <label className="secondary-action note-post-file-action">
          {record ? "画像を変更" : "画像を選択"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif"
            disabled={busy}
            onChange={(event) => onSelect(event.target.files?.[0])}
          />
        </label>
        {record && (
          <button className="secondary-action" type="button" disabled={busy} onClick={onRemove}>画像を外す</button>
        )}
      </div>
    </article>
  );
}

function InlinePreview({
  order,
  record,
  previewUrl,
}: {
  order: number;
  record?: LocalArticleImageRecord;
  previewUrl?: string;
}) {
  if (!record || !previewUrl) {
    return <div className="note-post-missing-image">挿絵 {order}（画像未設定）</div>;
  }
  return (
    <figure className="note-post-inline-preview">
      <DirectRuntimeImage src={previewUrl} alt={`挿絵${order}プレビュー`} />
      <figcaption>挿絵 {order}</figcaption>
    </figure>
  );
}
