import type {
  AdminScreenshotCount,
  AdminScreenshotDevice,
  AdminScreenshotPublication,
  AdminSocialPlatform,
} from "@/lib/admin-promotion";

export type Mode = "product" | "preview" | "article" | "social" | "campaign";

export const MODES: Array<{ key: Mode; label: string; description: string }> = [
  { key: "product", label: "製品情報を整える", description: "宣伝に使う確認済み情報を先に整理" },
  { key: "preview", label: "テスト・公開予告を作る", description: "実運用テスト・開発進捗・公開予定" },
  { key: "article", label: "紹介・販売記事を作る", description: "note / Brain / Tips / ブログ向け" },
  { key: "social", label: "SNS投稿を作る", description: "X・Instagram・Threads・短尺動画向け" },
  { key: "campaign", label: "まとめて販促計画を作る", description: "記事とSNSを14日分まとめて設計" },
];

export type QuickPresetKey =
  | ""
  | "prelaunch-test"
  | "development-update"
  | "release-preview"
  | "sales-launch"
  | "product-faq"
  | "sns-quick"
  | "update-campaign";

export const QUICK_PRESETS: Array<{ key: QuickPresetKey; label: string; description: string }> = [
  { key: "", label: "現在の設定をそのまま使う", description: "下の項目を自分で選ぶ" },
  { key: "prelaunch-test", label: "実運用テストを共有", description: "note等で試した内容を販売前として発信" },
  { key: "development-update", label: "開発進捗を共有", description: "PWAの改善・開発状況をSNS中心に発信" },
  { key: "release-preview", label: "公開予告を作る", description: "公開予定・ベータ予定を記事とSNSへ展開" },
  { key: "sales-launch", label: "販売開始を告知", description: "販売ページへの送客を含む14日販促" },
  { key: "product-faq", label: "FAQ・不安解消記事", description: "購入前の疑問を整理する長文記事" },
  { key: "sns-quick", label: "X投稿をすぐ作る", description: "短時間でSNS販促案を作る" },
  { key: "update-campaign", label: "アップデート告知", description: "既存ユーザー向け再訴求をまとめて設計" },
];

export type SalesProductKey = "aas-pwa" | "pwa-7day" | "pwa-monthly" | "prelaunch";
export type SalesChannelKey = "note" | "brain" | "tips" | "direct" | "stripe" | "social";
export type PromotionMethodKey = "article" | "social" | "campaign" | "preview";

export const SALES_PRODUCT_OPTIONS: Array<{ key: SalesProductKey; label: string; note: string }> = [
  { key: "aas-pwa", label: "AAS PWA版", note: "通常のPWA版紹介・販売向け" },
  { key: "pwa-7day", label: "PWA 7日利用パス（設定時のみ）", note: "販売設定で7日券を有効にする場合の販促向け" },
  { key: "pwa-monthly", label: "PWA 月額プラン（設定時のみ）", note: "販売設定で月額を有効にする場合の販促向け" },
  { key: "prelaunch", label: "販売前・公開予告", note: "まだ販売せず、テスト・開発・公開予定を伝える" },
];

export const SALES_CHANNEL_OPTIONS: Array<{ key: SalesChannelKey; label: string; note: string }> = [
  { key: "note", label: "note", note: "記事販売・案内ページへ誘導" },
  { key: "brain", label: "Brain", note: "Brainの商品・案内ページへ誘導" },
  { key: "tips", label: "Tips", note: "Tipsの商品・案内ページへ誘導" },
  { key: "direct", label: "AAS公式ページ・直接案内", note: "公式ページや利用開始導線を使う" },
  { key: "stripe", label: "AAS内Stripe（設定時のみ）", note: "販売設定でStripe受付を有効にした場合だけ利用" },
  { key: "social", label: "SNSから案内", note: "X・Instagram・Threads等から誘導" },
];

