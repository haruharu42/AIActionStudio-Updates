"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { PresetNumberSelectWithCustom, SelectWithCustom } from "@/components/select-with-custom";
import { SIDE_HUSTLE_DEFINITIONS } from "@/features/side-hustles/catalog";
import {
  loadActionPromptCatalog,
  saveActionPromptCategory,
  saveActionPromptTemplate,
  type ActionPromptCategoryRecord,
  type ActionPromptTemplateRecord,
} from "@/lib/action-prompt-service";
import type { ActionPromptField } from "@/lib/action-prompt-catalog";

const PROMPT_ICON_OPTIONS = ["⌘", "✍️", "📱", "🎬", "🖼️", "🛒", "💼", "📣", "🔍", "⚙️", "🤖", "✨"] as const;
const SORT_ORDER_PRESETS = [10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500] as const;
const VERSION_PRESETS = [1, 2, 3, 4, 5, 10] as const;

const FIELD_AUDIENCE_OPTIONS = [
  "完全初心者", "初心者", "経験者", "会社員・働く人", "副業を始めたい人",
  "クリエイター・発信者", "個人事業主・経営者", "既存フォロワー", "購入を検討している人", "幅広い読者",
] as const;
const FIELD_GOAL_OPTIONS = [
  "認知を広げる", "保存・ブックマークにつなげる", "プロフィール閲覧・フォローにつなげる",
  "購入判断を助ける", "商品・サービス購入につなげる", "問い合わせ・相談につなげる",
  "応募・案件獲得につなげる", "理解・学習を助ける", "継続して読んでもらう", "作業を効率化する",
] as const;

const NEW_FIELDS: ActionPromptField[] = [
  { key: "topic", label: "テーマ・対象", placeholder: "例：AI副業、商品、動画テーマ" },
  { key: "audience", label: "想定する相手", placeholder: "一覧にない相手は自由入力", options: FIELD_AUDIENCE_OPTIONS },
  { key: "goal", label: "目的", placeholder: "一覧にない目的は自由入力", options: FIELD_GOAL_OPTIONS },
  { key: "notes", label: "追加条件・素材", placeholder: "事実として使える情報、避けたい表現など", multiline: true },
];

type TemplateDraft = Omit<ActionPromptTemplateRecord, "category">;

