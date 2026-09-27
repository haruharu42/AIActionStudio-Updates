"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { useAppFeatureAccess } from "@/components/feature-access-gate";
import { HomeWidgetCustomizer } from "@/components/home-widget-customizer";
import { MobileNavCustomizer } from "@/components/mobile-nav-customizer";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { WorkspacePresetSettings } from "@/features/presets/workspace-preset-settings";
import { signOutCurrentBrowser } from "@/lib/auth-session";
import { readMobileNavAlways, writeMobileNavAlways } from "@/lib/mobile-nav-preference";
import { getSupabaseClient } from "@/lib/supabase";
import {
  AI_PLAN_LABELS,
  AI_PROVIDER_LABELS,
  createDefaultWritingProfile,
  loadWritingProfile,
  resetWritingProfile,
  saveWritingProfile,
  summarizeWritingProfile,
  type AiPlan,
  type AiProvider,
  type CtaStyle,
  type HeadingStyle,
  type ListPreference,
  type PreferredPlatform,
  type UserWritingProfile,
  type WritingTone,
} from "@/lib/user-personalization";

type SettingsSection = "preset" | "home" | "navigation" | "notifications" | "personalization" | "account";

function SettingsAccordion({
  id,
  title,
  description,
  icon,
  open,
  onOpen,
  children,
}: {
  id: SettingsSection;
  title: string;
  description: string;
  icon: string;
  open: boolean;
  onOpen: (id: SettingsSection) => void;
  children: ReactNode;
}) {
  return (
    <section className={`settings-accordion ${open ? "open" : ""}`}>
      <button
        className="settings-accordion-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={`settings-panel-${id}`}
        onClick={() => onOpen(id)}
      >
        <span className="settings-accordion-icon" aria-hidden="true">{icon}</span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <b aria-hidden="true">{open ? "−" : "＋"}</b>
      </button>
      {open && <div className="settings-accordion-panel" id={`settings-panel-${id}`}>{children}</div>}
    </section>
  );
}

