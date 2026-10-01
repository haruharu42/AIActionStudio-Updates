import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type JsonRecord = Record<string, unknown>;

const REPO = "haruharu42/AIActionStudio-Updates";
const CANARY_WORKFLOW = "pwa-admin-canary-release.yml";
const PUBLIC_WORKFLOW = "pwa-admin-public-release.yml";
const DEFAULT_PREVIEW_BRANCH = "main";
const ALLOWED_PREVIEW_BRANCHES = new Set(["main", "preview/current"]);
const CANARY_URL = "https://ai-article-studio-pwa-canary.ai-article-studio.workers.dev/";
const PUBLIC_URL = "https://ai-article-studio-pwa.ai-article-studio.workers.dev/";
const ALLOWED_ORIGINS = new Set([
  "https://aas-preview-ai-article-studio-pwa-preview.ai-article-studio.workers.dev",
  "https://ai-article-studio-pwa-canary.ai-article-studio.workers.dev",
  "https://ai-article-studio-pwa.ai-article-studio.workers.dev",
  "http://localhost:4173",
  "http://127.0.0.1:8765",
]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function deploymentKind(value: unknown): "canary" | "public" {
  return clean(value) === "canary" ? "canary" : "public";
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "600",
    "vary": "Origin",
  };
}

function json(request: Request, payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function supabaseBaseUrl(): string {
  return clean(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
}

function anonKey(): string {
  return clean(Deno.env.get("SUPABASE_ANON_KEY"));
}

function serviceKey(): string {
  return clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}

function githubToken(): string {
  return clean(Deno.env.get("AAS_GITHUB_RELEASE_TOKEN"));
}

async function userRpc(request: Request, functionName: string, body: JsonRecord): Promise<unknown> {
  const base = supabaseBaseUrl();
  const key = anonKey();
  const authorization = request.headers.get("authorization") ?? "";
  if (!base || !key || !authorization) throw new Error("admin_auth_not_configured");

  const response = await fetch(`${base}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    const row = asRecord(payload);
    throw new Error(clean(row?.message) || `rpc_failed:${functionName}`);
  }
  return payload;
}

async function serviceRpc(functionName: string, body: JsonRecord): Promise<void> {
  const base = supabaseBaseUrl();
  const key = serviceKey();
  if (!base || !key) throw new Error("service_role_not_configured");

  const response = await fetch(`${base}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = asRecord(await safeJson(response));
    throw new Error(clean(payload?.message) || `service_rpc_failed:${functionName}`);
  }
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const token = githubToken();
  if (!token) throw new Error("github_release_token_missing");
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "aas-release-control",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function listDeployments(request: Request): Promise<JsonRecord[]> {
  const payload = await userRpc(request, "admin_list_app_release_deployments", {});
  return Array.isArray(payload) ? payload.filter((item): item is JsonRecord => asRecord(item) !== null) : [];
}

function workflowForDeployment(deployment: JsonRecord): string {
  return deploymentKind(deployment.deployment_kind) === "canary" ? CANARY_WORKFLOW : PUBLIC_WORKFLOW;
}

async function refreshRequestFromGithub(request: Request, deployment: JsonRecord): Promise<void> {
  const requestId = clean(deployment.id);
  const sourceSha = clean(deployment.source_sha).toLowerCase();
  const currentStatus = clean(deployment.status);
  const kind = deploymentKind(deployment.deployment_kind);
  if (!requestId || !/^[0-9a-f]{40}$/.test(sourceSha) || ["succeeded", "failed", "cancelled"].includes(currentStatus)) return;

  const workflow = workflowForDeployment(deployment);
  const response = await github(`/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=50`);
  if (!response.ok) throw new Error("github_run_lookup_failed");
  const payload = asRecord(await safeJson(response));
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  const run = runs
    .map(asRecord)
    .filter((item): item is JsonRecord => item !== null)
    .find((item) => clean(item.display_title).includes(requestId));

  if (!run) return;

  const runId = typeof run.id === "number" ? Math.trunc(run.id) : Number(run.id);
  const runUrl = clean(run.html_url);
  const status = clean(run.status);
  const conclusion = clean(run.conclusion);

  if (!Number.isSafeInteger(runId) || !runUrl) return;

  if (status === "queued" || status === "waiting" || status === "pending") {
    if (currentStatus === "requested") {
      await serviceRpc("service_mark_app_release_deployment", {
        p_request_id: requestId,
        p_status: "dispatched",
        p_github_run_id: runId,
        p_github_run_url: runUrl,
        p_error_message: null,
      });
    }
    return;
  }

  if (status === "in_progress") {
    if (currentStatus !== "running") {
      await serviceRpc("service_mark_app_release_deployment", {
        p_request_id: requestId,
        p_status: "running",
        p_github_run_id: runId,
        p_github_run_url: runUrl,
        p_error_message: null,
      });
    }
    return;
  }

  if (status === "completed" && conclusion === "success") {
    const sourceCommitResponse = await github(`/commits/${sourceSha}`);
    if (!sourceCommitResponse.ok) throw new Error("github_release_commit_lookup_failed");

    if (kind === "canary") {
      await serviceRpc("service_finalize_app_release_canary_deployment", {
        p_request_id: requestId,
        p_github_run_id: runId,
        p_github_run_url: runUrl,
        p_target_sha: sourceSha,
        p_deployment_url: CANARY_URL,
      });
    } else {
      await serviceRpc("service_finalize_app_release_deployment", {
        p_request_id: requestId,
        p_github_run_id: runId,
        p_github_run_url: runUrl,
        p_target_sha: sourceSha,
        p_deployment_url: PUBLIC_URL,
      });
    }
    return;
  }

  if (status === "completed") {
    await serviceRpc("service_mark_app_release_deployment", {
      p_request_id: requestId,
      p_status: "failed",
      p_github_run_id: runId,
      p_github_run_url: runUrl,
      p_error_message: `GitHub Actions finished with conclusion: ${conclusion || "unknown"}`,
    });
  }
}

async function dispatchWorkflow(
  request: Request,
  workflow: string,
  rpcName: string,
  releaseId: string,
  sourceBranch: string,
  sourceSha: string,
): Promise<Response> {
  const createdPayload = await userRpc(request, rpcName, {
    p_release_id: releaseId,
    p_source_branch: sourceBranch,
    p_source_sha: sourceSha,
  });
  const created = asRecord(createdPayload);
  const requestId = clean(created?.id);
  if (!requestId) throw new Error("deployment_request_create_failed");

  const inputs: Record<string, string> = {
    request_id: requestId,
    release_id: releaseId,
    source_branch: sourceBranch,
    source_sha: sourceSha,
  };

  if (workflow === PUBLIC_WORKFLOW) {
    const canaryRunId = Number(created?.canary_run_id);
    if (!Number.isSafeInteger(canaryRunId) || canaryRunId <= 0) {
      await serviceRpc("service_mark_app_release_deployment", {
        p_request_id: requestId,
        p_status: "failed",
        p_github_run_id: null,
        p_github_run_url: null,
        p_error_message: "verified Canary run ID is unavailable",
      });
      throw new Error("verified_canary_run_id_missing");
    }
    inputs.canary_run_id = String(canaryRunId);
  }

  const dispatch = await github(`/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: "main",
      inputs,
    }),
  });

  if (dispatch.status !== 204) {
    const detail = asRecord(await safeJson(dispatch));
    const message = clean(detail?.message) || `GitHub dispatch failed with HTTP ${dispatch.status}`;
    await serviceRpc("service_mark_app_release_deployment", {
      p_request_id: requestId,
      p_status: "failed",
      p_github_run_id: null,
      p_github_run_url: null,
      p_error_message: message,
    });
    return json(request, { error: "github_dispatch_failed", message }, 502);
  }

  await serviceRpc("service_mark_app_release_deployment", {
    p_request_id: requestId,
    p_status: "dispatched",
    p_github_run_id: null,
    p_github_run_url: null,
    p_error_message: null,
  });

  return json(request, {
    ok: true,
    configured: true,
    requestId,
    status: "dispatched",
    deploymentKind: workflow === CANARY_WORKFLOW ? "canary" : "public",
    sourceBranch,
    sourceSha,
  }, 202);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (!request.headers.get("authorization")) {
    return json(request, { error: "authentication_required" }, 401);
  }

  try {
    if (request.method === "GET") {
      const deployments = await listDeployments(request);
      const tokenConfigured = Boolean(githubToken());
      const requestId = clean(new URL(request.url).searchParams.get("request_id"));

      if (tokenConfigured && requestId) {
        const target = deployments.find((item) => clean(item.id) === requestId);
        if (target) await refreshRequestFromGithub(request, target);
      }

      const refreshed = requestId && tokenConfigured ? await listDeployments(request) : deployments;
      return json(request, {
        configured: tokenConfigured,
        supportsGithubReadiness: true,
        previewBranch: DEFAULT_PREVIEW_BRANCH,
        canaryUrl: CANARY_URL,
        publicUrl: PUBLIC_URL,
        deployments: refreshed,
      });
    }

    if (request.method !== "POST") {
      return json(request, { error: "method_not_allowed" }, 405);
    }

    let body: JsonRecord = {};
    try {
      body = asRecord(await request.json()) ?? {};
    } catch {
      body = {};
    }

    const action = clean(body.action) || "start";
    if (action === "github_readiness") {
      await listDeployments(request);
      const configured = Boolean(githubToken());
      if (!configured) {
        return json(request, {
          supported: true,
          configured: false,
          repositoryReadable: false,
          canaryWorkflowReadable: false,
          publicWorkflowReadable: false,
          workflowReadable: false,
          dispatchPermissionTested: false,
        });
      }
      const [repositoryResponse, canaryWorkflowResponse, publicWorkflowResponse] = await Promise.all([
        github(""),
        github(`/actions/workflows/${CANARY_WORKFLOW}`),
        github(`/actions/workflows/${PUBLIC_WORKFLOW}`),
      ]);
      return json(request, {
        supported: true,
        configured: true,
        repositoryReadable: repositoryResponse.ok,
        canaryWorkflowReadable: canaryWorkflowResponse.ok,
        publicWorkflowReadable: publicWorkflowResponse.ok,
        workflowReadable: canaryWorkflowResponse.ok && publicWorkflowResponse.ok,
        dispatchPermissionTested: false,
      });
    }

    if (action === "status") {
      const deployments = await listDeployments(request);
      const tokenConfigured = Boolean(githubToken());
      const requestId = clean(body.requestId);

      if (tokenConfigured && requestId) {
        const target = deployments.find((item) => clean(item.id) === requestId);
        if (target) await refreshRequestFromGithub(request, target);
      }

      const refreshed = requestId && tokenConfigured ? await listDeployments(request) : deployments;
      return json(request, {
        configured: tokenConfigured,
        supportsGithubReadiness: true,
        previewBranch: DEFAULT_PREVIEW_BRANCH,
        canaryUrl: CANARY_URL,
        publicUrl: PUBLIC_URL,
        deployments: refreshed,
      });
    }

    if (action !== "start" && action !== "start_canary") {
      return json(request, { error: "invalid_action" }, 400);
    }

    if (!githubToken()) {
      return json(request, {
        error: "github_release_token_missing",
        message: "GitHub公開連携が未設定です。Supabase Edge Function secret AAS_GITHUB_RELEASE_TOKEN を設定してください。",
      }, 503);
    }

    const releaseId = clean(body.releaseId);
    const sourceSha = clean(body.sourceSha).toLowerCase();
    const sourceBranch = clean(body.sourceBranch) || DEFAULT_PREVIEW_BRANCH;

    if (!/^[0-9a-f-]{36}$/.test(releaseId)) {
      return json(request, { error: "invalid_release_id" }, 400);
    }
    if (!ALLOWED_PREVIEW_BRANCHES.has(sourceBranch) || !/^[0-9a-f]{40}$/.test(sourceSha)) {
      return json(request, { error: "invalid_preview_source" }, 400);
    }

    if (action === "start_canary") {
      return dispatchWorkflow(
        request,
        CANARY_WORKFLOW,
        "admin_request_app_release_canary_deploy",
        releaseId,
        sourceBranch,
        sourceSha,
      );
    }

    return dispatchWorkflow(
      request,
      PUBLIC_WORKFLOW,
      "admin_request_app_release_deploy",
      releaseId,
      sourceBranch,
      sourceSha,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message.includes("aal2 required") ? 403 :
      message.includes("active admin required") ? 403 :
      message.includes("authentication") ? 401 :
      message.includes("already in progress") ? 409 :
      500;
    return json(request, { error: "release_deploy_error", message }, status);
  }
});
