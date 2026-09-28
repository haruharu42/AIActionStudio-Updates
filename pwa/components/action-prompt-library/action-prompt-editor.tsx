import { SelectWithCustom } from "@/components/select-with-custom";
import { AI_APP_LINKS, type AiAppKey } from "@/lib/ai-app-links";
import { recommendedActionPromptAi, type ActionPromptTemplate } from "@/features/prompts";

type Props = {
  selected: ActionPromptTemplate;
  values: Record<string, string>;
  prompt: string;
  favorite: boolean;
  selectedAi: AiAppKey;
  message: string;
  onValueChange: (key: string, value: string) => void;
  onFavoriteToggle: () => void;
  onAiChange: (key: AiAppKey) => void;
  onCopy: (openAi?: AiAppKey) => void;
  onReset: () => void;
};

export function ActionPromptEditor({
  selected,
  values,
  prompt,
  favorite,
  selectedAi,
  message,
  onValueChange,
  onFavoriteToggle,
  onAiChange,
  onCopy,
  onReset,
}: Props) {
  const filledCount = selected.fields.filter((field) => (values[field.key] ?? "").trim()).length;
  const recommendedAi = recommendedActionPromptAi(selected);

  return (
    <section className="creator-card action-prompt-editor" aria-labelledby="selected-prompt-title">
      <div className="action-prompt-editor-head">
        <div>
          <span>{selected.category}</span>
          <h2 id="selected-prompt-title">{selected.title}</h2>
          <p>{selected.description}</p>
        </div>
        <button type="button" onClick={onFavoriteToggle} aria-pressed={favorite}>
          {favorite ? "★ お気に入り済み" : "☆ お気に入り"}
        </button>
      </div>

      <div className="action-prompt-input-status">
        <span>入力 {filledCount} / {selected.fields.length}</span>
        <button type="button" onClick={onReset}>入力をリセット</button>
      </div>

      <div className="action-prompt-fields">
        {selected.fields.map((field) => (
          field.options?.length ? (
            <SelectWithCustom
              key={field.key}
              className="action-prompt-field"
              label={field.label}
              value={values[field.key] ?? ""}
              onChange={(value) => onValueChange(field.key, value)}
              options={field.options}
              placeholder="候補から選択"
              customPlaceholder={field.placeholder || "その他を自由入力"}
            />
          ) : (
            <label className={field.multiline ? "full" : ""} key={field.key}>
              <span>{field.label}</span>
              {field.multiline ? (
                <textarea
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) => onValueChange(field.key, event.target.value)}
                />
              ) : (
                <input
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) => onValueChange(field.key, event.target.value)}
                />
              )}
            </label>
          )
        ))}
      </div>

      <label className="action-prompt-output">
        <span>完成プロンプト</span>
        <textarea readOnly value={prompt} />
      </label>

      <div className="action-prompt-ai-step">
        <label>
          <span>使用AI</span>
          <select value={selectedAi} onChange={(event) => onAiChange(event.target.value as AiAppKey)}>
            {(["chatgpt", "claude", "gemini"] as const).map((key) => (
              <option key={key} value={key}>
                {AI_APP_LINKS[key].name}{key === recommendedAi ? "（推奨）" : ""}
              </option>
            ))}
          </select>
        </label>
        <small>あとから何度でも変更できます。選択したAIも入力途中の内容と一緒に保存されます。</small>
      </div>

      <div className="action-prompt-actions">
        <button className="primary-action" type="button" onClick={() => onCopy(selectedAi)}>
          コピーして{AI_APP_LINKS[selectedAi].name}を開く
        </button>
        <button type="button" onClick={() => onCopy()}>プロンプトだけコピー</button>
      </div>

      {message && <div className="route-notice" role="status">{message}</div>}
      <p className="panel-muted">
        AASはプロンプトを準備して外部AIを開きます。ブラウザへAIサービスのAPIキーや秘密鍵は保存しません。
      </p>
    </section>
  );
}
