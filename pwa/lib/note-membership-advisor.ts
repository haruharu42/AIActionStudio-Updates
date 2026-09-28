import { compileKnowledgeContext } from "@/lib/knowledge-engine";
import {
  noteProfileSelectionLabels,
  type NoteOperationProfile,
} from "@/lib/note-operation-profile";

export type NoteMembershipConsultation =
  | "new"
  | "pricing"
  | "benefits"
  | "growth"
  | "retention"
  | "simplify"
  | "description";

export type NoteMembershipPurpose =
  | "support"
  | "exclusive"
  | "learning"
  | "community"
  | "consultation"
  | "behind_scenes"
  | "mixed";

export type NoteMembershipPriceBand =
  | "ai"
  | "300_500"
  | "500_1000"
  | "1000_3000"
  | "3000_5000"
  | "5000_10000"
  | "10000_plus";

export type NoteMembershipBenefit =
  | "member_articles"
  | "past_paid_articles"
  | "magazine"
  | "board"
  | "newsletter"
  | "qa"
  | "zoom"
  | "individual"
  | "external"
  | "support_only";

export type NoteMembershipFrequency =
  | "weekly1"
  | "weekly2"
  | "monthly2"
  | "monthly1"
  | "irregular"
  | "ai";

export type NoteMembershipWorkload =
  | "under1"
  | "1_3"
  | "3_5"
  | "5_plus"
  | "ai";

export type NoteMembershipAudienceStage =
  | "followers"
  | "free_readers"
  | "paid_buyers"
  | "sns"
  | "new"
  | "mixed";

export type NoteMembershipTrial = "consider" | "normal" | "ai";
export type NoteMembershipVisibility = "public" | "invite" | "limited" | "ai";

export type NoteMembershipAdvisorInput = {
  consultation: NoteMembershipConsultation;
  purpose: NoteMembershipPurpose;
  audienceStage: NoteMembershipAudienceStage;
  planCount: number;
  priceBand: NoteMembershipPriceBand;
  primaryBenefit: NoteMembershipBenefit;
  secondaryBenefit: NoteMembershipBenefit;
  frequency: NoteMembershipFrequency;
  workload: NoteMembershipWorkload;
  trial: NoteMembershipTrial;
  visibility: NoteMembershipVisibility;
  note: string;
};

type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export const NOTE_MEMBERSHIP_CONSULTATIONS: readonly Option<NoteMembershipConsultation>[] = [
  { value: "new", label: "0からメンバーシップを設計したい" },
  { value: "pricing", label: "料金を相談・見直したい" },
  { value: "benefits", label: "特典内容を相談・見直したい" },
  { value: "growth", label: "加入につながる導線を考えたい" },
  { value: "retention", label: "継続しやすい運営にしたい" },
  { value: "simplify", label: "運営負荷を減らしたい" },
  { value: "description", label: "紹介文・プラン説明を作りたい" },
];

export const NOTE_MEMBERSHIP_PURPOSES: readonly Option<NoteMembershipPurpose>[] = [
  { value: "support", label: "応援・活動支援を中心にする" },
  { value: "exclusive", label: "限定記事・限定コンテンツを届ける" },
  { value: "learning", label: "ノウハウ・学びを継続提供する" },
  { value: "community", label: "コミュニティ・交流を中心にする" },
  { value: "consultation", label: "相談・質問対応を中心にする" },
  { value: "behind_scenes", label: "制作の裏側・進捗を共有する" },
  { value: "mixed", label: "複数を組み合わせたい" },
];

export const NOTE_MEMBERSHIP_PRICE_BANDS: readonly Option<NoteMembershipPriceBand>[] = [
  { value: "ai", label: "AIに最適な価格帯を相談する" },
  { value: "300_500", label: "300〜500円程度" },
  { value: "500_1000", label: "500〜1,000円程度" },
  { value: "1000_3000", label: "1,000〜3,000円程度" },
  { value: "3000_5000", label: "3,000〜5,000円程度" },
  { value: "5000_10000", label: "5,000〜10,000円程度" },
  { value: "10000_plus", label: "10,000円以上も検討" },
];

