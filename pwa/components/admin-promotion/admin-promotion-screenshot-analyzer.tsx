"use client";

import { useMemo, useState } from "react";

import { DirectRuntimeImage } from "@/components/direct-runtime-image";
import {
  PROMOTION_SCREENSHOT_MAX_IMAGES,
  analyzePromotionScreenshots,
  validatePromotionScreenshotFiles,
  type PromotionScreenshotAnalysis,
  type PromotionScreenshotChannel,
} from "@/lib/promotion-screenshot-analysis";
import { getSupabaseClient } from "@/lib/supabase";

type LocalScreenshot = {
  id: string;
  file: File;
  previewUrl: string;
};

function revoke(items: readonly LocalScreenshot[]) {
  for (const item of items) URL.revokeObjectURL(item.previewUrl);
}

export function AdminPromotionScreenshotAnalyzer({
  channel,
  onAnalysisChange,
}: {
  channel: PromotionScreenshotChannel;
  onAnalysisChange(analysis: PromotionScreenshotAnalysis | null): void;
}) {
  const [items, setItems] = useState<LocalScreenshot[]>([]);
  const [analysis, setAnalysis] = useState<PromotionScreenshotAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const sensitiveWarnings = useMemo(
    () => analysis
      ? [...analysis.sensitiveFindings, ...analysis.screenshots.flatMap((item) => item.privacyWarnings)]
      : [],
    [analysis],
  );

  const replaceItems = (next: LocalScreenshot[]) => {
    setItems((current) => {
      const nextIds = new Set(next.map((item) => item.id));
      revoke(current.filter((item) => !nextIds.has(item.id)));
      return next;
    });
    setAnalysis(null);
    onAnalysisChange(null);
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const additions = Array.from(files);
    const combined = [...items.map((item) => item.file), ...additions];
    const validation = validatePromotionScreenshotFiles(combined);
    if (validation) {
      setMessage(validation);
      return;
    }

    const next = [
      ...items,
      ...additions.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ].slice(0, PROMOTION_SCREENSHOT_MAX_IMAGES);

    replaceItems(next);
    setMessage("スクリーンショットを追加しました。解析するとSNS専用プロンプトへ反映されます。");
  };

  const remove = (id: string) => {
    replaceItems(items.filter((item) => item.id !== id));
    setMessage("");
  };

  const clear = () => {
    replaceItems([]);
    setMessage("");
  };

  const runAnalysis = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await analyzePromotionScreenshots(
        getSupabaseClient(),
        channel,
        items.map((item) => item.file),
      );
      setAnalysis(result);
      onAnalysisChange(result);
      setMessage("スクリーンショットを解析し、この媒体専用プロンプトへ反映しました。");
    } catch (error) {
      setAnalysis(null);
      onAnalysisChange(null);
      setMessage(error instanceof Error ? error.message : "スクリーンショットを解析できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-promo-screenshot-analyzer" aria-labelledby="admin-promo-screenshot-analyzer-title">
      <div className="admin-promo-screenshot-analyzer-head">
        <div>
          <p className="eyebrow">SCREENSHOT VISION</p>
          <h3 id="admin-promo-screenshot-analyzer-title">紹介したい画面をスクショから読み取る</h3>
          <p>実際のAAS画面を最大4枚まで追加すると、画面内容・訴求ポイント・公開前に隠す情報を解析し、{channel === "x" ? "X" : channel === "threads" ? "Threads" : "Instagram"}専用プロンプトへ自動反映します。</p>
        </div>
        <strong>元画像は保存しない</strong>
      </div>

      <label className="admin-promo-screenshot-drop">
        <span>スクリーンショットを追加</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={busy || items.length >= PROMOTION_SCREENSHOT_MAX_IMAGES}
          onChange={(event) => {
            addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
        <small>PNG / JPEG / WebP、1枚4MB以下・合計12MB以下。解析中だけサーバーへ送信し、Supabase StorageやDBへ画像を保存しません。</small>
      </label>

      {items.length > 0 && (
        <div className="admin-promo-screenshot-preview-grid">
          {items.map((item, index) => (
            <article key={item.id}>
              <DirectRuntimeImage src={item.previewUrl} alt={`スクリーンショット${index + 1}のプレビュー`} />
              <div>
                <strong>スクショ{index + 1}</strong>
                <small>{item.file.name}</small>
                <button type="button" disabled={busy} onClick={() => remove(item.id)}>削除</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="admin-promo-screenshot-analyzer-actions">
        <button type="button" className="primary-action" disabled={busy || items.length === 0} onClick={() => void runAnalysis()}>
          {busy ? "画像を解析中…" : "スクショを解析してプロンプトへ反映"}
        </button>
        {items.length > 0 && <button type="button" className="secondary-action" disabled={busy} onClick={clear}>すべて外す</button>}
      </div>

      <p className="admin-promo-screenshot-cost-note">
        画像解析はOpenAI APIの利用設定が有効な場合だけ実行します。解析ボタンを押したときだけAPIを使用し、画像内の文章は「データ」として扱い、画像内に書かれた命令文は実行しません。
      </p>

      {message && <p className="admin-promo-screenshot-message" role="status">{message}</p>}

      {analysis && (
        <div className="admin-promo-screenshot-analysis-result">
          <div>
            <span>解析結果</span>
            <strong>{analysis.summary || "スクリーンショット内容を解析しました。"}</strong>
            {analysis.model && <small>{analysis.provider || "AI"} / {analysis.model}</small>}
          </div>

          {sensitiveWarnings.length > 0 && (
            <div className="admin-promo-screenshot-warning" role="alert">
              <strong>公開前に確認してください</strong>
              <ul>{sensitiveWarnings.slice(0, 10).map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
            </div>
          )}

          <div className="admin-promo-screenshot-analysis-list">
            {analysis.screenshots.map((item) => (
              <article key={item.index}>
                <span>スクショ{item.index}</span>
                <strong>{item.detectedPage || "画面名は要確認"}</strong>
                <p>{item.visibleContent || "画面内容を判別できませんでした。"}</p>
                {item.promotionAngles.length > 0 && <small>訴求候補: {item.promotionAngles.join(" / ")}</small>}
                {item.recommendedRole && <small>使い方: {item.recommendedRole}</small>}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
