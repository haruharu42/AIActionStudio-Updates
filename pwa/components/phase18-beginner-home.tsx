"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AasReferenceBottomNav, AasReferenceHeader } from "@/components/aas-reference-shell";
import { DirectRuntimeImage } from "@/components/direct-runtime-image";
import { ActionStudioHomeHero, ActionStudioQuickActions } from "@/components/action-studio-home-hub";
import { useSharedAccessState } from "@/components/access-state-provider";
import { useAppFeatureAccess } from "@/components/feature-access-gate";
import { Phase7App } from "@/components/phase6-app";
import { Phase7Library } from "@/components/phase7-library";
import { NoteTodayPanel } from "@/components/note-today-panel";
import { ReleasePreviewHomeStatus } from "@/components/release-preview-home-status";
import { AI_APP_LINKS, launchAiApp, type AiAppKey } from "@/lib/ai-app-links";
import {
  getCreatorRanking,
  getMyCreatorDashboard,
  getMyCreatorMissions,
  xpProgress,
  type CreatorDashboard,
  type CreatorMission,
  type RankingRow,
} from "@/lib/creator-system";
import { listCloudArticles, type ArticleStatus, type ArticleSummary } from "@/lib/phase7-articles";
import { getSupportNotificationSummary } from "@/lib/support-center";
import {
  createDefaultHomeWidgetPreferences,
  loadHomeWidgetPreferences,
  parseHomeWidgetPreferences,
  type HomeWidgetItem,
  type HomeWidgetKey,
} from "@/lib/home-widget-preferences";
import {
  AGE_GROUP_OPTIONS,
  GENDER_OPTIONS,
  GENRE_OPTIONS,
  TARGET_LENGTH_OPTIONS,
  subgenreOptionsFor,
} from "@/lib/phase18-content-options";

type Section = "home" | "library";

type QuickSetup = {
  publicationTarget: "note" | "tips" | "brain" | "blog";
  articleType: "free" | "paid";
  genre: string;
  subgenre: string;
  ageGroup: string;
  gender: string;
  targetLength: number;
  inlineCount: number;
};

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "下書き",
  writing: "作成中",
  ready: "完成",
  waiting_publish: "公開待ち",
  published: "公開済み",
  on_hold: "保留",
  archived: "保管済み",
};

const QUICK_SETUP_INITIAL: QuickSetup = {
  publicationTarget: "note",
  articleType: "free",
  genre: "AI副業",
  subgenre: "AIおまかせ",
  ageGroup: "30代",
  gender: "AIおまかせ",
  targetLength: 5000,
  inlineCount: 2,
};

function avatarLetter(value: string): string {
  return (value.trim().charAt(0) || "A").toUpperCase();
}

function QuickSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="beginner-quick-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function AiLaunchCard({ appKey }: { appKey: AiAppKey }) {
  const app = AI_APP_LINKS[appKey];
  const mark = appKey === "chatgpt" ? "◎" : appKey === "claude" ? "✳" : "✦";
  return (
    <button className={`beginner-ai-card ${appKey}`} type="button" onClick={() => launchAiApp(appKey)}>
      <span aria-hidden="true">{mark}</span>
      <strong>{app.name}</strong>
      <small>{app.description}</small>
      <b aria-hidden="true">↗</b>
    </button>
  );
}

function HomeWidgetSlot({
  layout,
  widgetKey,
  children,
}: {
  layout: readonly HomeWidgetItem[];
  widgetKey: HomeWidgetKey;
  children: ReactNode;
}) {
  const order = layout.findIndex((item) => item.key === widgetKey);
  const item = order >= 0 ? layout[order] : null;
  if (!item?.visible) return null;

  return (
    <div
      className={"home-widget-slot " + item.size}
      data-home-widget={widgetKey}
      style={{ order }}
    >
      {children}
    </div>
  );
}

