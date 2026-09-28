"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AdminPresetNumberField, AdminSelectWithCustom } from "@/components/admin-form-controls";
import {
  entitlementStatusLabel,
  expiresWithin,
  fmt,
  fmtDate,
  inviteStatusLabel,
  isCurrentEntitlement,
  isUsableInvite,
  loadEntitlementOverview,
  nearestExpiry,
  roleLabel,
  statusLabel,
} from "@/components/phase10-admin/phase10-admin-page-helpers";

import { getSupabaseClient } from "@/lib/supabase";
import {
  PWA_PRODUCT,
  WINDOWS_PRODUCT,
  createPwaInvite,
  grantEntitlement,
  listAdminUsers,
  listPwaInvites,
  listUserEntitlements,
  revokeEntitlement,
  revokePwaInvite,
  setAdminUserStatus,
  type AdminEntitlement,
  type AdminInvite,
  type AdminUser,
} from "@/lib/phase10-admin";

type Gate =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "denied" }
  | { kind: "ready"; aasId: string }
  | { kind: "error"; message: string };

type StatusFilter = "all" | AdminUser["status"];
type RoleFilter = "all" | AdminUser["role"];
type AccessFilter = "all" | "pwa" | "windows" | "both" | "none";
type InviteFilter = "all" | "usable" | "expired" | "exhausted" | "revoked";
type OverviewState = "idle" | "loading" | "ready" | "partial";

const SALES_CHANNEL_OPTIONS = [
  { value: "admin", label: "管理者による直接付与", note: "個別対応やテスト利用など、管理者が直接付与する場合。" },
  { value: "admin-invite", label: "管理者発行の招待コード" },
  { value: "note", label: "note販売" },
  { value: "tips", label: "Tips販売" },
  { value: "brain", label: "Brain販売" },
  { value: "stripe", label: "Stripe決済" },
  { value: "campaign", label: "キャンペーン・配布" },
  { value: "support", label: "問い合わせ対応・補填" },
  { value: "migration", label: "移行・既存ユーザー対応" },
] as const;

const INVITE_LABEL_OPTIONS = [
  "βテスター",
  "note購入者",
  "Tips購入者",
  "Brain購入者",
  "キャンペーン配布",
  "サポート個別対応",
  "期間限定テスト",
  "運営確認用",
] as const;

type AccessFlags = {
  pwa: boolean;
  windows: boolean;
  implicitAdmin: boolean;
};

