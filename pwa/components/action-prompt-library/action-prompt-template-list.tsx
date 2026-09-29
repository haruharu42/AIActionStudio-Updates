import type { ActionPromptTemplate } from "@/features/prompts";

type Props = {
  templates: readonly ActionPromptTemplate[];
  selectedId: string;
  onSelect: (template: ActionPromptTemplate) => void;
  onClearFilters: () => void;
};

export function ActionPromptTemplateList({ templates, selectedId, onSelect, onClearFilters }: Props) {
  return (
    <section className="action-prompt-list" aria-label="プロンプト一覧">
      <div className="action-prompt-list-head">
        <strong>{templates.length}件</strong>
        <small>プロンプト本文は入力内容から自動で完成します。</small>
      </div>

      {templates.map((template) => (
        <button
          key={template.id}
          className={template.id === selectedId ? "action-prompt-item active" : "action-prompt-item"}
          type="button"
          onClick={() => onSelect(template)}
        >
          <span>{template.category}</span>
          <strong>{template.title}</strong>
          <p>{template.description}</p>
          <small>{template.sideHustle} · 推奨 {template.recommendedAi}</small>
        </button>
      ))}

      {!templates.length && (
        <div className="route-notice action-prompt-empty" role="status">
          <span>条件に一致するプロンプトがありません。</span>
          <button type="button" className="secondary-action" onClick={onClearFilters}>検索条件をクリア</button>
        </div>
      )}
    </section>
  );
}