function BeginnerAccessFallback({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <div className="reference-home">
      <AasReferenceHeader showVersion />
      <main className="reference-home-main">
        {unavailable ? (
          <section className="beginner-recommend" role="alert">
            <div>
              <span className="beginner-recommend-label">CONNECTION</span>
              <h2>接続状態を確認できませんでした</h2>
              <p>通信状態を確認して、もう一度読み込んでください。</p>
            </div>
            <button type="button" onClick={() => window.location.reload()}>再読み込み</button>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function MissionRows({ missions }: { missions: CreatorMission[] }) {
  const visible = missions.slice(0, 3);
  if (!visible.length) return <p className="beginner-right-muted">現在表示できるミッションはありません。</p>;
  return (
    <div className="reference-mission-list">
      {visible.map((mission) => (
        <Link className={`reference-mission-row ${mission.completed ? "done" : ""}`} href="/missions" key={mission.missionCode}>
          <span aria-hidden="true">{mission.completed ? "✓" : "○"}</span>
          <span>
            <strong>{mission.title}</strong>
            <small>{mission.description}</small>
          </span>
          <b>+{mission.rewardXp} XP</b>
        </Link>
      ))}
    </div>
  );
}

export function Phase18BeginnerHome() {
  const { state, client } = useSharedAccessState();
  const articleLibraryAccess = useAppFeatureAccess("article-library");
  const [section, setSection] = useState<Section>("home");
  const [imageUnsaved, setImageUnsaved] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [recentArticles, setRecentArticles] = useState<ArticleSummary[] | null>(null);
  const [recentArticlesError, setRecentArticlesError] = useState(false);
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState(false);
  const [missions, setMissions] = useState<CreatorMission[]>([]);
  const [missionsLoaded, setMissionsLoaded] = useState(false);
  const [missionsError, setMissionsError] = useState(false);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingLoaded, setRankingLoaded] = useState(false);
  const [rankingError, setRankingError] = useState(false);
  const [quickSetup, setQuickSetup] = useState<QuickSetup>(QUICK_SETUP_INITIAL);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [homeWidgetPreferences, setHomeWidgetPreferences] = useState(() => createDefaultHomeWidgetPreferences());
  const [homeWidgetTarget, setHomeWidgetTarget] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const syncTarget = () => setHomeWidgetTarget(media.matches ? "mobile" : "desktop");
    syncTarget();
    media.addEventListener("change", syncTarget);
    return () => media.removeEventListener("change", syncTarget);
  }, []);

  useEffect(() => {
    if (state.kind !== "ready" || !client) return;
    let active = true;
    void loadHomeWidgetPreferences(client, state.profile.id).then(
      (value) => {
        if (active) setHomeWidgetPreferences(value);
      },
      () => {
        if (active) setHomeWidgetPreferences(createDefaultHomeWidgetPreferences());
      },
    );
    return () => { active = false; };
  }, [client, state]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      setHomeWidgetPreferences(parseHomeWidgetPreferences(event.detail));
    };
    window.addEventListener("aas:home-widgets-updated", handleUpdate);
    return () => window.removeEventListener("aas:home-widgets-updated", handleUpdate);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("section") !== "library") return;
    queueMicrotask(() => setSection("library"));
  }, []);

  useEffect(() => {
    if (state.kind !== "ready" || !client) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setRecentArticlesError(false);
      setDashboardError(false);
      setMissionsLoaded(false);
      setMissionsError(false);
      setRankingLoaded(false);
      setRankingError(false);
    });
    void listCloudArticles(client, state.profile.id, 3).then(
      (articles) => {
        if (!active) return;
        setRecentArticles(articles);
        setRecentArticlesError(false);
      },
      () => {
        if (!active) return;
        setRecentArticles([]);
        setRecentArticlesError(true);
      },
    );
    void getMyCreatorDashboard(client).then(
      (value) => {
        if (!active) return;
        setDashboard(value);
        setDashboardError(false);
      },
      () => {
        if (!active) return;
        setDashboard(null);
        setDashboardError(true);
      },
    );
    void getMyCreatorMissions(client).then(
      (value) => {
        if (!active) return;
        setMissions(value);
        setMissionsLoaded(true);
      },
      () => {
        if (!active) return;
        setMissions([]);
        setMissionsLoaded(true);
        setMissionsError(true);
      },
    );
    void getCreatorRanking(client, "level", 50).then(
      (value) => {
        if (!active) return;
        setRanking(value);
        setRankingLoaded(true);
      },
      () => {
        if (!active) return;
        setRanking([]);
        setRankingLoaded(true);
        setRankingError(true);
      },
    );
    void getSupportNotificationSummary(client).then(
      (value) => {
        if (active) setSupportUnreadCount(value.unreadCount);
      },
      () => {
        if (active) setSupportUnreadCount(0);
      },
    );
    return () => { active = false; };
  }, [client, state]);


  const quickSubgenres = useMemo(() => subgenreOptionsFor(quickSetup.genre), [quickSetup.genre]);
  const quickCreateHref = useMemo(() => {
    const params = new URLSearchParams({
      publicationTarget: quickSetup.publicationTarget,
      articleType: quickSetup.articleType,
      genre: quickSetup.genre,
      subgenre: quickSetup.subgenre,
      ageGroup: quickSetup.ageGroup,
      gender: quickSetup.gender,
      targetLength: String(quickSetup.targetLength),
      inlineCount: String(quickSetup.inlineCount),
      from: "home-quick-setup",
    });
    return `/create?${params.toString()}`;
  }, [quickSetup]);

  const creatorXp = useMemo(
    () => dashboard ? xpProgress(dashboard.totalXp, dashboard.level) : null,
    [dashboard],
  );
  const myRank = useMemo(() => ranking.find((row) => row.isMe) ?? null, [ranking]);
  const homeWidgetLayout = homeWidgetTarget === "mobile"
    ? homeWidgetPreferences.mobileLayout
    : homeWidgetPreferences.desktopLayout;

  if (state.kind === "loading") return <BeginnerAccessFallback />;
  if (state.kind === "unavailable") return <BeginnerAccessFallback unavailable />;
  if (state.kind !== "ready") return <Phase7App />;
  if (!client) return <BeginnerAccessFallback />;

  const profile = state.profile;
  const displayName = dashboard?.publicName || profile.display_name || "ユーザー";
  const activeAdmin = profile.role === "admin" && profile.status === "active";
  const supportNotificationHref = activeAdmin ? "/admin/inquiries" : "/inquiries";
  const hasSupportNotification = supportUnreadCount > 0;
  const headerNotificationHref = hasSupportNotification ? supportNotificationHref : "/missions";
  const headerNotificationLabel = hasSupportNotification
    ? `問い合わせ通知 ${supportUnreadCount}件`
    : "ミッション・お知らせ";
  const hasHeaderNotification = Boolean(dashboard?.claimableMissions) || hasSupportNotification;
  const mayLeave = () => !imageBusy && (!imageUnsaved || window.confirm("未保存の画像情報・選択した画像を破棄して移動しますか？"));

  const openSection = (next: Section) => {
    if (next !== section && !mayLeave()) return;
    setSection(next);
    window.history.replaceState({}, "", next === "library" ? "/?section=library" : "/");
  };

  const setQuickGenre = (genre: string) => {
    const nextSubgenres = subgenreOptionsFor(genre);
    setQuickSetup((current) => ({
      ...current,
      genre,
      subgenre: nextSubgenres.includes(current.subgenre) ? current.subgenre : nextSubgenres[0] ?? "AIおまかせ",
    }));
  };

  if (section === "library" && articleLibraryAccess.loading) {
    return <BeginnerAccessFallback />;
  }

  if (section === "library" && !articleLibraryAccess.allowed) {
    const message = articleLibraryAccess.feature?.maintenanceMessage
      || (articleLibraryAccess.feature?.maintenanceMode
        ? "記事ライブラリは現在メンテナンス中です。修正確認後に再開します。"
        : "記事ライブラリは現在、管理者または指定テストユーザーで動作確認中です。");
    return (
      <div className="reference-home">
        <AasReferenceHeader showVersion hasUnreadNotifications={hasHeaderNotification} notificationHref={headerNotificationHref} notificationLabel={headerNotificationLabel} />
        <main className="reference-home-main beginner-library-main">
          <section className="standalone-card feature-unavailable-card">
            <p className="eyebrow">{articleLibraryAccess.feature?.maintenanceMode ? "MAINTENANCE" : "FEATURE PREVIEW"}</p>
            <h1>記事ライブラリ</h1>
            <p className="route-notice">{message}</p>
            <button className="primary-action" type="button" onClick={() => openSection("home")}>ホームへ戻る</button>
          </section>
        </main>
        <AasReferenceBottomNav active="library" onHome={() => openSection("home")} onLibrary={() => openSection("library")} />
      </div>
    );
  }

  if (section === "library") {
    return (
      <div className="reference-home">
        <AasReferenceHeader showVersion hasUnreadNotifications={hasHeaderNotification} notificationHref={headerNotificationHref} notificationLabel={headerNotificationLabel} />
        <main className="reference-home-main beginner-library-main">
          <div className="beginner-library-toolbar">
            <button type="button" onClick={() => openSection("home")}>← ホーム</button>
            <Link href="/create">＋ 新しい記事を作る</Link>
          </div>
          <Phase7Library
            client={client}
            ownerId={profile.id}
            onUnsavedChange={setImageUnsaved}
            onBusyChange={setImageBusy}
          />
        </main>
        <AasReferenceBottomNav active="library" onHome={() => openSection("home")} onLibrary={() => openSection("library")} />
      </div>
    );
  }

  return (
    <div className="reference-home">
      <AasReferenceHeader showVersion hasUnreadNotifications={hasHeaderNotification} notificationHref={headerNotificationHref} notificationLabel={headerNotificationLabel} />
      <main className="reference-home-main">
        <div className="reference-home-heading">
          <h1>⌂ ホーム</h1>
          <p>AIで副業を、もっと簡単に。</p>
        </div>

        <div className="home-widget-grid">
        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="creator">
        <section className="reference-creator-card" aria-label="Creatorステータス">
          <span className="reference-avatar" aria-hidden="true">
            {dashboard?.avatarUrl ? <DirectRuntimeImage src={dashboard.avatarUrl} alt="" /> : avatarLetter(displayName)}
          </span>
          <div className="reference-creator-main">
            <div className="reference-name-row">
              <strong>{displayName}</strong>
              <span className="reference-level-pill">♛ Creator {dashboard ? `Lv.${dashboard.level}` : "—"}</span>
            </div>
            {creatorXp ? (
              <>
                <div className="reference-xp-row">
                  <div className="reference-xp-track" aria-label={`レベル進捗 ${creatorXp.percent}%`}>
                    <span style={{ width: `${creatorXp.percent}%` }} />
                  </div>
                  <b>{creatorXp.current} / {creatorXp.needed} XP</b>
                </div>
                <small className="reference-xp-note">あと {Math.max(0, creatorXp.needed - creatorXp.current)} XPで次のレベルです。</small>
              </>
            ) : <small className="reference-xp-note">Creatorデータを取得できませんでした。</small>}
          </div>
          <div className="reference-streak">
            <strong>🔥 {dashboard ? `${dashboard.currentStreak}日連続` : "—"}</strong>
            <small>継続は力なり！</small>
          </div>
        </section>
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="todayNote">
          <NoteTodayPanel client={client} ownerId={profile.id} />
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="missions">
        <section className="reference-home-section">
          <div className="reference-section-heading">
            <h2>🎯 今日のミッション</h2>
            <Link href="/missions">すべて見る ›</Link>
          </div>
          {missionsError ? (
            <p className="beginner-right-muted" role="alert">ミッションを取得できませんでした。再読み込みしてお試しください。</p>
          ) : !missionsLoaded ? (
            <p className="beginner-right-muted" role="status" aria-live="polite">ミッションを読み込んでいます…</p>
          ) : (
            <MissionRows missions={missions.filter((mission) => mission.cadence === "daily").length ? missions.filter((mission) => mission.cadence === "daily") : missions} />
          )}
        </section>
        </HomeWidgetSlot>

        {dashboard && (
          <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="membership">
          <section className="reference-home-section">
            <div className="reference-member-banner">
              <span aria-hidden="true">♛</span>
              <div>
                <strong>{dashboard.noteMember ? dashboard.membershipPlanName || "Creator Club" : "Creator Level 特典"}</strong>
                <small>
                  {dashboard.noteMember
                    ? `記事XP ×${dashboard.articleXpMultiplier.toFixed(1)}・記事枠 +${dashboard.membershipArticleQuotaBonus}`
                    : `レベルに応じて記事ストック上限が増えます。現在 +${dashboard.creatorArticleQuotaBonus}`}
                </small>
              </div>
              <Link href="/membership">特典を見る ›</Link>
            </div>
          </section>
          </HomeWidgetSlot>
        )}

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="library">
        <section className="reference-home-section">
          <div className="reference-section-heading">
            <h2>▤ 記事ライブラリ / noteマガジン</h2>
            <button type="button" className="reference-link-button" onClick={() => openSection("library")}>ライブラリを開く ›</button>
          </div>
          {dashboard && (
            <div className="reference-magazine-summary">
              <div><small>完成マガジン</small><strong>{dashboard.completedMagazines}</strong></div>
              <div><small>完成記事</small><strong>{dashboard.completedArticles}</strong></div>
              <div><small>今週XP</small><strong>{dashboard.weeklyXp}</strong></div>
            </div>
          )}
          {recentArticlesError ? (
            <p className="beginner-right-muted" role="alert">最近の記事を取得できませんでした。再読み込みしてお試しください。</p>
          ) : recentArticles === null ? (
            <p className="beginner-right-muted" role="status" aria-live="polite">最近の記事を読み込んでいます…</p>
          ) : recentArticles.length ? (
            <div className="reference-recent-list">
              {recentArticles.map((article) => (
                <button key={article.id} type="button" onClick={() => openSection("library")}>
                  <span>▧</span>
                  <span><strong>{article.title || "無題の記事"}</strong><small>{article.publicationTarget} · {STATUS_LABELS[article.status]}</small></span>
                  <b>›</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="reference-empty-inline">
              <strong>まだ記事がありません</strong>
              <Link href="/create">最初の記事を作る →</Link>
            </div>
          )}
        </section>
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="releaseStatus">
          <ReleasePreviewHomeStatus />
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="hero">
          <ActionStudioHomeHero />
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="quickStart">
        <section className="reference-home-section">
          <div className="reference-section-heading">
            <h2>⚡ クイックスタート / 使い方</h2>
            <Link href="/manual">詳しい使い方 ›</Link>
          </div>
          <div className="reference-quick-grid">
            <Link className="reference-quick-step" href="/create"><span>1</span><b>▧</b><strong>条件を選ぶ</strong><small>掲載先やジャンルをプルダウンで選択</small></Link>
            <Link className="reference-quick-step" href="/create"><span>2</span><b>✎</b><strong>記事を作る</strong><small>AI用プロンプトまたは手入力で作成</small></Link>
            <button className="reference-quick-step" type="button" onClick={() => openSection("library")}><span>3</span><b>✓</b><strong>保存して管理</strong><small>ライブラリで編集・画像管理</small></button>
          </div>
          <div className="reference-help-links">
            <Link className="secondary" href="/manual">使い方を見る</Link>
            <Link href="/faq">Q&A・よくある質問</Link>
          </div>
        </section>
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="articleSetup">
        <section className="reference-home-section beginner-quick-setup" aria-labelledby="quick-setup-title">
          <div className="beginner-card-title">
            <div><span aria-hidden="true">⚙</span><div><h2 id="quick-setup-title">記事の基本設定</h2><p>よく使う条件をプルダウンで選び、そのまま記事作成へ進めます。</p></div></div>
            <button type="button" onClick={() => setQuickSetup(QUICK_SETUP_INITIAL)}>↻ リセット</button>
          </div>
          <div className="beginner-quick-grid">
            <QuickSelect label="掲載先" value={quickSetup.publicationTarget} onChange={(value) => setQuickSetup((current) => ({ ...current, publicationTarget: value as QuickSetup["publicationTarget"] }))}><option value="note">note</option><option value="tips">Tips</option><option value="brain">Brain</option><option value="blog">ブログ</option></QuickSelect>
            <QuickSelect label="記事タイプ" value={quickSetup.articleType} onChange={(value) => setQuickSetup((current) => ({ ...current, articleType: value as QuickSetup["articleType"] }))}><option value="free">無料記事</option><option value="paid">有料記事</option></QuickSelect>
            <QuickSelect label="ジャンル" value={quickSetup.genre} onChange={setQuickGenre}>{GENRE_OPTIONS.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</QuickSelect>
            <QuickSelect label="サブジャンル" value={quickSetup.subgenre} onChange={(value) => setQuickSetup((current) => ({ ...current, subgenre: value }))}>{quickSubgenres.map((subgenre) => <option key={subgenre} value={subgenre}>{subgenre}</option>)}</QuickSelect>
            <QuickSelect label="対象年齢" value={quickSetup.ageGroup} onChange={(value) => setQuickSetup((current) => ({ ...current, ageGroup: value }))}>{AGE_GROUP_OPTIONS.map((age) => <option key={age} value={age}>{age}</option>)}</QuickSelect>
            <QuickSelect label="性別" value={quickSetup.gender} onChange={(value) => setQuickSetup((current) => ({ ...current, gender: value }))}>{GENDER_OPTIONS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}</QuickSelect>
            <QuickSelect label="文字数目安" value={quickSetup.targetLength} onChange={(value) => setQuickSetup((current) => ({ ...current, targetLength: Number(value) }))}>{TARGET_LENGTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</QuickSelect>
            <QuickSelect label="挿絵枚数" value={quickSetup.inlineCount} onChange={(value) => setQuickSetup((current) => ({ ...current, inlineCount: Number(value) }))}><option value={0}>なし</option><option value={1}>1枚</option><option value={2}>2枚</option><option value={3}>3枚</option><option value={4}>4枚</option><option value={5}>5枚</option></QuickSelect>
          </div>
          <Link className="beginner-quick-start" href={quickCreateHref}>この条件で記事作成を始める →</Link>
        </section>
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="aiApps">
        <section className="reference-home-section">
          <div className="reference-section-heading"><h2>🔗 AIアプリを開く</h2><Link href="/tools">すべての機能 ›</Link></div>
          <div className="beginner-ai-grid"><AiLaunchCard appKey="chatgpt" /><AiLaunchCard appKey="claude" /><AiLaunchCard appKey="gemini" /></div>
          <p className="reference-ai-note">iPhone / iPadでは「アプリを開く」と「Web版を開く」を選べます。Androidはアプリを優先し、開けない場合はGoogle Playの公式ページへ移動します。PCではWeb版を開きます。</p>
          <div className="reference-feature-links">
            <Link href="/workflow"><span>◎</span><strong>運営コックピット</strong><small>今日の作業・公開前チェック・再利用</small></Link>
            <Link href="/images"><span>▧</span><strong>画像作成</strong><small>アイキャッチ・挿絵を準備</small></Link>
            <Link href="/sns"><span>↗</span><strong>SNS投稿</strong><small>記事から投稿文を作成</small></Link>
          </div>
        </section>
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="ranking">
        <section className="reference-home-section">
          <div className="reference-section-heading"><h2>🏆 週間ランキング</h2><Link href="/ranking">ランキングを見る ›</Link></div>
          <div className="reference-rank-summary">
            <span aria-hidden="true">🏆</span>
            <div>
              <strong>{rankingError || dashboardError ? "ランキング情報を取得できません" : dashboard ? (dashboard.rankingOptIn ? "あなたの現在の順位" : "ランキングは現在非参加") : "ランキングを読み込んでいます…"}</strong>
              <b>{myRank ? `第 ${myRank.rankPosition} 位` : rankingLoaded && dashboard?.rankingOptIn ? (ranking.length ? "圏外" : "未集計") : "—"}</b>
            </div>
            <Link href="/profile">{dashboard?.rankingOptIn ? "公開設定 ›" : "プロフィール設定 ›"}</Link>
          </div>
        </section>
        </HomeWidgetSlot>

        <HomeWidgetSlot layout={homeWidgetLayout} widgetKey="quickActions">
          <ActionStudioQuickActions showAdmin={activeAdmin} />
        </HomeWidgetSlot>
        </div>

      </main>

      <AasReferenceBottomNav active="home" onLibrary={() => openSection("library")} />
    </div>
  );
}
