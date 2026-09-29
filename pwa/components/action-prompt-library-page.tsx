"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { ActionPromptEditor } from "@/components/action-prompt-library/action-prompt-editor";
import { ActionPromptTemplateList } from "@/components/action-prompt-library/action-prompt-template-list";
import { ActionPromptToolbar } from "@/components/action-prompt-library/action-prompt-toolbar";
import { AI_APP_LINKS, launchAiApp, type AiAppKey } from "@/lib/ai-app-links";
import {
  ACTION_PROMPT_FAVORITES_KEY,
  ACTION_PROMPT_RECENT_KEY,
  ACTION_PROMPT_TEMPLATES,
  buildActionPrompt,
  initialActionPromptValues,
  loadActionPromptCatalog,
  readActionPromptIds,
  readActionPromptProgress,
  readActionPromptRouteSelection,
  recommendedActionPromptAi,
  resolveActionPromptRouteTemplate,
  writeActionPromptIds,
  writeActionPromptProgress,
  type ActionPromptTemplate,
} from "@/features/prompts";

function mergeTemplates(cloudTemplates: readonly ActionPromptTemplate[]): ActionPromptTemplate[] {
  const merged = new Map<string, ActionPromptTemplate>(ACTION_PROMPT_TEMPLATES.map((template) => [template.id, template]));
  cloudTemplates.forEach((template) => merged.set(template.id, template));
  return [...merged.values()];
}

function valuesForTemplate(
  template: ActionPromptTemplate,
  stored: ReturnType<typeof readActionPromptProgress>,
): Record<string, string> {
  if (!stored || stored.selectedId !== template.id) return initialActionPromptValues(template);
  return Object.fromEntries(
    template.fields.map((field) => [field.key, stored.values[field.key] ?? ""]),
  );
}

function filterActionPromptTemplates(
  templates: readonly ActionPromptTemplate[],
  category: string,
  query: string,
  favoritesOnly: boolean,
  favorites: readonly string[],
): ActionPromptTemplate[] {
  const needle = query.trim().toLowerCase();
  return templates.filter((template) => {
    if (category !== "すべて" && template.category !== category) return false;
    if (favoritesOnly && !favorites.includes(template.id)) return false;
    if (!needle) return true;
    return [template.title, template.category, template.sideHustle, template.description]
      .some((value) => value.toLowerCase().includes(needle));
  });
}