export const NOTE_MEMBERSHIP_BENEFITS: readonly Option<NoteMembershipBenefit>[] = [
  { value: "member_articles", label: "メンバー限定記事" },
  { value: "past_paid_articles", label: "過去の有料記事を特典にする" },
  { value: "magazine", label: "限定マガジン" },
  { value: "board", label: "メンバー限定掲示板" },
  { value: "newsletter", label: "ニュースレター・定期便" },
  { value: "qa", label: "質問受付・Q&A" },
  { value: "zoom", label: "Zoom等の交流会" },
  { value: "individual", label: "個別相談・個別サポート" },
  { value: "external", label: "外部ツール・コミュニティ特典" },
  { value: "support_only", label: "特典を増やしすぎない応援プラン" },
];

export const NOTE_MEMBERSHIP_FREQUENCIES: readonly Option<NoteMembershipFrequency>[] = [
  { value: "ai", label: "AIに無理のない頻度を相談する" },
  { value: "weekly1", label: "週1回程度" },
  { value: "weekly2", label: "週2回程度" },
  { value: "monthly2", label: "月2回程度" },
  { value: "monthly1", label: "月1回程度" },
  { value: "irregular", label: "頻度を約束しすぎない・不定期" },
];

export const NOTE_MEMBERSHIP_WORKLOADS: readonly Option<NoteMembershipWorkload>[] = [
  { value: "ai", label: "AIに相談する" },
  { value: "under1", label: "週1時間以内に収めたい" },
  { value: "1_3", label: "週1〜3時間程度" },
  { value: "3_5", label: "週3〜5時間程度" },
  { value: "5_plus", label: "週5時間以上でも対応できる" },
];

export const NOTE_MEMBERSHIP_AUDIENCES: readonly Option<NoteMembershipAudienceStage>[] = [
  { value: "followers", label: "既存のnoteフォロワー" },
  { value: "free_readers", label: "無料記事を読んでくれている人" },
  { value: "paid_buyers", label: "有料記事を購入したことがある人" },
  { value: "sns", label: "SNSフォロワー" },
  { value: "new", label: "まだ自分を知らない新規読者" },
  { value: "mixed", label: "複数の層を想定" },
];

export const NOTE_MEMBERSHIP_TRIALS: readonly Option<NoteMembershipTrial>[] = [
  { value: "ai", label: "AIに相談する" },
  { value: "consider", label: "1ヶ月無料を検討する" },
  { value: "normal", label: "無料期間なしで検討する" },
];

export const NOTE_MEMBERSHIP_VISIBILITIES: readonly Option<NoteMembershipVisibility>[] = [
  { value: "ai", label: "AIに相談する" },
  { value: "public", label: "通常の公開プラン" },
  { value: "invite", label: "非公開・招待制も検討" },
  { value: "limited", label: "人数制限も検討" },
];

function labelOf<T extends string>(options: readonly Option<T>[], value: T): string {
  return options.find((item) => item.value === value)?.label ?? value;
}

