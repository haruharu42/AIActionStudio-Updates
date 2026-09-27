export type AdminSocialHumanity = "human" | "natural" | "polished" | "mechanical";
export type AdminSocialEmojiLevel = "none" | "few" | "standard" | "many";
export type AdminSocialTone = "soft" | "casual" | "standard" | "business" | "energetic";

export type AdminSocialWritingStyle = {
  humanity: AdminSocialHumanity;
  emojiLevel: AdminSocialEmojiLevel;
  tone: AdminSocialTone;
};

export const DEFAULT_ADMIN_SOCIAL_WRITING_STYLE: AdminSocialWritingStyle = {
  humanity: "natural",
  emojiLevel: "few",
  tone: "soft",
};

export const SOCIAL_HUMANITY_OPTIONS = [
  { value: "human", label: "人間味強め" },
  { value: "natural", label: "自然" },
  { value: "polished", label: "整った文章" },
  { value: "mechanical", label: "機械的・簡潔" },
] as const;

export const SOCIAL_EMOJI_OPTIONS = [
  { value: "none", label: "なし" },
  { value: "few", label: "少なめ" },
  { value: "standard", label: "標準" },
  { value: "many", label: "多め" },
] as const;

export const SOCIAL_TONE_OPTIONS = [
  { value: "soft", label: "やわらかい" },
  { value: "casual", label: "カジュアル" },
  { value: "standard", label: "標準" },
  { value: "business", label: "ビジネス" },
  { value: "energetic", label: "熱量高め" },
] as const;

const HUMANITY_INSTRUCTIONS: Record<AdminSocialHumanity, string> = {
  human: "人が実際に書いたような自然な間・言い回し・文の長短を使う。テンプレ感や同じ語尾の連続を避ける。ただし架空の体験談・感情・実績・反応は作らない。",
  natural: "自然で読みやすい日本語にする。過度に整えすぎず、適度な文の揺らぎを残す。AIらしい定型句や不自然な言い換えを避ける。",
  polished: "読みやすく整理された文章にする。文法・構成を整え、簡潔で安定した表現を優先する。",
  mechanical: "感情表現を抑え、事実・機能・手順を短く明確に並べる。装飾的な言い回しや会話的な余韻を減らす。",
};

const EMOJI_INSTRUCTIONS: Record<AdminSocialEmojiLevel, string> = {
  none: "絵文字は使わない。",
  few: "絵文字は必要な箇所だけ0〜2個程度に抑える。毎行には付けない。",
  standard: "読みやすさを損なわない範囲で適度に絵文字を使う。意味のない連続使用はしない。",
  many: "投稿の雰囲気を明るくするため絵文字をやや多めに使う。ただし1文ごとの乱用や同じ絵文字の連打は避ける。",
};

const TONE_INSTRUCTIONS: Record<AdminSocialTone, string> = {
  soft: "やわらかく親しみやすい口調。押し売り感を抑え、読者へ話しかける距離感にする。",
  casual: "カジュアルで会話的な口調。短い文や自然な区切りを使う。",
  standard: "中立で読みやすい標準的な口調。くだけすぎず堅すぎない。",
  business: "落ち着いたビジネス調。感情表現を控え、信頼感と明確さを優先する。",
  energetic: "前向きで熱量のある口調。ただし煽り・誇張・過剰な感嘆符は避ける。",
};

export function normalizeAdminSocialWritingStyle(
  style?: Partial<AdminSocialWritingStyle> | null,
): AdminSocialWritingStyle {
  const humanity = style?.humanity && style.humanity in HUMANITY_INSTRUCTIONS
    ? style.humanity
    : DEFAULT_ADMIN_SOCIAL_WRITING_STYLE.humanity;
  const emojiLevel = style?.emojiLevel && style.emojiLevel in EMOJI_INSTRUCTIONS
    ? style.emojiLevel
    : DEFAULT_ADMIN_SOCIAL_WRITING_STYLE.emojiLevel;
  const tone = style?.tone && style.tone in TONE_INSTRUCTIONS
    ? style.tone
    : DEFAULT_ADMIN_SOCIAL_WRITING_STYLE.tone;
  return { humanity, emojiLevel, tone };
}

export function buildSocialWritingStylePrompt(
  style?: Partial<AdminSocialWritingStyle> | null,
): string {
  const normalized = normalizeAdminSocialWritingStyle(style);
  return [
    `文章の人間味: ${HUMANITY_INSTRUCTIONS[normalized.humanity]}`,
    `絵文字: ${EMOJI_INSTRUCTIONS[normalized.emojiLevel]}`,
    `口調・温度感: ${TONE_INSTRUCTIONS[normalized.tone]}`,
    "人間味を出す場合も、架空の体験談・感想・利用者の反応・運営者の気持ちは作らない。",
    "選択した表現設定より、確認済み事実・媒体ルール・誇張禁止を優先する。",
  ].join("\n");
}
