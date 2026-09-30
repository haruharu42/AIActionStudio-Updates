"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import {
  GITHUB_CACHE_OVERAGE_USD_PER_GB_MONTH,
  GITHUB_SHARED_STORAGE_OVERAGE_USD_PER_GB_MONTH,
  INFRASTRUCTURE_PRICING_REFERENCE_DATE,
  SUPABASE_GP3_DISK_OVERAGE_USD_PER_GB_MONTH,
  SUPABASE_STORAGE_OVERAGE_USD_PER_GB_MONTH,
  githubPlanReference,
  loadInfrastructureUsage,
  readAdminGitHubPlan,
  supabasePlanReference,
  writeAdminGitHubPlan,
  type GitHubPlan,
  type InfrastructureUsageSnapshot,
} from "@/lib/infrastructure-usage";

const GIB = 1024 ** 3;

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "取得不可";
  if (value < 1024) return `${Math.max(0, Math.round(value))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let next = Math.max(0, value);
  let unit = -1;
  do {
    next /= 1024;
    unit += 1;
  } while (next >= 1024 && unit < units.length - 1);
  return `${next >= 100 ? next.toFixed(0) : next >= 10 ? next.toFixed(1) : next.toFixed(2)} ${units[unit]}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function percent(used: number | null, limit: number | null): number | null {
  if (used === null || limit === null || limit <= 0) return null;
  return Math.round((used / limit) * 10_000) / 100;
}

function progressClass(value: number | null): string {
  if (value === null) return "unknown";
  if (value >= 95) return "critical";
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "healthy";
}

function UsageMeter({
  label,
  used,
  limit,
  remaining,
  note,
}: {
  label: string;
  used: number | null;
  limit: number | null;
  remaining: number | null;
  note?: string;
}) {
  const value = percent(used, limit);
  const state = progressClass(value);
  return (
    <article className={`infra-meter infra-${state}`}>
      <header>
        <span>{label}</span>
        <strong>{value === null ? "上限未確定" : `${value.toFixed(1)}%`}</strong>
      </header>
      <div className="infra-meter-value">
        <strong>{formatBytes(used)}</strong>
        <span>使用中</span>
      </div>
      <progress
        max={100}
        value={Math.max(0, Math.min(100, value ?? 0))}
        aria-label={`${label}使用率`}
      />
      <dl>
        <div><dt>使用可能量</dt><dd>{formatBytes(limit)}</dd></div>
        <div><dt>残り</dt><dd>{formatBytes(remaining)}</dd></div>
      </dl>
      {note && <small>{note}</small>}
    </article>
  );
}

