"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AdminSelectWithCustom } from "@/components/admin-form-controls";

import {
  loadOpsSnapshot,
  probeWorkerHealth,
  refreshOpsCapacity,
  runOpsSecurityAudit,
  setOpsEventStatus,
  updateOpsCapacitySettings,
  type OpsEventStatus,
  type OpsSnapshot,
} from "@/lib/operations-admin";
import { getSupabaseClient } from "@/lib/supabase";

type Gate = { kind: "loading" } | { kind: "signed_out" } | { kind: "denied" } | { kind: "ready"; aasId: string } | { kind: "error"; message: string };
type SeverityFilter = "all" | "critical" | "error" | "warning" | "info";
type StatusFilter = "all" | OpsEventStatus;
type CapacityDraft = {
  planLabel: string;
  databaseLimitGb: string;
  storageLimitGb: string;
  warningPercent: string;
  dangerPercent: string;
  criticalPercent: string;
};

const GIB = 1024 ** 3;


const PLAN_OPTIONS = [
  { value: "Free", label: "Free" },
  { value: "Pro", label: "Pro" },
  { value: "Team", label: "Team" },
  { value: "Enterprise", label: "Enterprise" },
  { value: "Custom", label: "契約上のカスタムプラン" },
] as const;

const CAPACITY_GB_OPTIONS = ["0.5", "1", "2", "5", "8", "10", "20", "50", "100", "250", "500"] as const;
const WARNING_PERCENT_OPTIONS = ["50", "60", "65", "70", "75", "80"] as const;
const DANGER_PERCENT_OPTIONS = ["75", "80", "85", "88", "90"] as const;
const CRITICAL_PERCENT_OPTIONS = ["90", "92", "95", "97", "99"] as const;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "medium" }).format(date);
}

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${Math.max(0, Math.round(value))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let next = Math.max(0, value);
  let unit = -1;
  do { next /= 1024; unit += 1; } while (next >= 1024 && unit < units.length - 1);
  return `${next >= 100 ? next.toFixed(0) : next >= 10 ? next.toFixed(1) : next.toFixed(2)} ${units[unit]}`;
}

function healthLabel(value: string): string {
  if (value === "healthy" || value === "passed") return "正常";
  if (value === "warning") return "警告";
  if (value === "error" || value === "failed") return "異常";
  if (value === "running") return "監査中";
  return "未確認";
}

function severityLabel(value: string): string {
  if (value === "critical") return "Critical";
  if (value === "error") return "Error";
  if (value === "warning") return "Warning";
  return "Info";
}

function limitToGb(value: number | null): string {
  if (value === null) return "";
  return String(Math.round((value / GIB) * 1000) / 1000);
}

function capacityClass(percent: number | null, warning: number, danger: number, critical: number): string {
  if (percent === null) return "unknown";
  if (percent >= critical) return "critical";
  if (percent >= danger) return "error";
  if (percent >= warning) return "warning";
  return "healthy";
}

