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

async function invokeReleaseDeploy(
  client: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Row> {
  const { data, error } = await client.functions.invoke("pwa-release-deploy", {
    method: "POST",
    body,
  });
  if (error) {
    const context = error && typeof error === "object" && "context" in error
      ? (error as { context?: Response }).context
      : undefined;
    if (context instanceof Response) {
      return parseResponse(context);
    }
    throw new Error(error.message || "一般公開PWAのデプロイ処理に失敗しました。");
  }
  return data && typeof data === "object" && !Array.isArray(data) ? data as Row : {};
}

export async function requestPublicPwaDeployment(
  client: SupabaseClient,
  releaseId: string,
  sourceSha: string,
): Promise<{ requestId: string; status: string }> {
  await accessToken(client);
  const row = await invokeReleaseDeploy(client, {
    action: "start",
    releaseId,
    sourceBranch: AAS_PREVIEW_RELEASE_BRANCH,
    sourceSha,
  });
  return {
    requestId: text(row.requestId),
    status: text(row.status),
  };
}

export async function loadPublicPwaDeployments(
  client: SupabaseClient,
  requestId?: string,
): Promise<PublicDeploymentSnapshot> {
  await accessToken(client);
  const row = await invokeReleaseDeploy(client, {
    action: "status",
    requestId: requestId ?? "",
  });
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
