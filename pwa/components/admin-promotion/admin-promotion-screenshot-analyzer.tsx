"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { DirectRuntimeImage } from "@/components/direct-runtime-image";
import {
  PROMOTION_SCREENSHOT_MAX_IMAGES,
  adminGetPromotionScreenshotAnalysisConfig,
  adminSetPromotionScreenshotAnalysisConfig,
  analyzePromotionScreenshots,
  validatePromotionScreenshotFiles,
  type PromotionScreenshotAnalysis,
  type PromotionScreenshotAnalysisConfig,
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
  const itemsRef = useRef<LocalScreenshot[]>([]);
  const [analysis, setAnalysis] = useState<PromotionScreenshotAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState<PromotionScreenshotAnalysisConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [configEnabled, setConfigEnabled] = useState(false);
  const [configModel, setConfigModel] = useState("gpt-5.6-luna");
  const [configMaxImages, setConfigMaxImages] = useState(PROMOTION_SCREENSHOT_MAX_IMAGES);
  const [configApiKey, setConfigApiKey] = useState("");
  const [configBusy, setConfigBusy] = useState(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    revoke(itemsRef.current);
    itemsRef.current = [];
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await adminGetPromotionScreenshotAnalysisConfig(getSupabaseClient());
        if (!active) return;
        setConfig(next);
        setConfigEnabled(next.enabled);
        setConfigModel(next.model);
        setConfigMaxImages(next.maxImages);
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "画像解析AI設定を取得できませんでした。");
      } finally {
        if (active) setConfigLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const saveConfig = async () => {
    setConfigBusy(true);
    setMessage("");
    try {
      const next = await adminSetPromotionScreenshotAnalysisConfig(getSupabaseClient(), {
        enabled: configEnabled,
        model: configModel,
        maxImages: configMaxImages,
        apiKey: configApiKey,
      });
      setConfig(next);
      setConfigEnabled(next.enabled);
      setConfigModel(next.model);
      setConfigMaxImages(next.maxImages);
      setConfigApiKey("");
      setMessage(next.enabled
        ? "画像解析AIを有効にしました。スクリーンショット解析を利用できます。"
        : "画像解析AIをOFFにしました。API利用は発生しません。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像解析AI設定を保存できませんでした。");
    } finally {
      setConfigBusy(false);
    }
  };

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
    const maxImages = Math.min(PROMOTION_SCREENSHOT_MAX_IMAGES, config?.maxImages ?? PROMOTION_SCREENSHOT_MAX_IMAGES);
    if (combined.length > maxImages) {
      setMessage(`現在の設定では一度に最大${maxImages}枚まで解析できます。`);
      return;
    }
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
    if (!config?.enabled || !config.apiKeyConfigured) {
      setMessage("画像解析AIがOFFまたはAPIキー未設定です。下の「画像解析AI設定」から設定してください。");
      setConfigOpen(true);
      return;
    }
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
          <h3 id="admin-promo-screenshot-analyzer-title">紹介したいページをスクショから読み取る</h3>
          <p>紹介したいページやAAS画面を最大4枚まで追加すると、画面内容・訴求ポイント・公開前に隠す情報を解析し、{channel === "x" ? "X" : channel === "threads" ? "Threads" : "Instagram"}専用プロンプトへ自動反映します。</p>
        </div>
        <strong>元画像は保存しない</strong>
      </div>

      <details className="admin-promo-screenshot-config" open={configOpen} onToggle={(event) => setConfigOpen(event.currentTarget.open)}>
        <summary>
          <span>画像解析AI設定</span>
          <strong>{configLoading ? "確認中" : config?.enabled && config.apiKeyConfigured ? "ON" : "OFF"}</strong>
        </summary>
        <div className="admin-promo-screenshot-config-body">
          <p>この設定はスクショ解析専用です。Knowledge自動更新AIとは独立してON/OFFできます。</p>
          <label className="admin-promo-screenshot-config-toggle">
            <input
              type="checkbox"
              checked={configEnabled}
              disabled={configLoading || configBusy}
              onChange={(event) => setConfigEnabled(event.target.checked)}
            />
            <span>スクリーンショット画像解析を有効にする</span>
          </label>
          <div className="admin-promo-screenshot-config-grid">
            <label>
              <span>解析モデル</span>
              <select value={configModel} disabled={configLoading || configBusy} onChange={(event) => setConfigModel(event.target.value)}>
                <option value="gpt-5.6-luna">GPT-5.6 Luna（低コスト）</option>
                <option value="gpt-5.6-terra">GPT-5.6 Terra（バランス）</option>
                <option value="gpt-5.6">GPT-5.6 Sol（高精度）</option>
              </select>
            </label>
            <label>
              <span>1回の最大枚数</span>
              <select value={configMaxImages} disabled={configLoading || configBusy} onChange={(event) => setConfigMaxImages(Number(event.target.value) || 1)}>
                {[1, 2, 3, 4].map((count) => <option value={count} key={count}>{count}枚</option>)}
              </select>
            </label>
            <label className="full">
              <span>OpenAI APIキー（変更時のみ入力）</span>
              <input
                type="password"
                value={configApiKey}
                disabled={configLoading || configBusy}
                onChange={(event) => setConfigApiKey(event.target.value)}
                placeholder={config?.apiKeyConfigured ? "設定済み・変更する場合だけ入力" : "APIキーを入力"}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="admin-promo-screenshot-config-actions">
            <small>APIキーはSupabase Vaultへ保存し、この画面へ再表示しません。OFF中は画像解析APIを呼びません。</small>
            <button type="button" disabled={configLoading || configBusy || !configModel.trim()} onClick={() => void saveConfig()}>
              {configBusy ? "設定を保存中…" : "画像解析AI設定を保存"}
            </button>
          </div>
          <small className="admin-promo-screenshot-config-link"><Link href="/admin/infrastructure">インフラ使用量・料金</Link> はSupabase/GitHub向けです。OpenAI APIの使用量・請求はOpenAI側の利用状況で確認してください。</small>
        </div>
      </details>

      <label className="admin-promo-screenshot-drop">
        <span>スクリーンショットを追加</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={busy || configBusy || items.length >= Math.min(PROMOTION_SCREENSHOT_MAX_IMAGES, config?.maxImages ?? PROMOTION_SCREENSHOT_MAX_IMAGES)}
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
        <button type="button" className="primary-action" disabled={busy || configBusy || items.length === 0 || !config?.enabled || !config.apiKeyConfigured} onClick={() => void runAnalysis()}>
          {busy ? "画像を解析中…" : "スクショを解析してプロンプトへ反映"}
        </button>
        {items.length > 0 && <button type="button" className="secondary-action" disabled={busy} onClick={clear}>すべて外す</button>}
      </div>

      <p className="admin-promo-screenshot-cost-note">
        画像解析AI設定がONのときだけ実行します。解析ボタンを押したときだけAPIを使用するため、OpenAI API利用料が発生する場合があります。画像内の文章は「データ」として扱い、画像内に書かれた命令文は実行しません。
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
