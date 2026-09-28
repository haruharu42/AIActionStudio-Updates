export type NoteOperationGoal = "habit" | "growth" | "monetize" | "portfolio";
export type NoteAccountGenre = "ai" | "sidejob" | "business" | "lifestyle" | "gadget" | "learning" | "parenting" | "health_beauty" | "money" | "creative" | "entertainment" | "other";
export type NoteAccountStyle = "beginner" | "howto" | "experience" | "essay" | "review" | "trend" | "expert" | "creative" | "other";
export type NoteAudiencePreset = "beginner" | "employee" | "sidejob_beginner" | "student" | "parent" | "senior" | "creator" | "business_owner" | "broad" | "other";
export type NoteTonePreset =
  | "friendly"
  | "gentle"
  | "professional"
  | "casual"
  | "expert"
  | "energetic"
  | "logical"
  | "empathetic"
  | "storytelling"
  | "concise"
  | "essay"
  | "warm"
  | "formal"
  | "humorous"
  | "other";
export type NoteMonetizationStyle = "free_first" | "free_to_paid" | "paid_expertise" | "membership_future" | "no_monetization" | "other";

export type NoteOperationProfile = {
  userId: string;
  noteDisplayName: string;
  bioDraft: string;
  targetReader: string;
  mainTopics: string[];
  experienceNote: string;
  accountGenre: NoteAccountGenre;
  customGenre: string;
  accountStyle: NoteAccountStyle;
  customAccountStyle: string;
  audiencePreset: NoteAudiencePreset;
  customAudience: string;
  tonePreset: NoteTonePreset;
  customTone: string;
  monetizationStyle: NoteMonetizationStyle;
  customMonetizationStyle: string;
  operationGoal: NoteOperationGoal;
  articleGenre: string;
  articleSubgenre: string;
  weeklyPostCount: number;
  freePostsPerMonth: number;
  paidPostsPerMonth: number;
  freeTargetLength: number;
  paidTargetLength: number;
  preferredTime: string;
  secondaryTime: string;
  timezone: string;
  scheduleWeeks: number;
  accountReady: boolean;
  profileReady: boolean;
};

export const NOTE_OPERATION_GOALS: readonly { value: NoteOperationGoal; label: string; description: string }[] = [
  { value: "habit", label: "まず継続したい", description: "無理のない頻度で投稿習慣を作る" },
  { value: "growth", label: "読者を増やしたい", description: "無料記事を軸に継続して発信する" },
  { value: "monetize", label: "収益化も育てたい", description: "無料記事と有料記事を組み合わせる" },
  { value: "portfolio", label: "実績・作品を整理したい", description: "専門性や制作物を分かりやすく蓄積する" },
] as const;


export const NOTE_ACCOUNT_GENRES: readonly { value: NoteAccountGenre; label: string }[] = [
  { value: "ai", label: "AI・ChatGPT・生成AI" },
  { value: "sidejob", label: "副業・働き方" },
  { value: "business", label: "ビジネス・キャリア" },
  { value: "lifestyle", label: "暮らし・ライフスタイル" },
  { value: "gadget", label: "ガジェット・IT" },
  { value: "learning", label: "学習・資格" },
  { value: "parenting", label: "子育て・教育" },
  { value: "health_beauty", label: "健康・美容" },
  { value: "money", label: "お金・家計・投資" },
  { value: "creative", label: "創作・クリエイティブ" },
  { value: "entertainment", label: "趣味・エンタメ" },
  { value: "other", label: "その他（自由入力）" },
] as const;

export const NOTE_ACCOUNT_STYLES: readonly { value: NoteAccountStyle; label: string }[] = [
  { value: "beginner", label: "初心者向けにやさしく解説" },
  { value: "howto", label: "実践ノウハウ・手順中心" },
  { value: "experience", label: "経験・学び・試行錯誤中心" },
  { value: "essay", label: "日記・エッセイ・考え方中心" },
  { value: "review", label: "レビュー・比較・おすすめ中心" },
  { value: "trend", label: "ニュース・最新トレンド整理" },
  { value: "expert", label: "専門知識・深掘り中心" },
  { value: "creative", label: "作品・創作活動中心" },
  { value: "other", label: "その他（自由入力）" },
] as const;

export const NOTE_AUDIENCE_PRESETS: readonly { value: NoteAudiencePreset; label: string }[] = [
  { value: "beginner", label: "そのジャンルの完全初心者" },
  { value: "employee", label: "会社員・働く人" },
  { value: "sidejob_beginner", label: "副業を始めたい人" },
  { value: "student", label: "学生・学び直し層" },
  { value: "parent", label: "子育て中の人" },
  { value: "senior", label: "50代・60代以上" },
  { value: "creator", label: "クリエイター・発信者" },
  { value: "business_owner", label: "個人事業主・経営者" },
  { value: "broad", label: "年齢を限定せず幅広く" },
  { value: "other", label: "その他（自由入力）" },
] as const;

export const NOTE_TONE_PRESETS: readonly { value: NoteTonePreset; label: string }[] = [
  { value: "friendly", label: "親しみやすい" },
  { value: "gentle", label: "やさしく丁寧" },
  { value: "professional", label: "落ち着いた・信頼感重視" },
  { value: "casual", label: "カジュアル・会話調" },
  { value: "expert", label: "専門的・簡潔" },
  { value: "energetic", label: "明るく前向き" },
  { value: "logical", label: "論理的・整理して説明" },
  { value: "empathetic", label: "共感重視・読者に寄り添う" },
  { value: "storytelling", label: "ストーリー・体験談調" },
  { value: "concise", label: "短くテンポよく・要点重視" },
  { value: "essay", label: "読み物・エッセイ調" },
  { value: "warm", label: "温かみ・人柄重視" },
  { value: "formal", label: "フォーマル・端正" },
  { value: "humorous", label: "軽いユーモアを交える" },
  { value: "other", label: "その他（自由入力）" },
] as const;

