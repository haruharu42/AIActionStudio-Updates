import { compileKnowledgeContext } from "@/lib/knowledge-engine";
import { buildUserPromptContext, getRuntimeWritingProfile } from "@/lib/user-personalization";
import {
  buildSocialWritingStylePrompt,
  type AdminSocialWritingStyle,
} from "@/lib/social-writing-style";

export type AdminSocialPlatform = "x" | "instagram" | "threads" | "tiktok" | "youtube";

export type AdminScreenshotTarget =
  | "home"
  | "create"
  | "sidejob"
  | "prompts"
  | "sns"
  | "images"
  | "notifications"
  | "promotion"
  | "sales"
  | "knowledge"
  | "features";

export type AdminScreenshotPublication = "note" | "tips" | "brain" | "x" | "manual" | "update";
export type AdminScreenshotDevice = "pc" | "mobile" | "both";
export type AdminScreenshotCount = "auto" | "1" | "2" | "3";

export const ADMIN_SCREENSHOT_TARGETS: Record<AdminScreenshotTarget, { label: string; route: string; note: string }> = {
  home: { label: "ホーム", route: "/", note: "AAS全体像・主要機能の入口" },
  create: { label: "記事作成", route: "/create", note: "記事作成ウィザード・外部AI連携" },
  sidejob: { label: "副業機能", route: "/sidejob", note: "副業カテゴリ・専用ウィザード" },
  prompts: { label: "プロンプト", route: "/prompts", note: "用途別プロンプトライブラリ" },
  sns: { label: "SNS作成", route: "/sns", note: "SNS投稿作成・販促素材" },
  images: { label: "画像作成支援", route: "/images", note: "アイキャッチ・挿絵の作成支援" },
  notifications: { label: "通知センター", route: "/notifications", note: "アップデート・メンテナンス・Knowledge通知" },
  promotion: { label: "販売・プロモーション", route: "/admin/promotion", note: "管理者向け販促作成。公開記事では機密情報に注意" },
  sales: { label: "販売設定", route: "/admin/sales", note: "管理者向け販売受付設定。公開記事では機密情報に注意" },
  knowledge: { label: "Knowledge管理", route: "/admin/knowledge", note: "管理者向けKnowledge運用。内部情報の露出に注意" },
  features: { label: "全機能管理", route: "/admin/features", note: "管理者向け公開段階・メンテナンス管理" },
};

export type AdminProductFacts = {
  productName: string;
  editions: string;
  releaseStage: string;
  targetAudience: string;
  features: string;
  priceText: string;
  salesUrl: string;
  support: string;
  limitations: string;
  testingStatus: string;
  testingNotes: string;
  releasePlan: string;
  referenceUrl: string;
};

export type AdminArticlePromotionInput = {
  platform: "note" | "brain" | "tips" | "blog";
  phase: string;
  purpose: string;
  audience: string;
  focus: string;
  cta: string;
};

export type AdminSocialPromotionInput = {
  platform: AdminSocialPlatform;
  phase: string;
  purpose: string;
  audience: string;
  focus: string;
  cta: string;
  variants: number;
  lengthPresetId: string;
  targetChars: number;
  socialStyle?: AdminSocialWritingStyle;
};

export type AdminSocialLengthPlan = Record<AdminSocialPlatform, number>;

export type AdminCampaignInput = {
  campaignName: string;
  phase: string;
  goal: string;
  audience: string;
  channels: string;
  offer: string;
  cta: string;
  socialLengths: AdminSocialLengthPlan;
  socialStyle?: AdminSocialWritingStyle;
};

export type AdminPreviewPromotionInput = {
  updateType: string;
  testedPlatform: string;
  verifiedUpdate: string;
  releasePlan: string;
  audience: string;
  channels: string;
  cta: string;
  socialLengths: AdminSocialLengthPlan;
  socialStyle?: AdminSocialWritingStyle;
};

export type SocialLengthPreset = {
  id: string;
  label: string;
  targetChars: number;
  note: string;
  premium?: boolean;
};

export const ADMIN_PRODUCT_FACTS_STORAGE_KEY = "aas:admin:promotion-product:v1";

