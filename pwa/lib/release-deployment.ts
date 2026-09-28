import type { SupabaseClient } from "@supabase/supabase-js";

export const AAS_PREVIEW_RELEASE_BRANCH = "preview/current";
export const AAS_PUBLIC_PWA_URL = "https://ai-article-studio-pwa.ai-article-studio.workers.dev/";

export type PublicDeploymentStatus =
  | "requested"
  | "dispatched"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PublicDeployment = {
  id: string;
  release_id: string;
  source_branch: string;
  source_sha: string;
  status: PublicDeploymentStatus;
  github_run_id: number | null;
  github_run_url: string | null;
  target_sha: string | null;
  deployment_url: string | null;
  error_message: string | null;
  requested_at: string;
  dispatched_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type PublicDeploymentSnapshot = {
  configured: boolean;
  previewBranch: string;
  publicUrl: string;
  deployments: PublicDeployment[];
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function deploymentStatus(value: unknown): PublicDeploymentStatus | null {
  return ["requested", "dispatched", "running", "succeeded", "failed", "cancelled"].includes(String(value))
    ? value as PublicDeploymentStatus
    : null;
}

function parseDeployment(value: unknown): PublicDeployment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Row;
  const status = deploymentStatus(row.status);
  if (!text(row.id) || !text(row.release_id) || !status) return null;
  const githubRunId =
    typeof row.github_run_id === "number" && Number.isSafeInteger(row.github_run_id)
      ? row.github_run_id
      : null;
  return {
    id: text(row.id),
    release_id: text(row.release_id),
    source_branch: text(row.source_branch),
    source_sha: text(row.source_sha),
    status,
    github_run_id: githubRunId,
    github_run_url: nullableText(row.github_run_url),
    target_sha: nullableText(row.target_sha),
    deployment_url: nullableText(row.deployment_url),
    error_message: nullableText(row.error_message),
    requested_at: text(row.requested_at),
    dispatched_at: nullableText(row.dispatched_at),
    started_at: nullableText(row.started_at),
    finished_at: nullableText(row.finished_at),
    updated_at: text(row.updated_at),
  };
}

function functionUrl(): string {
  const base = (process.env.NEXT_PUBLIC_AAS_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  if (!base) throw new Error("Supabase URLを確認できません。");
  return `${base}/functions/v1/pwa-release-deploy`;
}

async function accessToken(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("管理者ログインを確認できません。");
  return data.session.access_token;
}

async function parseResponse(response: Response): Promise<Row> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const row = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Row : {};
  if (!response.ok) {
    const message = text(row.message);
    if (message.includes("AAS_GITHUB_RELEASE_TOKEN") || text(row.error) === "github_release_token_missing") {
      throw new Error("GitHub公開連携が未設定です。初回セットアップでAAS_GITHUB_RELEASE_TOKENを設定してください。");
    }
    if (message.includes("aal2 required")) {
      throw new Error("一般公開PWAへの反映には管理者MFA（AAL2）での再認証が必要です。");
    }
    if (message.includes("already in progress")) {
      throw new Error("この候補版はすでに一般公開処理中です。進捗を更新してください。");
    }
    throw new Error(message || "一般公開PWAのデプロイ処理に失敗しました。");
  }
  return row;
}

export async function requestPublicPwaDeployment(
  client: SupabaseClient,
  releaseId: string,
  sourceSha: string,
): Promise<{ requestId: string; status: string }> {
  const token = await accessToken(client);
  const response = await fetch(functionUrl(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      releaseId,
      sourceBranch: AAS_PREVIEW_RELEASE_BRANCH,
      sourceSha,
    }),
  });
  const row = await parseResponse(response);
  return {
    requestId: text(row.requestId),
    status: text(row.status),
  };
}

export async function loadPublicPwaDeployments(
  client: SupabaseClient,
  requestId?: string,
): Promise<PublicDeploymentSnapshot> {
  const token = await accessToken(client);
  const url = new URL(functionUrl());
  if (requestId) url.searchParams.set("request_id", requestId);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const row = await parseResponse(response);
  const deployments = Array.isArray(row.deployments)
    ? row.deployments.flatMap((item) => {
        const parsed = parseDeployment(item);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    configured: row.configured === true,
    previewBranch: text(row.previewBranch) || AAS_PREVIEW_RELEASE_BRANCH,
    publicUrl: text(row.publicUrl) || AAS_PUBLIC_PWA_URL,
    deployments,
  };
}
