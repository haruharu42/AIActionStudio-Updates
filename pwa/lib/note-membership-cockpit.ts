import { compileKnowledgeContext } from "@/lib/knowledge-engine";
import {
  NOTE_MEMBERSHIP_KNOWLEDGE,
} from "@/lib/note-membership-advisor";
import {
  noteProfileSelectionLabels,
  type NoteOperationProfile,
} from "@/lib/note-operation-profile";
import {
  formatMembershipMetricsForPrompt,
  type NoteMembershipMetricsEntry,
} from "@/lib/note-membership-metrics";

export type NoteMembershipCockpitTab =
  | "consult"
  | "pricing"
  | "launch"
  | "page"
  | "promotion"
  | "calendar"
  | "improve";

export type MembershipPricingInput = {
  planCount: number;
  currentPrice: string;
  mainValue: "content" | "community" | "qa" | "individual" | "support" | "mixed";
  individualSupport: "none" | "light" | "medium" | "heavy";
  weeklyHours: "under1" | "1_3" | "3_5" | "5_plus";
  goal: "easy_join" | "balance" | "premium" | "ai";
};

export type MembershipPageInput = {
  angle: "beginner" | "benefit" | "community" | "creator" | "professional";
  length: "short" | "standard" | "detailed";
  faq: "yes" | "no";
};

export type MembershipPromotionInput = {
  channel: "note" | "x" | "threads" | "instagram";
  stage: "before_open" | "just_opened" | "ongoing";
  focus: "concept" | "benefits" | "founder" | "limited" | "faq";
  image: "yes" | "no" | "ai";
};

export type MembershipCalendarInput = {
  cadence: "weekly1" | "weekly2" | "monthly2" | "monthly1";
  contentMix: "article" | "article_board" | "article_qa" | "mixed";
  monthGoal: "habit" | "value" | "conversation" | "retention";
};

export type MembershipImproveInput = {
  problem: "join" | "retention" | "upper_plan" | "workload" | "engagement" | "description";
  evidence: "none" | "some" | "enough";
  changeRange: "small" | "medium" | "large";
};

export const NOTE_MEMBERSHIP_LAUNCH_CHECKLIST = [
  { key: "concept", label: "コンセプト・対象読者を確定" },
  { key: "plans", label: "プラン数・料金・特典を確定" },
  { key: "workload", label: "更新頻度・個別対応の上限を確定" },
  { key: "description", label: "メンバーシップ紹介ページを作成" },
  { key: "welcome", label: "歓迎記事・最初に読む記事を準備" },
  { key: "board", label: "掲示板・質問受付など交流導線を準備" },
  { key: "announcement", label: "開始告知note・SNS投稿を準備" },
  { key: "official", label: "料金・請求・無料期間などnote公式の最新仕様を確認" },
  { key: "review", label: "公開前に約束内容と運営負荷を最終確認" },
  { key: "publish", label: "note側で審査・公開操作を実施" },
] as const;

export type MembershipLaunchChecklistKey = typeof NOTE_MEMBERSHIP_LAUNCH_CHECKLIST[number]["key"];

export function membershipLaunchStorageKey(userId: string): string {
  return "aas.note.membership.launch.v1:" + userId;
}

function profileBlock(profile: NoteOperationProfile): string {
  const labels = noteProfileSelectionLabels(profile);
  return [
    "表示名: " + (profile.noteDisplayName || "未設定"),
    "ジャンル: " + labels.genre,
    "運営スタイル: " + labels.style,
    "想定読者: " + (profile.targetReader || labels.audience),
    "文章の雰囲気: " + labels.tone,
    "収益化方針: " + labels.monetization,
    "主なテーマ: " + (profile.mainTopics.length ? profile.mainTopics.join(" / ") : "未設定"),
    "事実として使える経験・背景: " + (profile.experienceNote || "未入力"),
  ].join("\n");
}

function knowledgeBlock(profile: NoteOperationProfile, purpose: string): string {
  const labels = noteProfileSelectionLabels(profile);
  return compileKnowledgeContext({
    task: "promotion",
    publicationTarget: "note",
    audience: profile.targetReader || labels.audience,
    purpose,
  }).promptBlock;
}