export const NOTE_MEMBERSHIP_KNOWLEDGE = {
  checkedAt: "2026-09-26",
  sourceUrls: [
    "https://note.com/help/pg/membership",
    "https://note.com/lp/membership",
    "https://note.com/info/n/na1b62e620e9c",
    "https://note.com/info/n/n1403dd6c1cd9",
    "https://note.com/info/n/nb50a11d765b8",
  ],
  guidance: [
    "コンセプトは『やりたいこと・得意なこと・読者ニーズ』の重なりから考え、誰に何を継続提供するかを一文で説明できる状態にする",
    "プランは価格差だけで分けず、対象者・提供価値・関わり方・運営負荷が明確に違う場合だけ分ける",
    "特典は記事だけに限定せず、マガジン・掲示板・ニュースレター・質問対応・交流・外部ツールなどから目的に合うものを選ぶ",
    "投稿頻度は高く見せることより無理なく続けられる最低ラインを先に決める",
    "料金は特典量だけでなく、専門性・個別対応・コミュニティ価値・運営工数・既存読者との関係を合わせて検討する",
    "note公式ガイドの価格例は目安として扱い、最終価格は自分が継続できる負荷と読者が理解できる価値説明を基準に決める",
    "無料記事・単品有料記事・メンバーシップの役割を分け、無料側にも新規読者が価値を感じられる入口を残す",
    "加入直後に『何を読めばよいか・どこで交流できるか・次の更新は何か』が分かる歓迎導線を用意する",
    "開始前に自己紹介・概要説明・歓迎記事・掲示板等の初期コンテンツを必要に応じて準備する",
    "メンバーの反応やアンケートを見ながら特典や頻度を調整し、最初から運営方法を固定しすぎない",
    "2026年8月3日以降の新規加入では入会日基準の請求へ変更された公式案内があるため、請求日や無料期間を説明する際は現在のnote公式表示を最終確認する",
    "過去のnote公式案内では複数プランと最大5プランの案内があるが、開設時は現行画面で最新上限を確認する",
    "2026年6月の公式改善でメンバーシップ紹介ページは見出し・太字・箇条書き等を使いやすくなったため、長文を詰めず見出し構造で価値と注意点を整理する",
    "2026年8月のnote質問箱改善では質問受付をメンバーシップのプランごとに設定できるため、Q&A特典は全プラン共通にせず必要なプランだけへ割り当てる選択肢を検討する",
    "無料招待を使う場合は初期参加者の安心材料として活用できるが、招待人数や現在条件は公開前にnote公式ガイドで確認する",
  ],
  cautions: [
    "会員数、継続率、売上、加入率を保証しない",
    "既存のファン数や有料記事購入者数を入力なしに推測しない",
    "更新頻度を守れない可能性が高い特典を販売上の魅力だけで約束しない",
    "個別相談・Zoom等は対応人数と時間上限を決めずに上位プランへ入れない",
    "note側の手数料・請求日・無料期間・価格上限など変動しうる仕様は、最終公開前に公式画面と最新ヘルプを確認する",
    "他クリエイターの料金や特典をそのままコピーせず、自分の読者・発信内容・運営可能時間に合わせる",
  ],
} as const;

