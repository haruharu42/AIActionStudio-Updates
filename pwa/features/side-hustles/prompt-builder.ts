import { compileKnowledgeContext } from "@/lib/knowledge-engine";
import { compilePromptOptimizationContext } from "@/lib/prompt-optimization";
import { compileSideHustleScenarioKnowledge } from "@/features/side-hustles/scenario-knowledge";
import { compileSideHustleCombinationKnowledge } from "@/features/side-hustles/combination-knowledge";
import type { AiPlan, AiProvider } from "@/lib/user-personalization";
import {
  SIDE_HUSTLE_CUSTOM_VALUE,
  type SideHustleDefinition,
  type SideHustleDraft,
  type SideHustleFieldValue,
  type SideHustlePromptBuildResult,
} from "@/features/side-hustles/types";

export function resolveSideHustleFieldValue(
  definition: SideHustleDefinition,
  fieldKey: string,
  value: SideHustleFieldValue | undefined,
): string {
  const field = definition.fields.find((item) => item.key === fieldKey);
  if (!field || !value) return "未指定";
  if (value.selected === SIDE_HUSTLE_CUSTOM_VALUE) {
    return value.custom.trim() || "自由入力未記入";
  }
  const option = field.options.find((item) => item.value === value.selected);
  return (option?.label ?? value.selected) || "未指定";
}

export function initialSideHustleDraft(definition: SideHustleDefinition): SideHustleDraft {
  return {
    values: Object.fromEntries(definition.fields.map((field) => [
      field.key,
      {
        selected: field.options.find((item) => item.value !== SIDE_HUSTLE_CUSTOM_VALUE)?.value ?? SIDE_HUSTLE_CUSTOM_VALUE,
        custom: "",
      },
    ])),
    selectedAi: definition.recommendedAi,
    selectedPlan: "free",
    resultText: "",
    step: 0,
  };
}

export function validateSideHustleGroup(
  definition: SideHustleDefinition,
  draft: SideHustleDraft,
  group: "basic" | "detail",
): string | null {
  for (const field of definition.fields.filter((item) => item.group === group)) {
    const value = draft.values[field.key];
    if (!value?.selected) return field.label + "を選択してください。";
    if (value.selected === SIDE_HUSTLE_CUSTOM_VALUE && !value.custom.trim()) {
      return field.label + "で「その他・自由入力」を選んだ場合は内容を入力してください。";
    }
  }
  return null;
}

function interpolate(template: string, definition: SideHustleDefinition, draft: SideHustleDraft): string {
  return template.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_match, key: string) =>
    resolveSideHustleFieldValue(definition, key, draft.values[key]));
}

function buildSideHustleBrief(
  definition: SideHustleDefinition,
  resolved: Readonly<Record<string, string>>,
): string {
  return [
    "【SIDE HUSTLE BRIEF】",
    `副業機能: ${definition.title}`,
    `カテゴリ: ${definition.category}`,
    ...definition.fields.map((field) => `${field.label}: ${resolved[field.key] ?? "未指定"}`),
  ].join("\n");
}

export function buildSideHustlePrompt(
  definition: SideHustleDefinition,
  draft: SideHustleDraft,
): SideHustlePromptBuildResult {
  const resolved = Object.fromEntries(
    definition.fields.map((field) => [
      field.key,
      resolveSideHustleFieldValue(definition, field.key, draft.values[field.key]),
    ]),
  );

  const knowledge = compileKnowledgeContext({
    task: definition.knowledgeTask,
    genre: definition.category,
    subgenre: definition.title,
    audience: resolved.buyer_stage ?? resolved.reader_stage ?? resolved.target ?? resolved.buyer_level ?? "",
    purpose: resolved.objective ?? resolved.goal ?? resolved.decision ?? resolved.outcome ?? resolved.video_goal ?? "",
  });

  const scenarioKnowledge = compileSideHustleScenarioKnowledge(definition, resolved);
  const selected = Object.fromEntries(
    definition.fields.map((field) => [field.key, draft.values[field.key]?.selected ?? ""]),
  );
  const combinationKnowledge = compileSideHustleCombinationKnowledge(definition, selected);

  const provider = draft.selectedAi as AiProvider;
  const plan = draft.selectedPlan as AiPlan;
  const optimization = compilePromptOptimizationContext(provider, plan, definition.knowledgeTask);

  const sections = [
    interpolate(definition.promptTemplate, definition, draft),
    buildSideHustleBrief(definition, resolved),
    knowledge.promptBlock,
    scenarioKnowledge.promptBlock,
    combinationKnowledge.promptBlock,
    optimization,
    "【最終出力ルール】",
    "- ユーザーが入力していない実体験・実績・資格・レビュー・売上・使用経験を事実として作らない。",
    "- 価格、在庫、規約、手数料、ランキング、アルゴリズム、最新仕様など変動情報は、確認済みでない限り断定せず「最新の公式情報を確認」と明記する。",
    "- 架空例を使う場合は「例」「想定」と明示する。",
    "- 使える状態の成果物を優先し、一般論の水増しをしない。",
    "- SIDE HUSTLE BRIEFの全条件を最終出力前に内部確認し、選択された媒体・経験段階・目的・制作方法・販売/集客条件・リスク条件の取りこぼしをなくす。",
    "- 最終回答にはそのまま使える完成成果物だけを出し、内部検討・自己点検の途中経過は出さない。",
  ].filter(Boolean);

  return {
    prompt: sections.join("\n\n"),
    appliedKnowledge: [...knowledge.applied, ...scenarioKnowledge.applied, ...combinationKnowledge.applied],
    warnings: knowledge.warnings,
  };
}