function blankTemplate(categoryKey: string): TemplateDraft {
  return {
    databaseId: "",
    id: "",
    title: "",
    categoryKey,
    sideHustle: "",
    description: "",
    recommendedAi: "ChatGPT",
    fields: NEW_FIELDS.map((field) => ({ ...field })),
    prompt: "",
    status: "draft",
    sortOrder: 100,
    version: 1,
  };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

export function AdminActionPromptsPage() {
  const { state, client } = useSharedAccessState();
  const isAdmin = state.kind === "ready" && state.profile.role === "admin" && state.profile.status === "active";
  const [categories, setCategories] = useState<ActionPromptCategoryRecord[]>([]);
  const [templates, setTemplates] = useState<ActionPromptTemplateRecord[]>([]);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [newCategory, setNewCategory] = useState({ categoryKey: "", displayName: "", description: "", icon: "⌘", sortOrder: 100, status: "active" as const });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!client) throw new Error("AASへ接続できませんでした。");
    const next = await loadActionPromptCatalog(client);
    setCategories(next.categories);
    setTemplates(next.templates);
  }, [client]);

  useEffect(() => {
    if (!isAdmin || !client) return;
    let active = true;
    void loadActionPromptCatalog(client).then(
      (next) => {
        if (!active) return;
        setCategories(next.categories);
        setTemplates(next.templates);
      },
      (error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "プロンプト管理を初期化できませんでした。");
      },
    );
    return () => { active = false; };
  }, [client, isAdmin]);

  const visibleTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((item) =>
      [item.title, item.id, item.category, item.sideHustle, item.description].some((value) => value.toLowerCase().includes(needle))
    );
  }, [query, templates]);

  const sideHustleOptions = useMemo(() => {
    const values = new Set<string>();
    for (const definition of SIDE_HUSTLE_DEFINITIONS) values.add(definition.title);
    for (const template of templates) if (template.sideHustle.trim()) values.add(template.sideHustle.trim());
    return [...values].sort((a, b) => a.localeCompare(b, "ja"));
  }, [templates]);

  const openTemplate = (template: ActionPromptTemplateRecord) => {
    setDraft({
      databaseId: template.databaseId,
      id: template.id,
      title: template.title,
      categoryKey: template.categoryKey,
      sideHustle: template.sideHustle,
      description: template.description,
      recommendedAi: template.recommendedAi,
      fields: template.fields.map((field) => ({ ...field })),
      prompt: template.prompt,
      status: template.status,
      sortOrder: template.sortOrder,
      version: template.version,
    });
    setMessage("");
  };

  const saveTemplate = async () => {
    if (!draft || !client || busy) return;
    if (!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(draft.id)) {
      setMessage("プロンプトIDは英小文字・数字・-・_で3〜80文字にしてください。");
      return;
    }
    if (!draft.title.trim() || !draft.categoryKey || !draft.prompt.trim()) {
      setMessage("タイトル、カテゴリ、プロンプト本文は必須です。");
      return;
    }
    const keys = draft.fields.map((field) => field.key.trim());
    if (keys.some((key) => !/^[a-zA-Z0-9_-]{1,40}$/.test(key)) || new Set(keys).size !== keys.length) {
      setMessage("入力項目のkeyは英数字・-・_のみで重複なしにしてください。");
      return;
    }
    if (draft.fields.some((field) => !field.label.trim())) {
      setMessage("入力項目のラベルを入力してください。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await saveActionPromptTemplate(client, draft);
      await reload();
      setMessage(draft.databaseId ? "プロンプトを更新しました。" : "プロンプトを追加しました。");
      setDraft(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "プロンプトを保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = async (category: ActionPromptCategoryRecord) => {
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await saveActionPromptCategory(client, category);
      await reload();
      setMessage("カテゴリを保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "カテゴリを保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    if (!client || busy) return;
    const key = normalizeKey(newCategory.categoryKey);
    if (!/^[a-z0-9_-]{2,64}$/.test(key) || !newCategory.displayName.trim()) {
      setMessage("カテゴリキーと表示名を入力してください。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await saveActionPromptCategory(client, { ...newCategory, categoryKey: key });
      await reload();
      setNewCategory({ categoryKey: "", displayName: "", description: "", icon: "⌘", sortOrder: 100, status: "active" });
      setMessage("カテゴリを追加しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "カテゴリを追加できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const patchCategory = (id: string, patch: Partial<ActionPromptCategoryRecord>) => {
    setCategories((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const patchField = (index: number, patch: Partial<ActionPromptField>) => {
    setDraft((current) => current ? {
      ...current,
      fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field),
    } : current);
  };

  if (state.kind === "loading") return null;
  if (!isAdmin) {
    return (
      <main className="standalone-page"><section className="standalone-card">
        <p className="eyebrow">PROMPT CONTROL</p><h1>副業プロンプト管理</h1>
        <p className="route-notice error">この機能はactive管理者のみ利用できます。</p>
        <Link className="route-back" href="/">← ホームへ戻る</Link>
      </section></main>
    );
  }

  return (
    <main className="prompt-admin-page">
      <header className="prompt-admin-head">
        <div>
          <p className="eyebrow">PROMPT CONTROL</p>
          <h1>副業プロンプト管理</h1>
          <p>コード更新なしで、ユーザー向けプロンプト・カテゴリ・入力項目・推奨AI・公開状態を管理します。</p>
        </div>
        <nav><Link href="/admin">管理ダッシュボード</Link><Link href="/prompts">ユーザー表示を確認</Link></nav>
      </header>

      {message && <div className="route-notice">{message}</div>}

      <section className="prompt-admin-stats">
        <article><span>カテゴリ</span><strong>{categories.length}</strong></article>
        <article><span>全プロンプト</span><strong>{templates.length}</strong></article>
        <article><span>公開中</span><strong>{templates.filter((item) => item.status === "active").length}</strong></article>
        <article><span>下書き/停止</span><strong>{templates.filter((item) => item.status !== "active").length}</strong></article>
      </section>

      <section className="prompt-admin-panel">
        <div className="prompt-admin-panel-head">
          <div><p className="eyebrow">CATEGORIES</p><h2>カテゴリ管理</h2></div>
          <p>削除せず、使わないカテゴリは「停止」にします。</p>
        </div>
        <div className="prompt-category-grid">
          {categories.map((category) => (
            <article key={category.id}>
              <div className="prompt-category-row">
                <SelectWithCustom
                  label="アイコン"
                  value={category.icon}
                  onChange={(icon) => patchCategory(category.id, { icon: icon.slice(0, 16) })}
                  options={PROMPT_ICON_OPTIONS}
                  customPlaceholder="絵文字・記号を入力"
                  maxLength={16}
                />
                <label><span>表示名</span><input aria-label="表示名" value={category.displayName} onChange={(event) => patchCategory(category.id, { displayName: event.target.value.slice(0, 80) })} /></label>
              </div>
              <small>{category.categoryKey}</small>
              <textarea rows={2} aria-label="説明" value={category.description} onChange={(event) => patchCategory(category.id, { description: event.target.value.slice(0, 500) })} />
              <div className="prompt-category-row">
                <PresetNumberSelectWithCustom
                  label="並び順"
                  value={category.sortOrder}
                  onChange={(sortOrder) => patchCategory(category.id, { sortOrder })}
                  presets={SORT_ORDER_PRESETS}
                  min={0}
                  max={100000}
                />
                <label><span>状態</span><select aria-label="状態" value={category.status} onChange={(event) => patchCategory(category.id, { status: event.target.value === "inactive" ? "inactive" : "active" })}>
                  <option value="active">公開</option><option value="inactive">停止</option>
                </select></label>
                <button type="button" disabled={busy} onClick={() => void saveCategory(category)}>保存</button>
              </div>
            </article>
          ))}
        </div>

        <div className="prompt-category-add">
          <input placeholder="category-key" value={newCategory.categoryKey} onChange={(event) => setNewCategory((current) => ({ ...current, categoryKey: event.target.value }))} />
          <input placeholder="表示名" value={newCategory.displayName} onChange={(event) => setNewCategory((current) => ({ ...current, displayName: event.target.value }))} />
          <input placeholder="説明" value={newCategory.description} onChange={(event) => setNewCategory((current) => ({ ...current, description: event.target.value }))} />
          <SelectWithCustom
            label="アイコン"
            value={newCategory.icon}
            onChange={(icon) => setNewCategory((current) => ({ ...current, icon: icon.slice(0, 16) }))}
            options={PROMPT_ICON_OPTIONS}
            customPlaceholder="絵文字・記号を入力"
            maxLength={16}
          />
          <PresetNumberSelectWithCustom
            label="並び順"
            value={newCategory.sortOrder}
            onChange={(sortOrder) => setNewCategory((current) => ({ ...current, sortOrder }))}
            presets={SORT_ORDER_PRESETS}
            min={0}
            max={100000}
          />
          <button type="button" disabled={busy} onClick={() => void addCategory()}>カテゴリ追加</button>
        </div>
      </section>

      <section className="prompt-admin-panel">
        <div className="prompt-admin-panel-head">
          <div><p className="eyebrow">PROMPTS</p><h2>プロンプト一覧</h2></div>
          <button type="button" onClick={() => setDraft(blankTemplate(categories.find((item) => item.status === "active")?.categoryKey ?? categories[0]?.categoryKey ?? ""))}>＋ 新規プロンプト</button>
        </div>
        <input className="prompt-admin-search" placeholder="タイトル・ID・カテゴリ・副業で検索" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="prompt-admin-template-list">
          {visibleTemplates.map((template) => (
            <button key={template.databaseId} type="button" onClick={() => openTemplate(template)}>
              <span>{template.category} · {template.sideHustle || "共通"}</span>
              <strong>{template.title}</strong>
              <small>{template.id} / {template.status === "active" ? "公開" : template.status === "draft" ? "下書き" : "停止"} / v{template.version}</small>
            </button>
          ))}
        </div>
      </section>

      {draft && (
        <section className="prompt-admin-panel prompt-admin-editor">
          <div className="prompt-admin-panel-head">
            <div><p className="eyebrow">EDITOR</p><h2>{draft.databaseId ? "プロンプト編集" : "新規プロンプト"}</h2></div>
            <button type="button" onClick={() => setDraft(null)}>閉じる</button>
          </div>

          <div className="prompt-admin-form-grid">
            <label><span>プロンプトID</span><input value={draft.id} onChange={(event) => setDraft((current) => current ? { ...current, id: normalizeKey(event.target.value) } : current)} placeholder="x-post-series" /></label>
            <label><span>タイトル</span><input value={draft.title} onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value.slice(0, 120) } : current)} /></label>
            <label><span>カテゴリ</span><select value={draft.categoryKey} onChange={(event) => setDraft((current) => current ? { ...current, categoryKey: event.target.value } : current)}>{categories.map((category) => <option key={category.id} value={category.categoryKey}>{category.displayName}{category.status === "inactive" ? "（停止）" : ""}</option>)}</select></label>
            <SelectWithCustom
              label="副業・用途"
              value={draft.sideHustle}
              onChange={(sideHustle) => setDraft((current) => current ? { ...current, sideHustle: sideHustle.slice(0, 120) } : current)}
              options={sideHustleOptions}
              placeholder="共通・指定なし"
              customPlaceholder="一覧にない副業・用途を入力"
              maxLength={120}
            />
            <label><span>推奨AI</span><select value={draft.recommendedAi} onChange={(event) => setDraft((current) => current ? { ...current, recommendedAi: event.target.value as TemplateDraft["recommendedAi"] } : current)}><option>ChatGPT</option><option>Claude</option><option>Gemini</option></select></label>
            <label><span>公開状態</span><select value={draft.status} onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value as TemplateDraft["status"] } : current)}><option value="draft">下書き</option><option value="active">公開</option><option value="inactive">停止</option></select></label>
            <PresetNumberSelectWithCustom
              label="並び順"
              value={draft.sortOrder}
              onChange={(sortOrder) => setDraft((current) => current ? { ...current, sortOrder } : current)}
              presets={SORT_ORDER_PRESETS}
              min={0}
              max={100000}
            />
            <PresetNumberSelectWithCustom
              label="バージョン"
              value={draft.version}
              onChange={(version) => setDraft((current) => current ? { ...current, version } : current)}
              presets={VERSION_PRESETS}
              min={1}
              max={9999}
            />
            <label className="full"><span>説明</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value.slice(0, 500) } : current)} /></label>
          </div>

          <div className="prompt-admin-fields">
            <div className="prompt-admin-panel-head"><div><h3>ユーザー入力項目</h3><p>入力した値は本文の <code>{"{{key}}"}</code> へ差し込まれます。</p></div><button type="button" onClick={() => setDraft((current) => current ? { ...current, fields: [...current.fields, { key: `field${current.fields.length + 1}`, label: "追加項目", placeholder: "" }] } : current)}>＋ 項目追加</button></div>
            {draft.fields.map((field, index) => (
              <div className="prompt-admin-field-row" key={`${field.key}-${index}`}>
                <input aria-label="key" value={field.key} onChange={(event) => patchField(index, { key: event.target.value.slice(0, 40) })} placeholder="key" />
                <input aria-label="ラベル" value={field.label} onChange={(event) => patchField(index, { label: event.target.value.slice(0, 100) })} placeholder="表示ラベル" />
                <input aria-label="プレースホルダー" value={field.placeholder} onChange={(event) => patchField(index, { placeholder: event.target.value.slice(0, 200) })} placeholder="自由入力時の入力例" />
                <input
                  aria-label="選択肢"
                  value={field.options?.join("、") ?? ""}
                  onChange={(event) => patchField(index, {
                    options: event.target.value
                      .split(/[,、\n]/)
                      .map((value) => value.trim())
                      .filter(Boolean)
                      .slice(0, 30),
                  })}
                  placeholder="選択肢を「、」区切りで入力（空欄なら自由入力のみ）"
                />
                <label className="check"><input type="checkbox" checked={field.multiline === true} onChange={(event) => patchField(index, { multiline: event.target.checked, options: event.target.checked ? [] : field.options })} />複数行</label>
                <button type="button" onClick={() => setDraft((current) => current ? { ...current, fields: current.fields.filter((_item, fieldIndex) => fieldIndex !== index) } : current)}>削除</button>
              </div>
            ))}
          </div>

          <label className="prompt-admin-prompt"><span>プロンプト本文</span><textarea rows={18} value={draft.prompt} onChange={(event) => setDraft((current) => current ? { ...current, prompt: event.target.value } : current)} placeholder={"例：テーマ: {{topic}}\n想定読者: {{audience}}"} /></label>
          <div className="prompt-admin-save-row">
            <span>公開にするとactiveユーザーのプロンプトライブラリへ反映されます。削除はせず「停止」で非表示にできます。</span>
            <button type="button" disabled={busy} onClick={() => void saveTemplate()}>{busy ? "保存中…" : "保存"}</button>
          </div>
        </section>
      )}
    </main>
  );
}
