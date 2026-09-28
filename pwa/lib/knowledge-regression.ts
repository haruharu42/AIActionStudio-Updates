import {
  KNOWLEDGE_TASKS,
  KNOWLEDGE_TASK_LABELS,
  previewCloudKnowledgeSelection,
  type KnowledgeRule,
  type KnowledgeTask,
} from "@/lib/knowledge-engine";
import {
  evaluateKnowledgeSelectionContract,
  type KnowledgeSelectionContractGroupResult,
} from "@/lib/knowledge-selection-contracts";

export const SIDEJOB_REGRESSION_TASKS = KNOWLEDGE_TASKS.filter(
  (task): task is KnowledgeTask => task.startsWith("sidejob_"),
);

export type KnowledgeRegressionStatus = "pass" | "warn" | "fail";

export type KnowledgeRegressionResult = {
  task: KnowledgeTask;
  label: string;
  status: KnowledgeRegressionStatus;
  eligibleCount: number;
  selectedCount: number;
  taskSpecificSelected: number;
  topRuleKey: string | null;
  topRuleLabel: string | null;
  topRuleIsTaskSpecific: boolean;
  missingSourceCount: number;
  staleSourceCount: number;
  emptyContentCount: number;
  contractPassed: boolean;
  contractGroups: KnowledgeSelectionContractGroupResult[];
  missingContractGroups: KnowledgeSelectionContractGroupResult[];
  issues: string[];
};

export type KnowledgeRegressionSummary = {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  results: KnowledgeRegressionResult[];
};

function isTaskSpecificRule(rule: KnowledgeRule, task: KnowledgeTask): boolean {
  return rule.kind === "task"
    && Array.isArray(rule.tasks)
    && rule.tasks.length === 1
    && rule.tasks[0] === task;
}

function hasSourceMetadata(rule: KnowledgeRule): boolean {
  return Boolean(rule.sourceCheckedAt)
    && Array.isArray(rule.sourceUrls)
    && rule.sourceUrls.some((url) => /^https:\/\//i.test(url));
}

function isSourceStale(rule: KnowledgeRule, referenceTime: number, staleDays: number): boolean {
  if (!rule.sourceCheckedAt) return true;
  const checkedAt = new Date(rule.sourceCheckedAt).getTime();
  if (!Number.isFinite(checkedAt)) return true;
  return referenceTime - checkedAt > staleDays * 24 * 60 * 60 * 1000;
}

function hasUsefulContent(rule: KnowledgeRule): boolean {
  return rule.guidance.length + rule.deliverables.length + rule.cautions.length > 0;
}

export function evaluateSidejobKnowledgeRegression(
  rules: KnowledgeRule[],
  options?: {
    referenceTime?: number;
    staleDays?: number;
    minSelected?: number;
  },
): KnowledgeRegressionSummary {
  const referenceTime = options?.referenceTime ?? Date.now();
  const staleDays = Math.max(1, Math.trunc(options?.staleDays ?? 90));
  const minSelected = Math.max(1, Math.min(5, Math.trunc(options?.minSelected ?? 5)));

  const results = SIDEJOB_REGRESSION_TASKS.map((task): KnowledgeRegressionResult => {
    const preview = previewCloudKnowledgeSelection(rules, { task });
    const selectedRules = preview.selected.map((item) => item.rule);
    const topRule = selectedRules[0] ?? null;
    const taskSpecificSelected = selectedRules.filter((rule) => isTaskSpecificRule(rule, task)).length;
    const missingSourceCount = selectedRules.filter((rule) => !hasSourceMetadata(rule)).length;
    const staleSourceCount = selectedRules.filter((rule) =>
      hasSourceMetadata(rule) && isSourceStale(rule, referenceTime, staleDays)
    ).length;
    const emptyContentCount = selectedRules.filter((rule) => !hasUsefulContent(rule)).length;
    const topRuleIsTaskSpecific = topRule ? isTaskSpecificRule(topRule, task) : false;
    const contract = evaluateKnowledgeSelectionContract(task, selectedRules);
    const contractPassed = contract?.passed ?? false;
    const contractGroups = contract?.groups ?? [];
    const missingContractGroups = contract?.missingGroups ?? [];

    const issues: string[] = [];
    if (selectedRules.length < minSelected) {
      issues.push(`Top ${minSelected}に必要なKnowledgeが不足（${selectedRules.length}/${minSelected}）`);
    }
    if (taskSpecificSelected < 1) {
      issues.push("副業固有KnowledgeがTop 5に含まれていません");
    }
    if (!topRuleIsTaskSpecific) {
      issues.push("最上位が横断Knowledgeです");
    }
    if (missingSourceCount > 0) {
      issues.push(`根拠情報不足 ${missingSourceCount}件`);
    }
    if (emptyContentCount > 0) {
      issues.push(`実務ルールが空のKnowledge ${emptyContentCount}件`);
    }
    if (staleSourceCount > 0) {
      issues.push(`根拠確認から${staleDays}日超過 ${staleSourceCount}件`);
    }
    if (!contractPassed) {
      for (const group of missingContractGroups) {
        issues.push(`選択契約不足: ${group.label}`);
      }
    }

    const hasBlockingRegression =
      selectedRules.length < minSelected
      || taskSpecificSelected < 1
      || !topRuleIsTaskSpecific
      || missingSourceCount > 0
      || emptyContentCount > 0
      || !contractPassed;

    return {
      task,
      label: KNOWLEDGE_TASK_LABELS[task],
      status: hasBlockingRegression ? "fail" : staleSourceCount > 0 ? "warn" : "pass",
      eligibleCount: preview.eligibleCount,
      selectedCount: selectedRules.length,
      taskSpecificSelected,
      topRuleKey: topRule?.key ?? null,
      topRuleLabel: topRule?.label ?? null,
      topRuleIsTaskSpecific,
      missingSourceCount,
      staleSourceCount,
      emptyContentCount,
      contractPassed,
      contractGroups,
      missingContractGroups,
      issues,
    };
  });

  return {
    total: results.length,
    pass: results.filter((item) => item.status === "pass").length,
    warn: results.filter((item) => item.status === "warn").length,
    fail: results.filter((item) => item.status === "fail").length,
    results,
  };
}