export function PwaSettingsPage() {
  const { state } = useSharedAccessState();
  const notificationAccess = useAppFeatureAccess("notifications");
  const [openSection, setOpenSection] = useState<SettingsSection | null>(null);
  const [alwaysShowNav, setAlwaysShowNav] = useState(true);
  const [writingProfile, setWritingProfile] = useState<UserWritingProfile | null>(null);
  const [writingBusy, setWritingBusy] = useState(false);
  const [writingLoading, setWritingLoading] = useState(false);
  const [writingMessage, setWritingMessage] = useState("");
  const profile = state.kind === "ready" ? state.profile : null;
  const profileId = profile?.id ?? null;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setAlwaysShowNav(readMobileNavAlways());
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setWritingLoading(true);
        setWritingMessage("");
      }
    });
    void loadWritingProfile(getSupabaseClient(), profileId).then(
      (next) => {
        if (active) setWritingProfile(next);
      },
      (error) => {
        if (active) {
          setWritingProfile(createDefaultWritingProfile(profileId));
          setWritingMessage(error instanceof Error ? error.message : "あなた向け最適化の設定を取得できませんでした。");
        }
      },
    ).finally(() => {
      if (active) setWritingLoading(false);
    });
    return () => { active = false; };
  }, [profileId]);

  const toggleSection = (id: SettingsSection) => {
    setOpenSection((current) => current === id ? null : id);
  };

  const toggleAlwaysShowNav = () => {
    const next = !alwaysShowNav;
    setAlwaysShowNav(next);
    writeMobileNavAlways(next);
  };

  const patchWritingProfile = <K extends keyof UserWritingProfile>(key: K, value: UserWritingProfile[K]) => {
    setWritingProfile((current) => current ? { ...current, [key]: value } : current);
  };

  const savePersonalization = async () => {
    if (!writingProfile) return;
    setWritingBusy(true);
    setWritingMessage("");
    try {
      const saved = await saveWritingProfile(getSupabaseClient(), writingProfile);
      setWritingProfile(saved);
      setWritingMessage("あなた向け最適化の設定をクラウドへ保存しました。");
    } catch (error) {
      setWritingMessage(error instanceof Error ? error.message : "あなた向け最適化の設定を保存できませんでした。");
    } finally {
      setWritingBusy(false);
    }
  };

  const resetPersonalization = async () => {
    if (!writingProfile || !window.confirm("AI設定・文章の好み・集計された利用傾向をリセットしますか？")) return;
    setWritingBusy(true);
    setWritingMessage("");
    try {
      const reset = await resetWritingProfile(getSupabaseClient(), writingProfile.userId);
      setWritingProfile(reset);
      setWritingMessage("あなた向け最適化を初期状態へリセットしました。");
    } catch (error) {
      setWritingMessage(error instanceof Error ? error.message : "あなた向け最適化をリセットできませんでした。");
    } finally {
      setWritingBusy(false);
    }
  };

  const logout = async () => {
    try {
      await signOutCurrentBrowser(getSupabaseClient());
    } finally {
      window.location.replace("/");
    }
  };

  return (
    <div className="beginner-shell persistent-settings-shell">
      <header className="beginner-topbar">
        <Link className="beginner-brand" href="/" aria-label="AI Action Studio ホーム"><span aria-hidden="true">✦</span><strong>AI ACTION <em>STUDIO</em></strong></Link>
        {profile && <div className="beginner-account"><span>{profile.display_name || "ユーザー"}</span><small>{profile.aas_user_id}</small></div>}
      </header>

      <main className="beginner-main">
        <section className="beginner-settings-page persistent-settings-page">
          <p className="eyebrow">SETTINGS</p>
          <h1>設定</h1>
          <p>変更したい項目を選ぶと、その設定だけを下に表示します。</p>

          <div className="settings-accordion-list">
            <SettingsAccordion
              id="preset"
              icon="✦"
              title="共通プリセット"
              description="記事・画像・SNS・note運営などへ同じ運営方針を反映"
              open={openSection === "preset"}
              onOpen={toggleSection}
            >
              <WorkspacePresetSettings />
            </SettingsAccordion>

            <SettingsAccordion
              id="home"
              icon="▦"
              title="ホーム画面"
              description="ウィジェットの並び順・表示・横幅をPC/スマホ別に変更"
              open={openSection === "home"}
              onOpen={toggleSection}
            >
              {profile
                ? <HomeWidgetCustomizer userId={profile.id} />
                : <div className="persistent-settings-status">ホーム配置を読み込んでいます…</div>}
            </SettingsAccordion>

            <SettingsAccordion
              id="navigation"
              icon="☰"
              title="表示・ナビ"
              description="下部ナビの表示と4枠の入れ替え"
              open={openSection === "navigation"}
              onOpen={toggleSection}
            >
              <section className="persistent-settings-section" aria-labelledby="navigation-settings-title">
                <div>
                  <strong id="navigation-settings-title">下部ナビを常に表示</strong>
                  <small>ONにすると、記事作成・SNS・画像・各機能画面へ移動しても下部ナビを表示します。OFFではホームと設定画面だけに表示します。</small>
                </div>
                <button className={`persistent-toggle ${alwaysShowNav ? "on" : ""}`} type="button" role="switch" aria-checked={alwaysShowNav} onClick={toggleAlwaysShowNav}>
                  <span aria-hidden="true" />
                  <b>{alwaysShowNav ? "ON" : "OFF"}</b>
                </button>
              </section>

              <section className="persistent-settings-section" aria-labelledby="navigation-common-title">
                <div>
                  <strong id="navigation-common-title">スマホ下部ナビは全画面で共通</strong>
                  <small>ホームは固定、残り4枠は下の設定で変更できます。選んだ並びはホーム・作成・設定・note運営などすべてのスマホ画面で同じ内容になります。</small>
                </div>
              </section>

              {profile
                ? <MobileNavCustomizer userId={profile.id} isAdmin={profile.role === "admin" && profile.status === "active"} />
                : <div className="persistent-settings-status">ナビ設定を読み込んでいます…</div>}
            </SettingsAccordion>

            {!notificationAccess.loading && notificationAccess.allowed && (
              <SettingsAccordion
                id="notifications"
                icon="🔔"
                title="通知"
                description="AAS内通知・スマホ/PCの端末通知・通知種類"
                open={openSection === "notifications"}
                onOpen={toggleSection}
              >
                <NotificationSettingsPanel />
              </SettingsAccordion>
            )}

            <SettingsAccordion
              id="personalization"
              icon="◎"
              title="AI・文章の好み"
              description="使用AI・文体・CTA・個人最適化"
              open={openSection === "personalization"}
              onOpen={toggleSection}
            >
              {profile ? (
                <section className="personalization-settings embedded" aria-labelledby="personalization-settings-title">
                  <div className="personalization-settings-head">
                    <div>
                      <p className="eyebrow">PERSONALIZATION</p>
                      <h2 id="personalization-settings-title">あなた向け最適化</h2>
                      <p>使用するAIと文章の好みをクラウドへ保存し、記事プロンプトへ反映します。</p>
                    </div>
                    {writingProfile && (
                      <button
                        className={`persistent-toggle ${writingProfile.personalizationEnabled ? "on" : ""}`}
                        type="button"
                        role="switch"
                        aria-checked={writingProfile.personalizationEnabled}
                        onClick={() => patchWritingProfile("personalizationEnabled", !writingProfile.personalizationEnabled)}
                      >
                        <span aria-hidden="true" />
                        <b>{writingProfile.personalizationEnabled ? "ON" : "OFF"}</b>
                      </button>
                    )}
                  </div>

                  {writingLoading && <p className="persistent-settings-status">個人設定を読み込んでいます…</p>}

                  {writingProfile && !writingLoading && (
                    <>
                      <div className="personalization-grid">
                        <label><span>普段使うAI</span><select value={writingProfile.preferredAi} onChange={(event) => patchWritingProfile("preferredAi", event.target.value as AiProvider)}>{(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((key) => <option key={key} value={key}>{AI_PROVIDER_LABELS[key]}</option>)}</select></label>
                        <label><span>利用プラン</span><select value={writingProfile.preferredPlan} onChange={(event) => patchWritingProfile("preferredPlan", event.target.value as AiPlan)}>{(Object.keys(AI_PLAN_LABELS) as AiPlan[]).map((key) => <option key={key} value={key}>{AI_PLAN_LABELS[key]}</option>)}</select></label>
                        <label><span>文章の雰囲気</span><select value={writingProfile.tone} onChange={(event) => patchWritingProfile("tone", event.target.value as WritingTone)}><option value="balanced">バランス</option><option value="friendly">やさしく親しみやすい</option><option value="professional">落ち着いた専門的</option><option value="casual">自然な会話調</option></select></label>
                        <label><span>見出し</span><select value={writingProfile.headingStyle} onChange={(event) => patchWritingProfile("headingStyle", event.target.value as HeadingStyle)}><option value="balanced">バランス</option><option value="short">短め</option><option value="descriptive">具体的・説明型</option></select></label>
                        <label><span>箇条書き</span><select value={writingProfile.listPreference} onChange={(event) => patchWritingProfile("listPreference", event.target.value as ListPreference)}><option value="balanced">必要に応じて</option><option value="low">少なめ</option><option value="high">多め</option></select></label>
                        <label><span>CTA</span><select value={writingProfile.ctaStyle} onChange={(event) => patchWritingProfile("ctaStyle", event.target.value as CtaStyle)}><option value="balanced">バランス</option><option value="soft">柔らかめ</option><option value="direct">行動を明確に</option></select></label>
                        <label><span>普段の掲載先</span><select value={writingProfile.preferredPlatform ?? ""} onChange={(event) => patchWritingProfile("preferredPlatform", (event.target.value || null) as PreferredPlatform | null)}><option value="">指定なし</option><option value="note">note</option><option value="tips">Tips</option><option value="brain">Brain</option><option value="blog">ブログ</option></select></label>
                        <label><span>普段のジャンル</span><input maxLength={100} value={writingProfile.preferredGenre} onChange={(event) => patchWritingProfile("preferredGenre", event.target.value)} placeholder="例: AI副業" /></label>
                      </div>

                      <label className="personalization-check"><input type="checkbox" checked={writingProfile.avoidHype} onChange={(event) => patchWritingProfile("avoidHype", event.target.checked)} /><span><strong>煽り表現を特に避ける</strong><small>成果保証・過度な期待・強すぎる販売表現を避ける方向へ寄せます。</small></span></label>

                      <div className="personalization-learned">
                        <strong>AASが保持している小さな利用傾向</strong>
                        <div>{summarizeWritingProfile(writingProfile).map((line) => <span key={line}>{line}</span>)}</div>
                        <small>個人最適化がONのとき、記事を保存すると掲載先・ジャンルなどの集計だけを更新します。</small>
                      </div>

                      <div className="personalization-privacy">
                        <strong>保存しないもの</strong>
                        <p>記事本文・AI回答全文・プロンプト全文を、個人最適化プロフィールとして複製保存しません。個人設定は本人だけが読み書きできるRLSで分離します。</p>
                      </div>

                      {writingMessage && <p className="personalization-message" role="status">{writingMessage}</p>}
                      <div className="personalization-actions">
                        <button type="button" disabled={writingBusy} onClick={() => void savePersonalization()}>{writingBusy ? "保存中…" : "最適化設定を保存"}</button>
                        <button type="button" className="danger" disabled={writingBusy} onClick={() => void resetPersonalization()}>学習内容をリセット</button>
                      </div>
                    </>
                  )}
                </section>
              ) : state.kind === "loading" ? null : <div className="persistent-settings-status">アカウント情報を取得できませんでした。</div>}
            </SettingsAccordion>

            <SettingsAccordion
              id="account"
              icon="◉"
              title="アカウント・ヘルプ"
              description="アカウント状態・各種設計・問い合わせ・規約"
              open={openSection === "account"}
              onOpen={toggleSection}
            >
              {profile ? (
                <div className="beginner-settings-card">
                  <div><strong>{profile.display_name || "ユーザー"}</strong><span>{profile.aas_user_id}</span><small>{profile.role} / {profile.status}</small></div>
                  <span className="beginner-access-badge">● PWA利用可能</span>
                </div>
              ) : state.kind === "loading" ? null : (
                <div className="persistent-settings-status" role="status">
                  {state.kind === "signed_out" ? "ログイン状態を確認できませんでした。" : "アカウント情報を取得できませんでした。"}
                </div>
              )}

              <div className="beginner-settings-links">
                {profile?.role === "admin" && <Link href="/admin">管理者画面 <span>›</span></Link>}
                <Link href="/account-design">note / Tips / Brain アカウント設計 <span>›</span></Link>
                <Link href="/inquiries">お問い合わせ・返信確認 <span>›</span></Link>
                <Link href="/manual">使い方マニュアル <span>›</span></Link>
                <Link href="/faq">Q&A・よくある質問 <span>›</span></Link>
                <Link href="/tools">機能一覧 <span>›</span></Link>
                <Link href="/terms">利用規約 <span>›</span></Link>
                <Link href="/privacy">プライバシーポリシー <span>›</span></Link>
                <Link href="/ai-terms">AI利用条件 <span>›</span></Link>
              </div>

              <div className="beginner-settings-actions">
                <Link className="persistent-settings-home" href="/">ホームへ戻る</Link>
                {profile && <button className="danger" type="button" onClick={() => void logout()}>ログアウト</button>}
              </div>
            </SettingsAccordion>
          </div>
        </section>
      </main>
    </div>
  );
}