export function buildAdminScreenshotCapturePrompt(input: {
  target: AdminScreenshotTarget;
  publication: AdminScreenshotPublication;
  device: AdminScreenshotDevice;
  count: AdminScreenshotCount;
}): string {
  const target = ADMIN_SCREENSHOT_TARGETS[input.target];
  const publicationLabel: Record<AdminScreenshotPublication, string> = {
    note: "note記事",
    tips: "Tips記事",
    brain: "Brain記事",
    x: "X投稿・告知",
    manual: "操作マニュアル",
    update: "アップデート告知",
  };
  const deviceLabel: Record<AdminScreenshotDevice, string> = {
    pc: "PC表示（横長）",
    mobile: "スマホ表示（縦長）",
    both: "PC表示とスマホ表示の両方",
  };
  const countLabel = input.count === "auto" ? "必要最小限をAIが判断" : `${input.count}枚`;

  return `AI Action Studio（AAS）の${publicationLabel[input.publication]}用に、ユーザー本人が撮影するスクリーンショットの指示だけを作成してください。

【対象】
- 紹介機能: ${target.label}
- 画面候補: ${target.route}
- 画面の役割: ${target.note}
- 使用先: ${publicationLabel[input.publication]}
- 推奨端末: ${deviceLabel[input.device]}
- 画像数: ${countLabel}

【重要】
- スクリーンショット画像を取得・生成しない。
- ブラウザ操作、ログイン、GitHub確認、Preview画面の取得は行わない。
- ユーザーが自分で撮影できるように、必要な画面と位置だけを具体的に示す。
- 同じ内容の似た画像は増やさず、本当に理解が深まる箇所だけに絞る。
- AAS ID、メールアドレス、請求情報、アクセストークン、内部エラー、個人通知など公開不要の情報は写さない。

【各画像で必ず示すこと】
1. 記事内の挿入位置（見出し名と、その直後などの位置）
2. 撮影するAAS画面・機能名
3. 画面のどの範囲を見せるか
4. PC / スマホのどちらで撮るか
5. その画像で読者に理解してほしいこと
6. 20〜40文字程度の短いキャプション案
7. 公開前に隠すべき情報がないか

記事本文が同じ会話内にある場合は、その本文の見出しを使って正確な挿入位置を指定してください。本文がない場合は、想定見出し名を付けてください。`;
}

export const DEFAULT_ADMIN_PRODUCT_FACTS: AdminProductFacts = {
  productName: "AI Action Studio",
  editions: "PWA版のみ",
  releaseStage: "内部テスト",
  targetAudience: "副業初心者",
  features: [
    "12種類の副業専用ウィザード",
    "用途別プロンプトライブラリ",
    "記事作成・記事ライブラリ",
    "SNS投稿・SNSアカウント設計",
    "画像作成支援",
    "AI副業プランナー",
    "Knowledge自動更新",
    "通知センター",
    "公開管理・コンテンツ分析",
  ].join("\n"),
  priceText: "",
  salesUrl: "",
  support: "",
  limitations: "",
  testingStatus: "",
  testingNotes: "",
  releasePlan: "",
  referenceUrl: "",
};


