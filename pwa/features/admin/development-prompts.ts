export type AdminDevelopmentRequestType =
  | "update"
  | "fix"
  | "feature"
  | "refactor"
  | "security"
  | "test";

export type AdminDevelopmentArea =
  | "ui"
  | "auth"
  | "article"
  | "image"
  | "sns"
  | "note"
  | "account_design"
  | "admin"
  | "database"
  | "release"
  | "navigation"
  | "other";

export type AdminDevelopmentPromptInput = {
  requestType: AdminDevelopmentRequestType;
  area: AdminDevelopmentArea;
  target: string;
  subTarget: string;
  details: string;
  currentBehavior: string;
  expectedBehavior: string;
};

export const DEVELOPMENT_REQUEST_TYPES: readonly { value: AdminDevelopmentRequestType; label: string; instruction: string }[] = [
  { value: "update", label: "アップデート", instruction: "既存機能を維持しながら改善・更新する" },
  { value: "fix", label: "修正", instruction: "原因を特定して不具合を最小差分で修正する" },
  { value: "feature", label: "追加機能", instruction: "既存設計へ自然に統合した新機能を追加する" },
  { value: "refactor", label: "コード整理", instruction: "挙動を変えず保守性を改善する" },
  { value: "security", label: "セキュリティ", instruction: "認可を弱めず安全性を改善する" },
  { value: "test", label: "テスト・検証", instruction: "再現条件を確認し回帰テストを追加・実行する" },
] as const;

export const DEVELOPMENT_AREAS: readonly { value: AdminDevelopmentArea; label: string }[] = [
  { value: "ui", label: "UI・画面" },
  { value: "auth", label: "認証・ログイン" },
  { value: "article", label: "記事作成・ライブラリ" },
  { value: "image", label: "画像・画像計画" },
  { value: "sns", label: "SNS" },
  { value: "note", label: "note運営" },
  { value: "account_design", label: "アカウント設計・プリセット" },
  { value: "admin", label: "管理者機能" },
  { value: "database", label: "Supabase・DB・RLS" },
  { value: "release", label: "アップデート・Preview・公開" },
  { value: "navigation", label: "ナビゲーション" },
  { value: "other", label: "その他" },
] as const;

export const DEVELOPMENT_TARGETS: Readonly<Record<AdminDevelopmentArea, readonly string[]>> = {
  ui: ["ホーム", "設定", "記事作成", "記事ライブラリ", "運営コックピット", "note運営アシスタント", "アカウント設計", "画像作成", "SNS", "ランキング", "プロフィール", "お問い合わせ", "管理者ダッシュボード", "その他のUI"],
  auth: ["ログイン", "新規登録", "Google OAuth", "セッション保持", "利用権判定", "管理者判定", "その他の認証"],
  article: ["記事作成ウィザード", "タイトル生成", "本文生成", "プリセット", "記事ライブラリ", "公開管理", "公開前チェック", "シリーズ設計"],
  image: ["アイキャッチ", "挿絵", "画像計画", "画像プロンプト", "画像ファイル", "その他の画像機能"],
  sns: ["SNS投稿作成", "X", "Instagram", "Threads", "TikTok", "YouTube Shorts", "記事→SNS再利用", "SNSアカウント設計"],
  note: ["プロフィール設計", "月間運営計画", "カレンダー", "今日やること", "無料note", "有料note", "AAS公式運営"],
  account_design: ["共通プリセット", "noteアカウント", "Tipsアカウント", "Brainアカウント", "アカウント一括作成", "アイコン設計"],
  admin: ["ユーザー管理", "問い合わせ", "販売・プロモーション", "ナレッジ", "アップデート管理", "セキュリティ・運用", "無料利用設定", "販売設定", "管理者ツール"],
  database: ["テーブル", "RLS", "RPC", "Migration", "Storage", "インデックス", "監査ログ"],
  release: ["Preview", "Member Beta", "Production", "更新通知", "候補版", "ロールバック", "Cloudflare Worker"],
  navigation: ["スマホ下部ナビ", "デスクトップナビ", "管理者ナビ", "ルート遷移", "ローディング表示"],
  other: ["その他"],
} as const;