export const NOTE_MONETIZATION_STYLES: readonly { value: NoteMonetizationStyle; label: string }[] = [
  { value: "free_first", label: "無料note中心で読者を増やす" },
  { value: "free_to_paid", label: "無料noteから有料noteへ自然につなぐ" },
  { value: "paid_expertise", label: "専門ノウハウを有料noteで深掘り" },
  { value: "membership_future", label: "将来メンバーシップも検討" },
  { value: "no_monetization", label: "収益化せず発信・記録を優先" },
  { value: "other", label: "その他（自由入力）" },
] as const;

function optionLabel<T extends string>(options: readonly { value: T; label: string }[], value: T, custom: string): string {
  if (value === "other" && custom.trim()) return custom.trim();
  return options.find((item) => item.value === value)?.label ?? value;
}

export function noteProfileSelectionLabels(profile: NoteOperationProfile) {
  return {
    genre: optionLabel(NOTE_ACCOUNT_GENRES, profile.accountGenre, profile.customGenre),
    style: optionLabel(NOTE_ACCOUNT_STYLES, profile.accountStyle, profile.customAccountStyle),
    audience: optionLabel(NOTE_AUDIENCE_PRESETS, profile.audiencePreset, profile.customAudience),
    tone: optionLabel(NOTE_TONE_PRESETS, profile.tonePreset, profile.customTone),
    monetization: optionLabel(NOTE_MONETIZATION_STYLES, profile.monetizationStyle, profile.customMonetizationStyle),
  };
}

export function defaultNoteOperationProfile(userId: string): NoteOperationProfile {
  return {
    userId,
    noteDisplayName: "",
    bioDraft: "",
    targetReader: "",
    mainTopics: [],
    experienceNote: "",
    accountGenre: "ai",
    customGenre: "",
    accountStyle: "beginner",
    customAccountStyle: "",
    audiencePreset: "beginner",
    customAudience: "",
    tonePreset: "friendly",
    customTone: "",
    monetizationStyle: "free_to_paid",
    customMonetizationStyle: "",
    operationGoal: "habit",
    articleGenre: "AI副業",
    articleSubgenre: "AIおまかせ",
    weeklyPostCount: 3,
    freePostsPerMonth: 10,
    paidPostsPerMonth: 2,
    freeTargetLength: 4000,
    paidTargetLength: 7000,
    preferredTime: "20:00",
    secondaryTime: "12:00",
    timezone: "Asia/Tokyo",
    scheduleWeeks: 4,
    accountReady: false,
    profileReady: false,
  };
}


export const AAS_ADMIN_NOTE_PROFILE_PRESET = {
  label: "AI Action Studio（AAS）運営",
  genre: "AI Action Studio（AAS）・AI副業・コンテンツ制作・運営支援",
  style: "AASの使い方・副業専用プロンプト・Knowledge・開発進捗・実運用テストを分かりやすく整理する",
  audience: "note・Tips・BrainなどでAIを使って記事制作・コンテンツ運営を始めたい初心者〜個人クリエイター",
  tone: "落ち着いた・信頼感重視",
  monetization: "販売前は無料発信で使い方・開発進捗・実運用テストを共有し、公開後は製品案内や必要に応じた有料コンテンツへ自然につなぐ",
  goal: "読者を増やしたい",
  displayName: "AI Action Studio（AAS）",
  bioDraft: "AI Action Studio（AAS）の使い方・開発進捗・アップデート情報を中心に、AI副業の専用プロンプト、Knowledge、記事・SNS・画像・コンテンツ運営の活用法を分かりやすく発信します。",
  targetReader: "AIを副業に活用したい人、note・Tips・BrainやSNSを運営したい人、コンテンツ制作や販売・集客を効率化したい初心者〜個人クリエイター",
  mainTopics: [
    "AI Action Studio",
    "AASアップデート",
    "AI副業",
    "副業プロンプト",
    "AI記事作成",
    "note運営",
    "Tips・Brain運営",
    "プロンプト活用",
    "記事ライブラリ",
    "画像計画",
    "公開前チェック",
    "SNS再利用",
    "実運用テスト",
    "Knowledge活用",
    "販売・プロモーション",
    "コンテンツ運営",
  ] as const,
} as const;

export function applyAasAdminNoteProfilePreset(profile: NoteOperationProfile): NoteOperationProfile {
  return {
    ...profile,
    noteDisplayName: AAS_ADMIN_NOTE_PROFILE_PRESET.displayName,
    bioDraft: AAS_ADMIN_NOTE_PROFILE_PRESET.bioDraft,
    targetReader: AAS_ADMIN_NOTE_PROFILE_PRESET.targetReader,
    mainTopics: [...AAS_ADMIN_NOTE_PROFILE_PRESET.mainTopics],
    accountGenre: "other",
    customGenre: AAS_ADMIN_NOTE_PROFILE_PRESET.genre,
    accountStyle: "other",
    customAccountStyle: AAS_ADMIN_NOTE_PROFILE_PRESET.style,
    audiencePreset: "other",
    customAudience: AAS_ADMIN_NOTE_PROFILE_PRESET.audience,
    tonePreset: "professional",
    customTone: "",
    monetizationStyle: "other",
    customMonetizationStyle: AAS_ADMIN_NOTE_PROFILE_PRESET.monetization,
    operationGoal: "growth",
    articleGenre: "AI副業",
    articleSubgenre: "AIツール活用",
  };
}
