"use client";

import { useMemo, useState } from "react";

import { PromptOutput } from "@/components/admin-promotion/admin-promotion-fields";
import {
  SCREENSHOT_COUNT_OPTIONS,
  SCREENSHOT_DEVICE_OPTIONS,
  SCREENSHOT_PUBLICATION_OPTIONS,
} from "@/components/admin-promotion/admin-promotion-options";
import {
  ADMIN_SCREENSHOT_TARGETS,
  buildAdminScreenshotCapturePrompt,
  type AdminScreenshotCount,
  type AdminScreenshotDevice,
  type AdminScreenshotPublication,
  type AdminScreenshotTarget,
} from "@/lib/admin-promotion";

export function AdminPromotionScreenshotTool({
  onCopy,
}: {
  onCopy(prompt: string): void;
}) {
  const [target, setTarget] = useState<AdminScreenshotTarget>("create");
  const [publication, setPublication] = useState<AdminScreenshotPublication>("note");
  const [device, setDevice] = useState<AdminScreenshotDevice>("both");
  const [count, setCount] = useState<AdminScreenshotCount>("auto");

  const prompt = useMemo(
    () => buildAdminScreenshotCapturePrompt({ target, publication, device, count }),
    [target, publication, device, count],
  );

  return (
    <section className="admin-promo-screenshot-tool" aria-label="記事用スクリーンショット準備">
      <div className="admin-promo-screenshot-head">
        <div>
          <p className="eyebrow">MANUAL SCREENSHOT GUIDE</p>
          <h2>記事用スクショ撮影指示</h2>
          <p>画像そのものは取得しません。記事に必要な画面、撮る場所、本文へ入れる位置だけを整理する依頼文を作ります。</p>
        </div>
        <strong>撮影は自分で行う</strong>
      </div>
      <div className="admin-promo-screenshot-grid">
        <label className="admin-promo-field">
          <span>① 紹介する機能</span>
          <select value={target} onChange={(event) => setTarget(event.target.value as AdminScreenshotTarget)}>
            {(Object.entries(ADMIN_SCREENSHOT_TARGETS) as Array<[AdminScreenshotTarget, (typeof ADMIN_SCREENSHOT_TARGETS)[AdminScreenshotTarget]]>).map(([key, item]) => (
              <option key={key} value={key}>{item.label} — {item.note}</option>
            ))}
          </select>
        </label>
        <label className="admin-promo-field">
          <span>② 使用先</span>
          <select value={publication} onChange={(event) => setPublication(event.target.value as AdminScreenshotPublication)}>
            {SCREENSHOT_PUBLICATION_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="admin-promo-field">
          <span>③ 端末</span>
          <select value={device} onChange={(event) => setDevice(event.target.value as AdminScreenshotDevice)}>
            {SCREENSHOT_DEVICE_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="admin-promo-field">
          <span>④ スクショ枚数</span>
          <select value={count} onChange={(event) => setCount(event.target.value as AdminScreenshotCount)}>
            {SCREENSHOT_COUNT_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <div className="admin-promo-screenshot-note">
        <strong>安全設計</strong>
        <span>ChatGPTにはスクリーンショットの取得やブラウザ操作を依頼せず、挿入位置と撮影対象だけを整理させます。AAS ID・メール・請求情報など公開不要の情報が写らないよう、撮影前に確認してください。</span>
      </div>
      <PromptOutput
        prompt={prompt}
        onCopy={() => onCopy(prompt)}
        note="この依頼文は画像取得用ではありません。必要な画面・撮影位置・記事への挿入位置・キャプションだけを整理します。"
      />
    </section>
  );
}