function sharedRules(): string[] {
  return [
    "売上・加入率・継続率・インプレッション等の成果を保証しない。",
    "入力されていない会員数、売上、レビュー、購入者の声、資格、実績を作らない。",
    "noteの料金・手数料・請求・無料期間・プラン上限など変動しうる仕様は公開前にnote公式で再確認する。",
    "他クリエイターのプランをコピーせず、今回の読者・価値・運営時間から設計する。",
    "継続できない頻度や個別対応を、加入を増やすためだけに約束しない。",
  ];
}

export function buildMembershipPricingPrompt(
  profile: NoteOperationProfile,
  input: MembershipPricingInput,
): string {
  const valueLabels = {
    content: "限定記事・限定コンテンツ",
    community: "コミュニティ・交流",
    qa: "質問・Q&A",
    individual: "個別相談・個別サポート",
    support: "応援・活動支援",
    mixed: "複数を組み合わせる",
  } as const;
  const supportLabels = {
    none: "個別対応なし",
    light: "軽い質問対応のみ",
    medium: "月数件の個別対応",
    heavy: "継続的な個別相談を含む",
  } as const;
  const hourLabels = {
    under1: "週1時間以内",
    "1_3": "週1〜3時間",
    "3_5": "週3〜5時間",
    "5_plus": "週5時間以上",
  } as const;
  const goalLabels = {
    easy_join: "参加ハードルを低くしたい",
    balance: "価格と価値のバランス重視",
    premium: "少人数・高付加価値も検討",
    ai: "条件からAIに判断してほしい",
  } as const;

  return [
    "あなたはnoteメンバーシップの料金・特典バランス診断担当です。",
    "高い/安いの感覚論ではなく、提供価値・個別対応・運営時間・読者の参加ハードルから診断してください。",
    "",
    "【安全ルール】",
    ...sharedRules().map((x) => "- " + x),
    "",
    "【noteプロフィール】",
    profileBlock(profile),
    "",
    "【診断条件】",
    "プラン数: " + Math.max(1, Math.min(5, input.planCount)) + "プラン",
    "現在または想定価格: " + input.currentPrice,
    "中心価値: " + valueLabels[input.mainValue],
    "個別対応: " + supportLabels[input.individualSupport],
    "運営可能時間: " + hourLabels[input.weeklyHours],
    "価格方針: " + goalLabels[input.goal],
    "",
    "【専用Knowledge】",
    ...NOTE_MEMBERSHIP_KNOWLEDGE.guidance.map((x) => "- " + x),
    "",
    knowledgeBlock(profile, "noteメンバーシップの料金・特典診断"),
    "",
    "【出力】",
    "1. 現在案の負荷を「低い / 標準 / 高い」の3段階で説明する。",
    "2. 価格と特典の不一致があれば、どこが不一致か具体的に示す。",
    "3. " + Math.max(1, Math.min(5, input.planCount)) + "プラン分の価格候補を各2案示し、理由を書く。",
    "4. 上位プランほど単純に特典数を増やさず、価値の違いを明確にする。",
    "5. 個別相談やZoom等がある場合、人数・時間・回数の上限案を付ける。",
    "6. 運営負荷を下げながら価値を維持する代替案を出す。",
    "7. 最後にnote公式で再確認すべき変動仕様を列挙する。",
  ].join("\n");
}

