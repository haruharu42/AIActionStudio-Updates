"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminAccessCodePanel } from "@/components/admin-users/admin-access-code-panel";
import {
  AdminSelectedUserPanel,
  AdminUserSelectionPanel,
} from "@/components/admin-users/admin-user-panels";
import {
  filterAdminUsers,
  summarizeAccessCodes,
  summarizeAdminUsers,
  type UserFilter,
} from "@/lib/admin-users-view";
import {
  clearCreatorMembershipPlan,
  createPwaAccessCode,
  grantPwaEntitlement,
  listCreatorMembershipEntitlements,
  listPwaAccessCodes,
  listPwaAdminUsers,
  listPwaInviteRedemptions,
  listPwaEntitlements,
  revokePwaAccessCode,
  revokePwaEntitlement,
  setCreatorMembershipPlan,
  setPwaAdminUserStatus,
  type CreatorMembershipPlanCode,
  type PwaAdminEntitlement,
  type PwaAdminInvite,
  type PwaAdminUser,
  type PwaInviteRedemption,
} from "@/lib/pwa-admin-users";
import { getSupabaseClient } from "@/lib/supabase";

type LoadState = "loading" | "ready" | "error";

export function PwaAdminUsersPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [users, setUsers] = useState<PwaAdminUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const selectedIdRef = useRef("");
  const [entitlements, setEntitlements] = useState<PwaAdminEntitlement[]>([]);
  const [membershipEntitlements, setMembershipEntitlements] = useState<PwaAdminEntitlement[]>([]);
  const [codes, setCodes] = useState<PwaAdminInvite[]>([]);
  const [redemptions, setRedemptions] = useState<PwaInviteRedemption[]>([]);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [grantChannel, setGrantChannel] = useState("admin-pwa");
  const [grantReference, setGrantReference] = useState("");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [membershipPlan, setMembershipPlan] = useState<CreatorMembershipPlanCode>("CREATOR_CLUB");
  const [membershipReference, setMembershipReference] = useState("");
  const [membershipExpiry, setMembershipExpiry] = useState("");
  const [codeLabel, setCodeLabel] = useState("");
  const [codeChannel, setCodeChannel] = useState("external-sale");
  const [codeReference, setCodeReference] = useState("");
  const [codeExpiry, setCodeExpiry] = useState("");
  const [accessExpiry, setAccessExpiry] = useState("");
  const [maxUses, setMaxUses] = useState(1);

  const selected = useMemo(
    () => users.find((user) => user.id === selectedId) ?? null,
    [users, selectedId],
  );
  const userStats = useMemo(() => summarizeAdminUsers(users), [users]);
  const codeStats = useMemo(() => summarizeAccessCodes(codes), [codes]);
  const filteredUsers = useMemo(
    () => filterAdminUsers(users, search, userFilter),
    [search, userFilter, users],
  );

  const refreshSelectedEntitlements = useCallback(async (userId: string) => {
    if (!userId) {
      setEntitlements([]);
      setMembershipEntitlements([]);
      return;
    }

    const client = getSupabaseClient();
    const [nextPwa, nextMembership] = await Promise.all([
      listPwaEntitlements(client, userId),
      listCreatorMembershipEntitlements(client, userId),
    ]);
    setEntitlements(nextPwa);
    setMembershipEntitlements(nextMembership);
  }, []);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    const [nextUsers, nextCodes, nextRedemptions] = await Promise.all([
      listPwaAdminUsers(client),
      listPwaAccessCodes(client),
      listPwaInviteRedemptions(client),
    ]);
    setUsers(nextUsers);
    setCodes(nextCodes);
    setRedemptions(nextRedemptions);

    const currentSelectedId = selectedIdRef.current;
    const nextSelectedId = nextUsers.some((user) => user.id === currentSelectedId)
      ? currentSelectedId
      : nextUsers[0]?.id ?? "";
    selectedIdRef.current = nextSelectedId;
    setSelectedId(nextSelectedId);
    await refreshSelectedEntitlements(nextSelectedId);
  }, [refreshSelectedEntitlements]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void refresh().then(
        () => { if (active) setState("ready"); },
        (error: unknown) => {
          if (!active) return;
          setState("error");
          setMessage(error instanceof Error ? error.message : "管理データを取得できませんでした。");
        },
      );
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const selectUser = async (user: PwaAdminUser) => {
    selectedIdRef.current = user.id;
    setSelectedId(user.id);
    setMessage("");
    try {
      await refreshSelectedEntitlements(user.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "利用権を取得できませんでした。");
    }
  };

  const runMutation = async (action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const refreshNow = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await refresh();
      setMessage("最新状態へ更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const setSelectedStatus = async (status: "active" | "suspended") => {
    if (!selected) return;
    const success = selected.status === "pending"
      ? "アカウントを承認しました。"
      : status === "suspended"
        ? "アカウントを停止しました。"
        : "アカウントを再開しました。";
    await runMutation(
      () => setPwaAdminUserStatus(getSupabaseClient(), selected.id, status),
      success,
    );
  };

  const grantSimplePwaAccess = async () => {
    if (!selected) return;
    await runMutation(
      () => grantPwaEntitlement(getSupabaseClient(), selected.id, { salesChannel: "admin-pwa" }),
      "PWA利用権を付与しました。PC・スマホ・タブレットで共通して利用できます。",
    );
  };

  const grantDetailedPwaAccess = async () => {
    if (!selected) return;
    await runMutation(
      () => grantPwaEntitlement(getSupabaseClient(), selected.id, {
        salesChannel: grantChannel,
        externalReference: grantReference,
        expiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : undefined,
      }),
      "指定した条件でPWA利用権を付与しました。PC・スマホ・タブレット共通で利用できます。",
    );
  };

  const revokeSelectedPwaAccess = async () => {
    if (!selected) return;
    await runMutation(
      () => revokePwaEntitlement(getSupabaseClient(), selected.id),
      "PWA利用権を取り消しました。",
    );
  };

  const saveMembership = async () => {
    if (!selected) return;
    await runMutation(
      () => setCreatorMembershipPlan(getSupabaseClient(), selected.id, {
        planCode: membershipPlan,
        expiresAt: membershipExpiry ? new Date(membershipExpiry).toISOString() : undefined,
        externalReference: membershipReference,
      }),
      "Creator Club特典を設定しました。",
    );
  };

  const clearMembership = async () => {
    if (!selected) return;
    await runMutation(
      () => clearCreatorMembershipPlan(getSupabaseClient(), selected.id),
      "Creator Club特典を解除しました。",
    );
  };

  const copyAccessCode = async (code: string) => {
    if (!navigator.clipboard) {
      setMessage("このブラウザではクリップボードを利用できません。");
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setMessage("利用コードをコピーしました。");
    } catch {
      setMessage("利用コードをコピーできませんでした。コードを選択してコピーしてください。");
    }
  };

  const createCode = async () => {
    await runMutation(async () => {
      const created = await createPwaAccessCode(getSupabaseClient(), {
        label: codeLabel,
        salesChannel: codeChannel,
        externalReference: codeReference,
        expiresAt: codeExpiry ? new Date(codeExpiry).toISOString() : undefined,
        entitlementExpiresAt: accessExpiry ? new Date(accessExpiry).toISOString() : undefined,
        maxUses,
      });
      if (navigator.clipboard) await navigator.clipboard.writeText(created.code).catch(() => undefined);
      setCodeLabel("");
      setCodeReference("");
      setCodeExpiry("");
      setAccessExpiry("");
    }, "PWA利用コードを作成しました。可能な場合はクリップボードにもコピーしています。");
  };

  const revokeCode = async (codeId: string) => {
    await runMutation(
      () => revokePwaAccessCode(getSupabaseClient(), codeId),
      "PWA利用コードを無効化しました。",
    );
  };

  if (state === "loading") {
    return (
      <main className="admin-dashboard">
        <section className="admin-card admin-loading-card">
          <span className="admin-loading-dot" aria-hidden="true" />
          <p>ユーザー管理を読み込んでいます…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-dashboard">
      <section className="admin-card admin-hero-card">
        <div className="admin-hero-copy">
          <p className="eyebrow">PWA USER ACCESS</p>
          <h1>PWAユーザー利用管理</h1>
          <p>PWA利用権はPC・スマホ・タブレット共通です。端末ごとの承認や追加の利用権付与は必要ありません。</p>
        </div>
        {state === "ready" && (
          <div className="admin-simple-stats" aria-label="利用状況">
            <span><strong>{userStats.pending}</strong> 承認待ち</span>
            <span><strong>{userStats.active}</strong> 利用中</span>
            <span><strong>{codeStats.active}</strong> 有効コード</span>
          </div>
        )}
        {message && <p role="status" className="admin-message">{message}</p>}
        {state === "error" && <button type="button" onClick={() => window.location.reload()}>再読み込み</button>}
      </section>

      {state === "ready" && (
        <>
          <AdminUserSelectionPanel
            users={filteredUsers}
            selectedId={selectedId}
            search={search}
            userFilter={userFilter}
            busy={busy}
            onSearchChange={setSearch}
            onFilterChange={setUserFilter}
            onSelect={(user) => void selectUser(user)}
            onClearFilters={() => { setSearch(""); setUserFilter("all"); }}
            onRefresh={() => void refreshNow()}
          />

          {selected && (
            <AdminSelectedUserPanel
              selected={selected}
              entitlements={entitlements}
              membershipEntitlements={membershipEntitlements}
              busy={busy}
              grantChannel={grantChannel}
              grantReference={grantReference}
              grantExpiry={grantExpiry}
              membershipPlan={membershipPlan}
              membershipReference={membershipReference}
              membershipExpiry={membershipExpiry}
              onGrantChannelChange={setGrantChannel}
              onGrantReferenceChange={setGrantReference}
              onGrantExpiryChange={setGrantExpiry}
              onMembershipPlanChange={setMembershipPlan}
              onMembershipReferenceChange={setMembershipReference}
              onMembershipExpiryChange={setMembershipExpiry}
              onSetStatus={(status) => void setSelectedStatus(status)}
              onGrantSimplePwaAccess={() => void grantSimplePwaAccess()}
              onRevokePwaAccess={() => void revokeSelectedPwaAccess()}
              onGrantDetailedPwaAccess={() => void grantDetailedPwaAccess()}
              onSaveMembership={() => void saveMembership()}
              onClearMembership={() => void clearMembership()}
            />
          )}

          <AdminAccessCodePanel
            codes={codes}
            redemptions={redemptions}
            activeCount={codeStats.active}
            usedCount={codeStats.used}
            busy={busy}
            codeLabel={codeLabel}
            codeChannel={codeChannel}
            codeReference={codeReference}
            codeExpiry={codeExpiry}
            accessExpiry={accessExpiry}
            maxUses={maxUses}
            onCodeLabelChange={setCodeLabel}
            onCodeChannelChange={setCodeChannel}
            onCodeReferenceChange={setCodeReference}
            onCodeExpiryChange={setCodeExpiry}
            onAccessExpiryChange={setAccessExpiry}
            onMaxUsesChange={setMaxUses}
            onCreate={() => void createCode()}
            onCopy={(code) => void copyAccessCode(code)}
            onRevoke={(codeId) => void revokeCode(codeId)}
          />
        </>
      )}
    </main>
  );
}