export function ActionPromptLibraryPage() {
  const { state, client } = useSharedAccessState();
  const userId = state.kind === "ready" ? state.profile.id : "";
  const [templates, setTemplates] = useState<ActionPromptTemplate[]>(() => [...ACTION_PROMPT_TEMPLATES]);
  const [category, setCategory] = useState("すべて");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(ACTION_PROMPT_TEMPLATES[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>(
    () => ACTION_PROMPT_TEMPLATES[0] ? initialActionPromptValues(ACTION_PROMPT_TEMPLATES[0]) : {},
  );
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedAi, setSelectedAi] = useState<AiAppKey>(
    () => ACTION_PROMPT_TEMPLATES[0] ? recommendedActionPromptAi(ACTION_PROMPT_TEMPLATES[0]) : "chatgpt",
  );
  const [progressReady, setProgressReady] = useState(false);

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];

  useEffect(() => {
    if (!userId) return;
    const routeSelection = readActionPromptRouteSelection(window.location.search);
    const stored = readActionPromptProgress(userId);

    queueMicrotask(() => {
      setFavorites(readActionPromptIds(ACTION_PROMPT_FAVORITES_KEY, userId));
      setRecent(readActionPromptIds(ACTION_PROMPT_RECENT_KEY, userId));
      if (routeSelection.category) setCategory(routeSelection.category);
      if (routeSelection.query) setQuery(routeSelection.query);

      const routeTemplate = resolveActionPromptRouteTemplate(ACTION_PROMPT_TEMPLATES, routeSelection);
      const restored = routeTemplate
        ?? (stored ? ACTION_PROMPT_TEMPLATES.find((template) => template.id === stored.selectedId) : undefined)
        ?? ACTION_PROMPT_TEMPLATES[0];

      if (restored) {
        setSelectedId(restored.id);
        setValues(valuesForTemplate(restored, stored));
        setSelectedAi(
          stored?.selectedId === restored.id && stored.selectedAi
            ? stored.selectedAi
            : recommendedActionPromptAi(restored),
        );
      }
      setProgressReady(true);
    });
  }, [userId]);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;

    void loadActionPromptCatalog(client).then(
      (catalog) => {
        if (!active) return;
        const cloudTemplates = catalog.templates.filter((template) => template.status === "active");
        const merged = mergeTemplates(cloudTemplates);
        const routeSelection = readActionPromptRouteSelection(window.location.search);
        const stored = readActionPromptProgress(userId);
        const next = resolveActionPromptRouteTemplate(merged, routeSelection)
          ?? (stored ? merged.find((template) => template.id === stored.selectedId) : undefined)
          ?? merged[0];

        setTemplates(merged);
        if (routeSelection.category) setCategory(routeSelection.category);
        if (routeSelection.query) setQuery(routeSelection.query);

        if (next) {
          setSelectedId(next.id);
          setValues(valuesForTemplate(next, stored));
          setSelectedAi(
            stored?.selectedId === next.id && stored.selectedAi
              ? stored.selectedAi
              : recommendedActionPromptAi(next),
          );
        }
      },
      () => {
        // Built-in templates remain available when the cloud catalog is temporarily unavailable.
      },
    );

    return () => {
      active = false;
    };
  }, [client, userId]);

  useEffect(() => {
    if (!progressReady || !userId || !selected) return;
    writeActionPromptProgress(userId, {
      selectedId: selected.id,
      values,
      selectedAi,
    });
  }, [progressReady, selected, selectedAi, userId, values]);

  const categories = useMemo(
    () => ["すべて", ...Array.from(new Set(templates.map((template) => template.category)))],
    [templates],
  );

  const filtered = useMemo(
    () => filterActionPromptTemplates(templates, category, query, favoritesOnly, favorites),
    [category, favorites, favoritesOnly, query, templates],
  );

  const prompt = useMemo(
    () => selected ? buildActionPrompt(selected, values) : "",
    [selected, values],
  );

  const recentTemplates = useMemo(
    () => recent
      .map((id) => templates.find((template) => template.id === id))
      .filter((template): template is ActionPromptTemplate => Boolean(template)),
    [recent, templates],
  );

  const selectTemplate = (template: ActionPromptTemplate) => {
    setSelectedId(template.id);
    setSelectedAi(recommendedActionPromptAi(template));
    setValues(initialActionPromptValues(template));
    setMessage("");
  };

  const keepSelectionInFilter = (nextFiltered: readonly ActionPromptTemplate[]) => {
    if (!nextFiltered.length || nextFiltered.some((template) => template.id === selectedId)) return;
    selectTemplate(nextFiltered[0]);
  };

  const changeCategory = (nextCategory: string) => {
    setCategory(nextCategory);
    keepSelectionInFilter(
      filterActionPromptTemplates(templates, nextCategory, query, favoritesOnly, favorites),
    );
  };

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    keepSelectionInFilter(
      filterActionPromptTemplates(templates, category, nextQuery, favoritesOnly, favorites),
    );
  };

  const toggleFavoritesOnly = () => {
    const nextFavoritesOnly = !favoritesOnly;
    setFavoritesOnly(nextFavoritesOnly);
    keepSelectionInFilter(
      filterActionPromptTemplates(templates, category, query, nextFavoritesOnly, favorites),
    );
  };

  const toggleFavorite = () => {
    if (!selected) return;
    const next = favorites.includes(selected.id)
      ? favorites.filter((item) => item !== selected.id)
      : [...favorites, selected.id];
    setFavorites(next);
    writeActionPromptIds(ACTION_PROMPT_FAVORITES_KEY, userId, next);
  };

  const markRecent = (id: string) => {
    const next = [id, ...recent.filter((item) => item !== id)].slice(0, 5);
    setRecent(next);
    writeActionPromptIds(ACTION_PROMPT_RECENT_KEY, userId, next);
  };

  const copyPrompt = async (openAi?: AiAppKey) => {
    if (!selected) return;

    writeActionPromptProgress(userId, {
      selectedId: selected.id,
      values,
      selectedAi,
    });

    try {
      await navigator.clipboard.writeText(prompt);
      setMessage(openAi
        ? `プロンプトをコピーして${AI_APP_LINKS[openAi].name}を開きます。`
        : "プロンプトをコピーしました。");
    } catch {
      setMessage("自動コピーできません。下のプロンプト欄からコピーしてください。");
    }

    markRecent(selected.id);
    if (openAi) launchAiApp(openAi);
  };

  if (!selected) return null;

  return (
    <main className="creator-page action-prompt-page">
      <header className="creator-head">
        <div>
          <p className="eyebrow">AI ACTION STUDIO</p>
          <h1>汎用プロンプトライブラリ</h1>
          <p>
            短い補助プロンプトを探すための汎用ライブラリです。
            副業ごとの本格的な設計・制作は「機能一覧」の専用ウィザードを利用してください。
          </p>
        </div>
        <Link className="route-back" href="/">← ホーム</Link>
      </header>

      <ActionPromptToolbar
        categories={categories}
        category={category}
        query={query}
        favoritesOnly={favoritesOnly}
        onCategoryChange={changeCategory}
        onQueryChange={changeQuery}
        onFavoritesToggle={toggleFavoritesOnly}
      />

      {recentTemplates.length > 0 && (
        <section className="action-prompt-recent" aria-label="最近使ったプロンプト">
          <strong>最近使ったもの</strong>
          <div>
            {recentTemplates.map((template) => (
              <button key={template.id} type="button" onClick={() => selectTemplate(template)}>
                {template.title}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="action-prompt-layout">
        <ActionPromptTemplateList
          templates={filtered}
          selectedId={selected.id}
          onSelect={selectTemplate}
        />

        <ActionPromptEditor
          selected={selected}
          values={values}
          prompt={prompt}
          favorite={favorites.includes(selected.id)}
          selectedAi={selectedAi}
          message={message}
          onValueChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
          onFavoriteToggle={toggleFavorite}
          onAiChange={setSelectedAi}
          onCopy={(openAi) => void copyPrompt(openAi)}
          onReset={() => {
            setValues(initialActionPromptValues(selected));
            setMessage("入力内容をリセットしました。");
          }}
        />
      </div>
    </main>
  );
}
