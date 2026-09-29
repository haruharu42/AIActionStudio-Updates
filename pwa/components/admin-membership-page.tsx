"use client";

import Link from "next/link";
import { MembershipAuditSection, MembershipRecommendationsSection, MembershipStatusSection } from "@/components/admin-membership/admin-membership-static-sections";
import { SelectWithCustom } from "@/components/select-with-custom";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getArticleLibraryQuotaSettings,
  getMembershipSettings,
  listMembershipAuditActions,
  listMembershipAssignments,
  listMembershipFeatures,
  listMembershipPlanFeatures,
  listMembershipPlans,
  setMembershipPlanFeature,
  updateArticleLibraryQuotaSettings,
  updateMembershipPlan,
  updateMembershipSettings,
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

const EMPTY_LIBRARY_QUOTA: ArticleLibraryQuotaSettings = {
  freeLimit: 5,
  planLimitsEnabled: false,
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
  const [libraryQuota, setLibraryQuota] = useState<ArticleLibraryQuotaSettings>(EMPTY_LIBRARY_QUOTA);
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
      const [nextSettings, nextLibraryQuota, nextPlans, nextFeatures, nextPlanFeatures] = await Promise.all([
        getMembershipSettings(client),
        getArticleLibraryQuotaSettings(client),
        listMembershipPlans(client),
        listMembershipFeatures(client),
        listMembershipPlanFeatures(client),
      ]);
      setSettings(nextSettings);
      setLibraryQuota(nextLibraryQuota);
      setPlans(nextPlans);
      setFeatures(nextFeatures);
      setPlanFeatures(nextPlanFeatures);
      setConfigReady(true);
    } catch {
      setConfigReady(false);
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

  const saveFreeArticleLimit = async () => {
    if (busy) return;
    if (!Number.isInteger(libraryQuota.freeLimit) || libraryQuota.freeLimit < 1 || libraryQuota.freeLimit > 100000) {
      setMessage("無料プランの記事保存数は1〜100,000件の範囲で入力してください。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      await updateArticleLibraryQuotaSettings(client, libraryQuota.freeLimit);
      setLibraryQuota(await getArticleLibraryQuotaSettings(client));
      setMessage(`無料プランの記事ライブラリ保存上限を${libraryQuota.freeLimit}件に設定しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無料プランの記事保存上限を保存できませんでした。");
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
    if (!plan.storageQuotaManaged) {
      setMessage("記事保存数設定用のDB migrationがまだ未適用です。");
      return;
    }
    if (plan.articleLibraryLimit !== null && (!Number.isInteger(plan.articleLibraryLimit) || plan.articleLibraryLimit < 1 || plan.articleLibraryLimit > 100000)) {
      setMessage("記事ライブラリ保存数は1〜100,000件、または無制限を設定してください。");
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
        articleLibraryLimit: plan.articleLibraryLimit,
      });
      setPlans(await listMembershipPlans(getSupabaseClient()));
      setMessage(`${plan.displayName}の料金・表示・記事保存数設定を保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "プラン設定を保存できませんでした。");
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
          記事ライブラリの保存可能数も、無料プランと各有料プランごとにここで設定できます。
        </p>
        <div className="membership-plan-editor-card membership-free-storage-card">
          <div className="membership-plan-editor-head">
            <div>
              <span>FREE PLAN</span>
              <code>FREE</code>
            </div>
            <strong>記事保存 {libraryQuota.freeLimit.toLocaleString("ja-JP")}件</strong>
          </div>
          <SelectWithCustom
            className="route-field"
            label="無料プランの記事ライブラリ保存数"
            value={String(libraryQuota.freeLimit)}
            onChange={(value) => setLibraryQuota((current) => ({
              ...current,
              freeLimit: Math.max(1, Math.min(100000, Number(value) || 1)),
            }))}
            options={[
              { value: "5", label: "5件" },
              { value: "10", label: "10件" },
              { value: "15", label: "15件" },
              { value: "30", label: "30件" },
              { value: "50", label: "50件" },
              { value: "100", label: "100件" },
            ]}
            placeholder="保存数を選択"
            customPlaceholder="その他の保存数を入力"
            inputType="number"
            min={1}
            max={100000}
          />
          <button type="button" disabled={busy} onClick={() => void saveFreeArticleLimit()}>
            無料プランの保存数を保存
          </button>
          <small>
            {libraryQuota.planLimitsEnabled
              ? "この保存上限は現在有効です。"
              : "設定値は保存できます。プラン別保存上限はPreview確認後、一般公開時に有効化します。"}
          </small>
        </div>
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
              <SelectWithCustom
                className="route-field"
                label="記事ライブラリ保存数"
                value={plan.articleLibraryLimit === null ? "unlimited" : String(plan.articleLibraryLimit)}
                onChange={(value) => patchPlan(plan.planCode, {
                  articleLibraryLimit: value === "unlimited"
                    ? null
                    : Math.max(1, Math.min(100000, Number(value) || 1)),
                })}
                options={[
                  { value: "15", label: "15件" },
                  { value: "30", label: "30件" },
                  { value: "50", label: "50件" },
                  { value: "100", label: "100件" },
                  { value: "unlimited", label: "無制限" },
                ]}
                placeholder="保存数を選択"
                customPlaceholder="その他の保存数を入力"
                inputType="number"
                min={1}
                max={100000}
              />
              <small className="trial-admin-note">
                現在: {plan.articleLibraryLimit === null ? "無制限" : `${plan.articleLibraryLimit.toLocaleString("ja-JP")}件`}
              </small>
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

      <section className="admin-panel membership-admin-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">STEP 3</p>
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
            <p className="eyebrow">STEP 4</p>
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
