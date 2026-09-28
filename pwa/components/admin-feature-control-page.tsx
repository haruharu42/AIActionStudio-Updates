"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import {
  adminListAppFeatureControls,
  adminUpdateAppFeatureControl,
  validateFeatureRolloutTransition,
  type AdminFeatureControl,
  type AdminFeatureSnapshot,
  type FeatureRolloutStage,
} from "@/lib/feature-control";
import { getSupabaseClient } from "@/lib/supabase";

function stageLabel(stage: FeatureRolloutStage): string {
  if (stage === "admin") return "管理者のみ";
  if (stage === "tester") return "テストユーザー";
  return "全一般ユーザー";
}

function formatDate(value: string | null): string {
  if (!value) return "未変更";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未変更" : date.toLocaleString("ja-JP");
}

export function AdminFeatureControlPage() {
  const { state } = useSharedAccessState();
  const [snapshot, setSnapshot] = useState<AdminFeatureSnapshot | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [maintenanceDrafts, setMaintenanceDrafts] = useState<Record<string, string>>({});

  const activeAdmin = state.kind === "ready" && state.profile.role === "admin" && state.profile.status === "active";

  const applySnapshot = (next: AdminFeatureSnapshot) => {
    setSnapshot(next);
    setMaintenanceDrafts(Object.fromEntries(next.features.map((feature) => [feature.featureKey, feature.maintenanceMessage])));
  };

  const refresh = async () => {
    const next = await adminListAppFeatureControls(getSupabaseClient());
    applySnapshot(next);
  };

  useEffect(() => {
    if (!activeAdmin) return;
    let active = true;
    void adminListAppFeatureControls(getSupabaseClient()).then(
      (next) => {
        if (!active) return;
        setSnapshot(next);
        setMaintenanceDrafts(Object.fromEntries(next.features.map((feature) => [feature.featureKey, feature.maintenanceMessage])));
      },
      () => { if (active) setError("機能管理情報を取得できませんでした。"); },
    );
    return () => { active = false; };
  }, [activeAdmin]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = (snapshot?.features ?? []).filter((feature) =>
      !needle || [feature.title, feature.description, feature.category, feature.featureKey].some((value) => value.toLowerCase().includes(needle))
    );
    const categories = [...new Set(visible.map((feature) => feature.category))];
    return categories.map((category) => ({
      category,
      features: visible.filter((feature) => feature.category === category),
    }));
  }, [query, snapshot]);

  const update = async (
    feature: AdminFeatureControl,
    next: Partial<Pick<AdminFeatureControl, "rolloutStage" | "maintenanceMode" | "maintenanceMessage">>,
  ) => {
    if (busyKey) return;
    const rolloutStage = next.rolloutStage ?? feature.rolloutStage;
    const maintenanceMode = next.maintenanceMode ?? feature.maintenanceMode;
    const maintenanceMessage = next.maintenanceMessage ?? maintenanceDrafts[feature.featureKey] ?? feature.maintenanceMessage;
    const transitionError = validateFeatureRolloutTransition(
      feature.rolloutStage,
      rolloutStage,
      snapshot?.testerCount ?? 0,
    );
    if (transitionError) {
      setError(transitionError);
      return;
    }

    if (rolloutStage === "public" && feature.rolloutStage !== "public") {
      if (!window.confirm(feature.title + " を全一般ユーザーへ公開しますか？\nAAS-000002等のテストアカウントで動作確認済みか確認してください。")) return;
    }
    if (maintenanceMode && !feature.maintenanceMode) {
      if (!window.confirm(feature.title + " をメンテナンスモードにしますか？\n一般ユーザーは利用できなくなり、管理者と指定テスターだけが確認できます。")) return;
    }

    setBusyKey(feature.featureKey);
    setMessage("");
    setError("");
    try {
      const updated = await adminUpdateAppFeatureControl(getSupabaseClient(), {
        featureKey: feature.featureKey,
        rolloutStage,
        maintenanceMode,
        maintenanceMessage,
      });
      applySnapshot(updated);
      setMessage(
        maintenanceMode
          ? feature.title + " をメンテナンス管理へ更新しました。"
          : feature.title + " の公開範囲を「" + stageLabel(rolloutStage) + "」へ更新しました。",
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "機能設定を更新できませんでした。");
    } finally {
      setBusyKey("");
    }
  };

  if (state.kind === "loading") return null;
  if (!activeAdmin) {
    return <main className="standalone-page"><section className="standalone-card">
      <p className="eyebrow">FEATURE CONTROL</p>
      <h1>全機能管理センター</h1>
      <p className="route-notice error">active管理者のみ利用できます。</p>
      <Link href="/">← ホームへ戻る</Link>
    </section></main>;
  }

  const maintenanceCount = snapshot?.features.filter((feature) => feature.maintenanceMode).length ?? 0;
  const testerCount = snapshot?.features.filter((feature) => feature.rolloutStage === "tester" && !feature.adminOnly).length ?? 0;
  const adminStageCount = snapshot?.features.filter((feature) => feature.rolloutStage === "admin" && !feature.adminOnly).length ?? 0;

  return (
    <main className="admin-page feature-control-page">
      <header className="admin-head admin-dashboard-head">
        <div>
          <p className="eyebrow">FEATURE CONTROL CENTER</p>
          <h1>全機能管理センター</h1>
          <p>各機能を「管理者のみ → 一般ユーザーテスト → 全体公開」で段階管理し、不具合時は個別にメンテナンスへ切り替えます。</p>
        </div>
        <div className="admin-head-actions">
          <Link href="/admin/releases">アップデート管理</Link>
          <Link className="route-back" href="/admin">← 管理ダッシュボード</Link>
        </div>
      </header>

      {message && <p className="route-notice" role="status">{message}</p>}
      {error && <p className="route-notice error" role="alert">{error}</p>}

      <section className="feature-control-summary">
        <article><span>登録機能</span><strong>{snapshot?.features.length ?? 0}</strong><small>現在AASに登録されている管理対象</small></article>
        <article className={maintenanceCount ? "alert" : ""}><span>メンテナンス中</span><strong>{maintenanceCount}</strong><small>一般ユーザー停止中</small></article>
        <article><span>テスト段階</span><strong>{testerCount}</strong><small>{snapshot?.testers.join(" / ") || "テスター未登録"}</small></article>
        <article><span>管理者確認中</span><strong>{adminStageCount}</strong><small>一般ユーザー未公開</small></article>
      </section>

      <section className="admin-panel feature-control-guide">
        <div className="admin-panel-heading"><div><p className="eyebrow">SAFE ROLLOUT</p><h2>運用ルール</h2></div></div>
        <div className="feature-stage-flow">
          <span>① 管理者のみ</span><b>→</b><span>② AAS-000002等でテスト</span><b>→</b><span>③ 全一般ユーザー</span>
        </div>
        <p>メンテナンスONでは一般ユーザーを停止しますが、管理者と指定テスターは確認できます。修正確認後、そのままテスター段階・全体公開へ戻せます。</p>
      </section>

      <section className="admin-panel feature-control-search">
        <label className="route-field full">
          <span>機能を検索</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="記事、SNS、Knowledge、メンバーシップなど" />
        </label>
      </section>

      <div className="feature-control-groups">
        {groups.map((group) => {
          const groupMaintenance = group.features.filter((feature) => feature.maintenanceMode).length;
          return (
            <details className="feature-control-group" key={group.category}>
              <summary>
                <span><strong>{group.category}</strong><small>{group.features.length}機能</small></span>
                <span>{groupMaintenance ? "メンテナンス " + groupMaintenance : "正常"}</span>
              </summary>
              <div className="feature-control-list">
                {group.features.map((feature) => (
                  <article className={"feature-control-item " + (feature.maintenanceMode ? "maintenance" : "")} key={feature.featureKey}>
                    <div className="feature-control-main">
                      <div className="feature-control-title-row">
                        <div><strong>{feature.title}</strong><code>{feature.featureKey}</code></div>
                        <div className="feature-control-badges">
                          <span className={"stage-" + feature.rolloutStage}>{feature.adminOnly ? "管理者専用" : stageLabel(feature.rolloutStage)}</span>
                          {feature.maintenanceMode && <span className="maintenance-badge">メンテナンス中</span>}
                        </div>
                      </div>
                      <p>{feature.description}</p>
                      <small>
                        {feature.routePrefix ?? "埋め込み機能"} ・ 最終変更 {formatDate(feature.updatedAt)}
                        {feature.updatedByAasId ? " / " + feature.updatedByAasId : ""}
                      </small>
                    </div>

                    {feature.adminOnly ? (
                      <div className="feature-admin-fixed">
                        <strong>管理者専用（固定）</strong>
                        <small>誤操作で一般ユーザーへ公開できない保護対象です。</small>
                      </div>
                    ) : (
                      <>
                        <div className="feature-stage-actions" aria-label={feature.title + "の公開範囲"}>
                          <button type="button" className={feature.rolloutStage === "admin" ? "active" : ""} disabled={Boolean(busyKey)} onClick={() => void update(feature, { rolloutStage: "admin" })}>管理者のみ</button>
                          <button
                            type="button"
                            className={feature.rolloutStage === "tester" ? "active" : ""}
                            disabled={Boolean(busyKey) || (feature.rolloutStage === "admin" && (snapshot?.testerCount ?? 0) < 1)}
                            onClick={() => void update(feature, { rolloutStage: "tester" })}
                            title={feature.rolloutStage === "admin" && (snapshot?.testerCount ?? 0) < 1 ? "先にactiveなテストユーザーを登録してください" : undefined}
                          >
                            AAS-000002等でテスト
                          </button>
                          <button
                            type="button"
                            className={feature.rolloutStage === "public" ? "active" : ""}
                            disabled={Boolean(busyKey) || feature.rolloutStage === "admin" || (feature.rolloutStage === "tester" && (snapshot?.testerCount ?? 0) < 1)}
                            onClick={() => void update(feature, { rolloutStage: "public" })}
                            title={feature.rolloutStage === "admin" ? "先にテスト段階へ進めてください" : undefined}
                          >
                            全一般ユーザー
                          </button>
                        </div>

                        <div className="feature-maintenance-controls">
                          <label className="choice-card compact">
                            <input
                              type="checkbox"
                              checked={feature.maintenanceMode}
                              disabled={Boolean(busyKey)}
                              onChange={(event) => void update(feature, { maintenanceMode: event.target.checked })}
                            />
                            <span><strong>メンテナンスモード</strong><small>一般ユーザーを停止し、管理者・指定テスターだけで確認</small></span>
                          </label>
                          <label className="route-field">
                            <span>ユーザー向けメンテナンス案内</span>
                            <input
                              value={maintenanceDrafts[feature.featureKey] ?? ""}
                              maxLength={500}
                              onChange={(event) => setMaintenanceDrafts((current) => ({ ...current, [feature.featureKey]: event.target.value }))}
                              placeholder="例：現在修正対応中です。完了後に再開します。"
                            />
                          </label>
                          <button
                            className="secondary-action"
                            type="button"
                            disabled={Boolean(busyKey) || (maintenanceDrafts[feature.featureKey] ?? "") === feature.maintenanceMessage}
                            onClick={() => void update(feature, { maintenanceMessage: maintenanceDrafts[feature.featureKey] ?? "" })}
                          >
                            案内文を保存
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {!groups.length && <section className="admin-panel"><div className="admin-empty-state"><strong>条件に一致する機能がありません。</strong></div></section>}
      <button className="secondary-action feature-refresh-button" type="button" onClick={() => void refresh().catch(() => setError("機能一覧を更新できませんでした。"))}>一覧を再読み込み</button>
    </main>
  );
}
