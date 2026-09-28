export type ToolCard = {
  href: string;
  category: string;
  title: string;
  description: string;
  badge?: string;
};

export type ToolGroup = {
  id: string;
  title: string;
  description: string;
  tools: readonly ToolCard[];
};

export const MEMBER_TOOL_GROUPS: readonly ToolGroup[] = [
  {
    id: "content",
    title: "記事・コンテンツ",
    description: "note・ブログ・コンテンツ販売など、文章を中心にした副業・発信をまとめています。",
    tools: [
      {
        href: "/note-operations",
        category: "note副業",
        title: "note運営アシスタント",
        description: "アカウント準備、プロフィール、無料・有料noteの投稿計画、メンバーシップの料金・特典相談、カレンダーと今日のToDoを管理します。",
        badge: "専用フロー",
      },
      {
        href: "/side-hustles/content-sales",
        category: "記事・ブログ",
        title: "記事・ブログ・コンテンツ販売",
        description: "媒体・商品形態・購入者・無料/有料境界を選び、販売設計から執筆ブリーフまで専用ウィザードで作成します。",
        badge: "専用機能",
      },
    ],
  },
  {
    id: "social-video",
    title: "SNS・動画・集客",
    description: "SNS運用、集客、YouTube・ショート動画など、発信と視聴者獲得に関する機能です。",
    tools: [
      {
        href: "/sns-plan",
        category: "SNS設計",
        title: "SNSアカウント設計",
        description: "ジャンル選定からプロフィール、投稿の柱、収益導線、改善までまとめて設計します。",
      },
      {
        href: "/sns",
        category: "SNS投稿",
        title: "SNS投稿を作る",
        description: "記事ライブラリからX・Instagram・Threads向け投稿プロンプトを作成します。",
      },
      {
        href: "/side-hustles/sns-management",
        category: "SNS副業",
        title: "SNS運用・集客",
        description: "SNS・アカウント段階・目的・投稿形式を選び、投稿の柱から4週間運用・検証まで専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/side-hustles/youtube-video",
        category: "動画副業",
        title: "YouTube・ショート動画",
        description: "動画形式・チャンネル段階・目的を選び、企画・台本・サムネイル・編集・検証まで専用設計します。",
        badge: "専用機能",
      },
    ],
  },
  {
    id: "sales",
    title: "販売・収益化",
    description: "アフィリエイト、物販、スキル販売、デジタル商品など、販売型の副業をまとめています。",
    tools: [
      {
        href: "/side-hustles/affiliate",
        category: "アフィリエイト",
        title: "アフィリエイト",
        description: "商品ジャンル・読者段階・比較方法を選び、共通比較軸・一次情報確認・CTAまで専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/side-hustles/resale",
        category: "物販・EC",
        title: "物販・フリマ販売",
        description: "販売先・商品カテゴリ・状態を選び、出品文・写真・梱包・発送・費用確認まで専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/side-hustles/skill-sales",
        category: "スキル販売",
        title: "スキル販売",
        description: "提供スキル・購入者課題・納品形式を選び、提供範囲・修正条件・販売ページ・FAQまで専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/side-hustles/digital-product",
        category: "デジタル商品",
        title: "デジタル商品・教材販売",
        description: "商品形式・購入者レベル・完成状態を選び、教材構成・テンプレート・販売ページ・更新項目まで専用設計します。",
        badge: "専用機能",
      },
    ],
  },
  {
    id: "client-work",
    title: "受託・案件獲得",
    description: "クラウドソーシング、営業、案件応募など、仕事を受注するための機能です。",
    tools: [
      {
        href: "/side-hustles/crowdsourcing",
        category: "クラウドソーシング",
        title: "クラウドソーシング",
        description: "案件種別・経験・納期を選び、要件適合・応募文・確認質問・納品工程まで専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/side-hustles/outreach",
        category: "営業・案件獲得",
        title: "営業・案件獲得",
        description: "相手・関係性・提案内容を選び、事前調査・初回連絡・質問・フォローアップまで専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/side-hustles/sidejob-planner",
        category: "副業診断",
        title: "AI副業プランナー",
        description: "時間・予算・得意分野・営業可否を選び、副業候補比較と30日検証計画を専用設計します。",
        badge: "専用機能",
      },
    ],
  },
  {
    id: "research-efficiency",
    title: "リサーチ・業務効率化",
    description: "調査、事実確認、繰り返し作業の標準化など、複数ジャンルで使える補助機能です。",
    tools: [
      {
        href: "/side-hustles/research",
        category: "リサーチ",
        title: "リサーチ・事実確認",
        description: "調査タイプ・意思決定・情報源・最新性を選び、検証可能な調査計画と事実確認手順を専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/side-hustles/workflow-efficiency",
        category: "業務効率化",
        title: "業務効率化・SOP化",
        description: "作業・現在状態・自動化範囲・リスクを選び、SOP・例外フロー・再利用テンプレートまで専用設計します。",
        badge: "専用機能",
      },
      {
        href: "/workflow",
        category: "作業整理",
        title: "AAS運営コックピット",
        description: "今日やること、公開前チェック、記事→SNS再利用、シリーズ設計を1つの流れで管理します。",
      },
    ],
  },
  {
    id: "operations",
    title: "運営・アカウント",
    description: "投稿先アカウントの設計や、継続運営に必要な設定をまとめています。",
    tools: [
      {
        href: "/account-design",
        category: "アカウント設計",
        title: "note / Tips / Brain アカウント作成",
        description: "表示名・ID候補・プロフィール・発信軸・初期投稿・専用アイコンまで媒体別に設計して保存します。",
      },
    ],
  },
  {
    id: "publish",
    title: "公開・分析",
    description: "公開後の記録と、蓄積したコンテンツの状況確認をまとめています。",
    tools: [
      {
        href: "/publish",
        category: "公開管理",
        title: "公開管理",
        description: "公開予定・公開済みURL・公開日時を記事ライブラリへ記録します。",
      },
      {
        href: "/analytics",
        category: "分析",
        title: "コンテンツ分析",
        description: "記事ストック、掲載先、状態、最近更新した記事をAAS内のデータから集計します。",
      },
    ],
  },
  {
    id: "support",
    title: "サポート",
    description: "困ったときの問い合わせや要望・不具合連絡はこちらです。",
    tools: [
      {
        href: "/inquiries",
        category: "サポート",
        title: "お問い合わせ",
        description: "追加機能要望、不具合、使い方、アカウント・購入関連を送信し、管理者からの返信を確認します。",
      },
    ],
  },
];

export const SIDE_HUSTLE_TOOL_TITLES = [
  "note運営アシスタント",
  "記事・ブログ・コンテンツ販売",
  "SNS運用・集客",
  "YouTube・ショート動画",
  "アフィリエイト",
  "物販・フリマ販売",
  "クラウドソーシング",
  "スキル販売",
  "デジタル商品・教材販売",
  "営業・案件獲得",
  "リサーチ・事実確認",
  "業務効率化・SOP化",
  "AI副業プランナー",
] as const;
