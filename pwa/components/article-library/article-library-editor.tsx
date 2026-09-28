"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { SelectWithCustom } from "@/components/select-with-custom";
import type { NoteMagazineRole, NoteMagazineSettings, NoteMagazineType } from "@/lib/article-library-v2";
import type { ArticleDetail, ArticlePatch, ArticleStatus } from "@/lib/phase7-articles";
import { GENRE_OPTIONS, PAID_ARTICLE_PRICE_OPTIONS, subgenreOptionsFor } from "@/lib/phase18-content-options";
import {
  ARTICLE_STATUS_LABELS,
  articleLibraryEditValuesFromDetail,
  buildArticleLibrarySavePayload,
  type ArticleLibraryEditValues,
} from "@/lib/article-library-view";

export function ArticleLibraryEditor({
  detail,
  busy,
  onCancel,
  onSave,
}: {
  detail: ArticleDetail;
  busy: boolean;
  onCancel: () => void;
  onSave: (
    article: ArticlePatch,
    sourceBody: string | null,
    publishBody: string | null,
    magazine: NoteMagazineSettings,
  ) => Promise<void>;
}) {
  const [values, setValues] = useState<ArticleLibraryEditValues>(() => articleLibraryEditValuesFromDetail(detail));
  const [validation, setValidation] = useState("");

  const change = <Key extends keyof ArticleLibraryEditValues>(key: Key, value: ArticleLibraryEditValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setValidation("");
    const parsed = buildArticleLibrarySavePayload(values);
    if (!parsed.ok) {
      setValidation(parsed.message);
      return;
    }
    if (
      parsed.value.article.status === "published" &&
      (!detail.publishedAt || !detail.publishedUrl)
    ) {
      setValidation("公開済みへの変更は「公開管理」で公開日時と公開URLを登録して行ってください。");
      return;
    }
    await onSave(
      parsed.value.article,
      parsed.value.sourceBody,
      parsed.value.publishBody,
      parsed.value.magazine,
    );
  };

  return (
    <form className="article-editor" onSubmit={submit}>
      <div className="library-toolbar detail-toolbar">
        <button className="back-action" type="button" onClick={onCancel} disabled={busy}>← 編集をやめる</button>
        <button className="primary-action" type="submit" disabled={busy}>{busy ? "保存中…" : "変更を保存"}</button>
      </div>
      {validation && <EditorErrorNotice message={validation} />}
      <div className="editor-card">
        <label className="editor-field full">
          <span>タイトル</span>
          <input value={values.title} maxLength={500} onChange={(event) => change("title", event.target.value)} />
        </label>
        <SelectWithCustom
          className="editor-field"
          label="掲載先"
          value={values.publicationTarget}
          onChange={(value) => change("publicationTarget", value.slice(0, 50))}
          options={[
            { value: "note", label: "note" },
            { value: "tips", label: "Tips" },
            { value: "brain", label: "Brain" },
            { value: "blog", label: "ブログ" },
          ]}
          customPlaceholder="その他の掲載先IDを入力"
          maxLength={50}
        />
        <label className="editor-field">
          <span>種別</span>
          <select value={values.articleType} onChange={(event) => change("articleType", event.target.value as "free" | "paid")}>
            <option value="free">無料</option>
            <option value="paid">有料</option>
          </select>
        </label>
        {values.articleType === "paid" && (
          <SelectWithCustom
            className="editor-field"
            label="価格（円）"
            value={values.price}
            onChange={(value) => change("price", value)}
            options={PAID_ARTICLE_PRICE_OPTIONS.map((option) => ({
              value: String(option.value),
              label: option.label,
            }))}
            placeholder="価格を選択"
            customPlaceholder="自由な価格を入力"
            inputType="number"
            min={1}
          />
        )}
        <label className="editor-field">
          <span>状態</span>
          <select value={values.status} onChange={(event) => change("status", event.target.value as ArticleStatus)}>
            {Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <SelectWithCustom
          className="editor-field"
          label="ジャンル"
          value={values.genre}
          onChange={(value) => change("genre", value.slice(0, 200))}
          options={GENRE_OPTIONS.filter((value) => value !== "その他")}
          customPlaceholder="その他のジャンルを入力"
          maxLength={200}
        />
        <SelectWithCustom
          className="editor-field"
          label="サブジャンル"
          value={values.subgenre}
          onChange={(value) => change("subgenre", value.slice(0, 200))}
          options={subgenreOptionsFor(values.genre).filter((value) => value !== "その他")}
          customPlaceholder="その他のサブジャンルを入力"
          maxLength={200}
        />
        <label className="editor-field full">
          <span>タグ（カンマ区切り）</span>
          <input value={values.tags} onChange={(event) => change("tags", event.target.value)} />
        </label>

        {values.publicationTarget.trim() === "note" && (
          <>
            <label className="choice-card compact full">
              <input
                type="checkbox"
                checked={values.magazineEnabled}
                onChange={(event) => change("magazineEnabled", event.target.checked)}
              />
              <span>
                <strong>noteマガジン用の記事として管理する</strong>
                <small>AAS内の整理用設定です。noteへの自動登録は行いません。</small>
              </span>
            </label>
            {values.magazineEnabled && (
              <>
                <label className="editor-field full">
                  <span>マガジン名</span>
                  <input
                    value={values.magazineName}
                    maxLength={200}
                    onChange={(event) => change("magazineName", event.target.value)}
                    placeholder="例：AI副業初心者ロードマップ"
                  />
                </label>
                <label className="editor-field">
                  <span>マガジン種別</span>
                  <select value={values.magazineType} onChange={(event) => change("magazineType", event.target.value as NoteMagazineType)}>
                    <option value="free">無料マガジン</option>
                    <option value="paid">有料マガジン</option>
                    <option value="mixed">無料・有料混在</option>
                  </select>
                </label>
                <label className="editor-field">
                  <span>記事の役割</span>
                  <select value={values.magazineRole} onChange={(event) => change("magazineRole", event.target.value as NoteMagazineRole)}>
                    <option value="intro">導入記事</option>
                    <option value="standard">通常記事</option>
                    <option value="summary">まとめ記事</option>
                    <option value="bonus">特典・補足記事</option>
                  </select>
                </label>
                <label className="editor-field">
                  <span>シリーズ名</span>
                  <input
                    value={values.seriesName}
                    maxLength={200}
                    onChange={(event) => change("seriesName", event.target.value)}
                    placeholder="任意"
                  />
                </label>
                <SelectWithCustom
                  className="editor-field"
                  label="マガジン内の順番"
                  value={values.seriesOrder}
                  onChange={(value) => change("seriesOrder", value)}
                  options={Array.from({ length: 20 }, (_, index) => ({
                    value: String(index + 1),
                    label: `${index + 1}番目`,
                  }))}
                  placeholder="順番を選択"
                  customPlaceholder="20以上など自由入力"
                  inputType="number"
                  min={1}
                />
              </>
            )}
          </>
        )}

        <EditorTextArea label="完成本文" value={values.body} onChange={(value) => change("body", value)} />
        <EditorTextArea label="掲載用本文" value={values.publishBody} onChange={(value) => change("publishBody", value)} />
        <EditorTextArea label="元記事" value={values.sourceBody} onChange={(value) => change("sourceBody", value)} />
      </div>
    </form>
  );
}

function EditorTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="editor-field full">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EditorErrorNotice({ message }: { message: string }) {
  return (
    <div className="library-notice error" role="alert">
      <strong>処理を完了できませんでした</strong>
      <span>{message}</span>
    </div>
  );
}
