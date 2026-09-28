"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AasReferenceBottomNav, AasReferenceHeader } from "@/components/aas-reference-shell";
import { DirectRuntimeImage } from "@/components/direct-runtime-image";
import {
  getCreatorRanking,
  getMyCreatorDashboard,
  xpProgress,
  type CreatorDashboard,
  type RankingKey,
  type RankingRow,
} from "@/lib/creator-system";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "@/components/creator-system.module.css";

const TABS: Array<{ key: RankingKey; label: string; icon: string }> = [
  { key: "level", label: "レベル", icon: "♛" },
  { key: "completed_articles", label: "完成記事数", icon: "▧" },
  { key: "weekly_xp", label: "今週XP", icon: "✦" },
];

function displayTime(value: string): string {
  if (!value) return "まだ更新されていません";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新時刻不明";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function nextRefresh(value: string, hours: number): string {
  if (!value) return "初回ランキング更新を待っています";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "次回更新時刻を確認中";
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return displayTime(date.toISOString());
}

function metricLabel(row: RankingRow, key: RankingKey): string {
  if (key === "level") return `Lv.${row.metricValue}`;
  if (key === "completed_articles") return `${row.metricValue} 記事`;
  return `${row.metricValue} XP`;
}

function avatarLetter(name: string): string {
  return (name.trim().charAt(0) || "C").toUpperCase();
}

function podiumClass(position: number): string {
  if (position === 1) return styles.rankGold;
  if (position === 2) return styles.rankSilver;
  if (position === 3) return styles.rankBronze;
  return "";
}