export function OperationsAdminPage() {
  const { state: accessState, client } = useSharedAccessState();
  const [initError, setInitError] = useState("");
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [worker, setWorker] = useState<{ ok: boolean; latencyMs: number; checkedAt: string } | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [capacityDraft, setCapacityDraft] = useState<CapacityDraft | null>(null);

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

  const refresh = useCallback(async () => {
    if (!client) return;
    const [nextSnapshot, nextWorker] = await Promise.all([loadOpsSnapshot(client), probeWorkerHealth()]);
    setSnapshot(nextSnapshot);
    setWorker(nextWorker);
  }, [client]);

  useEffect(() => {
    if (accessState.kind !== "ready" || accessState.profile.role !== "admin" || accessState.profile.status !== "active" || !client) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setInitError("");
    });
    const boot = async () => {
      try {
        await refresh();
      } catch (error) {
        if (active) setInitError(error instanceof Error ? error.message : "Security & Operationsを初期化できませんでした。");
      }
    };
    void boot();
    const timer = window.setInterval(() => { if (active) void refresh().catch(() => undefined); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accessState, client, refresh]);

  const sources = useMemo(() => [...new Set((snapshot?.events ?? []).map((event) => event.source))].sort(), [snapshot]);
  const events = useMemo(() => (snapshot?.events ?? []).filter((event) => {
    if (severityFilter !== "all" && event.severity !== severityFilter) return false;
    if (statusFilter !== "all" && event.status !== statusFilter) return false;
    if (sourceFilter !== "all" && event.source !== sourceFilter) return false;
    return true;
  }), [snapshot, severityFilter, statusFilter, sourceFilter]);

  const runAudit = async () => {
    setBusy(true); setMessage("");
    try {
      await runOpsSecurityAudit(getSupabaseClient());
      await refresh();
      setMessage("セキュリティ監査と容量監視を実行し、最新状態へ更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "監査を実行できませんでした。");
    } finally { setBusy(false); }
  };

  const updateEvent = async (eventId: string, status: OpsEventStatus) => {
    setBusy(true); setMessage("");
    try {
      await setOpsEventStatus(getSupabaseClient(), eventId, status, resolutionNotes[eventId]);
      await refresh();
      setMessage(status === "resolved" ? "イベントを解決済みにしました。" : status === "acknowledged" ? "イベントを確認済みにしました。" : "イベントを再オープンしました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "イベントを更新できませんでした。");
    } finally { setBusy(false); }
  };

  if (gate.kind === "loading") return null;

  if (gate.kind !== "ready") {
    return <main className="standalone-page"><section className="standalone-card">
      <p className="eyebrow">SECURITY & OPERATIONS</p><h1>セキュリティ・運用</h1>
      {gate.kind === "signed_out" && <p className="route-notice error">先にログインしてください。</p>}
      {gate.kind === "denied" && <p className="route-notice error">active管理者のみ利用できます。</p>}
      {gate.kind === "error" && <p className="route-notice error">{gate.message}</p>}
      <Link className="route-back" href="/admin">← 管理ダッシュボード</Link>
    </section></main>;
  }

  const counts = snapshot?.counts ?? { open: 0, critical: 0, error: 0, warning: 0 };
  const latestRun = snapshot?.runs[0] ?? null;
  const capacity = snapshot?.capacity ?? null;
  const monitoringReady = snapshot !== null && worker !== null;
  const overall = !monitoringReady
    ? "unknown"
    : counts.critical > 0 || counts.error > 0 || latestRun?.status === "failed" || worker.ok === false
      ? "error"
      : counts.warning > 0 || latestRun?.status === "warning"
        ? "warning"
        : "healthy";
  const capacityForm: CapacityDraft = capacityDraft ?? {
    planLabel: capacity?.planLabel ?? "未設定",
    databaseLimitGb: limitToGb(capacity?.database.limitBytes ?? null),
    storageLimitGb: limitToGb(capacity?.storage.limitBytes ?? null),
    warningPercent: String(capacity?.warningPercent ?? 70),
    dangerPercent: String(capacity?.dangerPercent ?? 85),
    criticalPercent: String(capacity?.criticalPercent ?? 95),
  };

  const saveCapacitySettings = async () => {
    const dbGb = capacityForm.databaseLimitGb.trim() ? Number(capacityForm.databaseLimitGb) : null;
    const storageGb = capacityForm.storageLimitGb.trim() ? Number(capacityForm.storageLimitGb) : null;
    const warning = Number.parseInt(capacityForm.warningPercent, 10);
    const danger = Number.parseInt(capacityForm.dangerPercent, 10);
    const critical = Number.parseInt(capacityForm.criticalPercent, 10);
    if ((dbGb !== null && (!Number.isFinite(dbGb) || dbGb <= 0)) || (storageGb !== null && (!Number.isFinite(storageGb) || storageGb <= 0))) {
      setMessage("容量上限は0より大きいGB値、または空欄で入力してください。"); return;
    }
    if (!Number.isInteger(warning) || !Number.isInteger(danger) || !Number.isInteger(critical) || warning < 1 || warning >= danger || danger >= critical || critical > 100) {
      setMessage("警告しきい値は 1〜100 の範囲で、注意 < 警告 < 重大 の順にしてください。"); return;
    }
    setBusy(true); setMessage("");
    try {
      await updateOpsCapacitySettings(getSupabaseClient(), {
        planLabel: capacityForm.planLabel,
        databaseLimitBytes: dbGb === null ? null : Math.round(dbGb * GIB),
        storageLimitBytes: storageGb === null ? null : Math.round(storageGb * GIB),
        warningPercent: warning,
        dangerPercent: danger,
        criticalPercent: critical,
      });
      setCapacityDraft(null);
      await refresh();
      setMessage("Supabase容量上限と警告しきい値を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "容量設定を保存できませんでした。");
    } finally { setBusy(false); }
  };

  const refreshCapacity = async () => {
    setBusy(true); setMessage("");
    try {
      await refreshOpsCapacity(getSupabaseClient());
      await refresh();
      setMessage("Supabaseの現在容量を再計測しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "容量を更新できませんでした。");
    } finally { setBusy(false); }
  };

  return (
    <main className="admin-page ops-admin-page">
      <header className="admin-head admin-dashboard-head">
        <div><p className="eyebrow">SECURITY & OPERATIONS CENTER</p><h1>セキュリティ・運用</h1><p>{gate.aasId} / エラー・セキュリティイベント・定期監査・Supabase容量をまとめて確認します。</p></div>
        <div className="admin-head-actions"><button className="primary-action" disabled={busy} type="button" onClick={() => void runAudit()}>{busy ? "監査中…" : "今すぐ監査"}</button><Link className="route-back" href="/admin">← 管理ダッシュボード</Link></div>
      </header>
      {message && <div className="route-notice" role="status">{message}</div>}

      <section className={`ops-overall ops-${overall}`}><div><span>現在の状態</span><strong>{healthLabel(overall)}</strong></div><p>監視イベントは発生時に集約記録し、DB/Storage/RPC権限は1時間ごとに自動監査します。容量も1時間ごとに再計測します。</p></section>

      <section className="ops-count-grid" aria-label="未解決イベント件数">
        <article><span>未解決</span><strong>{counts.open}</strong></article><article className="critical"><span>Critical</span><strong>{counts.critical}</strong></article><article className="error"><span>Error</span><strong>{counts.error}</strong></article><article className="warning"><span>Warning</span><strong>{counts.warning}</strong></article>
      </section>

      <section className="admin-panel admin-dashboard-section ops-capacity-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">SUPABASE CAPACITY</p><h2>Supabase使用容量</h2></div><button className="secondary-action" disabled={busy} type="button" onClick={() => void refreshCapacity()}>再計測</button></div>
        {capacity ? <>
          <div className="ops-capacity-meta"><span>設定プラン: <strong>{capacity.planLabel}</strong></span><span>最終計測: {formatDate(capacity.checkedAt)}</span></div>
          <div className="ops-capacity-grid">
            {[{ label: "Database", metric: capacity.database }, { label: "Storage", metric: capacity.storage }].map(({ label, metric }) => {
              const state = capacityClass(metric.percent, capacity.warningPercent, capacity.dangerPercent, capacity.criticalPercent);
              return <article key={label} className={`ops-capacity-card ops-${state}`}>
                <header><span>{label}</span><strong>{metric.percent === null ? "上限未設定" : `${metric.percent.toFixed(1)}%`}</strong></header>
                <div className="ops-capacity-value"><strong>{formatBytes(metric.usedBytes)}</strong><span>使用中</span></div>
                <progress max={100} value={Math.min(100, Math.max(0, metric.percent ?? 0))} aria-label={`${label}使用率`} />
                <dl><div><dt>上限</dt><dd>{formatBytes(metric.limitBytes)}</dd></div><div><dt>残り</dt><dd>{formatBytes(metric.remainingBytes)}</dd></div>{label === "Storage" && <div><dt>ファイル</dt><dd>{capacity.storage.objectCount.toLocaleString("ja-JP")} 件</dd></div>}</dl>
              </article>;
            })}
          </div>
          <div className="ops-capacity-settings">
            <div><strong>容量監視設定</strong><small>契約プラン変更時も管理画面から変更できます。上限を空欄にすると残容量・使用率警告を停止します。</small></div>
            <div className="ops-capacity-form">
              <AdminSelectWithCustom label="プラン名" value={capacityForm.planLabel} onChange={(value) => setCapacityDraft({ ...capacityForm, planLabel: value.slice(0, 80) })} options={PLAN_OPTIONS} customPlaceholder="契約プラン名を入力" />
              <AdminSelectWithCustom label="Database上限 (GB)" value={capacityForm.databaseLimitGb} onChange={(value) => setCapacityDraft({ ...capacityForm, databaseLimitGb: value })} options={CAPACITY_GB_OPTIONS} placeholder="上限なし" customPlaceholder="GB数を自由入力" />
              <AdminSelectWithCustom label="Storage上限 (GB)" value={capacityForm.storageLimitGb} onChange={(value) => setCapacityDraft({ ...capacityForm, storageLimitGb: value })} options={CAPACITY_GB_OPTIONS} placeholder="上限なし" customPlaceholder="GB数を自由入力" />
              <AdminSelectWithCustom label="注意ライン (%)" value={capacityForm.warningPercent} onChange={(value) => setCapacityDraft({ ...capacityForm, warningPercent: value })} options={WARNING_PERCENT_OPTIONS} description="標準は70%。早めに気づくための目安です。" />
              <AdminSelectWithCustom label="警告ライン (%)" value={capacityForm.dangerPercent} onChange={(value) => setCapacityDraft({ ...capacityForm, dangerPercent: value })} options={DANGER_PERCENT_OPTIONS} description="標準は85%。対応を検討する目安です。" />
              <AdminSelectWithCustom label="重大ライン (%)" value={capacityForm.criticalPercent} onChange={(value) => setCapacityDraft({ ...capacityForm, criticalPercent: value })} options={CRITICAL_PERCENT_OPTIONS} description="標準は95%。至急対応する目安です。" />
            </div>
            <div className="admin-actions"><button className="primary-action" disabled={busy} type="button" onClick={() => void saveCapacitySettings()}>容量設定を保存</button>{capacityDraft && <button className="secondary-action" disabled={busy} type="button" onClick={() => setCapacityDraft(null)}>変更を破棄</button>}</div>
          </div>
        </> : <div className="admin-empty-state compact"><strong>容量情報を取得しています。</strong></div>}
      </section>

      <section className="admin-panel admin-dashboard-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">HEALTH</p><h2>システムヘルス</h2></div><button className="secondary-action" disabled={busy} type="button" onClick={() => void refresh().catch(() => setMessage("状態を更新できませんでした。"))}>更新</button></div>
        <div className="ops-health-grid">
          <article className={`ops-health-card ops-${worker?.ok ? "healthy" : worker ? "error" : "unknown"}`}><span>Cloudflare Worker</span><strong>{worker ? (worker.ok ? "正常" : "異常") : "確認中"}</strong><small>{worker ? `${worker.latencyMs} ms / ${formatDate(worker.checkedAt)}` : "—"}</small></article>
          {(snapshot?.health ?? []).map((item) => <article key={item.component} className={`ops-health-card ops-${item.status}`}><span>{item.component}</span><strong>{healthLabel(item.status)}</strong><small>{item.message}</small><small>{formatDate(item.checkedAt)}</small></article>)}
        </div>
      </section>

      <section className="admin-panel admin-dashboard-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">EVENTS</p><h2>エラー・セキュリティログ</h2></div><span className="admin-count-badge">{events.length} 件</span></div>
        <div className="ops-filter-grid">
          <label className="route-field"><span>重大度</span><select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}><option value="all">すべて</option><option value="critical">Critical</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
          <label className="route-field"><span>状態</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}><option value="all">すべて</option><option value="open">未解決</option><option value="acknowledged">確認済み</option><option value="resolved">解決済み</option></select></label>
          <label className="route-field"><span>発生元</span><select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="all">すべて</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
        </div>
        <div className="ops-event-list">
          {events.map((event) => <article key={event.id} className={`ops-event ops-${event.severity}`}>
            <header><div><span className="ops-severity">{severityLabel(event.severity)}</span><strong>{event.errorCode}</strong><small>{event.source}{event.feature ? ` / ${event.feature}` : ""}</small></div><span className={`ops-event-status status-${event.status}`}>{event.status === "open" ? "未解決" : event.status === "acknowledged" ? "確認済み" : "解決済み"}</span></header>
            <p>{event.message}</p>
            <dl><div><dt>回数</dt><dd>{event.occurrenceCount}</dd></div><div><dt>最終</dt><dd>{formatDate(event.lastSeenAt)}</dd></div><div><dt>初回</dt><dd>{formatDate(event.firstSeenAt)}</dd></div>{event.route && <div><dt>Route</dt><dd>{event.route}</dd></div>}{event.lastAasUserId && <div><dt>AAS ID</dt><dd>{event.lastAasUserId}</dd></div>}{event.requestId && <div><dt>Request</dt><dd>{event.requestId}</dd></div>}</dl>
            {event.status !== "resolved" && <label className="route-field"><span>解決メモ（任意）</span><input value={resolutionNotes[event.id] ?? ""} onChange={(e) => setResolutionNotes((current) => ({ ...current, [event.id]: e.target.value.slice(0, 500) }))} placeholder="原因・対応内容" /></label>}
            <div className="admin-actions">{event.status === "open" && <button disabled={busy} className="secondary-action" type="button" onClick={() => void updateEvent(event.id, "acknowledged")}>確認済みにする</button>}{event.status !== "resolved" && <button disabled={busy} className="primary-action" type="button" onClick={() => void updateEvent(event.id, "resolved")}>解決済みにする</button>}{event.status === "resolved" && <button disabled={busy} className="secondary-action" type="button" onClick={() => void updateEvent(event.id, "open")}>再オープン</button>}</div>
          </article>)}
          {!events.length && <div className="admin-empty-state compact"><strong>条件に一致するイベントはありません。</strong><span>重大な問題がない場合、この一覧は空のままです。</span></div>}
        </div>
      </section>

      <section className="admin-panel admin-dashboard-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">AUDIT</p><h2>最新セキュリティ監査</h2></div><span className={`admin-count-badge ${latestRun?.status === "failed" ? "alert" : ""}`}>{latestRun ? healthLabel(latestRun.status) : "未実行"}</span></div>
        {latestRun && <p className="ops-audit-summary">{formatDate(latestRun.startedAt)} / Critical {latestRun.criticalCount} · Error {latestRun.errorCount} · Warning {latestRun.warningCount} · Info {latestRun.infoCount}</p>}
        <div className="ops-finding-list">{(snapshot?.findings ?? []).map((finding) => <article key={finding.id} className={`ops-finding ops-${finding.severity}`}><header><span>{severityLabel(finding.severity)}</span><strong>{finding.title}</strong><code>{finding.checkCode}</code></header><p>{finding.detail}</p>{finding.objectName && <small>対象: {finding.objectName}</small>}{finding.remediation && <small>対応: {finding.remediation}</small>}</article>)}</div>
        {latestRun && !(snapshot?.findings.length) && <div className="admin-empty-state compact"><strong>最新監査で指摘事項はありません。</strong><span>RLS・RPC権限・Storage・スケジューラの基本検査を通過しています。</span></div>}
      </section>

      <section className="admin-panel admin-dashboard-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">HISTORY</p><h2>監査履歴</h2></div></div>
        <div className="ops-run-list">{(snapshot?.runs ?? []).map((run) => <div key={run.id}><span>{formatDate(run.startedAt)}</span><strong>{healthLabel(run.status)}</strong><small>{run.source} / C{run.criticalCount} E{run.errorCount} W{run.warningCount}</small></div>)}</div>
      </section>

      <section className="ops-privacy-note"><strong>ログのプライバシー保護</strong><p>パスワード、Cookie、Authorization、Access/Refresh Token、Stripe/Supabase秘密鍵、カード情報、記事本文、AIプロンプト全文は保存対象外です。ログは90日を基準に整理し、解決済みの古いイベントは定期監査時に削除します。</p></section>
    </main>
  );
}