export const SOCIAL_LENGTH_PRESETS: Record<AdminSocialPlatform, readonly SocialLengthPreset[]> = {
  x: [
    { id: "x-short-ja", label: "短文・日本語向け 140文字", targetChars: 140, note: "短く読み切れる日本語投稿向け。" },
    { id: "x-standard", label: "標準枠 280文字", targetChars: 280, note: "Xの標準投稿枠を基準にした設定。実際の文字カウントはX側の仕様に従う。" },
    { id: "x-premium-1000", label: "X Premium 長文 1,000文字", targetChars: 1000, note: "Premiumの長いポスト向け。", premium: true },
    { id: "x-premium-3000", label: "X Premium 長文 3,000文字", targetChars: 3000, note: "Premiumの長いポスト向け。", premium: true },
    { id: "x-premium-10000", label: "X Premium 長文 10,000文字", targetChars: 10000, note: "Premiumの長いポスト向け。", premium: true },
    { id: "x-premium-25000", label: "X Premium 最大 25,000文字", targetChars: 25000, note: "X Premiumの長いポスト上限を使う設定。予約投稿などの機能差は公開前に確認する。", premium: true },
  ],
  instagram: [
    { id: "instagram-short", label: "短文 150文字", targetChars: 150, note: "画像・リールの補足を短くまとめる。" },
    { id: "instagram-standard", label: "標準 300文字", targetChars: 300, note: "読みやすさ重視の標準キャプション。" },
    { id: "instagram-detail", label: "しっかり説明 600文字", targetChars: 600, note: "機能説明やテスト報告向け。" },
    { id: "instagram-long", label: "長文 1,000文字", targetChars: 1000, note: "ストーリー性のある説明向け。" },
    { id: "instagram-deep", label: "長文 2,000文字", targetChars: 2000, note: "AAS内の長文目安。投稿前にInstagram側の最新仕様を確認する。" },
  ],
  threads: [
    { id: "threads-short", label: "短文 200文字", targetChars: 200, note: "会話を始めやすい短文向け。" },
    { id: "threads-standard", label: "通常投稿 最大500文字", targetChars: 500, note: "Threads通常投稿の上限を使う設定。" },
    { id: "threads-attach-1000", label: "添付テキスト 1,000文字", targetChars: 1000, note: "長文テキスト添付向け。" },
    { id: "threads-attach-3000", label: "添付テキスト 3,000文字", targetChars: 3000, note: "長文テキスト添付向け。" },
    { id: "threads-attach-10000", label: "添付テキスト 最大10,000文字", targetChars: 10000, note: "Threadsの長文テキスト添付上限を使う設定。" },
  ],
  tiktok: [
    { id: "tiktok-short", label: "短文 80文字", targetChars: 80, note: "動画フックを邪魔しない短文向け。" },
    { id: "tiktok-standard", label: "標準 150文字", targetChars: 150, note: "動画内容とCTAを簡潔に補足する。" },
    { id: "tiktok-detail", label: "説明 300文字", targetChars: 300, note: "テスト内容や機能説明を少し詳しく書く。" },
    { id: "tiktok-long", label: "長め 600文字", targetChars: 600, note: "AAS内の長文目安。TikTok側の最新仕様を公開前に確認する。" },
    { id: "tiktok-deep", label: "長文 1,000文字", targetChars: 1000, note: "AAS内の長文目安。TikTok側の最新仕様を公開前に確認する。" },
  ],
  youtube: [
    { id: "youtube-short", label: "Shorts概要欄 150文字", targetChars: 150, note: "タイトルは別途100文字以内。概要欄を短くまとめる。" },
    { id: "youtube-standard", label: "Shorts概要欄 300文字", targetChars: 300, note: "タイトルは別途100文字以内。標準的な説明文。" },
    { id: "youtube-detail", label: "Shorts概要欄 1,000文字", targetChars: 1000, note: "タイトルは別途100文字以内。詳細説明向け。" },
    { id: "youtube-long", label: "概要欄 2,500文字", targetChars: 2500, note: "タイトルは別途100文字以内。長めの説明向け。" },
    { id: "youtube-max", label: "概要欄 最大5,000文字", targetChars: 5000, note: "YouTube説明欄の上限を使う設定。タイトルは100文字以内。" },
  ],
};

export const DEFAULT_SOCIAL_LENGTH_PLAN: AdminSocialLengthPlan = {
  x: 280,
  instagram: 300,
  threads: 500,
  tiktok: 150,
  youtube: 300,
};

export function socialLengthPresetsFor(platform: AdminSocialPlatform): readonly SocialLengthPreset[] {
  return SOCIAL_LENGTH_PRESETS[platform];
}

export function defaultSocialLengthPreset(platform: AdminSocialPlatform): SocialLengthPreset {
  const preset = SOCIAL_LENGTH_PRESETS[platform][1] ?? SOCIAL_LENGTH_PRESETS[platform][0];
  if (!preset) throw new Error("SNS文字数プリセットが未設定です。");
  return preset;
}

export function sanitizeSocialTargetChars(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(25000, Math.round(value)));
}

function socialPlatformLabel(platform: AdminSocialPlatform): string {
  return {
    x: "X",
    instagram: "Instagram",
    threads: "Threads",
    tiktok: "TikTok",
    youtube: "YouTube Shorts",
  }[platform];
}

