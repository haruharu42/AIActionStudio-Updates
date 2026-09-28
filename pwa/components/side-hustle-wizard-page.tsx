"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { SideHustlePromptStep } from "@/components/side-hustles/side-hustle-prompt-step";
import { SideHustleResultStep } from "@/components/side-hustles/side-hustle-result-step";
import { SideHustleSelectField } from "@/components/side-hustles/side-hustle-select-field";
import { SideHustleStepRail } from "@/components/side-hustles/side-hustle-step-rail";
import { AI_APP_LINKS, launchAiApp, type AiAppKey } from "@/lib/ai-app-links";
import {
  getRuntimeKnowledgeState,
  KNOWLEDGE_RUNTIME_EVENT,
} from "@/lib/prompt-optimization";
import { getSideHustleDefinition } from "@/features/side-hustles/catalog";
import {
  buildSideHustlePrompt,
  initialSideHustleDraft,
  validateSideHustleGroup,
} from "@/features/side-hustles/prompt-builder";
import {
  clearSideHustleDraft,
  hasStoredSideHustleDraft,
  readSideHustleDraft,
  writeSideHustleDraft,
} from "@/features/side-hustles/progress";
import type { SideHustleDraft } from "@/features/side-hustles/types";
import { loadWritingProfile } from "@/lib/user-personalization";

function formatKnowledgeDate(value: string | null): string {
  if (!value) return "未設定";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未設定" : date.toLocaleString("ja-JP");
}

export function SideHustleWizardPage({ slug }: { slug: string }) {
  const { state } = useSharedAccessState();
  const userId = state.kind === "ready" ? state.profile.id : "";
  return <SideHustleWizardContent key={`${userId}:${slug}`} slug={slug} />;
}

