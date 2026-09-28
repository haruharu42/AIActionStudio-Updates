import type {
  KnowledgeRefreshChangeItem,
  KnowledgeRefreshDiff,
} from "@/lib/knowledge-auto-update";

const FIELD_LABELS: Record<string, string> = {
  new: "新規追加",
  kind: "分類",
  label: "表示名",
  parent_label: "親分類",
  aliases: "別名",
  guidance: "制作ルール",
  deliverables: "成果物",
  cautions: "注意・禁止",
  tasks: "適用機能",
  priority: "優先度",
  sources: "根拠URL",
  source_summary: "根拠要約",
  provider: "AIプロバイダー",
  plan: "利用プラン",
  task: "用途",
  rules: "Promptルール",
};

function actionLabel(action: KnowledgeRefreshChangeItem["action"]): string {
  if (action === "added") return "追加";
  if (action === "updated") return "変更";
  return "変更なし";
}

function DiffGroup({
  title,
  diff,
}: {
  title: string;
  diff: KnowledgeRefreshDiff["knowledge"];
}) {
  return (
    <section className="knowledge-diff-group">
      <header>
        <strong>{title}</strong>
        <div>
          <span className="added">＋{diff.added} 追加</span>
          <span className="updated">↻ {diff.updated} 変更</span>
          <span className="unchanged">＝{diff.unchanged} 変更なし</span>
        </div>
      </header>
      {diff.items.length > 0 && (
        <div className="knowledge-diff-items">
          {diff.items.map((item) => (
            <article key={item.itemType + ":" + item.key}>
              <div className="knowledge-diff-item-head">
                <span className={"diff-action " + item.action}>{actionLabel(item.action)}</span>
                <strong>{item.label || item.key}</strong>
              </div>
              <small>{item.key}</small>
              {item.changedFields.length > 0 && (
                <p>
                  変更箇所: {item.changedFields.map((field) => FIELD_LABELS[field] ?? field).join(" / ")}
                </p>
              )}
              {item.sourceSummary && <p className="source-summary">根拠: {item.sourceSummary}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function KnowledgeDiffSummary({ diff }: { diff: KnowledgeRefreshDiff }) {
  return (
    <div className="knowledge-diff-summary">
      <DiffGroup title="Knowledge" diff={diff.knowledge} />
      <DiffGroup title="Prompt" diff={diff.prompt} />
    </div>
  );
}