function socialLengthPlanBlock(plan: AdminSocialLengthPlan): string {
  return (Object.keys(plan) as AdminSocialPlatform[])
    .map((platform) => {
      const value = sanitizeSocialTargetChars(plan[platform]);
      if (platform === "youtube") return `- YouTube Shorts: 概要欄 約${value}文字 / タイトル100文字以内`;
      return `- ${socialPlatformLabel(platform)}: 約${value}文字`;
    })
    .join("\n");
}
export function factsBlock(facts: AdminProductFacts): string {
  return [
    `製品名: ${facts.productName || "未設定"}`,
    `提供形態: ${facts.editions || "未設定"}`,
    `提供状況: ${facts.releaseStage || "未設定"}`,
    `想定ユーザー: ${facts.targetAudience || "未設定"}`,
    `確認済み機能:\n${facts.features || "未設定"}`,
    `価格・販売条件: ${facts.priceText || "未設定"}`,
    `販売URL: ${facts.salesUrl || "未設定"}`,
    `サポート: ${facts.support || "未設定"}`,
    `制限・注意事項: ${facts.limitations || "未設定"}`,
    `実運用・テスト状況: ${facts.testingStatus || "未設定"}`,
    `確認済みテスト内容・観察結果:\n${facts.testingNotes || "未設定"}`,
    `公開・販売予定: ${facts.releasePlan || "未設定"}`,
    `テスト記事・案内URL: ${facts.referenceUrl || "未設定"}`,
  ].join("\n");
}

export const FACT_SAFETY = `【絶対ルール】
- 下記の「確認済み製品情報」に書かれていない機能、価格、実績、利用者数、売上、レビュー、キャンペーンを事実として作らない。
- テスト結果・使った感想・改善効果・数値は、確認済みテスト内容に書かれた事実だけを使う。運営者の体験を推測で作らない。
- 公開日・販売開始日・価格が未確定なら、具体的な日付・価格・購入可能という表現を作らない。
- 販売前・テスト中の段階では「販売中」「購入できます」「正式リリース済み」などと誤認させない。
- 未入力・未確認の情報は推測で補完せず、必要なら「要確認」と明示する。
- 「必ず稼げる」「絶対に売れる」などの成果保証や過度な煽りを使わない。
- 架空の購入者レビュー、体験談、ランキング、権威づけを作らない。
- 競合サービスを根拠なく否定しない。`;

export function buildAdminArticlePromotionPrompt(
  facts: AdminProductFacts,
  input: AdminArticlePromotionInput,
): string {
  const knowledge = compileKnowledgeContext({
    task: "promotion",
    publicationTarget: input.platform,
    audience: input.audience || facts.targetAudience,
    purpose: input.purpose,
  }).promptBlock;
  const promptOptimization = buildUserPromptContext(getRuntimeWritingProfile(), "promotion");
  return `あなたは日本語のプロダクトマーケティング編集者です。
AI Action Studioの紹介・販売を含め、現在の発信フェーズに合った完成記事を作成してください。販売前なら販売記事にせず、テスト状況・開発進捗・公開予告として自然に伝えてください。

${FACT_SAFETY}

【掲載条件】
掲載先: ${input.platform}
発信フェーズ: ${input.phase || facts.releaseStage || "要確認"}
目的: ${input.purpose}
想定読者: ${input.audience || facts.targetAudience || "要確認"}
特に紹介したい内容: ${input.focus || "製品全体"}
CTA: ${input.cta || facts.salesUrl || "要確認"}

${knowledge}${promptOptimization ? `\n\n${promptOptimization}` : ""}

【確認済み製品情報】
${factsBlock(facts)}

【出力】
1. 一目で内容が伝わるタイトル候補を7案
2. 採用推奨タイトルを1案
3. そのまま掲載しやすいMarkdown完成記事
4. 冒頭で「読者の悩み・この記事で分かること・先に結論」を短く整理し、前置きを長くしない
5. 販売前・テスト中なら「何を試しているか → 現時点で確認できたこと → 改善中/準備中のこと → 公開予定 → 続報CTA」を基本にする
6. 販売開始後なら「読者の悩み → 製品でできること → 主な機能 → 利用イメージ → 向いている人 → 注意事項 → CTA」を基本にする
7. 抽象的な宣伝文句の繰り返しを避け、具体的な利用場面・手順・判断基準・箇条書きを使って読みやすくする
8. ${input.platform}の読者に合わせて見出し・文章量・CTAの強さを調整する
9. スクリーンショットがあると理解しやすい箇所だけ、本文中に「[スクショ①をここに挿入]」のような目印を入れる。画像を取得・生成しない
10. 記事の後に「スクリーンショット撮影指示」を付け、各画像について「挿入位置 / 撮影するAAS画面・機能 / 見せる範囲 / PCかスマホ / 画像の目的 / 短いキャプション案 / 隠すべき情報」を明記する。不要なら0枚でもよい
11. ユーザー本人がスクリーンショットを撮影する前提とし、ブラウザ操作・GitHub確認・Preview画像取得を依頼しない
12. 最後に完成原稿を自己点検し、事実関係・読みやすさ・重複・CTA・未確認情報を見直したうえで完成版だけを出す
13. 記事末尾に、確認が必要な情報があれば「公開前チェック」として列挙する`;
}

