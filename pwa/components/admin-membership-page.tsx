"use client";

import Link from "next/link";
import { MembershipAuditSection, MembershipRecommendationsSection, MembershipStatusSection } from "@/components/admin-membership/admin-membership-static-sections";
import { SelectWithCustom } from "@/components/select-with-custom";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getArticleLibraryQuotaReadiness,
  getArticleLibraryQuotaSettings,
  getMembershipSettings,
  listMembershipAuditActions,
  listMembershipAssignments,
  listMembershipFeatures,
  listMembershipPlanFeatures,
  listMembershipPlans,
  setArticleLibraryPlanLimitsEnabled,
  setMembershipPlanFeature,
  updateArticleLibraryFreeLimit,
  updateMembershipPlan,
  updateMembershipPlanArticleQuota,
  updateMembershipSettings,
  type ArticleLibraryQuotaReadiness,
  type ArticleLibraryQuotaSettings,
  type MembershipAssignment,
  type MembershipAuditAction,
  type MembershipFeature,
  type MembershipPlan,
  type MembershipPlanFeature,
  type MembershipSettings,
} from "@/lib/admin-membership";
import {
  CREATOR_MEMBERSHIP_PLANS,
  clearCreatorMembershipPlan,
  listCreatorMembershipEntitlements,
  listPwaAdminUsers,
  setCreatorMembershipPlan,
  type CreatorMembershipPlanCode,
  type PwaAdminEntitlement,
  type PwaAdminUser,
} from "@/lib/pwa-admin-users";
import { getSupabaseClient } from "@/lib/supabase";

type LoadState = "loading" | "ready" | "error";

const EMPTY_SETTINGS: MembershipSettings = {
  displayName: "noteメンバーシップ",
  noteMembershipUrl: "",
  guidance: "",
  updatedAt: null,
};

function currentFeatureEnabled(
  planCode: string,
  featureKey: string,
  mappings: readonly MembershipPlanFeature[],
): boolean {
  return mappings.some((item) =>
    item.planCode === planCode
    && item.featureKey === featureKey
    && item.enabled
  );
}

function formatDate(value: string | null): string {
  if (!value) return "期限なし";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "—";
}

