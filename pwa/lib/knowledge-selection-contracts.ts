import type { KnowledgeRule, KnowledgeTask } from "@/lib/knowledge-engine";

export type KnowledgeSelectionContractGroup = {
  id: string;
  label: string;
  description: string;
  keyPrefixes: string[];
};

export type KnowledgeSelectionContract = {
  task: KnowledgeTask;
  groups: KnowledgeSelectionContractGroup[];
};

export type KnowledgeSelectionContractGroupResult = KnowledgeSelectionContractGroup & {
  matchedKeys: string[];
  passed: boolean;
};

export type KnowledgeSelectionContractResult = {
  task: KnowledgeTask;
  passed: boolean;
  groups: KnowledgeSelectionContractGroupResult[];
  missingGroups: KnowledgeSelectionContractGroupResult[];
};

const taskCore = (task: KnowledgeTask, label: string): KnowledgeSelectionContractGroup => ({
  id: "core",
  label,
  description: "この副業専用の実務KnowledgeがTop 5に残っていること",
  keyPrefixes: [`auto:task:${task}:`],
});

export const SIDEJOB_SELECTION_CONTRACTS: Partial<Record<KnowledgeTask, KnowledgeSelectionContract>> = {
  sidejob_content: {
    task: "sidejob_content",
    groups: [
      taskCore("sidejob_content", "有料コンテンツ固有ルール"),
      {
        id: "commercial-safety",
        label: "販売・広告・権利チェック",
        description: "販売前の表示・提供範囲・権利確認のいずれかがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:commercial:",
          "auto:cross:ecommerce:",
          "auto:cross:promotion:",
          "auto:cross:copyright:",
        ],
      },
    ],
  },
  sidejob_sns: {
    task: "sidejob_sns",
    groups: [
      taskCore("sidejob_sns", "SNS運用固有ルール"),
      {
        id: "operation-quality",
        label: "運用改善または自動化安全性",
        description: "分析・重複回避・真正性を補う横断KnowledgeがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:analytics:",
          "auto:cross:sns-outreach:",
          "auto:cross:copyright:",
          "auto:cross:promotion:",
        ],
      },
    ],
  },
  sidejob_video: {
    task: "sidejob_video",
    groups: [
      taskCore("sidejob_video", "動画制作固有ルール"),
      {
        id: "video-feedback",
        label: "動画分析・権利確認",
        description: "分析フィードバックまたは素材権利確認がTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:analytics:",
          "auto:cross:copyright:",
        ],
      },
    ],
  },
  sidejob_affiliate: {
    task: "sidejob_affiliate",
    groups: [
      taskCore("sidejob_affiliate", "アフィリエイト固有ルール"),
      {
        id: "ad-disclosure",
        label: "広告・販売表示チェック",
        description: "広告表示・販売条件・根拠確認を補うKnowledgeがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:commercial:",
          "auto:cross:ecommerce:",
          "auto:cross:promotion:",
          "auto:cross:copyright:",
        ],
      },
    ],
  },
  sidejob_resale: {
    task: "sidejob_resale",
    groups: [
      taskCore("sidejob_resale", "物販固有ルール"),
      {
        id: "margin-record",
        label: "利益または記録管理",
        description: "利益計算または収支記録のKnowledgeがTop 5に含まれること",
        keyPrefixes: [
          "auto:task:sidejob_resale:price-fee-shipping-margin",
          "auto:cross:tax:",
        ],
      },
    ],
  },
  sidejob_crowdsourcing: {
    task: "sidejob_crowdsourcing",
    groups: [
      taskCore("sidejob_crowdsourcing", "クラウドソーシング固有ルール"),
      {
        id: "contract-safety",
        label: "契約・連絡・情報管理",
        description: "契約後の安全な連絡/決済または顧客情報管理がTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:marketplace:",
          "auto:cross:privacy:",
          "auto:cross:service-work:",
        ],
      },
    ],
  },
  sidejob_skill_sales: {
    task: "sidejob_skill_sales",
    groups: [
      taskCore("sidejob_skill_sales", "スキル販売固有ルール"),
      {
        id: "service-commerce",
        label: "取引・販売条件管理",
        description: "販売条件・連絡決済・個人情報管理のKnowledgeがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:ecommerce:",
          "auto:cross:marketplace:",
          "auto:cross:privacy:",
          "auto:cross:copyright:",
        ],
      },
    ],
  },
  sidejob_digital_product: {
    task: "sidejob_digital_product",
    groups: [
      taskCore("sidejob_digital_product", "デジタル商品固有ルール"),
      {
        id: "digital-commerce",
        label: "販売条件・広告・権利確認",
        description: "オンライン販売条件、広告表示または権利確認がTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:commercial:",
          "auto:cross:ecommerce:",
          "auto:cross:promotion:",
          "auto:cross:copyright:",
        ],
      },
    ],
  },
  sidejob_outreach: {
    task: "sidejob_outreach",
    groups: [
      taskCore("sidejob_outreach", "案件営業固有ルール"),
      {
        id: "outreach-safety",
        label: "提案後の取引安全性",
        description: "条件整理・安全な連絡決済・情報管理のKnowledgeがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:service-work:",
          "auto:cross:marketplace:",
          "auto:cross:privacy:",
          "auto:cross:sns-outreach:",
        ],
      },
    ],
  },
  sidejob_research: {
    task: "sidejob_research",
    groups: [
      taskCore("sidejob_research", "リサーチ固有ルール"),
      {
        id: "evidence-quality",
        label: "複数根拠・評価ループ",
        description: "一次情報の複数確認または評価ループがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:research:",
          "auto:cross:research-planning:",
          "auto:cross:research-efficiency:",
          "auto:cross:ai-workflow:",
        ],
      },
    ],
  },
  sidejob_efficiency: {
    task: "sidejob_efficiency",
    groups: [
      taskCore("sidejob_efficiency", "業務効率化固有ルール"),
      {
        id: "automation-review",
        label: "評価・人確認・情報管理",
        description: "AI評価、人による確認または情報管理のKnowledgeがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:ai-workflow:",
          "auto:cross:research-efficiency:",
          "auto:cross:privacy:",
        ],
      },
    ],
  },
  sidejob_planning: {
    task: "sidejob_planning",
    groups: [
      taskCore("sidejob_planning", "副業選定固有ルール"),
      {
        id: "planning-evidence",
        label: "候補比較の根拠確認",
        description: "比較根拠または一次情報確認のKnowledgeがTop 5に含まれること",
        keyPrefixes: [
          "auto:cross:research-planning:",
          "auto:cross:research:",
          "auto:cross:tax:",
        ],
      },
    ],
  },
};

function keyMatchesPrefix(key: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => key.startsWith(prefix));
}

export function evaluateKnowledgeSelectionContract(
  task: KnowledgeTask,
  selectedRules: KnowledgeRule[],
): KnowledgeSelectionContractResult | null {
  const contract = SIDEJOB_SELECTION_CONTRACTS[task];
  if (!contract) return null;

  const groups = contract.groups.map((group): KnowledgeSelectionContractGroupResult => {
    const matchedKeys = selectedRules
      .filter((rule) => keyMatchesPrefix(rule.key, group.keyPrefixes))
      .map((rule) => rule.key);
    return {
      ...group,
      matchedKeys,
      passed: matchedKeys.length > 0,
    };
  });

  return {
    task,
    passed: groups.every((group) => group.passed),
    groups,
    missingGroups: groups.filter((group) => !group.passed),
  };
}
