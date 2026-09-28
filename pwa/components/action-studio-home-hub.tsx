import Link from "next/link";

type ActionCard = {
  title: string;
  description: string;
  icon: string;
  href: string;
  badge?: string;
  tone?: "blue" | "violet" | "cyan" | "pink";
};

const primaryActions: readonly ActionCard[] = [
  {
    title: "記事生成",
    description: "掲載先・ジャンル・読者・文字数を選んで記事作成へ。",
    icon: "▧",
    href: "/create",
    tone: "blue",
  },
  {
    title: "画像生成",
    description: "アイキャッチ・挿絵用の画像プロンプトを準備。",
    icon: "▣",
    href: "/images",
    tone: "cyan",
  },
  {
    title: "プロンプトライブラリ",
    description: "すぐに使える補助プロンプトを検索・保存。",
    icon: "◇",
    href: "/prompts",
    tone: "violet",
  },
  {
    title: "記事ライブラリ",
    description: "作成した記事を管理・編集・画像管理。",
    icon: "▤",
    href: "/?section=library",
    tone: "pink",
  },
];

const quickActions: readonly ActionCard[] = [
  {
    title: "SNS投稿",
    description: "保存した記事からX・Instagram・Threads向け投稿を作成。",
    icon: "↗",
    href: "/sns",
    tone: "blue",
  },
  {
    title: "アカウント設計",
    description: "発信名・プロフィール・発信軸・初期投稿を媒体別に整える。",
    icon: "◫",
    href: "/account-design",
    tone: "violet",
  },
  {
    title: "運営コックピット",
    description: "今日の作業・公開前チェック・再利用をひとつの流れで確認。",
    icon: "◎",
    href: "/workflow",
    tone: "cyan",
  },
  {
    title: "note運営",
    description: "note向けの運用・投稿計画・メンバーシップ相談を専用フローで進める。",
    icon: "✦",
    href: "/note-operations",
    tone: "pink",
  },
  {
    title: "副業機能",
    description: "SNS・動画・販売・受託・リサーチなどをジャンル別に開く。",
    icon: "▦",
    href: "/tools",
    badge: "機能一覧",
    tone: "violet",
  },
];

function ActionCardView({ card, compact = false }: { card: ActionCard; compact?: boolean }) {
  return (
    <Link
      className={`action-studio-card action-studio-tone-${card.tone ?? "blue"} ${compact ? "compact" : ""}`}
      href={card.href}
    >
      <div className="action-studio-card-top">
        <span className="action-studio-card-icon" aria-hidden="true">{card.icon}</span>
        {card.badge ? <small>{card.badge}</small> : null}
      </div>
      <strong>{card.title}</strong>
      <p>{card.description}</p>
      <b>開く →</b>
    </Link>
  );
}

export function ActionStudioHomeHero() {
  return (
    <section className="action-studio-hero-shell" aria-labelledby="action-studio-hero-title">
      <div className="action-studio-hero">
        <div className="action-studio-hero-copy">
          <span className="action-studio-kicker">AI ACTION STUDIO</span>
          <h2 id="action-studio-hero-title">今日はAIで何を進めますか？</h2>
          <p>
            アイデアを、かたちに。記事・画像・SNS・副業の作業を、
            アクシアとルーモと一緒に進められます。
          </p>
          <div className="action-studio-hero-chips" aria-label="AASでできること">
            <span>✓ 記事・コンテンツ</span>
            <span>✓ 画像・SNS</span>
            <span>✓ 副業専用機能</span>
            <span>✓ ナレッジ更新</span>
          </div>
        </div>
        <div className="action-studio-character-caption" aria-label="AASイメージキャラクター">
          <strong>アクシア × ルーモ</strong>
          <small>ひらめきを、一緒に。もっと遠くへ。</small>
        </div>
      </div>

      <div className="action-studio-primary-grid" aria-label="主要機能">
        {primaryActions.map((card) => <ActionCardView key={card.title} card={card} compact />)}
      </div>
    </section>
  );
}

export function ActionStudioQuickActions({ showAdmin = false }: { showAdmin?: boolean }) {
  const cards: readonly ActionCard[] = showAdmin
    ? [
        ...quickActions,
        {
          title: "管理者ツール",
          description: "ユーザー・メンバーシップ・インフラ使用量・システム運用を管理。",
          icon: "⚙",
          href: "/admin",
          badge: "ADMIN",
          tone: "blue",
        },
      ]
    : quickActions;

  return (
    <section className="action-studio-hub action-studio-quick-actions" aria-labelledby="action-studio-quick-title">
      <div className="action-studio-section-head">
        <div>
          <span>QUICK ACTIONS</span>
          <h3 id="action-studio-quick-title">よく使う機能</h3>
        </div>
        <p>ユーザー情報や記事ライブラリを確認したあと、必要な機能を直接開けます。</p>
      </div>
      <div className="action-studio-card-grid">
        {cards.map((card) => <ActionCardView key={card.title} card={card} />)}
      </div>
    </section>
  );
}

export function ActionStudioHomeHub({ showAdmin = false }: { showAdmin?: boolean }) {
  return (
    <>
      <ActionStudioHomeHero />
      <ActionStudioQuickActions showAdmin={showAdmin} />
    </>
  );
}