export function AdminMembershipPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [settings, setSettings] = useState<MembershipSettings>(EMPTY_SETTINGS);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [features, setFeatures] = useState<MembershipFeature[]>([]);
  const [planFeatures, setPlanFeatures] = useState<MembershipPlanFeature[]>([]);
  const [users, setUsers] = useState<PwaAdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [membershipEntitlements, setMembershipEntitlements] = useState<PwaAdminEntitlement[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CreatorMembershipPlanCode>("CREATOR_CLUB");
  const [membershipExpiry, setMembershipExpiry] = useState("");
  const [membershipReference, setMembershipReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [configReady, setConfigReady] = useState(true);
  const [operationsReady, setOperationsReady] = useState(true);
  const [assignments, setAssignments] = useState<MembershipAssignment[]>([]);
  const [auditActions, setAuditActions] = useState<MembershipAuditAction[]>([]);
  const [referenceNow, setReferenceNow] = useState(0);
  const [articleLibraryQuota, setArticleLibraryQuota] = useState<ArticleLibraryQuotaSettings | null>(null);
  const [articleLibraryQuotaReady, setArticleLibraryQuotaReady] = useState(true);
  const [articleLibraryReadiness, setArticleLibraryReadiness] = useState<ArticleLibraryQuotaReadiness | null>(null);
  const [articleLibraryActivationReady, setArticleLibraryActivationReady] = useState(true);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter((user) => user.role === "user")
      .filter((user) => !query
        || user.aasUserId.toLowerCase().includes(query)
        || (user.displayName ?? "").toLowerCase().includes(query))
      .slice(0, 100);
  }, [search, users]);

  const activeFeatures = useMemo(
    () => features.filter((feature) => feature.status === "active"),
    [features],
  );

  const pricingReady = useMemo(
    () => plans.length > 0 && plans.every((plan) => plan.pricingManaged),
    [plans],
  );

  const articleLibraryPlanLimitsReady = useMemo(
    () => plans.length > 0 && plans.every((plan) => plan.articleLibraryManaged),
    [plans],
  );

  const expiringSoon = useMemo(() => {
    const deadline = referenceNow + 7 * 24 * 60 * 60 * 1000;
    return assignments.filter((item) => {
      if (!item.expiresAt || referenceNow <= 0) return false;
      const expiresAt = new Date(item.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt > referenceNow && expiresAt <= deadline;
    });
  }, [assignments, referenceNow]);

  const assignmentPlanCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of assignments) counts.set(item.planCode, (counts.get(item.planCode) ?? 0) + 1);
    return counts;
  }, [assignments]);

  const loadMembership = useCallback(async () => {
    const client = getSupabaseClient();
    const nextUsers = await listPwaAdminUsers(client);
    setUsers(nextUsers);
    setReferenceNow(Date.now());

    try {
      const [nextSettings, nextPlans, nextFeatures, nextPlanFeatures] = await Promise.all([
        getMembershipSettings(client),
        listMembershipPlans(client),
        listMembershipFeatures(client),
        listMembershipPlanFeatures(client),
      ]);
      setSettings(nextSettings);
      setPlans(nextPlans);
      setFeatures(nextFeatures);
      setPlanFeatures(nextPlanFeatures);
      setConfigReady(true);
    } catch {
      setConfigReady(false);
    }

    try {
      const nextQuota = await getArticleLibraryQuotaSettings(client);
      setArticleLibraryQuota(nextQuota);
      setArticleLibraryQuotaReady(true);
    } catch {
      setArticleLibraryQuota(null);
      setArticleLibraryQuotaReady(false);
    }

    try {
      const nextReadiness = await getArticleLibraryQuotaReadiness(client);
      setArticleLibraryReadiness(nextReadiness);
      setArticleLibraryActivationReady(true);
    } catch {
      setArticleLibraryReadiness(null);
      setArticleLibraryActivationReady(false);
    }

    try {
      const [nextAssignments, nextAuditActions] = await Promise.all([
        listMembershipAssignments(client),
        listMembershipAuditActions(client, 30),
      ]);
      setAssignments(nextAssignments);
      setAuditActions(nextAuditActions);
      setOperationsReady(true);
    } catch {
      setOperationsReady(false);
      setAssignments([]);
      setAuditActions([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadMembership().then(
        () => { if (active) setState("ready"); },
        (error: unknown) => {
          if (!active) return;
          setState("error");
          setMessage(error instanceof Error
            ? error.message
            : "ユーザー管理データを読み込めませんでした。");
        },
      );
    });
    return () => { active = false; };
  }, [loadMembership]);

  const refreshNow = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await loadMembership();
      if (selectedUserId) {
        try {
          setMembershipEntitlements(
            await listCreatorMembershipEntitlements(getSupabaseClient(), selectedUserId),
          );
        } catch {
          // 全体更新は成功扱いにし、選択中ユーザーだけ次回選択時に再取得する。
        }
      }
      setMessage("メンバーシップ管理を最新状態へ更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "最新状態へ更新できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const selectUser = async (user: PwaAdminUser) => {
    setSelectedUserId(user.id);
    setMessage("");
    try {
      const items = await listCreatorMembershipEntitlements(getSupabaseClient(), user.id);
      setMembershipEntitlements(items);
    } catch (error) {
      setMembershipEntitlements([]);
      setMessage(error instanceof Error ? error.message : "メンバー特典を取得できませんでした。");
    }
  };

  const saveSettings = async () => {
    if (busy) return;
    if (!settings.displayName.trim()) {
      setMessage("メンバーシップ表示名を入力してください。");
      return;
    }
    if (settings.noteMembershipUrl && !settings.noteMembershipUrl.startsWith("https://note.com/")) {
      setMessage("noteメンバーシップURLは https://note.com/ で始まるURLを入力してください。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await updateMembershipSettings(getSupabaseClient(), settings);
      await loadMembership();
      setMessage("メンバーシップ基本設定を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "メンバーシップ設定を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const patchPlan = (planCode: string, patch: Partial<MembershipPlan>) => {
    setPlans((current) => current.map((plan) => plan.planCode === planCode ? { ...plan, ...patch } : plan));
  };

  const savePlan = async (plan: MembershipPlan) => {
    if (busy) return;
    if (!plan.pricingManaged) {
      setMessage("料金設定用のDB migrationがまだ未適用です。リリース工程で適用後に保存できます。");
      return;
    }
    if (!plan.displayName.trim()) {
      setMessage("プラン表示名を入力してください。");
      return;
    }
    if (plan.monthlyPriceYen !== null && (!Number.isInteger(plan.monthlyPriceYen) || plan.monthlyPriceYen < 0 || plan.monthlyPriceYen > 1000000)) {
      setMessage("月額料金は0〜1,000,000円の範囲で入力してください。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await updateMembershipPlan(getSupabaseClient(), {
        planCode: plan.planCode,
        displayName: plan.displayName,
        monthlyPriceYen: plan.monthlyPriceYen,
        description: plan.description,
      });
      setPlans(await listMembershipPlans(getSupabaseClient()));
      setMessage(`${plan.displayName}の料金・表示設定を保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "プラン設定を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const saveArticleLibraryFreeLimit = async () => {
    if (busy || !articleLibraryQuota) return;
    const limit = articleLibraryQuota.freeLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100000) {
      setMessage("無料ユーザーの保存上限は1〜100,000件で入力してください。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      await updateArticleLibraryFreeLimit(client, limit);
      const [nextQuota, nextReadiness] = await Promise.all([
        getArticleLibraryQuotaSettings(client),
        getArticleLibraryQuotaReadiness(client),
      ]);
      setArticleLibraryQuota(nextQuota);
      setArticleLibraryReadiness(nextReadiness);
      setMessage(`無料ユーザーの記事ライブラリ保存上限を${limit}件に保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無料ユーザーの保存上限を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const savePlanArticleLibraryQuota = async (plan: MembershipPlan) => {
    if (busy) return;
    if (!plan.articleLibraryManaged) {
      setMessage("記事ライブラリ上限管理用のDB migrationがまだ未適用です。");
      return;
    }
    if (!plan.articleLibraryUnlimited) {
      const limit = plan.articleLibraryLimit;
      if (limit === null || !Number.isInteger(limit) || limit < 1 || limit > 100000) {
        setMessage("プラン別の保存上限は1〜100,000件で入力してください。");
        return;
      }
    }
    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      await updateMembershipPlanArticleQuota(client, plan);
      const [nextPlans, nextReadiness] = await Promise.all([
        listMembershipPlans(client),
        getArticleLibraryQuotaReadiness(client),
      ]);
      setPlans(nextPlans);
      setArticleLibraryReadiness(nextReadiness);
      setMessage(`${plan.displayName}の記事ライブラリ保存上限を保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "プラン別の保存上限を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const refreshArticleLibraryReadiness = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await getArticleLibraryQuotaReadiness(getSupabaseClient());
      setArticleLibraryReadiness(next);
      setArticleLibraryActivationReady(true);
      setMessage("記事ライブラリ上限の公開前チェックを更新しました。");
    } catch (error) {
      setArticleLibraryActivationReady(false);
      setMessage(error instanceof Error ? error.message : "記事ライブラリ上限の公開前チェックを更新できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const setArticleLibraryQuotaEnforcement = async (enabled: boolean) => {
    if (busy || !articleLibraryReadiness) return;
    if (enabled && !articleLibraryReadiness.automatedChecksPass) {
      setMessage("公開前チェックを通過していないため、プラン別保存上限を発効できません。");
      return;
    }
    const warning = enabled
      ? `プラン別の記事ライブラリ保存上限を一般ユーザーへ発効しますか？\n\nactive一般ユーザー: ${articleLibraryReadiness.activeGeneralUsers}名\n将来上限の超過ユーザー: ${articleLibraryReadiness.usersOverFutureLimit}名\n\n発効には現在の管理者セッションでMFA認証（AAL2）が必要です。`
      : "プラン別の記事ライブラリ保存上限を停止し、従来の保存上限へ戻しますか？\n\nこれは緊急停止用の操作です。";
    if (!window.confirm(warning)) return;

    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      const next = await setArticleLibraryPlanLimitsEnabled(client, enabled);
      setArticleLibraryReadiness(next);
      setArticleLibraryQuota((current) => current ? { ...current, planLimitsEnabled: next.planLimitsEnabled } : current);
      setMessage(enabled
        ? "プラン別の記事ライブラリ保存上限を発効しました。"
        : "プラン別保存上限を停止し、従来の保存上限へ戻しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : enabled
        ? "プラン別保存上限を発効できませんでした。"
        : "プラン別保存上限を停止できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const toggleFeature = async (plan: MembershipPlan, feature: MembershipFeature) => {
    if (busy) return;
    const enabled = currentFeatureEnabled(plan.planCode, feature.featureKey, planFeatures);
    const nextEnabled = !enabled;
    if (!window.confirm(
      `${plan.displayName}の「${feature.displayName}」を${nextEnabled ? "利用可能" : "利用不可"}に変更しますか？`
    )) return;

    setBusy(true);
    setMessage("");
    try {
      await setMembershipPlanFeature(getSupabaseClient(), {
        planCode: plan.planCode,
        featureKey: feature.featureKey,
        enabled: nextEnabled,
      });
      setPlanFeatures(await listMembershipPlanFeatures(getSupabaseClient()));
      setMessage(`${plan.displayName}の「${feature.displayName}」を${nextEnabled ? "ON" : "OFF"}にしました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "特典機能を変更できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const assignMembership = async () => {
    if (!selectedUser || busy) return;
    const current = membershipEntitlements[0]?.productName;
    const label = plans.find((plan) => plan.planCode === selectedPlan)?.displayName
      ?? CREATOR_MEMBERSHIP_PLANS.find((plan) => plan.code === selectedPlan)?.label
      ?? selectedPlan;
    if (!window.confirm(
      current
        ? `${selectedUser.aasUserId} のメンバー特典を「${label}」へ変更しますか？`
        : `${selectedUser.aasUserId} に「${label}」を付与しますか？`
    )) return;

    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      await setCreatorMembershipPlan(client, selectedUser.id, {
        planCode: selectedPlan,
        expiresAt: membershipExpiry ? new Date(membershipExpiry).toISOString() : undefined,
        salesChannel: "note-membership-admin",
        externalReference: membershipReference.trim() || undefined,
      });
      let refreshWarning = "";
      try {
        const items = await listCreatorMembershipEntitlements(client, selectedUser.id);
        setMembershipEntitlements(items);
        if (operationsReady) {
          const [nextAssignments, nextAuditActions] = await Promise.all([
            listMembershipAssignments(client),
            listMembershipAuditActions(client, 30),
          ]);
          setAssignments(nextAssignments);
          setAuditActions(nextAuditActions);
        }
      } catch {
        refreshWarning = " 最新表示の再取得だけ失敗したため、「更新」で再確認してください。";
      }
      setMessage(`${selectedUser.aasUserId} に${label}特典を設定しました。${refreshWarning}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "メンバー特典を設定できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const revokeMembership = async () => {
    if (!selectedUser || !membershipEntitlements.length || busy) return;
    if (!window.confirm(
      `${selectedUser.aasUserId} のメンバーシップ特典を取り消しますか？\nAASの通常利用権は取り消しません。`
    )) return;

    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      await clearCreatorMembershipPlan(client, selectedUser.id);
      setMembershipEntitlements([]);
      let refreshWarning = "";
      if (operationsReady) {
        try {
          const [nextAssignments, nextAuditActions] = await Promise.all([
            listMembershipAssignments(client),
            listMembershipAuditActions(client, 30),
          ]);
          setAssignments(nextAssignments);
          setAuditActions(nextAuditActions);
        } catch {
          refreshWarning = " 最新表示の再取得だけ失敗したため、「更新」で再確認してください。";
        }
      }
      setMessage(`${selectedUser.aasUserId} のメンバーシップ特典を取り消しました。${refreshWarning}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "メンバー特典を取り消せませんでした。");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;

  return (
    <main className="admin-page admin-membership-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow">MEMBERSHIP CONTROL</p>
          <h1>メンバーシップ管理</h1>
          <p>noteメンバー特典の付与・取消、プラン別機能、参加URLを1か所で管理します。</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="secondary-action" disabled={busy} onClick={() => void refreshNow()}>最新状態へ更新</button>
          <Link className="route-back" href="/admin">← 管理ダッシュボード</Link>
        </div>
      </header>

      {state === "error" && (
        <div className="route-notice error" role="alert">
          {message || "メンバーシップ管理を読み込めませんでした。"}
        </div>
      )}
      {state === "ready" && !configReady && (
        <div className="route-notice" role="note">
          新しいメンバーシップ設定DBはまだ未適用です。ユーザーへのCreator Club特典の付与・変更・取消は利用できます。note URLとプラン別機能設定は、リリース工程でmigration適用後に有効になります。
        </div>
      )}
      {state === "ready" && configReady && !operationsReady && (
        <div className="route-notice" role="note">
          メンバー一覧・期限切れ予定・監査ログ用の追加DBはまだ未適用です。基本設定、特典機能管理、ユーザーへの付与・取消は利用できます。
        </div>
      )}

      {operationsReady && (
        <MembershipStatusSection
          assignments={assignments}
          expiringSoon={expiringSoon}
          plans={plans}
          assignmentPlanCounts={assignmentPlanCounts}
          users={users}
          onSelectUser={selectUser}
        />
      )}

      <section className="admin-panel membership-admin-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">STEP 1</p>
            <h2>noteメンバーシップ基本設定</h2>
          </div>
          <span className="availability-badge">参加導線</span>
        </div>
        <p className="trial-admin-note">ユーザーへ案内するnoteメンバーシップの名称・URL・説明を設定します。</p>
        <div className="admin-form-grid">
          <label className="route-field">
            <span>表示名</span>
            <input
              value={settings.displayName}
              onChange={(event) => setSettings((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="例: はるくん。Creator Club"
            />
          </label>
          <label className="route-field">
            <span>noteメンバーシップURL</span>
            <input
              type="url"
              value={settings.noteMembershipUrl}
              onChange={(event) => setSettings((current) => ({ ...current, noteMembershipUrl: event.target.value }))}
              placeholder="https://note.com/..."
            />
          </label>
          <label className="route-field full">
            <span>ユーザー向け案内（任意）</span>
            <textarea
              value={settings.guidance}
              onChange={(event) => setSettings((current) => ({ ...current, guidance: event.target.value.slice(0, 1000) }))}
              placeholder="例: メンバーになるとクラウド画像保存や限定機能を利用できます。"
            />
          </label>
        </div>
        <div className="admin-actions">
          <button type="button" disabled={busy || state !== "ready" || !configReady} onClick={() => void saveSettings()}>基本設定を保存</button>
          {settings.noteMembershipUrl && (
            <a className="secondary-action" href={settings.noteMembershipUrl} target="_blank" rel="noreferrer">設定URLを確認 ↗</a>
          )}
        </div>
      </section>

      <section className="admin-panel membership-admin-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">STEP 2</p>
            <h2>3プランの料金・表示設定</h2>
          </div>
          <span className="availability-badge">月額料金</span>
        </div>
        <p className="trial-admin-note">
          note側で設定した実際の月額料金と同じ金額を入力してください。プランコードは既存ユーザーの権限判定に使うため固定です。
        </p>
        {!pricingReady && (
          <div className="route-notice" role="note">
            料金設定DBはまだ未適用です。現在のプラン・機能割り当ては確認できますが、料金・説明の保存はmigration適用後に有効になります。
          </div>
        )}
        <div className="membership-plan-editor-grid">
          {plans.map((plan) => (
            <article className="membership-plan-editor-card" key={plan.planCode}>
              <div className="membership-plan-editor-head">
                <div>
                  <span>PLAN {plan.tierRank}</span>
                  <code>{plan.planCode}</code>
                </div>
                <strong>
                  {plan.monthlyPriceYen === null
                    ? "料金未設定"
                    : `¥${plan.monthlyPriceYen.toLocaleString("ja-JP")} / 月`}
                </strong>
              </div>
              <label className="route-field">
                <span>プラン表示名</span>
                <input
                  value={plan.displayName}
                  maxLength={100}
                  onChange={(event) => patchPlan(plan.planCode, { displayName: event.target.value })}
                />
              </label>
              <SelectWithCustom
                className="route-field"
                label="月額料金（税込・円）"
                value={plan.monthlyPriceYen === null ? "" : String(plan.monthlyPriceYen)}
                onChange={(value) => patchPlan(plan.planCode, {
                  monthlyPriceYen: value === "" ? null : Math.max(0, Math.min(1000000, Number(value) || 0)),
                })}
                options={[
                  { value: "0", label: "0円（無料）" },
                  { value: "300", label: "300円" },
                  { value: "500", label: "500円" },
                  { value: "980", label: "980円" },
                  { value: "1480", label: "1,480円" },
                  { value: "1980", label: "1,980円" },
                  { value: "2980", label: "2,980円" },
                  { value: "4980", label: "4,980円" },
                  { value: "9800", label: "9,800円" },
                ]}
                placeholder="料金を選択"
                customPlaceholder="その他の月額料金を入力"
                inputType="number"
                min={0}
                max={1000000}
              />
              <label className="route-field">
                <span>ユーザー向けプラン説明</span>
                <textarea
                  value={plan.description}
                  maxLength={500}
                  placeholder="このプランで利用できる内容を簡潔に説明"
                  onChange={(event) => patchPlan(plan.planCode, { description: event.target.value })}
                />
              </label>
              <div className="membership-plan-feature-summary">
                <span>現在の利用可能機能</span>
                <strong>
                  {activeFeatures.filter((feature) => currentFeatureEnabled(plan.planCode, feature.featureKey, planFeatures)).length}個
                </strong>
              </div>
              <button
                type="button"
                disabled={busy || !plan.pricingManaged}
                onClick={() => void savePlan(plan)}
              >
                このプラン設定を保存
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel membership-admin-section membership-library-quota-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">STEP 3</p>
            <h2>記事ライブラリ保存上限</h2>
          </div>
          <span className={articleLibraryQuota?.planLimitsEnabled ? "availability-badge active" : "availability-badge"}>
            {articleLibraryQuota?.planLimitsEnabled ? "プラン上限 発効中" : "準備済み・未発効"}
          </span>
        </div>
        <p className="trial-admin-note">
          無料ユーザーとCreator Club各プランの記事保存上限を管理します。値の保存と、本番でプラン別上限を発効する操作は分離しています。
        </p>

        {!articleLibraryQuotaReady || !articleLibraryPlanLimitsReady ? (
          <div className="route-notice" role="note">
            記事ライブラリ上限管理用のDB migrationがまだ未適用です。現在の保存上限は従来設定のままです。
          </div>
        ) : articleLibraryQuota && !articleLibraryQuota.planLimitsEnabled ? (
          <div className="route-notice" role="note">
            現在は従来の保存上限が有効です。ここで無料5件・各有料プランの上限を準備しても、一般ユーザーの実上限はまだ切り替わりません。発効は公開前の安全確認後に行います。
          </div>
        ) : null}

        {articleLibraryActivationReady && articleLibraryReadiness ? (
          <div className={"membership-library-readiness " + (articleLibraryReadiness.automatedChecksPass ? "ready" : "blocked")}>
            <div className="membership-library-readiness-head">
              <div>
                <span>ROLLOUT READINESS</span>
                <strong>{articleLibraryReadiness.automatedChecksPass ? "自動確認 通過" : "発効前の確認事項あり"}</strong>
              </div>
              <button type="button" className="secondary-action" disabled={busy} onClick={() => void refreshArticleLibraryReadiness()}>
                再確認
              </button>
            </div>
            <div className="membership-library-readiness-grid">
              <article><span>対象プラン</span><strong>{articleLibraryReadiness.activeExpectedPlans} / 3</strong><small>{articleLibraryReadiness.planConfigReady ? "設定正常" : "設定要確認"}</small></article>
              <article><span>active一般ユーザー</span><strong>{articleLibraryReadiness.activeGeneralUsers}</strong><small>個人情報は表示しません</small></article>
              <article><span>将来上限の超過</span><strong>{articleLibraryReadiness.usersOverFutureLimit}</strong><small>0名のみ発効可能</small></article>
              <article><span>現在の最大保存数</span><strong>{articleLibraryReadiness.maxCurrentArticles}</strong><small>一般ユーザー内の最大値</small></article>
              <article><span>最大超過数</span><strong>{articleLibraryReadiness.maxOverage}</strong><small>現在は0件が安全</small></article>
            </div>
            <div className="membership-library-activation-actions">
              {articleLibraryReadiness.planLimitsEnabled ? (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => void setArticleLibraryQuotaEnforcement(false)}
                >
                  従来上限へ戻す（緊急停止）
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !articleLibraryReadiness.automatedChecksPass}
                  onClick={() => void setArticleLibraryQuotaEnforcement(true)}
                >
                  プラン別上限を発効（MFA必須）
                </button>
              )}
              <Link className="secondary-action" href="/admin/security">管理者MFAを確認</Link>
              <small>ONはAAL2＋DB側の再チェック必須。OFFは緊急停止としてactive管理者が実行できます。</small>
            </div>
          </div>
        ) : articleLibraryQuotaReady && articleLibraryPlanLimitsReady ? (
          <div className="route-notice" role="note">
            発効ガード用のDB migrationが未適用です。保存上限の値は編集できますが、本番発効操作は利用できません。
          </div>
        ) : null}

        {articleLibraryQuota && articleLibraryQuotaReady && (
          <div className="membership-library-quota-grid">
            <article className="membership-library-quota-card">
              <div>
                <span>FREE</span>
                <strong>無料ユーザー</strong>
              </div>
              <label className="route-field">
                <span>保存上限（件）</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={articleLibraryQuota.freeLimit}
                  onChange={(event) => setArticleLibraryQuota((current) => current ? {
                    ...current,
                    freeLimit: Math.max(1, Math.min(100000, Number(event.target.value) || 1)),
                  } : current)}
                />
              </label>
              <button type="button" disabled={busy} onClick={() => void saveArticleLibraryFreeLimit()}>
                無料上限を保存
              </button>
            </article>

            {plans.map((plan) => (
              <article className="membership-library-quota-card" key={"library-" + plan.planCode}>
                <div>
                  <span>PLAN {plan.tierRank}</span>
                  <strong>{plan.displayName}</strong>
                </div>
                <label className="membership-library-unlimited">
                  <input
                    type="checkbox"
                    checked={plan.articleLibraryUnlimited}
                    disabled={busy || !plan.articleLibraryManaged}
                    onChange={(event) => patchPlan(plan.planCode, {
                      articleLibraryUnlimited: event.target.checked,
                      articleLibraryLimit: event.target.checked ? null : (plan.articleLibraryLimit ?? 5),
                    })}
                  />
                  <span>保存数を無制限にする</span>
                </label>
                {!plan.articleLibraryUnlimited && (
                  <label className="route-field">
                    <span>保存上限（件）</span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={plan.articleLibraryLimit ?? ""}
                      disabled={busy || !plan.articleLibraryManaged}
                      onChange={(event) => patchPlan(plan.planCode, {
                        articleLibraryLimit: Math.max(1, Math.min(100000, Number(event.target.value) || 1)),
                      })}
                    />
                  </label>
                )}
                <div className="membership-plan-feature-summary">
                  <span>現在の設定</span>
                  <strong>{plan.articleLibraryUnlimited ? "無制限" : `${plan.articleLibraryLimit ?? "—"}件`}</strong>
                </div>
                <button
                  type="button"
                  disabled={busy || !plan.articleLibraryManaged}
                  onClick={() => void savePlanArticleLibraryQuota(plan)}
                >
                  保存上限を保存
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-panel membership-admin-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">STEP 4</p>
            <h2>プランごとの利用可能機能</h2>
          </div>
          <span className="availability-badge active">自由に割り振り</span>
        </div>
        <p className="trial-admin-note">
          各機能を3つのプランへ自由に割り振れます。「利用可」を押すたびにON/OFFが切り替わり、DB側の機能ゲートにも反映されます。
        </p>
        <div className="membership-feature-matrix">
          <div className="membership-feature-row membership-feature-head">
            <div>特典機能</div>
            {plans.map((plan) => <div key={plan.planCode}>{plan.displayName}</div>)}
          </div>
          {activeFeatures.map((feature) => (
            <div className="membership-feature-row" key={feature.featureKey}>
              <div className="membership-feature-copy">
                <strong>{feature.displayName}</strong>
                <small>{feature.description}</small>
                <code>{feature.featureKey}</code>
              </div>
              {plans.map((plan) => {
                const enabled = currentFeatureEnabled(plan.planCode, feature.featureKey, planFeatures);
                return (
                  <div key={plan.planCode}>
                    <button
                      type="button"
                      className={enabled ? "membership-feature-toggle enabled" : "membership-feature-toggle"}
                      aria-pressed={enabled}
                      disabled={busy || state !== "ready" || !configReady}
                      onClick={() => void toggleFeature(plan, feature)}
                    >
                      {enabled ? "利用可" : "利用不可"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel membership-admin-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">STEP 5</p>
            <h2>ユーザーへメンバー特典を付与</h2>
          </div>
          <span className="availability-badge">手動確認</span>
        </div>
        <p className="trial-admin-note">
          note側の加入状態は自動取得せず、管理者が確認できたユーザーへ付与します。PWA利用権とは別管理です。
        </p>

        <label className="route-field full">
          <span>ユーザー検索</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="AAS ID または表示名"
          />
        </label>

        <div className="membership-user-list">
          {filteredUsers.map((user) => (
            <button
              type="button"
              key={user.id}
              className={selectedUserId === user.id ? "selected" : ""}
              onClick={() => void selectUser(user)}
            >
              <strong>{user.aasUserId}</strong>
              <span>{user.displayName || "表示名なし"}</span>
              <small>{user.status}</small>
            </button>
          ))}
          {!filteredUsers.length && <p className="admin-empty-copy">該当するユーザーはいません。</p>}
        </div>

        {selectedUser && (
          <div className="membership-user-editor">
            <div className="membership-user-current">
              <div><span>選択中</span><strong>{selectedUser.aasUserId}</strong></div>
              <div>
                <span>現在の特典</span>
                <strong>{membershipEntitlements[0]?.productName ?? "未付与"}</strong>
                <small>{membershipEntitlements[0] ? `期限: ${formatDate(membershipEntitlements[0].expiresAt)}` : "—"}</small>
              </div>
            </div>

            <div className="admin-form-grid">
              <label className="route-field">
                <span>付与するプラン</span>
                <select
                  value={selectedPlan}
                  onChange={(event) => setSelectedPlan(event.target.value as CreatorMembershipPlanCode)}
                >
                  {CREATOR_MEMBERSHIP_PLANS.map((plan) => {
                    const managedPlan = plans.find((item) => item.planCode === plan.code);
                    return <option key={plan.code} value={plan.code}>{managedPlan?.displayName ?? plan.label}</option>;
                  })}
                </select>
              </label>
              <label className="route-field">
                <span>特典期限（任意）</span>
                <input
                  type="datetime-local"
                  value={membershipExpiry}
                  onChange={(event) => setMembershipExpiry(event.target.value)}
                />
              </label>
              <label className="route-field full">
                <span>note確認メモ・参照番号（任意）</span>
                <input
                  value={membershipReference}
                  onChange={(event) => setMembershipReference(event.target.value.slice(0, 255))}
                  placeholder="例: 2026-09-23 note加入確認"
                />
              </label>
            </div>

            <div className="admin-actions">
              <button type="button" disabled={busy} onClick={() => void assignMembership()}>
                {membershipEntitlements.length ? "プランを変更・更新" : "メンバー特典を付与"}
              </button>
              {membershipEntitlements.length > 0 && (
                <button className="secondary-action" type="button" disabled={busy} onClick={() => void revokeMembership()}>
                  メンバー特典を取り消す
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {operationsReady && <MembershipAuditSection auditActions={auditActions} />}

      <MembershipRecommendationsSection />

      {message && state !== "error" && (
        <div className="route-notice" role="status" aria-live="polite">{message}</div>
      )}
    </main>
  );
}