export function buildAdminSocialPromotionPrompt(
  facts: AdminProductFacts,
  input: AdminSocialPromotionInput,
): string {
  const targetChars = sanitizeSocialTargetChars(input.targetChars);
  const preset = SOCIAL_LENGTH_PRESETS[input.platform].find((item) => item.id === input.lengthPresetId);
  const platformRule: Record<AdminSocialPromotionInput["platform"], string> = {
    x: "X向け。標準投稿かPremium長文かを指定文字数に従って使い分ける。長文でも冒頭で要点が分かる構成にする。",
    instagram: "Instagram向け。通常投稿キャプション、6枚前後のカルーセル構成、短いリール台本を作る。",
    threads: "Threads向け。会話調で読みやすく、押し売り感を抑える。500文字を超える指定では長文テキスト添付を前提にする。",
    tiktok: "TikTok向け。冒頭3秒のフック、30〜45秒の縦動画台本、画面テロップ案を作る。",
    youtube: "YouTube Shorts向け。30〜60秒の台本、100文字以内のタイトル案、指定文字数を目安にした概要欄を作る。",
  };
  const knowledge = compileKnowledgeContext({
    task: "promotion",
    audience: `${input.audience || facts.targetAudience || "要確認"} / SNS: ${input.platform}`,
    purpose: input.purpose,
  }).promptBlock;
  const promptOptimization = buildUserPromptContext(getRuntimeWritingProfile(), "promotion");
  const socialStyle = buildSocialWritingStylePrompt(input.socialStyle);

  return `あなたはSNSプロモーション担当者です。
AI Action Studioについて、現在の発信フェーズに合ったSNS投稿素材を作成してください。販売前なら、実運用テスト・開発状況・公開予定の共有として作り、購入可能と誤認させないでください。

${FACT_SAFETY}

【SNS条件】
媒体: ${socialPlatformLabel(input.platform)}
発信フェーズ: ${input.phase || facts.releaseStage || "要確認"}
目的: ${input.purpose}
想定読者: ${input.audience || facts.targetAudience || "要確認"}
紹介テーマ: ${input.focus || "製品全体"}
CTA: ${input.cta || facts.salesUrl || "要確認"}
作成数: ${Math.max(1, Math.min(10, input.variants))}案
目標文字数: 1案あたり約${targetChars}文字
文字数プリセット: ${preset?.label || "カスタム"}
文字数メモ: ${preset?.note || "指定文字数を上限目安として自然に収める"}
媒体ルール: ${platformRule[input.platform]}

【SNS表現設定】
${socialStyle}

${knowledge}${promptOptimization ? `\n\n${promptOptimization}` : ""}

【確認済み製品情報】
${factsBlock(facts)}

【出力ルール】
- 各投稿本文は目標文字数を超えないように調整し、文字数の概算も添える。
- 同じ文面の使い回しではなく、媒体に合わせて構成を変える。
- 投稿ごとに狙いを1行で添える。
- 販売前なら「テスト中」「準備中」「公開予定」など事実に合う表現を使い、販売URLが空なら購入CTAを作らない。
- ハッシュタグは必要な媒体だけ、過剰に付けない。
- 画像・動画が有効な場合は、投稿素材の構図案または画像生成プロンプトも付ける。
- 選択された人間味・絵文字量・口調を守り、同じ語尾・定型句・過剰な絵文字連打を避ける。
- 人間味を出すために架空の体験談・感情・利用者反応を作らない。
- 確認が必要な情報は最後に「公開前チェック」として分離する。`;
}