export function Phase10AdminPage() {
  const { state: accessState } = useSharedAccessState();
  const [initError, setInitError] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [entitlementsByUser, setEntitlementsByUser] = useState<Record<string, AdminEntitlement[]>>({});
  const [overviewState, setOverviewState] = useState<OverviewState>("idle");
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [grantSalesChannel, setGrantSalesChannel] = useState("admin");
  const [grantExternalReference, setGrantExternalReference] = useState("");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteSalesChannel, setInviteSalesChannel] = useState("admin-invite");
  const [inviteExternalReference, setInviteExternalReference] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [inviteEntitlementExpiry, setInviteEntitlementExpiry] = useState("");
  const [maxUses, setMaxUses] = useState(1);

  const activeAdminId =
    accessState.kind === "ready" && accessState.profile.role === "admin" && accessState.profile.status === "active"
      ? accessState.profile.id
      : "";

  const gate = useMemo<Gate>(() => {
    if (accessState.kind === "ready") {
      if (accessState.profile.role !== "admin" || accessState.profile.status !== "active") return { kind: "denied" };
      if (initError) return { kind: "error", message: initError };
      return { kind: "ready", aasId: accessState.profile.aas_user_id };
    }
    if (accessState.kind === "loading") return { kind: "loading" };
    if (accessState.kind === "signed_out") return { kind: "signed_out" };
    if (accessState.kind === "unavailable") {
      return { kind: "error", message: "AASへ接続できませんでした。通信状態を確認してください。" };
    }
    return { kind: "denied" };
  }, [accessState, initError]);

  const selected = useMemo(
    () => users.find((user) => user.id === selectedId) ?? null,
    [users, selectedId],
  );

  const selectedEntitlements = selected ? entitlementsByUser[selected.id] ?? [] : [];

  const accessFor = useCallback((user: AdminUser): AccessFlags => {
    if (user.role === "admin" && user.status === "active") {
      return { pwa: true, windows: true, implicitAdmin: true };
    }
    const items = entitlementsByUser[user.id] ?? [];
    return {
      pwa: items.some((item) => item.productCode === PWA_PRODUCT && isCurrentEntitlement(item)),
      windows: items.some((item) => item.productCode === WINDOWS_PRODUCT && isCurrentEntitlement(item)),
      implicitAdmin: false,
    };
  }, [entitlementsByUser]);

  const reloadBase = useCallback(async () => {
    const client = getSupabaseClient();
    const [nextUsers, nextInvites] = await Promise.all([
      listAdminUsers(client),
      listPwaInvites(client),
    ]);
    setUsers(nextUsers);
    setInvites(nextInvites);
    setOverviewState("loading");
    const overview = await loadEntitlementOverview(nextUsers);
    setEntitlementsByUser(overview.map);
    setOverviewState(overview.partial ? "partial" : "ready");
  }, []);

  useEffect(() => {
    if (!activeAdminId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setInitError("");
    });
    const boot = async () => {
      try {
        await reloadBase();
      } catch (error) {
        if (active) {
          setInitError(error instanceof Error ? error.message : "管理画面の初期化に失敗しました。");
        }
      }
    };
    void boot();
    return () => {
      active = false;
    };
  }, [activeAdminId, reloadBase]);

  const reload = async () => {
    setBusy(true);
    setMessage("");
    try {
      await reloadBase();
      setMessage("最新の管理データへ更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const selectUser = async (user: AdminUser) => {
    setSelectedId(user.id);
    setMessage("");
    if (user.role === "admin") return;
    try {
      const next = await listUserEntitlements(getSupabaseClient(), user.id);
      setEntitlementsByUser((current) => ({ ...current, [user.id]: next }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "利用権を取得できませんでした。");
    }
  };

  const runUserAction = async (
    action: () => Promise<void>,
    successMessage: string,
    confirmation?: string,
  ) => {
    if (!selected) return;
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      await reloadBase();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const makeInvite = async () => {
    setBusy(true);
    setMessage("");
    try {
      const invite = await createPwaInvite(getSupabaseClient(), {
        label: inviteLabel,
        salesChannel: inviteSalesChannel,
        externalReference: inviteExternalReference,
        expiresAt: inviteExpiry ? new Date(inviteExpiry).toISOString() : undefined,
        entitlementExpiresAt: inviteEntitlementExpiry
          ? new Date(inviteEntitlementExpiry).toISOString()
          : undefined,
        maxUses,
      });
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(invite.code).catch(() => undefined);
      }
      setMessage(`招待コードを作成しました: ${invite.code}`);
      setInviteLabel("");
      setInviteExternalReference("");
      setInvites(await listPwaInvites(getSupabaseClient()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "招待コード作成に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const disableInvite = async (inviteId: string) => {
    if (!window.confirm("この招待コードを無効化しますか？\n無効化後は新規利用できません。")) return;
    setBusy(true);
    setMessage("");
    try {
      await revokePwaInvite(getSupabaseClient(), inviteId);
      setInvites(await listPwaInvites(getSupabaseClient()));
      setMessage("招待コードを無効化しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "招待コードを無効化できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const copyInviteCode = async (invite: AdminInvite) => {
    if (!navigator.clipboard) {
      setMessage("このブラウザーでは自動コピーできません。コードを長押ししてコピーしてください。");
      return;
    }
    try {
      await navigator.clipboard.writeText(invite.code);
      setMessage("招待コードをコピーしました。");
    } catch {
      setMessage("招待コードをコピーできませんでした。");
    }
  };

  const pendingUsers = useMemo(() => users.filter((user) => user.status === "pending"), [users]);
  const suspendedUsers = useMemo(() => users.filter((user) => user.status === "suspended"), [users]);
  const pwaUsers = useMemo(
    () => users.filter((user) => user.role === "user" && user.status === "active" && accessFor(user).pwa),
    [users, accessFor],
  );
  const windowsUsers = useMemo(
    () => users.filter((user) => user.role === "user" && user.status === "active" && accessFor(user).windows),
    [users, accessFor],
  );
  const usableInvites = useMemo(() => invites.filter(isUsableInvite), [invites]);

  const expiringUsers = useMemo(() => {
    return users
      .filter((user) => user.role === "user")
      .map((user) => ({ user, expiry: nearestExpiry(entitlementsByUser[user.id] ?? []) }))
      .filter((item): item is { user: AdminUser; expiry: string } => Boolean(item.expiry && expiresWithin(item.expiry, 7)))
      .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
  }, [users, entitlementsByUser]);

  const expiringInvites = useMemo(
    () => invites.filter((invite) => isUsableInvite(invite) && expiresWithin(invite.expiresAt, 7)),
    [invites],
  );

  const channelSummary = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(entitlementsByUser)
      .flat()
      .filter(isCurrentEntitlement)
      .forEach((item) => {
        const label = item.salesChannel || "未設定";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [entitlementsByUser]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (query) {
        const haystack = `${user.aasUserId} ${user.displayName ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (accessFilter !== "all") {
        const access = accessFor(user);
        if (accessFilter === "pwa" && !access.pwa) return false;
        if (accessFilter === "windows" && !access.windows) return false;
        if (accessFilter === "both" && !(access.pwa && access.windows)) return false;
        if (accessFilter === "none" && (access.pwa || access.windows)) return false;
      }
      return true;
    });
  }, [users, search, statusFilter, roleFilter, accessFilter, accessFor]);

  const filteredInvites = useMemo(() => {
    return invites.filter((invite) => {
      if (inviteFilter === "all") return true;
      if (inviteFilter === "usable") return isUsableInvite(invite);
      if (inviteFilter === "expired") return invite.status === "active" && !isUsableInvite(invite);
      return invite.status === inviteFilter;
    });
  }, [invites, inviteFilter]);

  const clearUserFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRoleFilter("all");
    setAccessFilter("all");
  };

  if (gate.kind === "loading") return null;

  if (gate.kind !== "ready") {
    return (
      <main className="standalone-page">
        <section className="standalone-card">
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>管理ダッシュボード</h1>
          {gate.kind === "signed_out" && <p className="route-notice error">先にログインしてください。</p>}
          {gate.kind === "denied" && <p className="route-notice error">active管理者のみ利用できます。</p>}
          {gate.kind === "error" && <p className="route-notice error">{gate.message}</p>}
          <Link className="route-back" href="/">← ホームへ戻る</Link>
        </section>
      </main>
    );
  }

  const attentionCount = pendingUsers.length + expiringUsers.length + expiringInvites.length;

  return (
    <main className="admin-page admin-dashboard-page">
      <header className="admin-head admin-dashboard-head">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>管理ダッシュボード</h1>
          <p>{gate.aasId} / ユーザー・利用権・PWA招待をひとつの画面で確認できます。</p>
        </div>
        <div className="admin-head-actions">
          <button disabled={busy} type="button" className="secondary-action" onClick={() => void reload()}>
            最新情報に更新
          </button>
          <Link className="route-back" href="/">← ホーム</Link>
        </div>
      </header>

      {message && <div className="route-notice">{message}</div>}
      {overviewState === "partial" && (
        <div className="route-notice error">一部ユーザーの利用権集計を取得できませんでした。個別ユーザーを開くと再取得できます。</div>
      )}

      <section className="admin-dashboard-section" aria-labelledby="admin-summary-title">
        <div className="admin-section-heading">
          <div><p className="eyebrow">OVERVIEW</p><h2 id="admin-summary-title">運用サマリー</h2></div>
          <small>{overviewState === "loading" ? "利用権を集計しています…" : "現在の管理対象をリアルタイム集計"}</small>
        </div>
        <div className="admin-summary-grid">
          <button type="button" className="admin-summary-card" onClick={clearUserFilters}>
            <span>総ユーザー</span><strong>{users.length}</strong><small>管理者を含む登録数</small>
          </button>
          <button type="button" className={pendingUsers.length ? "admin-summary-card alert" : "admin-summary-card"} onClick={() => { setStatusFilter("pending"); setRoleFilter("all"); setAccessFilter("all"); }}>
            <span>承認待ち</span><strong>{pendingUsers.length}</strong><small>対応が必要な登録</small>
          </button>
          <button type="button" className="admin-summary-card" onClick={() => { setStatusFilter("active"); setRoleFilter("user"); setAccessFilter("pwa"); }}>
            <span>PWA利用者</span><strong>{pwaUsers.length}</strong><small>有効な一般ユーザー</small>
          </button>
          <button type="button" className="admin-summary-card" onClick={() => { setStatusFilter("active"); setRoleFilter("user"); setAccessFilter("windows"); }}>
            <span>Windows利用者</span><strong>{windowsUsers.length}</strong><small>有効な一般ユーザー</small>
          </button>
          <button type="button" className={suspendedUsers.length ? "admin-summary-card warning" : "admin-summary-card"} onClick={() => { setStatusFilter("suspended"); setRoleFilter("all"); setAccessFilter("all"); }}>
            <span>停止中</span><strong>{suspendedUsers.length}</strong><small>再開・確認対象</small>
          </button>
          <a className="admin-summary-card" href="#admin-invites">
            <span>利用可能な招待</span><strong>{usableInvites.length}</strong><small>現在使用できるコード</small>
          </a>
        </div>
      </section>

      <section className="admin-operations-grid admin-dashboard-section">
        <article className="admin-panel admin-attention-panel">
          <div className="admin-panel-heading">
            <div><p className="eyebrow">ACTION</p><h2>要対応</h2></div>
            <span className={attentionCount ? "admin-count-badge alert" : "admin-count-badge"}>{attentionCount}</span>
          </div>
          {attentionCount === 0 && <div className="admin-empty-state"><strong>現在、急ぎの対応はありません。</strong><span>承認待ちや7日以内の期限切れが発生するとここへ表示されます。</span></div>}
          <div className="admin-attention-list">
            {pendingUsers.slice(0, 4).map((user) => (
              <button key={`pending-${user.id}`} type="button" onClick={() => void selectUser(user)}>
                <span className="admin-attention-icon">!</span>
                <span><strong>{user.aasUserId} の承認待ち</strong><small>{user.displayName || "名称未設定"} / 登録 {fmtDate(user.createdAt)}</small></span>
              </button>
            ))}
            {expiringUsers.slice(0, 4).map(({ user, expiry }) => (
              <button key={`expiry-${user.id}`} type="button" onClick={() => void selectUser(user)}>
                <span className="admin-attention-icon clock">7</span>
                <span><strong>{user.aasUserId} の利用権期限が近い</strong><small>{fmt(expiry)} に期限到達</small></span>
              </button>
            ))}
            {expiringInvites.slice(0, 3).map((invite) => (
              <a key={`invite-${invite.id}`} href="#admin-invites">
                <span className="admin-attention-icon clock">7</span>
                <span><strong>{invite.label || "PWA招待"} の期限が近い</strong><small>{fmt(invite.expiresAt)} / {invite.useCount}/{invite.maxUses} 使用</small></span>
              </a>
            ))}
          </div>
        </article>

        <article className="admin-panel admin-channel-panel">
          <div className="admin-panel-heading">
            <div><p className="eyebrow">ACCESS</p><h2>利用権・販売状況</h2></div>
            <span className="admin-count-badge">{pwaUsers.length + windowsUsers.length}</span>
          </div>
          <div className="admin-platform-summary">
            <div><span>PWA</span><strong>{pwaUsers.length}</strong><small>有効ユーザー</small></div>
            <div><span>Windows</span><strong>{windowsUsers.length}</strong><small>有効ユーザー</small></div>
          </div>
          <h3>販売チャネル別・有効利用権</h3>
          {channelSummary.length === 0 ? (
            <p className="panel-muted">有効な一般ユーザー利用権はありません。</p>
          ) : (
            <div className="admin-channel-list">
              {channelSummary.map(([channel, count]) => <div key={channel}><span>{channel}</span><strong>{count}</strong></div>)}
            </div>
          )}
        </article>
      </section>

      <section className="admin-workspace admin-dashboard-section" aria-labelledby="admin-users-title">
        <article className="admin-panel admin-users-panel">
          <div className="admin-panel-heading">
            <div><p className="eyebrow">USERS</p><h2 id="admin-users-title">ユーザー管理</h2></div>
            <span className="admin-count-badge">{filteredUsers.length}/{users.length}</span>
          </div>
          <div className="admin-filter-grid">
            <label className="admin-filter-control admin-filter-search">
              <span>AAS ID・表示名</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="例: AAS-000002" />
            </label>
            <label className="admin-filter-control">
              <span>状態</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">すべて</option><option value="pending">承認待ち</option><option value="active">利用中</option><option value="suspended">停止中</option><option value="disabled">無効</option>
              </select>
            </label>
            <label className="admin-filter-control">
              <span>区分</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
                <option value="all">すべて</option><option value="user">一般ユーザー</option><option value="admin">管理者</option>
              </select>
            </label>
            <label className="admin-filter-control">
              <span>利用環境</span>
              <select disabled={overviewState === "loading"} value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}>
                <option value="all">すべて</option><option value="pwa">PWA利用可</option><option value="windows">Windows利用可</option><option value="both">両方利用可</option><option value="none">利用権なし</option>
              </select>
            </label>
          </div>
          <button type="button" className="admin-clear-filters" onClick={clearUserFilters}>絞り込みを解除</button>

          <div className="admin-user-list admin-user-list-modern">
            {filteredUsers.map((user) => {
              const access = accessFor(user);
              return (
                <button key={user.id} className={user.id === selectedId ? "admin-user active" : "admin-user"} type="button" onClick={() => void selectUser(user)}>
                  <span className="admin-user-top">
                    <span><strong>{user.aasUserId}</strong><small>{user.displayName || "名称未設定"}</small></span>
                    <span className={`admin-status-pill ${user.status}`}>{statusLabel(user.status)}</span>
                  </span>
                  <span className="admin-user-badges">
                    <span className="admin-badge neutral">{roleLabel(user.role)}</span>
                    {access.pwa && <span className="admin-badge pwa">PWA ✓</span>}
                    {access.windows && <span className="admin-badge windows">Windows ✓</span>}
                    {!access.pwa && !access.windows && <span className="admin-badge muted">利用権なし</span>}
                  </span>
                  <span className="admin-user-date">登録 {fmtDate(user.createdAt)}</span>
                </button>
              );
            })}
            {filteredUsers.length === 0 && <div className="admin-empty-state compact"><strong>条件に一致するユーザーはいません。</strong><span>絞り込み条件を変更してください。</span></div>}
          </div>
        </article>

        <article className="admin-panel admin-detail-panel">
          <div className="admin-panel-heading">
            <div><p className="eyebrow">DETAIL</p><h2>アカウント詳細</h2></div>
          </div>
          {!selected && <div className="admin-empty-state"><strong>ユーザーを選択してください。</strong><span>左の一覧から選ぶと、状態・利用権・管理操作を確認できます。</span></div>}
          {selected && (
            <>
              <div className="admin-selected-hero">
                <div><span>{roleLabel(selected.role)}</span><h3>{selected.aasUserId}</h3><p>{selected.displayName || "名称未設定"}</p></div>
                <span className={`admin-status-pill large ${selected.status}`}>{statusLabel(selected.status)}</span>
              </div>

              <div className="admin-account-facts">
                <div><span>登録日</span><strong>{fmtDate(selected.createdAt)}</strong></div>
                <div><span>アカウント区分</span><strong>{roleLabel(selected.role)}</strong></div>
              </div>

              <div className="admin-access-summary">
                <div className={accessFor(selected).pwa ? "active" : ""}><span>PWA</span><strong>{accessFor(selected).pwa ? "利用可" : "なし"}</strong></div>
                <div className={accessFor(selected).windows ? "active" : ""}><span>Windows</span><strong>{accessFor(selected).windows ? "利用可" : "なし"}</strong></div>
              </div>
              {accessFor(selected).implicitAdmin && <p className="admin-inline-note">管理者はactive状態の間、個別利用権がなくてもPWA・Windowsの両方を利用できます。</p>}

              <div className="admin-actions admin-primary-actions">
                {selected.status === "pending" && <button disabled={busy} className="primary-action" type="button" onClick={() => void runUserAction(() => setAdminUserStatus(getSupabaseClient(), selected.id, "active"), "ユーザーを承認しました。", `${selected.aasUserId} を承認して利用可能にしますか？`)}>承認する</button>}
                {selected.status === "active" && !(selected.role === "admin" && selected.aasUserId === gate.aasId) && <button disabled={busy} className="danger-action" type="button" onClick={() => void runUserAction(() => setAdminUserStatus(getSupabaseClient(), selected.id, "suspended"), "ユーザーの利用を停止しました。", `${selected.aasUserId} の利用を一時停止しますか？`)}>利用を停止</button>}
                {selected.status === "suspended" && <button disabled={busy} className="primary-action" type="button" onClick={() => void runUserAction(() => setAdminUserStatus(getSupabaseClient(), selected.id, "active"), "ユーザーの利用を再開しました。", `${selected.aasUserId} の利用を再開しますか？`)}>利用を再開</button>}
              </div>

              {selected.role === "user" && (
                <>
                  <div className="admin-subsection-heading"><h3>利用権</h3><small>{selectedEntitlements.length}件の履歴</small></div>
                  <div className="entitlement-list admin-entitlement-list">
                    {selectedEntitlements.map((item) => (
                      <div key={item.id} className={isCurrentEntitlement(item) ? "active" : ""}>
                        <div className="admin-entitlement-top"><strong>{item.productName || item.productCode}</strong><span>{entitlementStatusLabel(item.status)}</span></div>
                        <small>{item.productCode}</small>
                        <dl><div><dt>販売チャネル</dt><dd>{item.salesChannel || "—"}</dd></div><div><dt>期限</dt><dd>{fmt(item.expiresAt)}</dd></div>{item.externalReference && <div className="full"><dt>外部参照</dt><dd>{item.externalReference}</dd></div>}</dl>
                      </div>
                    ))}
                    {selectedEntitlements.length === 0 && <div className="admin-empty-state compact"><strong>利用権履歴はありません。</strong><span>下のフォームからPWAまたはWindows利用権を付与できます。</span></div>}
                  </div>

                  <div className="admin-grant-section">
                    <div className="admin-subsection-heading"><h3>利用権を変更</h3><small>一般ユーザーのみ</small></div>
                    <div className="admin-form-grid admin-grant-form">
                      <AdminSelectWithCustom
                        label="販売チャネル"
                        value={grantSalesChannel}
                        onChange={setGrantSalesChannel}
                        options={SALES_CHANNEL_OPTIONS}
                        description="通常は候補から選択します。独自の販売経路だけ「その他・自由入力」を使ってください。"
                      />
                      <label className="route-field"><span>利用期限（任意）</span><input type="datetime-local" value={grantExpiry} onChange={(event) => setGrantExpiry(event.target.value)} /></label>
                      <label className="route-field full"><span>外部参照（任意）</span><input value={grantExternalReference} onChange={(event) => setGrantExternalReference(event.target.value)} placeholder="注文番号・問い合わせ番号など、必要な場合だけ入力" /></label>
                    </div>
                    <div className="admin-actions admin-entitlement-actions">
                      <button disabled={busy} className="primary-action" type="button" onClick={() => void runUserAction(() => grantEntitlement(getSupabaseClient(), selected.id, PWA_PRODUCT, { salesChannel: grantSalesChannel, externalReference: grantExternalReference, expiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : undefined }), "PWA利用権を付与しました。")}>PWAを付与</button>
                      <button disabled={busy} className="primary-action" type="button" onClick={() => void runUserAction(() => grantEntitlement(getSupabaseClient(), selected.id, WINDOWS_PRODUCT, { salesChannel: grantSalesChannel, externalReference: grantExternalReference, expiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : undefined }), "Windows利用権を付与しました。")}>Windowsを付与</button>
                      <button disabled={busy} className="secondary-action" type="button" onClick={() => void runUserAction(() => revokeEntitlement(getSupabaseClient(), selected.id, PWA_PRODUCT), "PWA利用権を取り消しました。", "このユーザーのPWA利用権を取り消しますか？")}>PWAを取消</button>
                      <button disabled={busy} className="secondary-action" type="button" onClick={() => void runUserAction(() => revokeEntitlement(getSupabaseClient(), selected.id, WINDOWS_PRODUCT), "Windows利用権を取り消しました。", "このユーザーのWindows利用権を取り消しますか？")}>Windowsを取消</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </article>
      </section>

      <section id="admin-invites" className="admin-panel admin-invite-panel admin-dashboard-section">
        <div className="admin-panel-heading">
          <div><p className="eyebrow">INVITATIONS</p><h2>PWA招待コード</h2></div>
          <span className="admin-count-badge">{usableInvites.length} 利用可能</span>
        </div>
        <div className="admin-invite-layout">
          <div className="admin-invite-create">
            <h3>新しい招待コードを作成</h3>
            <div className="admin-form-grid">
              <AdminSelectWithCustom label="ラベル" value={inviteLabel} onChange={setInviteLabel} options={INVITE_LABEL_OPTIONS} customPlaceholder="例: note購入者 2026-09" />
              <AdminSelectWithCustom label="販売チャネル" value={inviteSalesChannel} onChange={setInviteSalesChannel} options={SALES_CHANNEL_OPTIONS} />
              <label className="route-field"><span>外部参照（任意）</span><input value={inviteExternalReference} onChange={(event) => setInviteExternalReference(event.target.value)} placeholder="注文番号・キャンペーン名など" /></label>
              <AdminPresetNumberField label="最大利用回数" value={maxUses} onChange={setMaxUses} presets={[1, 5, 10, 50, 100, 1000]} min={1} max={10000} description="1人用なら1、複数配布なら人数に近い候補を選びます。" suffix="回" />
              <label className="route-field"><span>コード期限</span><input type="datetime-local" value={inviteExpiry} onChange={(event) => setInviteExpiry(event.target.value)} /></label>
              <label className="route-field"><span>付与利用権期限</span><input type="datetime-local" value={inviteEntitlementExpiry} onChange={(event) => setInviteEntitlementExpiry(event.target.value)} /></label>
            </div>
            <button disabled={busy} className="primary-action admin-create-invite" type="button" onClick={() => void makeInvite()}>招待コードを作成</button>
          </div>

          <div className="admin-invite-manage">
            <div className="admin-subsection-heading"><h3>招待コード一覧</h3><select value={inviteFilter} onChange={(event) => setInviteFilter(event.target.value as InviteFilter)}><option value="all">すべて</option><option value="usable">利用可能</option><option value="expired">期限切れ</option><option value="exhausted">上限到達</option><option value="revoked">無効</option></select></div>
            <div className="invite-list admin-invite-list">
              {filteredInvites.map((invite) => {
                const percentage = Math.min(100, Math.round((invite.useCount / Math.max(invite.maxUses, 1)) * 100));
                return (
                  <div key={invite.id} className="invite-row admin-invite-row">
                    <div className="admin-invite-top"><div><strong>{invite.label || "PWA招待"}</strong><code>{invite.code}</code></div><span className={`admin-invite-status ${inviteStatusLabel(invite) === "利用可能" ? "active" : ""}`}>{inviteStatusLabel(invite)}</span></div>
                    <div className="admin-invite-meta"><span>{invite.salesChannel}</span><span>{invite.useCount}/{invite.maxUses} 使用</span><span>期限 {fmt(invite.expiresAt)}</span></div>
                    <div className="admin-invite-progress" aria-label={`使用率 ${percentage}%`}><span style={{ width: `${percentage}%` }} /></div>
                    <div className="admin-invite-actions"><button disabled={busy} type="button" className="secondary-action" onClick={() => void copyInviteCode(invite)}>コードをコピー</button>{invite.status === "active" && <button disabled={busy} type="button" className="danger-action" onClick={() => void disableInvite(invite.id)}>無効化</button>}</div>
                  </div>
                );
              })}
              {filteredInvites.length === 0 && <div className="admin-empty-state compact"><strong>該当する招待コードはありません。</strong><span>表示条件を変更するか、新しいコードを作成してください。</span></div>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