export const DEVELOPMENT_SUBTARGETS: Readonly<Record<string, readonly string[]>> = {
  "ホーム": ["ヘッダー", "クイックスタート", "機能カード", "今日の表示", "通知", "下部ナビ", "レスポンシブ"],
  "設定": ["共通プリセット", "アカウント別プリセット", "表示・ナビ", "AI・文章の好み", "アカウント・ヘルプ", "収納/アコーディオン"],
  "記事作成": ["ステップUI", "入力フォーム", "プリセット反映", "タイトル候補", "本文生成", "画像計画", "保存"],
  "記事ライブラリ": ["一覧", "検索・絞り込み", "詳細", "編集", "公開前チェック", "SNS再利用"],
  "運営コックピット": ["今日やること", "公開前チェック", "SNS再利用", "シリーズ設計"],
  "note運営アシスタント": ["アカウント準備", "プロフィール", "運営計画", "カレンダー", "AI取込"],
  "アカウント設計": ["基本設計", "アカウント別プリセット", "プロフィール", "一括作成", "アイコン"],
  "画像作成": ["アイキャッチ", "挿絵", "枚数", "画像プロンプト", "保存"],
  "SNS": ["媒体選択", "文字数", "トーン", "投稿案", "CTA"],
  "管理者ダッシュボード": ["機能一覧", "通知", "ショートカット", "管理者限定表示"],
  "ログイン": ["Email/Password", "Google", "エラー表示", "ログイン保持"],
  "新規登録": ["入力項目", "規約同意", "pending", "AAS ID"],
  "Google OAuth": ["PKCE", "コールバック", "state", "セッション"],
  "スマホ下部ナビ": ["5枠レイアウト", "4枠カスタマイズ", "管理者機能", "全画面共通", "保存"],
  "共通プリセット": ["プリセット選択", "機能別ON/OFF", "AAS公式", "アカウント別プリセット", "クラウド保存"],
  "RLS": ["SELECT", "INSERT", "UPDATE", "DELETE", "所有者境界", "active admin判定"],
  "Preview": ["CI", "Cloudflare Worker", "Preview URL", "回帰テスト"],
} as const;

export function developmentSubTargets(target: string): readonly string[] {
  return DEVELOPMENT_SUBTARGETS[target] ?? ["対象全体", "その他・自由入力"];
}

function labelFor<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string {
  return options.find((item) => item.value === value)?.label ?? value;
}

export function buildAdminDevelopmentPrompt(input: AdminDevelopmentPromptInput): string {
  const request = DEVELOPMENT_REQUEST_TYPES.find((item) => item.value === input.requestType);
  const requestLabel = request?.label ?? input.requestType;
  const areaLabel = labelFor(DEVELOPMENT_AREAS, input.area);
  const target = input.target.trim() || "対象未指定";
  const subTarget = input.subTarget.trim() || "対象全体";
  const details = input.details.trim() || "ここに入力した依頼内容を実装してください。";
  const lines = [
    "AI Action Studio（AAS）の開発作業を行ってください。",
    "",
    "【依頼種別】",
    requestLabel,
    "- " + (request?.instruction ?? "指定内容に沿って対応する"),
    "",
    "【対象】",
    "- 分野: " + areaLabel,
    "- 対象画面・機能: " + target,
    "- 詳細箇所: " + subTarget,
    "",
    "【依頼内容】",
    details,
  ];

  if (input.currentBehavior.trim()) {
    lines.push("", "【現在の状態・症状】", input.currentBehavior.trim());
  }
  if (input.expectedBehavior.trim()) {
    lines.push("", "【期待する状態】", input.expectedBehavior.trim());
  }

  lines.push(
    "",
    "【必須の進め方】",
    "1. 推測だけで変更せず、現在のGitHubブランチ・PR・HEAD・CIと関連実装を確認する。",
    "2. 既存の正常機能を壊さない最小差分を優先する。",
    "3. 実装中にエラー・不具合・型エラー・Lintエラー・回帰を見つけた場合は、その原因を確認して今回の変更に関連するものを修正する。",
    "4. 認証・認可・RLS・所有者境界・active admin判定を弱めない。",
    "5. service_role、Secret、Access/Refresh Token、Cookie、認証コード等をクライアント・ログ・成果物へ追加しない。",
    "6. Supabaseを変更する場合はMigrationを作成し、RLS、権限、Advisor、実DB状態を確認する。",
    "7. UI変更はPC・スマホの両方を確認し、既存のAASデザインと共通ナビを維持する。",
    "8. Typecheck、Lint、Build、回帰テストを実行し、失敗した場合は原因を修正して再実行する。",
    "9. Previewで安全に確認し、明示的な指示がない限りmainへの直接反映、Member Beta、Production公開、DNS/本番ルーティング変更は行わない。",
    "10. 最後に変更内容、修正した不具合、テスト結果、残っている注意点を簡潔に報告する。",
    "",
    "【AAS既存機能の保護】",
    "- Email/Password、Google OAuth / PKCE、ログイン保持",
    "- profiles / RLS / AASユーザーID / User・Admin分離",
    "- 記事作成、記事ライブラリ、Web AI、画像計画、SNS、note運営、アカウント設計",
    "- 共通プリセット、運営コックピット、問い合わせ、管理者機能",
    "- PWA更新・Preview・リリース安全境界",
    "",
    "必要な関連ファイルを確認し、実装 → テスト → 修正 → 最終Preview確認まで進めてください。",
  );

  return lines.join("\n");
}
