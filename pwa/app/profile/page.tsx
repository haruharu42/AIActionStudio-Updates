"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { AasReferenceBottomNav, AasReferenceHeader } from "@/components/aas-reference-shell";
import { DirectRuntimeImage } from "@/components/direct-runtime-image";
import {
  getMyCreatorDashboard,
  updateMyCreatorProfile,
  xpProgress,
  type CreatorDashboard,
  type CreatorProfilePatch,
} from "@/lib/creator-system";
import { GENRE_OPTIONS } from "@/lib/phase18-content-options";
import {
  prepareProfileAvatar,
  removeProfileAvatar,
  uploadProfileAvatar,
} from "@/lib/profile-avatar";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "@/components/creator-system.module.css";

type FormState = {
  publicName: string;
  bio: string;
  avatarUrl: string;
  favoriteGenre: string;
  creatorGoal: string;
  rankingOptIn: boolean;
  showLevel: boolean;
  showCompletedArticles: boolean;
};

function toForm(data: CreatorDashboard): FormState {
  return {
    publicName: data.publicName,
    bio: data.bio,
    avatarUrl: data.avatarUrl,
    favoriteGenre: data.favoriteGenre,
    creatorGoal: data.creatorGoal,
    rankingOptIn: data.rankingOptIn,
    showLevel: data.showLevel,
    showCompletedArticles: data.showCompletedArticles,
  };
}

function avatarLetter(name: string): string {
  return (name.trim().charAt(0) || "C").toUpperCase();
}

function Achievement({
  icon,
  title,
  description,
  achieved,
}: {
  icon: string;
  title: string;
  description: string;
  achieved: boolean;
}) {
  return (
    <article className={`${styles.referenceAchievement} ${achieved ? styles.referenceAchievementDone : ""}`}>
      <span aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <small>{achieved ? description : "まだ未達成です"}</small>
    </article>
  );
}

