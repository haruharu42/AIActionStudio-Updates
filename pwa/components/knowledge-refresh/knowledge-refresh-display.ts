import type {
  KnowledgeAutomationCandidate,
  KnowledgeRefreshRequest,
} from "@/lib/knowledge-auto-update";

export function formatKnowledgeDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
}

export function formatKnowledgeCycle(hours: number | null | undefined): string {
  if (!hours) return "-";
  if (hours % 24 === 0) return `${hours / 24}日ごと`;
  return `${hours}時間ごと`;
}

export function knowledgeRefreshStatusLabel(status: KnowledgeRefreshRequest["status"]): string {
  switch (status) {
    case "pending": return "待機中";
    case "processing": return "調査・確認中";
    case "completed": return "公開済み";
    case "failed": return "失敗";
    case "cancelled": return "キャンセル";
  }
}

export function knowledgeAutomationActionLabel(
  action: KnowledgeAutomationCandidate["candidateAction"],
): string {
  switch (action) {
    case "new": return "新規候補";
    case "update": return "更新候補";
    case "recheck": return "再確認";
    case "retire": return "廃止候補";
  }
}

export const SIDE_HUSTLE_COVERAGE_TASKS = [
  ["sidejob_content", "記事・コンテンツ"],
  ["sidejob_sns", "SNS運用"],
  ["sidejob_video", "YouTube・ショート動画"],
  ["sidejob_affiliate", "アフィリエイト"],
  ["sidejob_resale", "物販・フリマ"],
  ["sidejob_crowdsourcing", "クラウドソーシング"],
  ["sidejob_skill_sales", "スキル販売"],
  ["sidejob_digital_product", "デジタル商品"],
  ["sidejob_outreach", "営業・案件獲得"],
  ["sidejob_research", "リサーチ"],
  ["sidejob_efficiency", "業務効率化"],
  ["sidejob_planning", "AI副業プラン"],
] as const;

export function knowledgeSourceKindLabel(value: string): string {
  switch (value) {
    case "official_changelog": return "公式Changelog";
    case "official_docs": return "公式Docs";
    case "official_help": return "公式Help";
    case "official_policy": return "公式Policy";
    case "official_feed": return "公式Feed";
    default: return "公式ページ";
  }
}

export function knowledgeSourceHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

export function knowledgeRefreshErrorLabel(value: string): string {
  if (value.startsWith("AAS auto-recovery: processing exceeded 24 hours")) {
    return "24時間以上処理中だったため自動解除しました。次回の更新サイクルで再試行できます。";
  }
  return value;
}