export default function CreatorRankingPage() {
  const [key, setKey] = useState<RankingKey>("level");
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const load = useCallback(async (rankingKey: RankingKey) => {
    const requestId = ++requestIdRef.current;
    try {
      const client = getSupabaseClient();
      const [nextDashboard, nextRows] = await Promise.all([
        getMyCreatorDashboard(client),
        getCreatorRanking(client, rankingKey, 50),
      ]);
      if (requestId !== requestIdRef.current) return;
      setDashboard(nextDashboard);
      setRows(nextRows);
    } catch (reason) {
      if (requestId !== requestIdRef.current) return;
      setError(reason instanceof Error ? reason.message : "ランキングを読み込めませんでした。");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load(key);
    });
    return () => {
      active = false;
      requestIdRef.current += 1;
    };
  }, [key, load]);

  function chooseRanking(nextKey: RankingKey) {
    if (nextKey === key) return;
    setLoading(true);
    setError("");
    setKey(nextKey);
  }

  const updatedAt = useMemo(() => rows[0]?.generatedAt || dashboard?.rankingLastGeneratedAt || "", [dashboard, rows]);
  const me = useMemo(() => rows.find((row) => row.isMe) ?? null, [rows]);
  const xp = useMemo(() => dashboard ? xpProgress(dashboard.totalXp, dashboard.level) : null, [dashboard]);

  return (
    <div className="reference-page">
      <AasReferenceHeader hasUnreadNotifications={Boolean(dashboard?.claimableMissions)} />
      <main className="reference-page-inner reference-ranking-page">
        <div className="reference-title-row">
          <div>
            <Link className="reference-back" href="/" aria-label="ホームへ戻る">‹</Link>
            <div>
              <h1>♛ ランキング</h1>
              <p>みんなの頑張りを、次の記事づくりのモチベーションに。</p>
            </div>
          </div>
        </div>

        {dashboard && (
          <section className="reference-status-card">
            <span className="reference-avatar" aria-hidden="true">
              {dashboard.avatarUrl ? <DirectRuntimeImage src={dashboard.avatarUrl} alt="" /> : avatarLetter(dashboard.publicName || "Creator")}
            </span>
            <div className="reference-creator-main">
              <div className="reference-name-row">
                <strong>{dashboard.publicName || "Creator"}</strong>
                <span className="reference-level-pill">♛ Creator Lv.{dashboard.level}</span>
              </div>
              {xp && (
                <>
                  <div className="reference-xp-row">
                    <div className="reference-xp-track"><span style={{ width: `${xp.percent}%` }} /></div>
                    <b>{xp.current} / {xp.needed} XP</b>
                  </div>
                  <small className="reference-xp-note">完成記事だけが実績へ加算されます。</small>
                </>
              )}
            </div>
            <div className="reference-rank-box">
              <small>あなたの順位</small>
              <strong>{me ? `${me.rankPosition}位` : !dashboard.rankingOptIn ? "非参加" : loading ? "読込中" : rows.length ? "圏外" : "未集計"}</strong>
              <em>{dashboard.rankingOptIn ? "公開設定ON" : "プロフィールから参加できます"}</em>
            </div>
          </section>
        )}

        <section className={`${styles.panel} ${styles.referenceRankingPanel}`}>
          <div className={styles.referenceRankTabs} role="tablist" aria-label="ランキング種別">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={key === tab.key}
                className={key === tab.key ? styles.referenceRankTabActive : ""}
                onClick={() => chooseRanking(tab.key)}
              >
                <span aria-hidden="true">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>

          <p className={styles.referenceRankGuide}>
            ※ 完成数は「完成・公開待ち・公開済み」の記事が最初に条件を満たした時だけ集計されます。
          </p>

          {loading && <div className={styles.empty} role="status" aria-live="polite">ランキングを読み込んでいます…</div>}
          {error && <div className={styles.error} role="alert">{error}</div>}

          {!loading && !error && rows.length > 0 && (
            <div className={styles.referenceRankList}>
              {rows.map((row) => (
                <article
                  key={`${row.rankingKey}-${row.rankPosition}-${row.publicName}`}
                  className={`${styles.referenceRankRow} ${podiumClass(row.rankPosition)} ${row.isMe ? styles.rankMe : ""}`}
                >
                  <span className={styles.referenceRankPosition}>
                    {row.rankPosition <= 3 ? <b>♛</b> : null}
                    {row.rankPosition}
                  </span>
                  <span className={styles.rankAvatar} aria-hidden="true">
                    {row.avatarUrl ? <DirectRuntimeImage src={row.avatarUrl} alt="" /> : avatarLetter(row.publicName)}
                  </span>
                  <div className={styles.rankName}>
                    <strong>{row.publicName}{row.isMe ? "（あなた）" : ""}</strong>
                    <small>
                      {row.level !== null ? `Creator Lv.${row.level}` : "レベル非公開"}
                      {row.completedArticles !== null ? ` · 完成 ${row.completedArticles}記事` : " · 記事数非公開"}
                    </small>
                  </div>
                  <div className={styles.referenceRankMetric}>
                    <small>{key === "level" ? "レベル" : key === "completed_articles" ? "完成記事数" : "今週XP"}</small>
                    <strong>{metricLabel(row, key)}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className={styles.empty}>
              まだこのランキングに参加者がいません。<br />
              公開名を設定してランキング参加をONにすると、次回更新から反映されます。
            </div>
          )}
        </section>

        {dashboard && (
          <section className={styles.referenceActivityCard}>
            <span aria-hidden="true">🎁</span>
            <div>
              <strong>今週のがんばり</strong>
              <small>今週獲得したXPと、ランキングの次回更新目安を確認できます。</small>
            </div>
            <div>
              <small>今週XP</small>
              <strong>+{dashboard.weeklyXp} XP</strong>
            </div>
          </section>
        )}

        {dashboard && (
          <section className={styles.referenceInfoCard}>
            <span aria-hidden="true">🔥</span>
            <div>
              <strong>ランキングの集計について</strong>
              <small>最終更新：{displayTime(updatedAt)} ／ 次回目安：{nextRefresh(updatedAt, dashboard.rankingRefreshHours)}</small>
            </div>
            <Link href="/profile">公開設定 ›</Link>
          </section>
        )}
      </main>
      <AasReferenceBottomNav active="ranking" />
    </div>
  );
}