export default function CreatorProfilePage() {
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [removeAvatarRequested, setRemoveAvatarRequested] = useState(false);

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof getSupabaseClient>;
    try {
      client = getSupabaseClient();
    } catch {
      queueMicrotask(() => {
        if (active) setError("プロフィールを読み込めませんでした。");
      });
      return () => { active = false; };
    }

    queueMicrotask(() => {
      if (!active) return;
      void getMyCreatorDashboard(client).then(
        (next) => {
          if (!active) return;
          setDashboard(next);
          setForm(toForm(next));
        },
        (reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : "プロフィールを読み込めませんでした。");
        },
      );
    });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setError("");
    try {
      const prepared = await prepareProfileAvatar(file);
      const preview = URL.createObjectURL(prepared.blob);
      setAvatarBlob(prepared.blob);
      setAvatarPreview(preview);
      setRemoveAvatarRequested(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "プロフィール画像を準備できませんでした。");
    }
  }

  function requestAvatarRemoval() {
    setAvatarBlob(null);
    setAvatarPreview("");
    setRemoveAvatarRequested(true);
    setMessage("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setMessage("");
    setError("");
    if (form.rankingOptIn && !form.publicName.trim()) {
      setError("ランキングへ参加するには表示名を入力してください。");
      return;
    }
    setBusy(true);
    try {
      const client = getSupabaseClient();
      const patch: CreatorProfilePatch = {
        public_name: form.publicName,
        bio: form.bio,
        favorite_genre: form.favoriteGenre,
        creator_goal: form.creatorGoal,
        ranking_opt_in: form.rankingOptIn,
        show_level: form.showLevel,
        show_completed_articles: form.showCompletedArticles,
      };

      if (avatarBlob) {
        patch.avatar_url = await uploadProfileAvatar(client, avatarBlob);
      } else if (removeAvatarRequested) {
        patch.avatar_url = "";
      }

      await updateMyCreatorProfile(client, patch);

      let cleanupWarning = "";
      if (removeAvatarRequested) {
        try {
          await removeProfileAvatar(client);
        } catch {
          cleanupWarning = " 旧プロフィール画像の削除は次回再試行できます。";
        }
      }
      const next = await getMyCreatorDashboard(client);
      setDashboard(next);
      setForm(toForm(next));
      setAvatarBlob(null);
      setAvatarPreview("");
      setRemoveAvatarRequested(false);
      setMessage(`プロフィールを保存しました。ランキング設定は次回の更新から反映されます。${cleanupWarning}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "プロフィールを保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  const xp = useMemo(() => dashboard ? xpProgress(dashboard.totalXp, dashboard.level) : null, [dashboard]);

  return (
    <div className="reference-page">
      <AasReferenceHeader hasUnreadNotifications={Boolean(dashboard?.claimableMissions)} />
      <main className="reference-page-inner reference-profile-page">
        <div className="reference-title-row">
          <div>
            <Link className="reference-back" href="/" aria-label="ホームへ戻る">‹</Link>
            <div><h1>プロフィール</h1><p>公開プロフィールとランキングの表示範囲を設定できます。</p></div>
          </div>
        </div>

        {error && !form ? <div className={styles.error} role="alert">{error}</div> : null}

        {form && dashboard && xp ? (
          <form onSubmit={save} className={styles.referenceProfileForm}>
            <section className="reference-status-card">
              <span className="reference-avatar" aria-hidden="true">
                {dashboard.avatarUrl ? <DirectRuntimeImage src={dashboard.avatarUrl} alt="" /> : avatarLetter(form.publicName || "Creator")}
              </span>
              <div className="reference-creator-main">
                <div className="reference-name-row">
                  <strong>{form.publicName || "公開名未設定"}</strong>
                  <span className="reference-level-pill">♛ Creator Lv.{dashboard.level}</span>
                </div>
                <div className="reference-xp-row">
                  <div className="reference-xp-track"><span style={{ width: `${xp.percent}%` }} /></div>
                  <b>{xp.current} / {xp.needed} XP</b>
                </div>
                <small className="reference-xp-note">あと {Math.max(0, xp.needed - xp.current)} XPで次のレベルです。</small>
              </div>
              <div className={styles.referenceMemberBox}>
                <span aria-hidden="true">♛</span>
                <strong>{dashboard.noteMember ? dashboard.membershipBadgeLabel || dashboard.membershipPlanName || "Creator Club" : "通常利用"}</strong>
                <small>{dashboard.noteMember ? `記事XP ×${dashboard.articleXpMultiplier.toFixed(1)}` : "Creator Level特典を利用中"}</small>
              </div>
            </section>

            <section className={styles.referenceProfileGrid}>
              <label className={styles.referenceProfileTile}>
                <span className={styles.referenceTileIcon}>♙</span>
                <span><strong>表示名</strong><small>ランキングや公開画面で使用</small></span>
                <input maxLength={40} value={form.publicName} onChange={(event) => setForm({ ...form, publicName: event.target.value })} placeholder="例：はる Creator" />
              </label>

              <label className={styles.referenceProfileTile}>
                <span className={styles.referenceTileIcon}>▧</span>
                <span><strong>自己紹介</strong><small>どんな記事を作っているか紹介</small></span>
                <textarea maxLength={300} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="AIで広がる創作の楽しさを発信しています。" />
              </label>

              <label className={styles.referenceProfileTile}>
                <span className={styles.referenceTileIcon}>◇</span>
                <span><strong>得意ジャンル</strong><small>よく作る記事ジャンル</small></span>
                <select value={GENRE_OPTIONS.includes(form.favoriteGenre as (typeof GENRE_OPTIONS)[number]) ? form.favoriteGenre : ""} onChange={(event) => setForm({ ...form, favoriteGenre: event.target.value })}>
                  <option value="">未設定</option>
                  {GENRE_OPTIONS.filter((genre) => genre !== "その他").map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                </select>
              </label>

              <label className={styles.referenceProfileTile}>
                <span className={styles.referenceTileIcon}>◎</span>
                <span><strong>目標</strong><small>今後の制作目標</small></span>
                <input maxLength={200} value={form.creatorGoal} onChange={(event) => setForm({ ...form, creatorGoal: event.target.value })} placeholder="例：今月はマガジンを1冊完成させる" />
              </label>

              <section className={`${styles.referenceProfileTile} ${styles.referenceProfileTileWide} ${styles.referenceAvatarTile}`}>
                <span className={styles.referenceTileIcon}>◉</span>
                <span><strong>プロフィール画像</strong><small>選んだ画像は自動で正方形に整え、WebPへ圧縮して保存します。</small></span>
                <div className={styles.referenceAvatarEditor}>
                  <span className={styles.referenceAvatarPreview} aria-hidden="true">
                    {avatarPreview || (!removeAvatarRequested && dashboard.avatarUrl)
                      ? <DirectRuntimeImage src={avatarPreview || dashboard.avatarUrl} alt="" />
                      : avatarLetter(form.publicName || "Creator")}
                  </span>
                  <div className={styles.referenceAvatarActions}>
                    <label className={styles.referenceAvatarChoose}>
                      画像を選択
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => void chooseAvatar(event)}
                      />
                    </label>
                    {(avatarPreview || (!removeAvatarRequested && dashboard.avatarUrl)) && (
                      <button type="button" className={styles.referenceAvatarRemove} onClick={requestAvatarRemoval}>
                        画像を削除
                      </button>
                    )}
                    <small>JPEG / PNG / WebP・元画像10MBまで。保存時に最大512×512、500KB以下のWebPへ自動圧縮します。</small>
                  </div>
                </div>
              </section>
            </section>

            <section className={styles.referenceProfileSection}>
              <div className={styles.referenceSectionTitle}><span>▥</span><div><h2>ランキング公開設定</h2><p>公開する情報は自分で選べます。</p></div></div>
              <div className={styles.referenceToggleGrid}>
                <label className={styles.referenceSwitchCard}>
                  <input type="checkbox" checked={form.rankingOptIn} onChange={(event) => setForm({ ...form, rankingOptIn: event.target.checked })} />
                  <span><strong>ランキングに参加する</strong><small>OFFでも自分のXP・レベルは利用できます。</small></span>
                </label>
                <label className={styles.referenceSwitchCard}>
                  <input type="checkbox" checked={form.showCompletedArticles} onChange={(event) => setForm({ ...form, showCompletedArticles: event.target.checked })} />
                  <span><strong>記事数を公開</strong><small>完成した記事数だけを表示</small></span>
                </label>
                <label className={styles.referenceSwitchCard}>
                  <input type="checkbox" checked={form.showLevel} onChange={(event) => setForm({ ...form, showLevel: event.target.checked })} />
                  <span><strong>レベルを公開</strong><small>Creator Levelをランキングに表示</small></span>
                </label>
              </div>
            </section>

            <section className={styles.referenceProfileSection}>
              <div className={styles.referenceSectionTitle}><span>🏅</span><div><h2>実績・バッジ</h2><p>実データから達成状況を表示します。</p></div></div>
              <div className={styles.referenceAchievementGrid}>
                <Achievement icon="▧" title="初記事完成" description="最初の記事を完成しました" achieved={dashboard.completedArticles >= 1} />
                <Achievement icon="🔥" title="7日継続" description="7日以上の連続記録を達成しました" achieved={dashboard.bestStreak >= 7} />
                <Achievement icon="▤" title="マガジン編集者" description="マガジンを完成しました" achieved={dashboard.completedMagazines >= 1} />
              </div>
            </section>

            <section className={styles.referenceProfileSection}>
              <div className={styles.referenceSectionTitle}><span>▥</span><div><h2>制作データ</h2><p>完成した記事だけが完成記事数に加算されます。</p></div></div>
              <div className={styles.referenceDataGrid}>
                <div><span>▧</span><small>完成記事数</small><strong>{dashboard.completedArticles}<em>記事</em></strong></div>
                <div><span>✎</span><small>今週XP</small><strong>{dashboard.weeklyXp}<em>XP</em></strong></div>
                <div><span>▤</span><small>マガジン数</small><strong>{dashboard.completedMagazines}<em>個</em></strong></div>
                <div><span>🔥</span><small>連続日数</small><strong>{dashboard.currentStreak}<em>日</em></strong></div>
              </div>
            </section>

            <button className={styles.referenceSaveButton} type="submit" disabled={busy}>✦ {busy ? "保存中…" : "プロフィールを保存"}</button>
            {message && <div className={styles.success} role="status" aria-live="polite">{message}</div>}
            {error && <div className={styles.error} role="alert">{error}</div>}
          </form>
        ) : !error ? <div className={styles.notice} role="status" aria-live="polite">プロフィールを読み込んでいます…</div> : null}
      </main>
      <AasReferenceBottomNav active="profile" />
    </div>
  );
}