export function buildAdminCampaignPrompt(
  facts: AdminProductFacts,
  input: AdminCampaignInput,
): string {
  const knowledge = compileKnowledgeContext({
    task: "promotion",
    audience: input.audience || facts.targetAudience,
    purpose: input.goal,
  }).promptBlock;
  const promptOptimization = buildUserPromptContext(getRuntimeWritingProfile(), "promotion");
  const socialStyle = buildSocialWritingStylePrompt(input.socialStyle);
  return `あなたはAI Action Studioのプロモーション設計担当者です。
販売開始後だけでなく、販売前の実運用テスト・開発進捗・公開予告も含めて、記事とSNSを連動させた発信計画を設計してください。

${FACT_SAFETY}

【キャンペーン】
名称: ${input.campaignName || "AASプロモーション"}
発信フェーズ: ${input.phase || facts.releaseStage || "要確認"}
目的: ${input.goal}
想定読者: ${input.audience || facts.targetAudience || "要確認"}
使用媒体: ${input.channels}
販売条件・オファー: ${input.offer || facts.priceText || "要確認"}
CTA: ${input.cta || facts.salesUrl || "要確認"}

【SNS文字数設定】
${socialLengthPlanBlock(input.socialLengths)}

【SNS表現設定】
${socialStyle}

${knowledge}${promptOptimization ? `\n\n${promptOptimization}` : ""}

【確認済み製品情報】
${factsBlock(facts)}

【出力】
- キャンペーンの中心メッセージを1つ
- note / Brain / Tips等の長文記事テーマを3案
- 指定SNS向けの投稿企画。上記のSNS文字数設定を守る
- 販売前の場合は「テスト共有 → 改善内容 → 開発進捗 → 公開予告 → 続報」の流れを優先し、販売開始済みの表現を使わない
- 販売開始後の場合のみ「予告 → 理解促進 → 機能紹介 → 販売開始 → FAQ → 再訴求」の流れを使う
- 14日分の投稿カレンダー。各日の目的、投稿テーマ、CTA、必要素材を示す
- 同じ訴求を連投しないための切り口ローテーション
- 公開前に人が確認すべき製品情報のチェックリスト`;
}

export function buildAdminPreviewPromotionPrompt(
  facts: AdminProductFacts,
  input: AdminPreviewPromotionInput,
): string {
  const knowledge = compileKnowledgeContext({
    task: "promotion",
    publicationTarget: input.testedPlatform === "note" ? "note" : undefined,
    audience: input.audience || facts.targetAudience,
    purpose: input.updateType,
  }).promptBlock;
  const promptOptimization = buildUserPromptContext(getRuntimeWritingProfile(), "promotion");
  const socialStyle = buildSocialWritingStylePrompt(input.socialStyle);
  return `あなたはAI Action Studioの開発・公開予告コンテンツ担当者です。
まだ販売前の段階で、運営者自身が行っている実運用テストや開発進捗、今後の公開予定を誠実に伝えるコンテンツを作成してください。

${FACT_SAFETY}

【今回の発信】
種類: ${input.updateType}
テスト・掲載先: ${input.testedPlatform || "要確認"}
今回共有してよい確認済み内容:
${input.verifiedUpdate || "未入力。確認済み製品情報にある事実だけで構成し、具体的なテスト成果は作らない。"}
公開予定: ${input.releasePlan || facts.releasePlan || "未定"}
想定読者: ${input.audience || facts.targetAudience || "要確認"}
使用媒体: ${input.channels}
CTA: ${input.cta || "続報を待ってもらう"}

【SNS文字数設定】
${socialLengthPlanBlock(input.socialLengths)}

【SNS表現設定】
${socialStyle}

${knowledge}${promptOptimization ? `\n\n${promptOptimization}` : ""}

【確認済み製品情報】
${factsBlock(facts)}

【出力】
1. ${input.testedPlatform || "note"}向けの「開発・実運用テスト報告」記事タイトル候補を7案
2. 読者が状況を誤解しない完成記事。販売前であること、何をテストしているか、現時点で確認できたこと、改善中の点、公開予定、続報の受け取り方を整理する
3. 記事冒頭で「今回分かること」を短く示し、抽象的な前置きや同じ説明の繰り返しを減らす
4. 記事で実画面があると理解しやすい箇所だけ「[スクショ①をここに挿入]」と明記し、記事後に「スクリーンショット撮影指示」として挿入位置・撮影画面・見せる範囲・PC/スマホ・キャプション案・隠すべき情報を整理する。画像自体は取得・生成しない
5. 指定SNSそれぞれの投稿案。上記の文字数設定を守り、各投稿に概算文字数を添える
6. Xでは設定が280文字を超える場合はPremium長文向けとして作成する
7. Threadsで500文字を超える場合は長文テキスト添付向けとして作成する
8. YouTube Shortsはタイトル100文字以内に加えて、設定文字数の概要欄を作る
9. 公開日・価格・販売URLが未確定なら、それらを断定せず「公開前チェック」へ回す
10. 実際に確認していない成果・PV・売上・反応・レビュー・感想を作らない
11. 完成前に事実関係・読みやすさ・重複・未確認情報を自己点検し、修正済みの完成版だけを出す`;
}
