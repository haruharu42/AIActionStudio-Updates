export type AdminSectionId =
  | "users"
  | "membership"
  | "free-plan"
  | "sales"
  | "promotion"
  | "development-prompts"
  | "prompts"
  | "knowledge"
  | "releases"
  | "features"
  | "notifications"
  | "security"
  | "infrastructure"
  | "operations"
  | "inquiries";

export type AdminSectionGroupId = "daily" | "sales" | "creation" | "system";

export type AdminSection = {
  id: AdminSectionId;
  group: AdminSectionGroupId;
  href: `/admin/${string}`;
  eyebrow: string;
  title: string;
  shortTitle: string;
  description: string;
};

export const ADMIN_SECTION_GROUPS: readonly {
  id: AdminSectionGroupId;
  eyebrow: string;
  title: string;
  description: string;
}[] = [
  { id: "daily", eyebrow: "DAILY OPERATIONS", title: "日常の管理", description: "問い合わせ対応、ユーザー承認、無料枠など、普段よく使う管理です。" },
  { id: "sales", eyebrow: "SALES & PROMOTION", title: "販売・告知", description: "販売受付、アップグレード導線、告知や販促素材を管理します。" },
  { id: "creation", eyebrow: "CONTENT & DEVELOPMENT", title: "制作・開発支援", description: "ユーザー向け副業プロンプト、開発依頼プロンプト、AASが参照するナレッジを整えます。" },
  { id: "system", eyebrow: "SYSTEM CONTROL", title: "システム・安全管理", description: "アップデート、管理者認証、インフラ使用量・料金、監査・障害対応を管理します。" },
] as const;

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    id: "inquiries",
    group: "daily",
    href: "/admin/inquiries",
    eyebrow: "SUPPORT INBOX",
    title: "問い合わせ確認",
    shortTitle: "問い合わせ",
    description: "ユーザーからの要望・不具合・質問を確認し、返信と対応状況を管理。",
  },
  {
    id: "users",
    group: "daily",
    href: "/admin/users",
    eyebrow: "USERS & ACCESS",
    title: "ユーザー・利用権",
    shortTitle: "ユーザー・利用権",
    description: "ユーザー承認、停止・再開、PWA利用権、利用コードの発行と管理。",
  },
  {
    id: "membership",
    group: "daily",
    href: "/admin/membership",
    eyebrow: "MEMBERSHIP",
    title: "メンバーシップ管理",
    shortTitle: "メンバーシップ",
    description: "noteメンバー特典の付与・取消、参加URL、プランごとの利用可能機能を管理。",
  },
  {
    id: "free-plan",
    group: "daily",
    href: "/admin/free-trial",
    eyebrow: "FREE PLAN",
    title: "無料利用・回数制限",
    shortTitle: "無料利用設定",
    description: "無料ユーザーの日次回数、リセット時刻、個別利用状況を管理。",
  },
  {
    id: "sales",
    group: "sales",
    href: "/admin/sales",
    eyebrow: "SALES",
    title: "販売・アップグレード導線",
    shortTitle: "販売設定",
    description: "外部購入URL、利用コード、PWA向けStripe販売スイッチを管理。",
  },
  {
    id: "promotion",
    group: "sales",
    href: "/admin/promotion",
    eyebrow: "PROMOTION",
    title: "販売・プロモーション",
    shortTitle: "プロモーション",
    description: "実運用テスト・公開予告から紹介記事、SNS投稿、販売キャンペーンまで作成。",
  },
  {
    id: "development-prompts",
    group: "creation",
    href: "/admin/development-prompts",
    eyebrow: "DEV PROMPT BUILDER",
    title: "開発依頼プロンプト",
    shortTitle: "開発依頼",
    description: "アップデート・修正・追加機能を対象画面まで絞り込み、ChatGPTへ渡すAAS開発依頼文を作成。",
  },
  {
    id: "prompts",
    group: "creation",
    href: "/admin/prompts",
    eyebrow: "PROMPT LIBRARY",
    title: "副業プロンプト管理",
    shortTitle: "副業プロンプト",
    description: "ユーザー向け副業プロンプト、カテゴリ、入力項目、推奨AI、公開状態を管理。",
  },
  {
    id: "knowledge",
    group: "creation",
    href: "/admin/knowledge",
    eyebrow: "KNOWLEDGE",
    title: "ナレッジ管理",
    shortTitle: "ナレッジ管理",
    description: "ジャンル・サブジャンル候補や学習候補を確認・承認。",
  },
  {
    id: "releases",
    group: "system",
    href: "/admin/releases",
    eyebrow: "RELEASE CONTROL",
    title: "アップデート管理",
    shortTitle: "アップデート",
    description: "管理者テスト版、ユーザー向け更新通知、必須更新、ロールバックを管理。",
  },
  {
    id: "features",
    group: "system",
    href: "/admin/features",
    eyebrow: "FEATURE CONTROL",
    title: "全機能管理センター",
    shortTitle: "機能管理",
    description: "全機能の公開段階、一般ユーザーテスト、メンテナンス停止・再開を一元管理。",
  },
  {
    id: "notifications",
    group: "system",
    href: "/admin/notifications",
    eyebrow: "NOTIFICATION CONTROL",
    title: "通知管理",
    shortTitle: "通知管理",
    description: "アップデート・メンテナンス・Knowledge更新・管理者からのお知らせを配信。",
  },
  {
    id: "security",
    group: "system",
    href: "/admin/security",
    eyebrow: "ADMIN MFA",
    title: "管理者MFA・認証器",
    shortTitle: "管理者MFA",
    description: "管理者のTOTP認証器を確認し、紛失対策用の予備認証器を管理。",
  },
  {
    id: "infrastructure",
    group: "system",
    href: "/admin/infrastructure",
    eyebrow: "INFRASTRUCTURE USAGE",
    title: "インフラ使用量・料金",
    shortTitle: "インフラ使用量",
    description: "SupabaseとGitHubの容量、残量、Actions利用状況、料金基準と公式Billing導線を確認。",
  },
  {
    id: "operations",
    group: "system",
    href: "/admin/operations",
    eyebrow: "SECURITY & OPS",
    title: "セキュリティ・運用",
    shortTitle: "セキュリティ・運用",
    description: "セキュリティ監査、容量監視、運用イベントとシステム状態を確認。",
  },
] as const;

export const ADMIN_HOME_SHORTCUT_IDS: readonly AdminSectionId[] = [
  "inquiries",
  "users",
  "membership",
  "free-plan",
  "sales",
  "development-prompts",
  "prompts",
  "releases",
  "features",
  "notifications",
  "security",
  "infrastructure",
  "operations",
];