export function AdminInfrastructureUsagePage() {
  const { state, client } = useSharedAccessState();
  const [githubPlan, setGitHubPlan] = useState<GitHubPlan>("free");
  const [snapshot, setSnapshot] = useState<InfrastructureUsageSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const adminReady =
    state.kind === "ready"
    && state.profile.role === "admin"
    && state.profile.status === "active";

  const reload = useCallback(async (refreshSupabase: boolean) => {
    if (!client || !adminReady) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await loadInfrastructureUsage(client, githubPlan, { refreshSupabase });
      setSnapshot(next);
      if (refreshSupabase) setMessage("SupabaseとGitHubの使用状況を更新しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "インフラ使用状況を取得できませんでした。");
    } finally {
      setBusy(false);
    }
  }, [adminReady, client, githubPlan]);

  useEffect(() => {
    const saved = readAdminGitHubPlan();
    queueMicrotask(() => setGitHubPlan(saved));
  }, []);

  useEffect(() => {
    if (!adminReady || !client) return;
    let active = true;
    const boot = async () => {
      try {
        const next = await loadInfrastructureUsage(client, githubPlan);
        if (active) setSnapshot(next);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "インフラ使用状況を取得できませんでした。");
      }
    };
    void boot();
    return () => { active = false; };
  }, [adminReady, client, githubPlan]);

  const supabaseRef = useMemo(
    () => snapshot ? supabasePlanReference(snapshot.supabase.planLabel) : null,
    [snapshot],
  );
  const githubRef = useMemo(() => githubPlanReference(githubPlan), [githubPlan]);

  if (!adminReady) return null;

  const supabase = snapshot?.supabase ?? null;
  const github = snapshot?.github ?? null;

  const supabaseDatabaseLimit =
    supabase?.database.limitBytes
    ?? supabaseRef?.databaseOrDiskIncludedBytes
    ?? null;
  const supabaseStorageLimit =
    supabase?.storage.limitBytes
    ?? supabaseRef?.storageIncludedBytes
    ?? null;

  return (
    <main className="admin-page infrastructure-usage-page">
      <header className="admin-head admin-dashboard-head">
        <div>
          <p className="eyebrow">INFRASTRUCTURE USAGE</p>
          <h1>インフラ使用量・料金</h1>
          <p>
            SupabaseとGitHubの使用容量、使用可能量、残量、料金の基準を専用画面で確認します。
            実測できない請求項目は推測せず、公式Billingへ分離します。
          </p>
        </div>
        <div className="admin-head-actions">
          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={() => void reload(true)}
          >
            {busy ? "更新中…" : "使用量を再計測"}
          </button>
          <Link className="route-back" href="/admin">← 管理ダッシュボード</Link>
        </div>
      </header>

      {message && <div className="route-notice" role="status">{message}</div>}

      <section className="infra-summary-grid" aria-label="インフラ概要">
        <article>
          <span>Supabase</span>
          <strong>{supabase?.planLabel ?? "確認中"}</strong>
          <small>Database / Storageを実測</small>
        </article>
        <article>
          <span>GitHub</span>
          <strong>{github?.repository.isPrivate === false ? "Public" : github?.repository.isPrivate ? "Private" : "確認中"}</strong>
          <small>{github?.plan.label ?? githubRef.label}</small>
        </article>
        <article>
          <span>GitHub Actions</span>
          <strong>{github?.actions.workflowRunsThisMonth?.toLocaleString("ja-JP") ?? "—"} 回</strong>
          <small>今月のWorkflow Run数</small>
        </article>
        <article>
          <span>Supabase料金状態</span>
          <strong>{supabase?.planLabel?.toLowerCase() === "free" ? "$0" : "Billing確認"}</strong>
          <small>{supabase?.planLabel?.toLowerCase() === "free" ? "Free設定 / 超過時は制限対象" : "固定料金・Compute等は公式請求を優先"}</small>
        </article>
        <article>
          <span>GitHub Actions料金</span>
          <strong>{github?.actions.publicStandardRunnerFree ? "$0" : "Billing確認"}</strong>
          <small>{github?.actions.publicStandardRunnerFree ? "Public / 標準GitHub-hosted runner" : "Private / プラン枠・超過料金対象"}</small>
        </article>
        <article>
          <span>料金基準更新</span>
          <strong>{INFRASTRUCTURE_PRICING_REFERENCE_DATE}</strong>
          <small>公式ドキュメント確認日</small>
        </article>
      </section>

      <section className="admin-panel admin-dashboard-section infra-provider-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">SUPABASE USAGE</p>
            <h2>Supabase</h2>
            <p>現在のPostgres DatabaseとStorage ObjectをAASの管理RPCで直接計測します。</p>
          </div>
          <a
            className="secondary-action"
            href="https://supabase.com/dashboard/org/_/usage"
            target="_blank"
            rel="noreferrer"
          >
            Supabase Usageを開く ↗
          </a>
        </div>

        <div className="infra-plan-strip">
          <div><span>設定プラン</span><strong>{supabase?.planLabel ?? "—"}</strong></div>
          <div><span>最終計測</span><strong>{formatDate(supabase?.checkedAt ?? null)}</strong></div>
          <div><span>Storageファイル</span><strong>{supabase?.storage.objectCount.toLocaleString("ja-JP") ?? "—"} 件</strong></div>
        </div>

        <div className="infra-meter-grid">
          <UsageMeter
            label="Database"
            used={supabase?.database.usedBytes ?? null}
            limit={supabaseDatabaseLimit}
            remaining={supabase?.database.remainingBytes ?? (
              supabase?.database.usedBytes !== undefined && supabaseDatabaseLimit !== null
                ? Math.max(0, supabaseDatabaseLimit - (supabase?.database.usedBytes ?? 0))
                : null
            )}
            note={supabaseRef?.databaseLabel}
          />
          <UsageMeter
            label="Storage"
            used={supabase?.storage.usedBytes ?? null}
            limit={supabaseStorageLimit}
            remaining={supabase?.storage.remainingBytes ?? (
              supabase?.storage.usedBytes !== undefined && supabaseStorageLimit !== null
                ? Math.max(0, supabaseStorageLimit - (supabase?.storage.usedBytes ?? 0))
                : null
            )}
            note="Storage bucket内の実ファイル合計"
          />
        </div>

        {supabaseRef && (
          <div className="infra-reference-box">
            <strong>{supabaseRef.label} の料金・上限基準</strong>
            <p>{supabaseRef.note}</p>
            <div>
              <span>Storage超過単価（Pro/Team参考） <b>${SUPABASE_STORAGE_OVERAGE_USD_PER_GB_MONTH.toFixed(4)} / GB・月</b></span>
              <span>gp3 Disk超過単価（Pro/Team参考） <b>${SUPABASE_GP3_DISK_OVERAGE_USD_PER_GB_MONTH.toFixed(3)} / GB・月</b></span>
            </div>
            <small>
              Database実使用量と有料プランのprovisioned diskは別指標です。Compute、Egress、MAU等はこの簡易表示の料金計算へ含めません。
            </small>
          </div>
        )}
      </section>

      <section className="admin-panel admin-dashboard-section infra-provider-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">GITHUB USAGE</p>
            <h2>GitHub</h2>
            <p>リポジトリ容量とActionsの実行状況を公開GitHub APIから取得します。</p>
          </div>
          <div className="infra-github-actions">
            <label>
              <span>GitHubプラン</span>
              <select
                value={githubPlan}
                onChange={(event) => {
                  const value = event.target.value as GitHubPlan;
                  setGitHubPlan(value);
                  writeAdminGitHubPlan(value);
                }}
              >
                <option value="free">GitHub Free</option>
                <option value="pro">GitHub Pro</option>
                <option value="team">GitHub Team</option>
                <option value="enterprise">GitHub Enterprise Cloud</option>
              </select>
              <small>プラン選択は表示用の基準として、この端末に保存します。</small>
            </label>
            <a
              className="secondary-action"
              href="https://github.com/settings/billing/usage"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Billingを開く ↗
            </a>
          </div>
        </div>

        <div className="infra-plan-strip">
          <div><span>Repository</span><strong>{github?.repository.fullName ?? "haruharu42/AIActionStudio-Updates"}</strong></div>
          <div><span>公開状態</span><strong>{github?.repository.isPrivate === false ? "Public" : github?.repository.isPrivate ? "Private" : "—"}</strong></div>
          <div><span>最新更新</span><strong>{formatDate(github?.repository.updatedAt ?? null)}</strong></div>
        </div>

        <div className="infra-meter-grid">
          <UsageMeter
            label="Repository"
            used={github?.repository.sizeBytes ?? null}
            limit={github?.repository.recommendedLimitBytes ?? 10 * GIB}
            remaining={github?.repository.remainingRecommendedBytes ?? null}
            note="GitHub推奨のon-disk repository上限 10GBに対する参考値。課金枠ではありません。"
          />
          <UsageMeter
            label="Actions Artifact"
            used={github?.actions.artifactUsedBytes ?? null}
            limit={github?.actions.artifactLimitBytes ?? githubRef.artifactStorageBytes}
            remaining={github?.actions.artifactRemainingBytes ?? null}
            note={github?.actions.artifactPartial ? "100件を超えるため現在値は一部のみです。" : "ArtifactsとPackagesは共有ストレージ枠です。"}
          />
          <UsageMeter
            label="Actions Cache"
            used={github?.actions.cacheUsedBytes ?? null}
            limit={github?.actions.cacheLimitBytes ?? githubRef.cacheStorageBytes}
            remaining={github?.actions.cacheRemainingBytes ?? null}
            note={github?.actions.cachePartial ? "100件を超えるため現在値は一部のみです。" : "CacheはRepositoryごとに10GBの別枠です。"}
          />
        </div>

        <div className="infra-github-facts">
          <article>
            <span>今月のActions実行数</span>
            <strong>{github?.actions.workflowRunsThisMonth?.toLocaleString("ja-JP") ?? "取得不可"}</strong>
            <small>Workflow Run数。請求対象の分数そのものではありません。</small>
          </article>
          <article>
            <span>Private repo用の月間分数枠</span>
            <strong>{githubRef.actionsMinutesPerMonth.toLocaleString("ja-JP")} 分</strong>
            <small>現在の選択プラン基準</small>
          </article>
          <article>
            <span>標準Runner料金</span>
            <strong>{github?.actions.publicStandardRunnerFree ? "$0" : "Billingで確認"}</strong>
            <small>{github?.actions.publicStandardRunnerFree ? "Public repositoryの標準GitHub-hosted runnerは無料" : "Private repositoryはプラン枠と超過料金の対象"}</small>
          </article>
        </div>

        <div className="infra-reference-box">
          <strong>{githubRef.label} のActions基準</strong>
          <div>
            <span>Artifact枠 <b>{formatBytes(githubRef.artifactStorageBytes)}</b></span>
            <span>Cache枠 <b>{formatBytes(githubRef.cacheStorageBytes)}</b></span>
            <span>Artifact/Packages超過 <b>${GITHUB_SHARED_STORAGE_OVERAGE_USD_PER_GB_MONTH.toFixed(2)} / GB・月</b></span>
            <span>Cache超過 <b>${GITHUB_CACHE_OVERAGE_USD_PER_GB_MONTH.toFixed(2)} / GB・月</b></span>
          </div>
          <small>
            Artifact/Cacheの公開API取得が拒否された場合は「取得不可」と表示します。請求額は時間積算のため、GitHub Billingの値が正式です。Larger runnerはPublicでも課金対象です。
          </small>
        </div>

        {github?.warnings.length ? (
          <div className="infra-warning-list">
            {github.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}
      </section>

      <section className="admin-panel admin-dashboard-section infra-billing-guide">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">BILLING SAFETY</p>
            <h2>料金表示の扱い</h2>
          </div>
        </div>
        <p>
          この画面はAASが安全に取得できる実容量と、公式ドキュメントのプラン枠・超過単価を並べる監視画面です。
          Supabaseの組織全体Usage、Compute/Egress/MAU、GitHubの時間積算済みストレージやLarger runnerなどは、
          最終的な請求額を公式Billing画面で確認してください。
        </p>
        <div className="infra-official-links">
          <a href="https://supabase.com/dashboard/org/_/usage" target="_blank" rel="noreferrer">Supabase Usage ↗</a>
          <a href="https://supabase.com/dashboard/org/_/billing" target="_blank" rel="noreferrer">Supabase Billing ↗</a>
          <a href="https://github.com/settings/billing/usage" target="_blank" rel="noreferrer">GitHub Usage ↗</a>
          <a href="https://github.com/haruharu42/AIActionStudio-Updates/actions" target="_blank" rel="noreferrer">GitHub Actions ↗</a>
        </div>
      </section>
    </main>
  );
}