export function buildMembershipPagePrompt(
  profile: NoteOperationProfile,
  input: MembershipPageInput,
): string {
  const angleLabels = {
    beginner: "初心者にも分かりやすい安心感重視",
    benefit: "参加すると得られる価値を明確にする",
    community: "一緒に参加する感覚・交流を重視",
    creator: "制作過程・裏側・継続支援を重視",
    professional: "専門性・実務価値を重視",
  } as const;
  const lengthLabels = {
    short: "短め",
    standard: "標準",
    detailed: "詳しく",
  } as const;

  return [
    "あなたはnoteメンバーシップ紹介ページの編集者です。",
    "2026年のnote紹介ページで見出し・太字・箇条書き等を使える前提で、読みやすい下書きを作ってください。",
    "",
    "【安全ルール】",
    ...sharedRules().map((x) => "- " + x),
    "",
    "【noteプロフィール】",
    profileBlock(profile),
    "",
    "【ページ方針】",
    "訴求軸: " + angleLabels[input.angle],
    "長さ: " + lengthLabels[input.length],
    "FAQ: " + (input.faq === "yes" ? "入れる" : "入れない"),
    "",
    knowledgeBlock(profile, "noteメンバーシップ紹介ページ作成"),
    "",
    "【出力】",
    "1. メンバーシップ名候補を5案。",
    "2. ファーストビューで伝える短い一文を3案。",
    "3. そのままnoteへ貼りやすい紹介ページ本文。",
    "4. 本文は「こんな人へ / 参加するとできること / 特典 / 更新頻度 / 参加前に知ってほしいこと / CTA」を基本構成にする。",
    "5. プランが複数ある場合に使える比較表のひな型。",
    input.faq === "yes" ? "6. 加入前FAQを5〜8問。" : "6. FAQは省略する。",
    "7. 画像を入れるなら、どの見出しの直後にどんなスクショ・画像が必要かを指示する。",
    "8. 最後に誇張・約束過多・仕様断定がないか自己点検した完成版を出す。",
  ].join("\n");
}

export function buildMembershipPromotionPrompt(
  profile: NoteOperationProfile,
  input: MembershipPromotionInput,
): string {
  const channelLabels = {
    note: "note告知記事",
    x: "X",
    threads: "Threads",
    instagram: "Instagram",
  } as const;
  const stageLabels = {
    before_open: "公開前の予告",
    just_opened: "公開開始直後",
    ongoing: "継続募集",
  } as const;
  const focusLabels = {
    concept: "コンセプト・誰向けか",
    benefits: "特典・参加価値",
    founder: "なぜこのメンバーシップを始めるか",
    limited: "人数制限・個別対応など本当に存在する条件",
    faq: "よくある疑問の解消",
  } as const;

  return [
    "あなたはnoteメンバーシップの告知・集客コンテンツ編集者です。",
    "",
    "【安全ルール】",
    ...sharedRules().map((x) => "- " + x),
    "- 限定・残りわずか等は実際に条件がある場合だけ使う。",
    "- 未確認の参加者数や人気を社会的証明として作らない。",
    "",
    "【noteプロフィール】",
    profileBlock(profile),
    "",
    "【告知条件】",
    "媒体: " + channelLabels[input.channel],
    "段階: " + stageLabels[input.stage],
    "中心訴求: " + focusLabels[input.focus],
    "画像: " + (input.image === "yes" ? "使用する" : input.image === "no" ? "不要" : "必要性をAIが判断"),
    "",
    knowledgeBlock(profile, "noteメンバーシップ告知・集客"),
    "",
    "【出力】",
    "1. 媒体に合う完成原稿を3案。",
    "2. 各案は切り口を変え、同じ文言の言い換えだけにしない。",
    "3. 公開前なら入会可能と誤認させない。",
    "4. 画像が有効な場合は『何を撮るか / どの範囲 / 何を伝える画像か / 添付順』を具体的に指示する。",
    "5. note告知記事の場合は、本文の最適位置へスクショ挿入位置を明記する。",
    "6. CTAは1つを主軸にし、押し売りにならないようにする。",
  ].join("\n");
}

export function buildMembershipCalendarPrompt(
  profile: NoteOperationProfile,
  input: MembershipCalendarInput,
): string {
  const cadenceLabels = {
    weekly1: "週1回",
    weekly2: "週2回",
    monthly2: "月2回",
    monthly1: "月1回",
  } as const;
  const mixLabels = {
    article: "限定記事中心",
    article_board: "限定記事＋掲示板",
    article_qa: "限定記事＋Q&A",
    mixed: "記事・掲示板・Q&A・ニュースレター等を混ぜる",
  } as const;
  const goalLabels = {
    habit: "無理なく継続",
    value: "会員価値を明確にする",
    conversation: "交流・会話を増やす",
    retention: "継続しやすい体験を作る",
  } as const;

  return [
    "あなたはnoteメンバーシップの月間運営プランナーです。",
    "",
    "【安全ルール】",
    ...sharedRules().map((x) => "- " + x),
    "",
    "【noteプロフィール】",
    profileBlock(profile),
    "",
    "【月間条件】",
    "基本頻度: " + cadenceLabels[input.cadence],
    "コンテンツ構成: " + mixLabels[input.contentMix],
    "今月の優先目的: " + goalLabels[input.monthGoal],
    "",
    knowledgeBlock(profile, "noteメンバーシップ月間運営"),
    "",
    "【出力】",
    "1. 4週間の運営例を週単位で表にする。",
    "2. 各予定に『限定記事 / 掲示板 / Q&A / ニュースレター / 告知 / 振り返り』の種類を付ける。",
    "3. 各限定記事には記事テーマ候補と読者が得る価値を付ける。",
    "4. 加入者向けだけで閉じず、必要に応じて無料noteやSNSで新規読者の入口も作る。",
    "5. 更新が多すぎる場合は減らし、運営可能性を優先する。",
    "6. 月末に確認する指標は、ユーザーが実際に確認できる数値だけを候補として示す。",
  ].join("\n");
}

