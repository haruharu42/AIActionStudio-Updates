"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";

import { FreeTrialAdminPanel } from "@/components/free-trial-admin-panel";
import { listPwaAdminUsers, type PwaAdminUser } from "@/lib/pwa-admin-users";

type Gate =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "denied" }
  | { kind: "ready"; aasId: string }
  | { kind: "error"; message: string };

export function FreeTrialAdminPage() {
  const { state: accessState, client } = useSharedAccessState();
  const [initError, setInitError] = useState("");
  const [users, setUsers] = useState<PwaAdminUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
    [selectedId, users],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (user.role !== "user") return false;
      if (!query) return true;
      return `${user.aasUserId} ${user.displayName ?? ""}`.toLowerCase().includes(query);
    });
  }, [search, users]);

  const reloadUsers = async () => {
    if (!client) throw new Error("AASへ接続できませんでした。");
    const next = await listPwaAdminUsers(client);
    setUsers(next);
    if (selectedId && !next.some((user) => user.id === selectedId)) setSelectedId("");
  };

  useEffect(() => {
    if (
      accessState.kind !== "ready" ||
      accessState.profile.role !== "admin" ||
      accessState.profile.status !== "active" ||
      !client
    ) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setInitError("");
    });
    const boot = async () => {
      try {
        const nextUsers = await listPwaAdminUsers(client);
        if (!active) return;
        setUsers(nextUsers);
      } catch (error) {
        if (active) setInitError(error instanceof Error ? error.message : "管理画面を初期化できませんでした。");
      }
    };
    void boot();
    return () => { active = false; };
  }, [accessState, client]);

  const reload = async () => {
    setBusy(true); setMessage("");
    try {
      await reloadUsers();
      setMessage("ユーザー一覧を更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ユーザー一覧を更新できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  if (gate.kind === "loading") return null;

  if (gate.kind !== "ready") {
    return (
      <main className="standalone-page"><section className="standalone-card">
        <p className="eyebrow">FREE TRIAL ADMIN</p><h1>無料トライアル管理</h1>
        {gate.kind === "signed_out" && <p className="route-notice error">先にログインしてください。</p>}
        {gate.kind === "denied" && <p className="route-notice error">active管理者のみ利用できます。</p>}
        {gate.kind === "error" && <p className="route-notice error">{gate.message}</p>}
        <Link className="route-back" href="/">← ホームへ戻る</Link>
      </section></main>
    );
  }

  return (
    <main className="admin-page free-trial-admin-page">
      <header className="admin-head admin-dashboard-head">
        <div>
          <p className="eyebrow">FREE TRIAL ADMIN</p>
          <h1>無料トライアル管理</h1>
          <p>{gate.aasId} / 初回無料期間・日次回数・機能別上限・ユーザー個別状態をすべて変更できます。</p>
        </div>
        <div className="admin-head-actions">
          <button disabled={busy} type="button" className="secondary-action" onClick={() => void reload()}>ユーザーを更新</button>
          <Link className="route-back" href="/admin">← 管理ダッシュボード</Link>
        </div>
      </header>

      {message && <div className="route-notice">{message}</div>}

      <section className="admin-panel trial-user-picker admin-dashboard-section">
        <div className="admin-panel-heading">
          <div><p className="eyebrow">USER</p><h2>個別管理するユーザー</h2></div>
          <span className="admin-count-badge">{filteredUsers.length} 件</span>
        </div>
        <div className="admin-form-grid">
          <label className="route-field full"><span>AAS ID・表示名で検索</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="AAS-000002 など" /></label>
          <label className="route-field full"><span>ユーザーを選択</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">選択してください</option>{filteredUsers.map((user) => <option key={user.id} value={user.id}>{user.aasUserId} / {user.displayName || "名称未設定"} / {user.status}</option>)}</select></label>
        </div>
      </section>

      <FreeTrialAdminPanel selectedUser={selected} />
    </main>
  );
}