function SideHustleWizardContent({ slug }: { slug: string }) {
  const definition = getSideHustleDefinition(slug);
  const { state, client } = useSharedAccessState();
  const userId = state.kind === "ready" ? state.profile.id : "";
  const [draft, setDraft] = useState<SideHustleDraft | null>(
    () => definition ? initialSideHustleDraft(definition) : null,
  );
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [, setKnowledgeRevision] = useState(0);

  useEffect(() => {
    if (!definition || !userId) return;
    let active = true;
    const restore = async () => {
      const hasStored = hasStoredSideHustleDraft(userId, definition);
      const restored = readSideHustleDraft(userId, definition);

      if (!hasStored && client) {
        try {
          const profile = await loadWritingProfile(client, userId);
          restored.selectedPlan = profile.preferredPlan;
        } catch {
          // Keep the safe free-plan default when personalization is unavailable.
        }
      }

      if (!active) return;
      setDraft(restored);
      setHydrated(true);
    };
    void restore();
    return () => { active = false; };
  }, [client, definition, userId]);

  useEffect(() => {
    const refresh = () => setKnowledgeRevision((value) => value + 1);
    window.addEventListener(KNOWLEDGE_RUNTIME_EVENT, refresh);
    return () => window.removeEventListener(KNOWLEDGE_RUNTIME_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!definition || !draft || !hydrated || !userId) return;
    const saved = writeSideHustleDraft(userId, definition, draft);
    let active = true;
    queueMicrotask(() => { if (active) setStorageError(!saved); });
    return () => { active = false; };
  }, [definition, draft, hydrated, userId]);

  useEffect(() => {
    if (!definition || !draft || !hydrated || !userId) return;
    const persist = () => writeSideHustleDraft(userId, definition, draft);
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [definition, draft, hydrated, userId]);

  const built = definition && draft ? buildSideHustlePrompt(definition, draft) : null;
  const runtimeState = getRuntimeKnowledgeState();

  if (!definition || !draft || !hydrated) return null;

  const fields = definition.fields.filter((field) =>
    draft.step === 0 ? field.group === "basic" : field.group === "detail",
  );

  const patchDraft = (patch: Partial<SideHustleDraft>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
  };

  const next = () => {
    setMessage("");
    if (draft.step === 0) {
      const error = validateSideHustleGroup(definition, draft, "basic");
      if (error) {
        setMessage(error);
        return;
      }
    }
    if (draft.step === 1) {
      const error = validateSideHustleGroup(definition, draft, "detail");
      if (error) {
        setMessage(error);
        return;
      }
    }
    patchDraft({ step: Math.min(4, draft.step + 1) });
  };

  const back = () => {
    setMessage("");
    patchDraft({ step: Math.max(0, draft.step - 1) });
  };

  const reset = () => {
    clearSideHustleDraft(userId, definition);
    setDraft(initialSideHustleDraft(definition));
    setHydrated(true);
    setMessage("入力内容をリセットしました。");
  };

  const copyPrompt = async (openAi?: AiAppKey) => {
    if (!built) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(built.prompt);
      copied = true;
      setMessage(
        openAi
          ? "専用プロンプトをコピーして" + AI_APP_LINKS[openAi].name + "を開きます。"
          : "専用プロンプトをコピーしました。",
      );
    } catch {
      setMessage("自動コピーできませんでした。完成プロンプト欄からコピーしてください。");
    }

    if (openAi && copied) {
      const nextDraft = { ...draft, step: 4 };
      const saved = writeSideHustleDraft(userId, definition, nextDraft);
      setStorageError(!saved);
      setDraft(nextDraft);
      if (!saved) {
        setMessage("プロンプトはコピーしました。進捗を端末へ保存できないため、この画面を開いたまま別タブでAIを使用してください。");
        return;
      }
      launchAiApp(openAi);
      return;
    }
    writeSideHustleDraft(userId, definition, draft);
  };

  const pasteResult = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) {
        setMessage("クリップボードに貼り付ける内容がありません。");
        return;
      }
      patchDraft({ resultText: value.slice(0, 120000) });
      setMessage("AIの出力を貼り付けました。");
    } catch {
      setMessage("クリップボードを読み取れませんでした。下の欄へ直接貼り付けてください。");
    }
  };

  const copyResult = async () => {
    if (!draft.resultText.trim()) return;
    try {
      await navigator.clipboard.writeText(draft.resultText);
      setMessage("AIの完成結果をコピーしました。");
    } catch {
      setMessage("結果をコピーできませんでした。");
    }
  };

  return (
    <main className="creator-page side-hustle-wizard-page">
      <header className="creator-head">
        <div>
          <p className="eyebrow">DEDICATED SIDE-HUSTLE WORKFLOW</p>
          <h1>{definition.title}</h1>
          <p>{definition.summary}</p>
        </div>
        <div className="side-hustle-head-actions">
          <Link className="route-back" href="/tools">← 機能一覧</Link>
          <button type="button" className="secondary-action" onClick={reset}>入力をリセット</button>
        </div>
      </header>

      <SideHustleStepRail step={draft.step} />

      <section className="side-hustle-knowledge-status" aria-label="ナレッジ更新状態">
        <div>
          <span>KNOWLEDGE</span>
          <strong>{runtimeState.channel === "fresh" ? "Fresh" : "Stable"} v{runtimeState.effectiveVersion}</strong>
        </div>
        <p>
          この機能専用のナレッジとPrompt最適化を自動で合成します。
          次回更新予定: {formatKnowledgeDate(runtimeState.nextRefreshDueAt)}
        </p>
      </section>

      {(draft.step === 0 || draft.step === 1) && (
        <section className="side-hustle-wizard-card">
          <div className="side-hustle-step-copy">
            <p className="eyebrow">STEP {draft.step + 1}</p>
            <h2>{draft.step === 0 ? "基本条件を選ぶ" : "成果物の条件を細かく選ぶ"}</h2>
            <p>
              まずプルダウンから選択してください。
              選択肢にない場合だけ「その他・自由入力」を選ぶと入力欄が表示されます。
            </p>
          </div>
          <div className="side-hustle-field-grid">
            {fields.map((field) => (
              <SideHustleSelectField
                key={field.key}
                field={field}
                value={draft.values[field.key]}
                onChange={(value) => setDraft((current) => current ? {
                  ...current,
                  values: { ...current.values, [field.key]: value },
                } : current)}
              />
            ))}
          </div>
        </section>
      )}

      {draft.step === 2 && (
        <section className="side-hustle-wizard-card">
          <div className="side-hustle-step-copy">
            <p className="eyebrow">STEP 3</p>
            <h2>使用するAIを選ぶ</h2>
            <p>この副業機能の推奨AIを初期値にしていますが、いつでも変更できます。</p>
          </div>
          <div className="side-hustle-ai-grid">
            <label className="side-hustle-field">
              <span className="side-hustle-field-label">使用AI</span>
              <small>専用プロンプトは選択AI向けの最新Prompt最適化も自動で追加します。</small>
              <select
                value={draft.selectedAi}
                onChange={(event) => patchDraft({ selectedAi: event.target.value as AiAppKey })}
              >
                {(["chatgpt", "claude", "gemini"] as const).map((key) => (
                  <option key={key} value={key}>
                    {AI_APP_LINKS[key].name}{key === definition.recommendedAi ? "（推奨）" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="side-hustle-field">
              <span className="side-hustle-field-label">利用プラン</span>
              <small>Free / Paidで利用できる機能差をPrompt最適化に反映します。</small>
              <select
                value={draft.selectedPlan}
                onChange={(event) => patchDraft({ selectedPlan: event.target.value === "free" ? "free" : "paid" })}
              >
                <option value="free">Free</option>
                <option value="paid">Paid / Plus / Pro 等</option>
              </select>
            </label>
          </div>
          <div className="side-hustle-ai-note">
            <strong>ナレッジ適用範囲</strong>
            <span>{definition.title} 専用</span>
            <small>内部では副業ごとに別タスクへ分離し、記事用の汎用ルールではなく、この機能に関係するKnowledge / Prompt Updateだけを優先適用します。</small>
          </div>
        </section>
      )}

      {draft.step === 3 && built && (
        <SideHustlePromptStep
          definition={definition}
          draft={draft}
          built={built}
          onCopyPrompt={copyPrompt}
        />
      )}

      {draft.step === 4 && (
        <SideHustleResultStep
          definition={definition}
          draft={draft}
          onChangeResult={(value) => patchDraft({ resultText: value })}
          onPasteResult={pasteResult}
          onCopyResult={copyResult}
          onClearResult={() => {
            patchDraft({ resultText: "" });
            setMessage("AIの完成結果だけをクリアしました。設定内容は残しています。");
          }}
        />
      )}


      {message && <div className="route-notice" role="status">{message}</div>}
      {storageError && <div className="route-notice" role="alert">進捗を端末に保存できません。画面を閉じる前に、入力内容とAIの結果をコピーして保管してください。</div>}

      <nav className="side-hustle-wizard-nav" aria-label="副業機能ステップ操作">
        <button
          className="secondary-action"
          type="button"
          disabled={draft.step === 0}
          onClick={back}
        >
          ← 戻る
        </button>
        {draft.step < 4 ? (
          <button className="primary-action" type="button" onClick={next}>
            {draft.step === 3 ? "AI出力を貼り付ける →" : "次へ →"}
          </button>
        ) : (
          <Link className="primary-action" href="/tools">機能一覧へ戻る</Link>
        )}
      </nav>
    </main>
  );
}