export function buildNoteMembershipAdvisorPrompt(
  profile: NoteOperationProfile,
  input: NoteMembershipAdvisorInput,
): string {
  const profileLabels = noteProfileSelectionLabels(profile);
  const knowledge = compileKnowledgeContext({
    task: "promotion",
    publicationTarget: "note",
    audience: profile.targetReader || profileLabels.audience,
    purpose: "noteメンバーシップの設計・料金・特典・運営相談",
  }).promptBlock;
  const planCount = Math.max(1, Math.min(5, Math.trunc(input.planCount || 1)));

  const lines = [
    "あなたはnoteメンバーシップの設計・料金・特典・継続運営を支援する日本語の編集者兼サブスクリプション設計アドバイザーです。",
    "目的は、ユーザーのnote発信内容と運営可能時間に合う、無理なく続けられるメンバーシップ案を具体化することです。",
    "",
    "【絶対ルール】",
    "- 売上、加入率、会員数、継続率などの成果を保証しない。",
    "- ユーザーが入力していない実績・ファン数・購入者の声・専門資格を作らない。",
    "- noteの料金・手数料・請求・無料期間・プラン上限等は変動しうるため、最新仕様が必要な箇所はnote公式の確認事項として明示する。",
    "- 他クリエイターのプランをコピーせず、今回の発信テーマ・読者・運営負荷から設計する。",
    "- 高額プランほど特典数を増やすという単純設計にせず、個別性・専門性・交流・対応工数など価値の違いを説明する。",
    "- 継続できない更新頻度や個別対応を安易に約束しない。",
    "",
    "【現在のnoteプロフィール条件】",
    "表示名: " + (profile.noteDisplayName || "未設定"),
    "ジャンル: " + profileLabels.genre,
    "運営スタイル: " + profileLabels.style,
    "想定読者: " + (profile.targetReader || profileLabels.audience),
    "文章の雰囲気: " + profileLabels.tone,
    "現在の収益化方針: " + profileLabels.monetization,
    "主な発信テーマ: " + (profile.mainTopics.length ? profile.mainTopics.join(" / ") : "未設定"),
    "事実として使える経験・背景: " + (profile.experienceNote || "未入力"),
    "",
    "【今回の相談】",
    "相談内容: " + labelOf(NOTE_MEMBERSHIP_CONSULTATIONS, input.consultation),
    "メンバーシップの中心目的: " + labelOf(NOTE_MEMBERSHIP_PURPOSES, input.purpose),
    "主に想定する読者層: " + labelOf(NOTE_MEMBERSHIP_AUDIENCES, input.audienceStage),
    "検討するプラン数: " + planCount + "プラン",
    "希望価格帯: " + labelOf(NOTE_MEMBERSHIP_PRICE_BANDS, input.priceBand),
    "主な特典: " + labelOf(NOTE_MEMBERSHIP_BENEFITS, input.primaryBenefit),
    "補助特典: " + labelOf(NOTE_MEMBERSHIP_BENEFITS, input.secondaryBenefit),
    "更新・提供頻度: " + labelOf(NOTE_MEMBERSHIP_FREQUENCIES, input.frequency),
    "運営に使える時間: " + labelOf(NOTE_MEMBERSHIP_WORKLOADS, input.workload),
    "無料体験: " + labelOf(NOTE_MEMBERSHIP_TRIALS, input.trial),
    "公開方法: " + labelOf(NOTE_MEMBERSHIP_VISIBILITIES, input.visibility),
    "追加相談メモ: " + (input.note.trim() || "なし"),
    "",
    "【noteメンバーシップ専用Knowledge】",
    ...NOTE_MEMBERSHIP_KNOWLEDGE.guidance.map((item) => "- " + item),
    "",
    "【注意】",
    ...NOTE_MEMBERSHIP_KNOWLEDGE.cautions.map((item) => "- " + item),
    "",
    knowledge,
    "",
    "【出力】",
    "1. 最初に「今回のおすすめ方針」を3〜6行でまとめる。",
    "2. メンバーシップのコンセプトを3案出し、それぞれ「誰に / 何を / なぜ継続する価値があるか」を説明する。",
    "3. 採用推奨コンセプトを1案選び、理由を説明する。",
    "4. " + planCount + "プラン分の設計表を作る。各プランに「プラン名 / 月額候補 / 対象者 / 主特典 / 補助特典 / 更新頻度 / 運営工数の目安 / 上位プランとの差」を入れる。",
    "5. 月額候補は最低2案ずつ示し、安い・高いではなく、価値・対応工数・読者の参加ハードルの違いから理由を書く。",
    "6. 無料note / 単品有料note / メンバーシップ限定コンテンツの役割分担を整理する。",
    "7. 加入直後のオンボーディングとして、歓迎記事・最初に読む記事・掲示板・質問箱のプラン別受付・無料招待等の必要項目を提案する。",
    "8. 最初の30日間の運営例を、無理のない更新頻度で週単位に提案する。",
    "9. noteのメンバーシップ概要文を、そのまま下書きに使える形で作る。",
    "10. 各プラン説明文を、それぞれ短文版と詳しい版の2種類作る。",
    "11. 未加入者向けFAQを5〜10問作る。",
    "12. 開始前の告知用note記事案とSNS告知案を1つずつ作る。",
    "13. 運営負荷が高すぎる点・約束しすぎている点があれば明確に警告し、代替案を出す。",
    "14. 最後に「note公式で公開前に確認する項目」を列挙する。料金、プラン数、1ヶ月無料、請求タイミング、手数料、審査・公開条件など変動しうる仕様はここで確認対象にする。",
    "15. 不足情報があっても作業を止めず、仮定する場合は「仮案」と明記して完成案を出す。",
    "",
    "【参照する公式情報】",
    ...NOTE_MEMBERSHIP_KNOWLEDGE.sourceUrls.map((url) => "- " + url),
  ];

  return lines.join("\n");
}