export const PROMOTION_METHOD_OPTIONS: Array<{ key: PromotionMethodKey; label: string; note: string }> = [
  { key: "article", label: "紹介・販売記事", note: "長文で詳しく説明する" },
  { key: "social", label: "SNS投稿", note: "短時間で複数投稿案を作る" },
  { key: "campaign", label: "14日プロモーション計画", note: "記事とSNSをまとめて設計する" },
  { key: "preview", label: "テスト・公開予告", note: "販売前の進捗・予告を誠実に発信する" },
];

export const SCREENSHOT_PUBLICATION_OPTIONS: Array<{ key: AdminScreenshotPublication; label: string }> = [
  { key: "note", label: "note記事" },
  { key: "tips", label: "Tips記事" },
  { key: "brain", label: "Brain記事" },
  { key: "x", label: "X投稿・告知" },
  { key: "manual", label: "操作マニュアル" },
  { key: "update", label: "アップデート告知" },
];

export const SCREENSHOT_DEVICE_OPTIONS: Array<{ key: AdminScreenshotDevice; label: string }> = [
  { key: "both", label: "PC＋スマホ両方" },
  { key: "pc", label: "PCのみ" },
  { key: "mobile", label: "スマホのみ" },
];

export const SCREENSHOT_COUNT_OPTIONS: Array<{ key: AdminScreenshotCount; label: string }> = [
  { key: "auto", label: "AIおまかせ（必要最小限）" },
  { key: "1", label: "1枚" },
  { key: "2", label: "2枚" },
  { key: "3", label: "3枚" },
];

export const PURPOSE_OPTIONS = [
  "実運用テスト状況の共有",
  "note実運用テスト報告",
  "開発進捗の共有",
  "改善内容の共有",
  "公開前の予告",
  "公開予定の案内",
  "ベータ開始予告",
  "新規紹介・販売",
  "販売開始告知",
  "認知拡大",
  "機能紹介",
  "初心者向け解説",
  "利用開始を促す",
  "既存ユーザーへ再訴求",
  "アップデート告知",
  "ベータ参加募集",
  "招待ユーザー募集",
  "比較検討を支援",
  "FAQ・不安解消",
  "無料コンテンツから販売へ誘導",
  "記事・販売ページへの送客",
  "SNSフォロー促進",
  "休眠ユーザーの再活性化",
];

export const AUDIENCE_OPTIONS = [
  "AI初心者",
  "副業初心者",
  "note初心者",
  "Tips・Brain初心者",
  "SNS運用初心者",
  "コンテンツ販売初心者",
  "AIをすでに使っている人",
  "記事作成を効率化したい人",
  "SNS投稿を効率化したい人",
  "個人事業主・フリーランス",
  "小規模事業者",
  "ブログ運営者",
  "クリエイター",
  "会社員",
  "主婦・主夫",
  "学生",
  "20代",
  "30代",
  "40代",
  "50代",
  "60代以上",
  "時間が少ない人",
  "PC操作が苦手な人",
  "スマホ中心で作業する人",
];

export const CTA_OPTIONS = [
  "フォローして続報を待ってもらう",
  "公開予定を知らせる",
  "テスト記事を読んでもらう",
  "開発状況を見てもらう",
  "先行案内を確認してもらう",
  "販売前なのでCTAなし",
  "販売URLへ誘導",
  "公式ページへ誘導",
  "詳細記事へ誘導",
  "無料記事へ誘導",
  "プロフィールへ誘導",
  "利用開始を促す",
  "ベータ参加を促す",
  "招待申請を促す",
  "問い合わせを促す",
  "DMを促す",
  "フォローを促す",
  "保存を促す",
  "コメントを促す",
  "次の記事へ誘導",
  "CTAなし",
];

export const EDITION_OPTIONS = [
  "PWA版 / Windows版",
  "PWA版のみ",
  "Windows版のみ",
  "PWA版 / Windows版（別購入）",
  "PWA版 / Windows版（共通利用）",
  "招待制PWA版",
  "ベータ版",
];

export const RELEASE_STAGE_OPTIONS = [
  "未定",
  "開発中",
  "内部テスト",
  "クローズドベータ",
  "オープンベータ",
  "有料ベータ",
  "先行販売",
  "正式販売",
  "販売一時停止",
  "提供終了",
];