export function buildMembershipImprovePrompt(
  profile: NoteOperationProfile,
  input: MembershipImproveInput,
  metrics: readonly NoteMembershipMetricsEntry[] = [],
): string {
  const problemLabels = {
    join: "加入につながりにくい",
    retention: "継続されにくい",
    upper_plan: "上位プランが選ばれにくい",
    workload: "運営負荷が高い",
    engagement: "交流・反応が少ない",
    description: "紹介ページやプラン説明が弱い",
  } as const;
  const evidenceLabels = {
    none: "実績データはまだほぼない",
    some: "少しだけ確認できる",
    enough: "比較できる程度の実績データがある",
  } as const;
  const rangeLabels = {
    small: "文章・順番・頻度など小さく改善",
    medium: "料金・特典・導線も見直してよい",
    large: "プラン構造から大きく見直してよい",
  } as const;
  const metricsLines = formatMembershipMetricsForPrompt(metrics, 6);

  return [
    "あなたはnoteメンバーシップの改善相談担当です。",
    "",
    "【安全ルール】",
    ...sharedRules().map((x) => "- " + x),
    "- データがない場合は原因を断定せず、仮説と確認方法を分ける。",
    "- 変更前後を比較できるよう、一度に多数の要素を変更しすぎない。",
    "",
    "【noteプロフィール】",
    profileBlock(profile),
    "",
    "【改善相談】",
    "困っていること: " + problemLabels[input.problem],
    "実績データの量: " + evidenceLabels[input.evidence],
    "変更してよい範囲: " + rangeLabels[input.changeRange],
    "",
    "【ユーザー入力実績】",
    ...(metricsLines.length ? metricsLines : ["- 実績入力なし"]),
    metricsLines.length
      ? "- 上記はユーザーが入力した実績だけです。空欄・未入力の数値は推測、補完、逆算しないでください。"
      : "- 実績データがないため、数値に基づく原因断定はしないでください。",
    "- メモに書かれた内容もユーザー入力として扱い、未記載の事実を追加しないでください。",
    "",
    knowledgeBlock(profile, "noteメンバーシップ改善相談"),
    "",
    "【出力】",
    "1. まず考えられる原因仮説を3〜5個。断定ではなく仮説と明示する。",
    "2. 追加で見るべき実データを優先順で示す。",
    "3. 最小変更案 / 標準変更案 / 大きな変更案を出す。",
    "4. 料金・特典・更新頻度・紹介文・加入導線・歓迎導線のどこを触るか明確にする。",
    "5. 変更後に何を比較すればよいか、観察期間と確認項目を示す。",
    "6. 運営負荷が高い場合は、特典削減や個別対応上限など具体的な軽量化案を出す。",
  ].join("\n");
}

export function membershipArticleHref(theme: string, mode: "member" | "announcement" | "qa"): string {
  const prefix = mode === "member"
    ? "メンバー限定記事"
    : mode === "announcement"
      ? "メンバーシップ告知用の無料記事"
      : "メンバー向けQ&A回答記事";
  const params = new URLSearchParams({
    publicationTarget: "note",
    articleType: "free",
    theme: prefix + "：" + (theme.trim() || "テーマをAIに提案してもらう"),
    from: "note-membership",
    membershipArticleKind: mode,
  });
  return "/create?" + params.toString();
}
