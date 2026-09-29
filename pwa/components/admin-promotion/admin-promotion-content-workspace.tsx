"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import {
  deletePromotionScreenshot,
  downloadPromotionScreenshot,
  loadPromotionContentWorkspace,
  promotionScreenshotMarker,
  savePromotionContentDraft,
  updatePromotionScreenshot,
  uploadPromotionScreenshot,
  type PromotionContentAsset,
} from "@/lib/admin-promotion-content";
import type { AdminPromotionChannel } from "@/lib/admin-promotion-channel";
import {
  blobToDataUrl,
  copyPromotionRichText,
  promotionMarkdownToRichHtml,
  promotionMarkdownToPlainText,
  type PromotionRichImage,
} from "@/lib/promotion-rich-text";

export function AdminPromotionContentWorkspace({ channel }: { channel: AdminPromotionChannel }) {
  const [body, setBody] = useState("");
  const [assets, setAssets] = useState<PromotionContentAsset[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const refresh = async () => {
    const client = getSupabaseClient();
    const workspace = await loadPromotionContentWorkspace(client, channel);
    setBody(workspace.draft?.bodyMarkdown ?? "");
    setAssets(workspace.assets);

    const urls: Record<string, string> = {};
    for (const asset of workspace.assets) {
      const signed = await client.storage.from(asset.storageBucket).createSignedUrl(asset.storagePath, 3600);
      if (!signed.error && signed.data?.signedUrl) urls[asset.id] = signed.data.signedUrl;
    }
    setPreviewUrls(urls);
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void refresh().catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "保存済み原稿を読み込めませんでした。");
      });
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const save = async (nextBody = body) => {
    setBusy(true); setMessage("");
    try {
      await savePromotionContentDraft(getSupabaseClient(), channel, nextBody);
      setMessage("完成原稿をAAS本体へ保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "原稿を保存できませんでした。");
    } finally { setBusy(false); }
  };

  const insertMarker = async (asset: PromotionContentAsset) => {
    const marker = promotionScreenshotMarker(asset.id);
    const area = textareaRef.current;
    const start = area?.selectionStart ?? body.length;
    const end = area?.selectionEnd ?? start;
    const next = `${body.slice(0, start)}\n\n${marker}\n\n${body.slice(end)}`;
    setBody(next);
    await savePromotionContentDraft(getSupabaseClient(), channel, next);
    setMessage("スクショを本文位置へ差し込み、AAS本体へ保存しました。");
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const asset = await uploadPromotionScreenshot(getSupabaseClient(), channel, file);
      await refresh();
      await insertMarker(asset);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "スクショを保存できませんでした。");
    } finally { setBusy(false); }
  };

  const remove = async (asset: PromotionContentAsset) => {
    if (!window.confirm("このスクショをAAS本体から削除しますか？")) return;
    setBusy(true); setMessage("");
    try {
      await deletePromotionScreenshot(getSupabaseClient(), asset);
      const next = body.replaceAll(promotionScreenshotMarker(asset.id), "").replace(/\n{3,}/g, "\n\n");
      await savePromotionContentDraft(getSupabaseClient(), channel, next);
      setBody(next);
      await refresh();
      setMessage("スクショをAAS本体から削除しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "スクショを削除できませんでした。");
    } finally { setBusy(false); }
  };

  const saveCaption = async (asset: PromotionContentAsset, caption: string) => {
    setBusy(true);
    try {
      await updatePromotionScreenshot(getSupabaseClient(), asset.id, caption, asset.sortOrder);
      await refresh();
      setMessage("スクショ説明を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "スクショ説明を保存できませんでした。");
    } finally { setBusy(false); }
  };

  const copyRich = async () => {
    if (!body.trim()) return;
    setBusy(true); setMessage("");
    try {
      const client = getSupabaseClient();
      const richImages: PromotionRichImage[] = [];
      for (const asset of assets) {
        const blob = await downloadPromotionScreenshot(client, asset);
        richImages.push({
          assetId: asset.id,
          filename: asset.originalFilename,
          caption: asset.caption,
          dataUrl: await blobToDataUrl(blob),
        });
      }
      await copyPromotionRichText(body, richImages);
      setMessage("装飾と差し込みスクショを含めてコピーしました。貼り付け先が画像貼り付けに対応している場合は画像も反映されます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "装飾付きコピーに失敗しました。");
    } finally { setBusy(false); }
  };

  const copyPlain = async () => {
    try {
      const plainImages: PromotionRichImage[] = assets.map((asset) => ({
        assetId: asset.id, filename: asset.originalFilename, caption: asset.caption, dataUrl: "",
      }));
      await navigator.clipboard.writeText(promotionMarkdownToPlainText(body, plainImages));
      setMessage("プレーンテキストをコピーしました。");
    } catch {
      setMessage("プレーンテキストをコピーできませんでした。");
    }
  };

  const previewHtml = useMemo(() => {
    const images: PromotionRichImage[] = assets.map((asset) => ({
      assetId: asset.id,
      filename: asset.originalFilename,
      caption: asset.caption,
      dataUrl: previewUrls[asset.id] ?? "",
    }));
    return promotionMarkdownToRichHtml(body, images);
  }, [assets, body, previewUrls]);

  return (
    <section className="admin-promo-panel admin-promo-content-workspace" data-aas-collapse="off">
      <div className="admin-promo-section-title">
        <div><p className="eyebrow">FINAL CONTENT</p><h2>完成原稿・スクショ保存</h2></div>
        <strong>AAS本体保存</strong>
      </div>
      <p className="admin-promo-help">
        AIで作成した完成原稿をここへ貼り付けてください。見出し・太字・リスト等を装飾付きでコピーできます。
        スクショはSupabase Storageへ保存し、カーソル位置へ本文画像として差し込めます。
      </p>

      <label className="admin-promo-field">
        <span>完成原稿（Markdown）</span>
        <textarea ref={textareaRef} className="admin-promo-final-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="AIで作成した完成原稿を貼り付け" />
      </label>

      <div className="admin-promo-content-actions">
        <button type="button" className="primary-action" disabled={busy || !body.trim()} onClick={() => void save()}>AAS本体へ保存</button>
        <button type="button" className="primary-action" disabled={busy || !body.trim()} onClick={() => void copyRich()}>装飾付きでコピー</button>
        <button type="button" className="secondary-action" disabled={busy || !body.trim()} onClick={() => void copyPlain()}>プレーンでコピー</button>
        <label className="secondary-action admin-promo-upload-button">
          スクショを追加
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => void upload(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {assets.length > 0 && (
        <div className="admin-promo-saved-screenshots">
          {assets.map((asset) => (
            <article key={asset.id}>
              {previewUrls[asset.id] && <img src={previewUrls[asset.id]} alt={asset.caption || asset.originalFilename} />}
              <strong>{asset.originalFilename}</strong>
              <input
                defaultValue={asset.caption}
                placeholder="スクショ説明・キャプション"
                onBlur={(e) => {
                  if (e.target.value !== asset.caption) void saveCaption(asset, e.target.value);
                }}
              />
              <div>
                <button type="button" className="secondary-action" disabled={busy} onClick={() => void insertMarker(asset)}>カーソル位置へ挿入</button>
                <button type="button" className="secondary-action" disabled={busy} onClick={() => void remove(asset)}>削除</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {body.trim() && (
        <div className="admin-promo-rich-preview">
          <strong>装飾・スクショプレビュー</strong>
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}

      {message && <div className="route-notice" role="status">{message}</div>}
      <small className="admin-promo-help">画像は端末内保存ではなくAAS本体の非公開Storageへ保存します。貼り付け先の仕様によって画像が除外される場合でも、AAS内の原稿と画像は保持されます。</small>
    </section>
  );
}