export const SUPPORT_OPTIONS = [
  "未定",
  "アプリ内案内",
  "FAQ・ヘルプ",
  "メールサポート",
  "問い合わせフォーム",
  "X・SNS経由の問い合わせ",
  "販売ページ経由の問い合わせ",
  "ベータ期間限定サポート",
  "複数チャネルでサポート",
];

export const LIMITATION_OPTIONS = [
  "特になし",
  "未確定事項あり",
  "ベータ版のため仕様変更の可能性あり",
  "一部機能は開発中",
  "Windows版とPWA版は別利用権",
  "招待制",
  "利用上限あり",
  "対応環境に制限あり",
  "外部AIサービスの仕様・利用条件に依存",
];

export const CAMPAIGN_GOAL_OPTIONS = [
  "実運用テストの共有",
  "開発進捗の認知拡大",
  "公開前の期待形成",
  "公開予定の周知",
  "ベータ開始予告",
  "販売開始・認知拡大",
  "新規ユーザー獲得",
  "ベータ参加者募集",
  "招待ユーザー募集",
  "販売ページへの送客",
  "記事への送客",
  "SNSフォロワー獲得",
  "製品理解の促進",
  "特定機能の認知拡大",
  "アップデート周知",
  "既存ユーザーの再活性化",
  "FAQ・不安解消",
];

export const CHANNEL_PRESET_OPTIONS = [
  "note, X, Instagram, Threads, TikTok, YouTube Shorts",
  "note, X",
  "note, X, Instagram",
  "note, X, Threads",
  "note, X, Instagram, Threads",
  "X, Instagram, Threads",
  "Instagram, TikTok, YouTube Shorts",
  "X, TikTok, YouTube Shorts",
  "note, Brain, Tips, X",
  "note, Brain, Tips, X, Instagram, Threads",
  "noteのみ",
  "Xのみ",
  "Instagramのみ",
  "Threadsのみ",
  "TikTokのみ",
  "YouTube Shortsのみ",
];

export const OFFER_OPTIONS = [
  "販売前・テスト運用中",
  "公開予定のみ・販売未開始",
  "価格未定・販売前",
  "未定・要確認",
  "通常販売",
  "新規販売開始",
  "ベータ参加募集",
  "招待制募集",
  "無料体験・試用案内",
  "早期利用者向け案内",
  "期間限定キャンペーン",
  "アップデート記念",
  "特典付き販売",
  "割引なし・製品価値を中心に訴求",
];

export const PROMOTION_PHASE_OPTIONS = [
  "実運用テスト中（販売前）",
  "開発中・進捗共有",
  "公開前予告",
  "ベータ公開予定",
  "公開日決定・カウントダウン",
  "販売開始前",
  "販売開始後",
  "アップデート告知",
];

export const TESTING_STATUS_OPTIONS = [
  "未実施",
  "運営者自身で実運用テスト中",
  "noteで実運用テスト中",
  "Tipsで実運用テスト中",
  "Brainで実運用テスト中",
  "複数媒体で実運用テスト中",
  "テスト完了・改善中",
  "公開準備中",
];

export const PREVIEW_UPDATE_OPTIONS = [
  "note実運用テスト報告",
  "Tips実運用テスト報告",
  "Brain実運用テスト報告",
  "開発進捗の共有",
  "改善内容の共有",
  "公開前の予告",
  "公開予定の案内",
  "ベータ開始予告",
  "正式公開予告",
  "公開日決定のお知らせ",
];

export const TESTED_PLATFORM_OPTIONS = ["note", "Tips", "Brain", "PWA版", "Windows版", "複数媒体"];

export const DEFAULT_SOCIAL_PRESET_IDS: Record<AdminSocialPlatform, string> = {
  x: "x-standard",
  instagram: "instagram-standard",
  threads: "threads-standard",
  tiktok: "tiktok-standard",
  youtube: "youtube-standard",
};
