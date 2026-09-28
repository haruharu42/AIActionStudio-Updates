import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeRefreshStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type KnowledgeRefreshChannel = "stable" | "fresh";
export type KnowledgeRefreshChangeAction = "added" | "updated" | "unchanged";

export type KnowledgeRefreshChangeItem = {
  itemType: "knowledge" | "prompt";
  key: string;
  label: string;
  action: KnowledgeRefreshChangeAction;
  changedFields: string[];
  sourceSummary: string;
};

export type KnowledgeRefreshChangeGroup = {
  added: number;
  updated: number;
  unchanged: number;
  items: KnowledgeRefreshChangeItem[];
};

export type KnowledgeRefreshDiff = {
  knowledge: KnowledgeRefreshChangeGroup;
  prompt: KnowledgeRefreshChangeGroup;
};

export type KnowledgeRefreshChannelState = {
  channel: KnowledgeRefreshChannel;
  refreshHours: number;
  currentVersion: number;
  lastPublishedAt: string | null;
  nextRefreshDueAt: string | null;
  lastRefreshRequestedAt: string | null;
};

export type KnowledgeRefreshRequest = {
  id: number;
  channel: KnowledgeRefreshChannel;
  requestedAt: string;
  startedAt: string | null;
  status: KnowledgeRefreshStatus;
  completedAt: string | null;
  researchSummary: string;
  publishedKnowledgeCount: number;
  publishedPromptCount: number;
  publishedVersion: number | null;
  errorMessage: string;
  changeDetails: KnowledgeRefreshDiff;
};

export type KnowledgeRefreshPublishResult = {
  channel: KnowledgeRefreshChannel;
  publishedVersion: number;
  knowledgeCount: number;
  promptCount: number;
  changeDetails: KnowledgeRefreshDiff;
};

export type KnowledgeRefreshBundle = {
  summary: string;
  knowledge_rules: unknown[];
  prompt_optimizations: unknown[];
};

export type KnowledgeAutomationCandidateAction = "new" | "update" | "recheck" | "retire";
export type KnowledgeAutomationCandidateStatus = "pending" | "approved" | "rejected" | "converted";

export type KnowledgeAutomationStatus = {
  enabled: boolean;
  checkIntervalHours: number;
  maxSourcesPerRun: number;
  trackedSources: number;
  dueSources: number;
  pendingCandidates: number;
  approvedCandidates: number;
  lastWorkerInvokedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string;
  latestRunId: number | null;
  latestRunStatus: string;
  latestRunStartedAt: string | null;
  latestRunCompletedAt: string | null;
  latestRunSourcesChecked: number;
  latestRunCandidatesCreated: number;
};

export type KnowledgeAutomationSource = {
  id: number;
  sourceUrl: string;
  tasks: string[];
  sourceKind: string;
  enabled: boolean;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  lastHttpStatus: number | null;
  consecutiveFailures: number;
  lastError: string;
};

export type KnowledgeProductionHealth = {
  activeKnowledge: number;
  activePromptOptimizations: number;
  pendingRequests: number;
  processingRequests: number;
  failedRequests: number;
  cancelledRequests: number;
  freshVersion: number;
  stableVersion: number;
  lastKnowledgeCheckedAt: string | null;
  lastPromptCheckedAt: string | null;
};

export type KnowledgeSourceRiskItem = {
  itemType: "knowledge" | "prompt";
  key: string;
  label: string;
  catalogVersion: number;
  releaseChannel: string;
  sourceCheckedAt: string | null;
  sourceCount: number;
  domainCount: number;
  sourceUrls: string[];
};

export type KnowledgeSourceRiskDomain = {
  domain: string;
  itemCount: number;
  urlCount: number;
};

export type KnowledgeSourceRiskReport = {
  itemCount: number;
  knowledgeCount: number;
  promptCount: number;
  zeroSourceCount: number;
  singleSourceCount: number;
  singleDomainCount: number;
  multiDomainCount: number;
  uniqueDomainCount: number;
  topDomainItemCount: number;
  topDomainSharePercent: number;
  domains: KnowledgeSourceRiskDomain[];
  reviewItems: KnowledgeSourceRiskItem[];
};

export type SourceDiversityResearchResult = {
  requestId: number;
  itemCount: number;
  singleSourceCount: number;
  singleDomainCount: number;
};

export type KnowledgeAutomationAiConfig = {
  enabled: boolean;
  provider: "openai";
  model: string;
  maxCandidatesPerRun: number;
  apiKeyConfigured: boolean;
};

export type KnowledgeAutomationAiConfigUpdate = {
  enabled: boolean;
  provider: "openai";
  model: string;
  maxCandidatesPerRun: number;
  apiKey?: string;
};

export type KnowledgeAutomationCandidate = {
  id: number;
  candidateAction: KnowledgeAutomationCandidateAction;
  existingItemType: "knowledge" | "prompt" | null;
  existingItemKey: string;
  matchedTasks: string[];
  sourceUrl: string;
  sourceTitle: string;
  sourceExcerpt: string;
  sourceHttpStatus: number | null;
  currentPayload: Record<string, unknown> | null;
  proposedPayload: Record<string, unknown> | null;
  researchPrompt: string;
  confidence: number;
  reason: string;
  status: KnowledgeAutomationCandidateStatus;
  reviewNotes: string;
  detectedAt: string;
  reviewedAt: string | null;
  analysisStatus: "pending" | "completed" | "failed";
  analysisDecision: "" | "no_change" | "new" | "update" | "recheck" | "retire";
  proposalItemType: "knowledge" | "prompt" | null;
  analysisProvider: string;
  analysisModel: string;
  analysisReason: string;
  analysisError: string;
  verifiedSourceUrls: string[];
  analyzedAt: string | null;
};

function emptyChangeGroup(): KnowledgeRefreshChangeGroup {
  return { added: 0, updated: 0, unchanged: 0, items: [] };
}

export function emptyKnowledgeRefreshDiff(): KnowledgeRefreshDiff {
  return { knowledge: emptyChangeGroup(), prompt: emptyChangeGroup() };
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseChangeItem(raw: unknown, fallbackType: "knowledge" | "prompt"): KnowledgeRefreshChangeItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const action = value.action;
  if (action !== "added" && action !== "updated" && action !== "unchanged") return null;
  return {
    itemType: value.item_type === "prompt" ? "prompt" : fallbackType,
    key: typeof value.key === "string" ? value.key : "",
    label: typeof value.label === "string" ? value.label : "",
    action,
    changedFields: Array.isArray(value.changed_fields)
      ? value.changed_fields.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [],
    sourceSummary: typeof value.source_summary === "string" ? value.source_summary : "",
  };
}

function parseChangeGroup(raw: unknown, fallbackType: "knowledge" | "prompt"): KnowledgeRefreshChangeGroup {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyChangeGroup();
  const value = raw as Record<string, unknown>;
  return {
    added: Math.max(0, asNumber(value.added)),
    updated: Math.max(0, asNumber(value.updated)),
    unchanged: Math.max(0, asNumber(value.unchanged)),
    items: Array.isArray(value.items)
      ? value.items.map((item) => parseChangeItem(item, fallbackType)).filter((item): item is KnowledgeRefreshChangeItem => Boolean(item))
      : [],
  };
}

export function parseKnowledgeRefreshDiff(raw: unknown): KnowledgeRefreshDiff {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyKnowledgeRefreshDiff();
  const value = raw as Record<string, unknown>;
  return {
    knowledge: parseChangeGroup(value.knowledge, "knowledge"),
    prompt: parseChangeGroup(value.prompt, "prompt"),
  };
}

function parseRequest(raw: Record<string, unknown>): KnowledgeRefreshRequest {
  return {
    id: typeof raw.id === "number" ? raw.id : Number(raw.id ?? 0),
    channel: raw.channel === "fresh" ? "fresh" : "stable",
    requestedAt: typeof raw.requested_at === "string" ? raw.requested_at : "",
    startedAt: typeof raw.started_at === "string" ? raw.started_at : null,
    status: raw.status === "processing" || raw.status === "completed" || raw.status === "failed" || raw.status === "cancelled"
      ? raw.status
      : "pending",
    completedAt: typeof raw.completed_at === "string" ? raw.completed_at : null,
    researchSummary: typeof raw.research_summary === "string" ? raw.research_summary : "",
    publishedKnowledgeCount: asNumber(raw.published_knowledge_count),
    publishedPromptCount: asNumber(raw.published_prompt_count),
    publishedVersion: raw.published_version === null || raw.published_version === undefined
      ? null
      : asNumber(raw.published_version, 1),
    errorMessage: typeof raw.error_message === "string" ? raw.error_message : "",
    changeDetails: parseKnowledgeRefreshDiff(raw.change_details),
  };
}

export async function adminListKnowledgeRefreshRequests(
  client: SupabaseClient,
  status: KnowledgeRefreshStatus | null = null,
  limit = 50,
): Promise<KnowledgeRefreshRequest[]> {
  const args = {
    p_status: status,
    p_limit: Math.max(1, Math.min(200, Math.trunc(limit))),
  };
  const current = await client.rpc("admin_list_knowledge_refresh_requests_v2", args);
  const response = current.error
    ? await client.rpc("admin_list_knowledge_refresh_requests", args)
    : current;
  if (response.error) throw new Error("ナレッジ更新キューを取得できませんでした。");
  return (response.data ?? []).map((row: Record<string, unknown>) => parseRequest(row));
}

export async function adminGetKnowledgeRefreshChannels(
  client: SupabaseClient,
): Promise<KnowledgeRefreshChannelState[]> {
  const { data, error } = await client.rpc("admin_get_knowledge_refresh_channels");
  if (error) throw new Error("Fresh / Stable の状態を取得できませんでした。");
  return (data ?? []).map((raw: Record<string, unknown>) => ({
    channel: raw.channel === "fresh" ? "fresh" : "stable",
    refreshHours: Math.max(1, asNumber(raw.refresh_hours, 1)),
    currentVersion: Math.max(1, asNumber(raw.current_version, 1)),
    lastPublishedAt: typeof raw.last_published_at === "string" ? raw.last_published_at : null,
    nextRefreshDueAt: typeof raw.next_refresh_due_at === "string" ? raw.next_refresh_due_at : null,
    lastRefreshRequestedAt: typeof raw.last_refresh_requested_at === "string" ? raw.last_refresh_requested_at : null,
  }));
}

export async function adminRequestKnowledgeRefresh(
  client: SupabaseClient,
  channel: KnowledgeRefreshChannel,
): Promise<number> {
  const { data, error } = await client.rpc("admin_request_knowledge_refresh", { p_channel: channel });
  if (error) throw new Error("ナレッジ更新をキューへ追加できませんでした。");
  const value = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(value) || value < 1) throw new Error("ナレッジ更新IDを確認できませんでした。");
  return value;
}

export async function adminStartKnowledgeRefresh(client: SupabaseClient, requestId: number): Promise<void> {
  const { error } = await client.rpc("admin_start_knowledge_refresh", { p_request_id: requestId });
  if (error) throw new Error("ナレッジ更新を開始できませんでした。");
}

export async function adminFailKnowledgeRefresh(
  client: SupabaseClient,
  requestId: number,
  message: string,
): Promise<void> {
  const { error } = await client.rpc("admin_fail_knowledge_refresh", {
    p_request_id: requestId,
    p_error_message: message.slice(0, 1000),
  });
  if (error) throw new Error("ナレッジ更新の失敗状態を保存できませんでした。");
}

export async function adminPreviewKnowledgeRefreshBundleDiff(
  client: SupabaseClient,
  bundle: KnowledgeRefreshBundle,
): Promise<KnowledgeRefreshDiff> {
  const { data, error } = await client.rpc("admin_preview_knowledge_refresh_bundle_diff", { p_bundle: bundle });
  if (error) throw new Error(error.message || "変更点を比較できませんでした。");
  return parseKnowledgeRefreshDiff(data);
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || /could not find the function|schema cache/i.test(error.message ?? "");
}

export async function adminPublishKnowledgeRefreshBundle(
  client: SupabaseClient,
  requestId: number,
  bundle: KnowledgeRefreshBundle,
): Promise<KnowledgeRefreshPublishResult> {
  const args = { p_request_id: requestId, p_bundle: bundle };
  let response = await client.rpc("admin_publish_knowledge_refresh_bundle_v4", args);
  if (response.error && isMissingRpc(response.error)) {
    response = await client.rpc("admin_publish_knowledge_refresh_bundle_v3", args);
  }
  if (response.error && isMissingRpc(response.error)) {
    response = await client.rpc("admin_publish_knowledge_refresh_bundle_v2", args);
  }
  if (response.error) throw new Error(response.error.message || "ナレッジ更新Bundleを公開できませんでした。");
  const data = response.data;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("ナレッジ更新結果を確認できませんでした。");
  }
  const value = row as Record<string, unknown>;
  return {
    channel: value.channel === "fresh" ? "fresh" : "stable",
    publishedVersion: asNumber(value.published_version, 1),
    knowledgeCount: asNumber(value.knowledge_count),
    promptCount: asNumber(value.prompt_count),
    changeDetails: parseKnowledgeRefreshDiff(value.change_details),
  };
}


function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function adminGetKnowledgeAutomationStatus(
  client: SupabaseClient,
): Promise<KnowledgeAutomationStatus | null> {
  const { data, error } = await client.rpc("admin_get_knowledge_automation_status");
  if (error) throw new Error(error.message || "公式ソース自動監視の状態を取得できませんでした。");
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  return {
    enabled: row.enabled !== false,
    checkIntervalHours: Math.max(1, asNumber(row.check_interval_hours, 24)),
    maxSourcesPerRun: Math.max(1, asNumber(row.max_sources_per_run, 12)),
    trackedSources: Math.max(0, asNumber(row.tracked_sources)),
    dueSources: Math.max(0, asNumber(row.due_sources)),
    pendingCandidates: Math.max(0, asNumber(row.pending_candidates)),
    approvedCandidates: Math.max(0, asNumber(row.approved_candidates)),
    lastWorkerInvokedAt: typeof row.last_worker_invoked_at === "string" ? row.last_worker_invoked_at : null,
    lastSuccessAt: typeof row.last_success_at === "string" ? row.last_success_at : null,
    lastError: typeof row.last_error === "string" ? row.last_error : "",
    latestRunId: row.latest_run_id === null || row.latest_run_id === undefined ? null : asNumber(row.latest_run_id),
    latestRunStatus: typeof row.latest_run_status === "string" ? row.latest_run_status : "",
    latestRunStartedAt: typeof row.latest_run_started_at === "string" ? row.latest_run_started_at : null,
    latestRunCompletedAt: typeof row.latest_run_completed_at === "string" ? row.latest_run_completed_at : null,
    latestRunSourcesChecked: Math.max(0, asNumber(row.latest_run_sources_checked)),
    latestRunCandidatesCreated: Math.max(0, asNumber(row.latest_run_candidates_created)),
  };
}

export async function adminListKnowledgeAutomationSources(
  client: SupabaseClient,
  limit = 200,
): Promise<KnowledgeAutomationSource[]> {
  const { data, error } = await client.rpc("admin_list_knowledge_automation_sources", {
    p_limit: Math.max(1, Math.min(500, Math.trunc(limit))),
  });
  if (error) throw new Error(error.message || "公式ソース監視一覧を取得できませんでした。");
  return (data ?? []).map((raw: Record<string, unknown>) => ({
    id: asNumber(raw.id),
    sourceUrl: typeof raw.source_url === "string" ? raw.source_url : "",
    tasks: asStringArray(raw.tasks),
    sourceKind: typeof raw.source_kind === "string" ? raw.source_kind : "official_page",
    enabled: raw.enabled !== false,
    lastCheckedAt: typeof raw.last_checked_at === "string" ? raw.last_checked_at : null,
    nextCheckAt: typeof raw.next_check_at === "string" ? raw.next_check_at : null,
    lastHttpStatus: raw.last_http_status === null || raw.last_http_status === undefined
      ? null
      : asNumber(raw.last_http_status),
    consecutiveFailures: Math.max(0, asNumber(raw.consecutive_failures)),
    lastError: typeof raw.last_error === "string" ? raw.last_error : "",
  }));
}

export async function adminGetKnowledgeProductionHealth(
  client: SupabaseClient,
): Promise<KnowledgeProductionHealth | null> {
  const { data, error } = await client.rpc("admin_get_knowledge_production_health");
  if (error) throw new Error(error.message || "Knowledge本番状態を取得できませんでした。");
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  return {
    activeKnowledge: Math.max(0, asNumber(row.active_knowledge)),
    activePromptOptimizations: Math.max(0, asNumber(row.active_prompt_optimizations)),
    pendingRequests: Math.max(0, asNumber(row.pending_requests)),
    processingRequests: Math.max(0, asNumber(row.processing_requests)),
    failedRequests: Math.max(0, asNumber(row.failed_requests)),
    cancelledRequests: Math.max(0, asNumber(row.cancelled_requests)),
    freshVersion: Math.max(1, asNumber(row.fresh_version, 1)),
    stableVersion: Math.max(1, asNumber(row.stable_version, 1)),
    lastKnowledgeCheckedAt: typeof row.last_knowledge_checked_at === "string" ? row.last_knowledge_checked_at : null,
    lastPromptCheckedAt: typeof row.last_prompt_checked_at === "string" ? row.last_prompt_checked_at : null,
  };
}

export async function adminGetKnowledgeSourceRiskReport(
  client: SupabaseClient,
): Promise<KnowledgeSourceRiskReport> {
  const { data, error } = await client.rpc("admin_get_knowledge_source_risk_report");
  if (error) throw new Error(error.message || "Knowledge根拠リスクを取得できませんでした。");
  const row = asObject(data) ?? {};
  const domains = Array.isArray(row.domains) ? row.domains : [];
  const reviewItems = Array.isArray(row.review_items) ? row.review_items : [];
  return {
    itemCount: Math.max(0, asNumber(row.item_count)),
    knowledgeCount: Math.max(0, asNumber(row.knowledge_count)),
    promptCount: Math.max(0, asNumber(row.prompt_count)),
    zeroSourceCount: Math.max(0, asNumber(row.zero_source_count)),
    singleSourceCount: Math.max(0, asNumber(row.single_source_count)),
    singleDomainCount: Math.max(0, asNumber(row.single_domain_count)),
    multiDomainCount: Math.max(0, asNumber(row.multi_domain_count)),
    uniqueDomainCount: Math.max(0, asNumber(row.unique_domain_count)),
    topDomainItemCount: Math.max(0, asNumber(row.top_domain_item_count)),
    topDomainSharePercent: Math.max(0, asNumber(row.top_domain_share_percent)),
    domains: domains.map((raw) => asObject(raw)).filter((raw): raw is Record<string, unknown> => Boolean(raw)).map((raw) => ({
      domain: typeof raw.domain === "string" ? raw.domain : "",
      itemCount: Math.max(0, asNumber(raw.item_count)),
      urlCount: Math.max(0, asNumber(raw.url_count)),
    })).filter((item) => item.domain),
    reviewItems: reviewItems.map((raw) => asObject(raw)).filter((raw): raw is Record<string, unknown> => Boolean(raw)).map((raw): KnowledgeSourceRiskItem => ({
      itemType: raw.item_type === "prompt" ? "prompt" : "knowledge",
      key: typeof raw.key === "string" ? raw.key : "",
      label: typeof raw.label === "string" ? raw.label : "",
      catalogVersion: Math.max(1, asNumber(raw.catalog_version, 1)),
      releaseChannel: typeof raw.release_channel === "string" ? raw.release_channel : "",
      sourceCheckedAt: typeof raw.source_checked_at === "string" ? raw.source_checked_at : null,
      sourceCount: Math.max(0, asNumber(raw.source_count)),
      domainCount: Math.max(0, asNumber(raw.domain_count)),
      sourceUrls: asStringArray(raw.source_urls),
    })).filter((item) => item.key),
  };
}

export async function adminPrepareSourceDiversityResearch(
  client: SupabaseClient,
  limit = 12,
): Promise<SourceDiversityResearchResult> {
  const { data, error } = await client.rpc("admin_prepare_source_diversity_research", {
    p_limit: Math.max(1, Math.min(30, Math.trunc(limit))),
  });
  if (error) throw new Error(error.message || "追加根拠リサーチを準備できませんでした。");
  const row = asObject(data);
  if (!row) throw new Error("追加根拠リサーチ結果を確認できませんでした。");
  return {
    requestId: asNumber(row.request_id),
    itemCount: Math.max(0, asNumber(row.item_count)),
    singleSourceCount: Math.max(0, asNumber(row.single_source_count)),
    singleDomainCount: Math.max(0, asNumber(row.single_domain_count)),
  };
}

export async function adminListKnowledgeAutomationCandidates(
  client: SupabaseClient,
  status: KnowledgeAutomationCandidateStatus | null = "pending",
  limit = 50,
): Promise<KnowledgeAutomationCandidate[]> {
  const args = {
    p_status: status,
    p_limit: Math.max(1, Math.min(200, Math.trunc(limit))),
  };
  let response = await client.rpc("admin_list_knowledge_automation_candidates_v2", args);
  if (response.error && isMissingRpc(response.error)) {
    response = await client.rpc("admin_list_knowledge_automation_candidates", args);
  }
  if (response.error) throw new Error(response.error.message || "自動調査候補を取得できませんでした。");
  return (response.data ?? []).map((raw: Record<string, unknown>) => ({
    id: asNumber(raw.id),
    candidateAction:
      raw.candidate_action === "update" || raw.candidate_action === "recheck" || raw.candidate_action === "retire"
        ? raw.candidate_action
        : "new",
    existingItemType: raw.existing_item_type === "knowledge" || raw.existing_item_type === "prompt"
      ? raw.existing_item_type
      : null,
    existingItemKey: typeof raw.existing_item_key === "string" ? raw.existing_item_key : "",
    matchedTasks: asStringArray(raw.matched_tasks),
    sourceUrl: typeof raw.source_url === "string" ? raw.source_url : "",
    sourceTitle: typeof raw.source_title === "string" ? raw.source_title : "",
    sourceExcerpt: typeof raw.source_excerpt === "string" ? raw.source_excerpt : "",
    sourceHttpStatus: raw.source_http_status === null || raw.source_http_status === undefined
      ? null
      : asNumber(raw.source_http_status),
    currentPayload: asObject(raw.current_payload),
    proposedPayload: asObject(raw.proposed_payload),
    researchPrompt: typeof raw.research_prompt === "string" ? raw.research_prompt : "",
    confidence: Math.max(0, Math.min(100, asNumber(raw.confidence, 50))),
    reason: typeof raw.reason === "string" ? raw.reason : "",
    status:
      raw.status === "approved" || raw.status === "rejected" || raw.status === "converted"
        ? raw.status
        : "pending",
    reviewNotes: typeof raw.review_notes === "string" ? raw.review_notes : "",
    detectedAt: typeof raw.detected_at === "string" ? raw.detected_at : "",
    reviewedAt: typeof raw.reviewed_at === "string" ? raw.reviewed_at : null,
    analysisStatus:
      raw.analysis_status === "completed" || raw.analysis_status === "failed"
        ? raw.analysis_status
        : "pending",
    analysisDecision:
      raw.analysis_decision === "no_change" || raw.analysis_decision === "new" ||
      raw.analysis_decision === "update" || raw.analysis_decision === "recheck" ||
      raw.analysis_decision === "retire"
        ? raw.analysis_decision
        : "",
    proposalItemType: raw.proposal_item_type === "knowledge" || raw.proposal_item_type === "prompt"
      ? raw.proposal_item_type
      : null,
    analysisProvider: typeof raw.analysis_provider === "string" ? raw.analysis_provider : "",
    analysisModel: typeof raw.analysis_model === "string" ? raw.analysis_model : "",
    analysisReason: typeof raw.analysis_reason === "string" ? raw.analysis_reason : "",
    analysisError: typeof raw.analysis_error === "string" ? raw.analysis_error : "",
    verifiedSourceUrls: asStringArray(raw.verified_source_urls),
    analyzedAt: typeof raw.analyzed_at === "string" ? raw.analyzed_at : null,
  }));
}

export async function adminReviewKnowledgeAutomationCandidate(
  client: SupabaseClient,
  candidateId: number,
  decision: "approved" | "rejected" | "converted",
  notes = "",
): Promise<void> {
  const { error } = await client.rpc("admin_review_knowledge_automation_candidate", {
    p_candidate_id: candidateId,
    p_decision: decision,
    p_notes: notes.slice(0, 2000),
  });
  if (error) throw new Error(error.message || "自動調査候補を更新できませんでした。");
}

export async function adminRequestKnowledgeAutomationRun(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("admin_request_knowledge_automation_run");
  if (error) throw new Error(error.message || "公式ソース自動調査を開始できませんでした。");
  const id = asNumber(data);
  if (id < 1) throw new Error("自動調査IDを確認できませんでした。");
  return id;
}

export async function adminGetKnowledgeAutomationAiConfig(
  client: SupabaseClient,
): Promise<KnowledgeAutomationAiConfig> {
  const { data, error } = await client.rpc("admin_get_knowledge_automation_ai_config");
  if (error) throw new Error(error.message || "AI自動解析設定を取得できませんでした。");
  const raw = Array.isArray(data) ? data[0] : data;
  const row = asObject(raw);
  if (!row) {
    return { enabled:false,provider:"openai",model:"gpt-5.6",maxCandidatesPerRun:6,apiKeyConfigured:false };
  }
  return {
    enabled: row.enabled === true,
    provider: "openai",
    model: typeof row.model === "string" && row.model.trim() ? row.model.trim() : "gpt-5.6",
    maxCandidatesPerRun: Math.max(1,Math.min(20,asNumber(row.max_candidates_per_run,6))),
    apiKeyConfigured: row.api_key_configured === true,
  };
}

export async function adminSetKnowledgeAutomationAiConfig(
  client: SupabaseClient,
  config: KnowledgeAutomationAiConfigUpdate,
): Promise<void> {
  const { error } = await client.rpc("admin_set_knowledge_automation_ai_config", {
    p_enabled: config.enabled,
    p_provider: config.provider,
    p_model: config.model.trim(),
    p_max_candidates_per_run: Math.max(1,Math.min(20,Math.trunc(config.maxCandidatesPerRun))),
    p_api_key: config.apiKey?.trim() || null,
  });
  if (error) throw new Error(error.message || "AI自動解析設定を保存できませんでした。");
}

export async function adminRetryKnowledgeAutomationCandidateAi(
  client: SupabaseClient,
  candidateId: number,
): Promise<void> {
  const { error } = await client.rpc("admin_retry_knowledge_automation_candidate_ai", {
    p_candidate_id: candidateId,
  });
  if (error) throw new Error(error.message || "AI解析候補を再試行状態へ戻せませんでした。");
}

export function buildKnowledgeAutomationCandidateBundle(
  candidate: KnowledgeAutomationCandidate,
): KnowledgeRefreshBundle | null {
  if (
    candidate.analysisStatus !== "completed" ||
    (candidate.analysisDecision !== "new" && candidate.analysisDecision !== "update") ||
    !candidate.proposedPayload ||
    !candidate.proposalItemType
  ) return null;

  return {
    summary:
      `自動公式ソース調査候補 #${candidate.id}: ${candidate.analysisReason || candidate.reason} / ${candidate.sourceUrl}`.slice(0,2000),
    knowledge_rules: candidate.proposalItemType === "knowledge" ? [candidate.proposedPayload] : [],
    prompt_optimizations: candidate.proposalItemType === "prompt" ? [candidate.proposedPayload] : [],
  };
}


export function parseKnowledgeRefreshBundle(text: string): KnowledgeRefreshBundle {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("JSONの最上位はオブジェクトにしてください。");
  }
  const value = raw as Record<string, unknown>;
  const knowledge = Array.isArray(value.knowledge_rules) ? value.knowledge_rules : null;
  const prompts = Array.isArray(value.prompt_optimizations) ? value.prompt_optimizations : null;
  if (!knowledge || !prompts) {
    throw new Error("knowledge_rules と prompt_optimizations の配列が必要です。");
  }
  if (knowledge.length === 0 && prompts.length === 0) {
    throw new Error("更新候補が1件もありません。");
  }
  return {
    summary: typeof value.summary === "string" ? value.summary.slice(0, 2000) : "",
    knowledge_rules: knowledge,
    prompt_optimizations: prompts,
  };
}

export function buildKnowledgeRefreshResearchPrompt(channel: "stable" | "fresh"): string {
  const rollout = channel === "fresh"
    ? "Fresh向け。確認済みの重要変更を早期反映する候補を作る。断定できない変更は含めない。"
    : "Stable向け。十分に定着し、公式情報で確認できる変更だけを候補にする。";

  return `あなたはAI Action Studio（AAS）のKnowledge / Prompt Update編集者です。
目的は、AASの記事制作・画像計画・SNS制作に加え、各副業専用機能の判断・制作・販売・案件獲得・調査・業務効率化に影響する最新変更をWebで調査し、管理者レビュー用JSONだけを返すことです。

【更新チャネル】
${rollout}

【調査対象】
- note / Tips / Brain の記事制作・販売・公開仕様
- X、Instagram、Threads、TikTok、YouTube等のSNS・動画制作・公開に関係する公式仕様
- アフィリエイトで購入判断・広告表示・商品比較に影響する公式仕様や公的ルール
- メルカリ、ラクマ、Yahoo!系マーケット、Amazon等の物販で出品・手数料・禁止商品・配送に影響する公式仕様
- クラウドワークス、ランサーズ、ココナラ等の案件応募・契約・納品に影響する公式仕様
- デジタル商品・スキル販売で販売条件、購入者対応、納品に影響する公式仕様
- 営業・案件獲得で迷惑行為や虚偽表示を避けるために必要な公的・公式情報
- リサーチ、ファクトチェック、業務効率化で情報源の信頼性・更新日・AI利用上の注意に影響する変更
- ChatGPT / OpenAI、Claude / Anthropic、Gemini / Google の利用上重要な変更
- 一時的な流行・感想・裏技・SEO都市伝説は採用しない。

【情報源ルール】
- まず公式ヘルプ、公式ドキュメント、公式発表を使う。
- 重要な変更は可能な限り2つ以上の独立した根拠で確認する。公式一次情報が1つしかない場合は、その事実をsummaryに明記する。
- 公開日・更新日・対象地域・対象プランを確認する。
- 検索結果スニペットだけで断定しない。
- 古い仕様と現在仕様を混ぜない。
- 未確認情報、推測、SNS上の噂はKnowledgeへ入れない。

【AAS安全ルール】
- ユーザーの実体験・実績・レビューを創作する指示を追加しない。
- 価格、統計、ランキング、アルゴリズム、販売数など変動情報を普遍ルールとして固定しない。
- 「必ず伸びる」「必ず売れる」等の成果保証を追加しない。
- 特定の作家・作品・競合記事の模倣を促さない。
- 既存AASルールと意味が重複するだけの候補は出さない。
- 変更が無い領域は無理に候補を作らない。

【JSON出力】
説明文やMarkdownコードフェンスを付けず、次の形のJSONオブジェクトだけを返す。

{
  "summary": "今回確認した変更の要約。変更なしの領域も簡潔に記載",
  "knowledge_rules": [
    {
      "key": "auto:一貫して再利用できる英数字キー",
      "kind": "age|genre|subgenre|publication|task|combination",
      "label": "表示名",
      "parent_label": "",
      "aliases": [],
      "guidance": ["制作ルール"],
      "deliverables": ["有効な成果物"],
      "cautions": ["注意・禁止"],
      "tasks": ["sidejob_affiliate"],
      "priority": 70,
      "source_urls": ["https://..."],
      "source_summary": "根拠と変更点を短く要約"
    }
  ],
  "prompt_optimizations": [
    {
      "key": "auto:一貫して再利用できる英数字キー",
      "provider": "all|chatgpt|claude|gemini",
      "plan": "all|free|paid",
      "task": "all|title|article|image|social|promotion|sidejob_content|sidejob_sns|sidejob_video|sidejob_affiliate|sidejob_resale|sidejob_crowdsourcing|sidejob_skill_sales|sidejob_digital_product|sidejob_outreach|sidejob_research|sidejob_efficiency|sidejob_planning",
      "rules": ["現在のモデル/サービスで有効な、短く具体的なプロンプト最適化ルール"],
      "priority": 70,
      "source_urls": ["https://..."],
      "source_summary": "公式情報との対応関係を短く要約"
    }
  ]
}

【tasks / task の指定ルール】
- 上のJSON例は形式例。tasksには今回の変更が実際に影響するタスクだけを1〜数個入れる。
- prompt_optimizations.taskも、影響する1タスクまたは本当に全タスク共通の場合だけallを使う。

【副業タスク割り当て】
- 記事・コンテンツ販売 → sidejob_content
- SNS運用・集客 → sidejob_sns
- YouTube・ショート動画 → sidejob_video
- アフィリエイト → sidejob_affiliate
- 物販・フリマ販売 → sidejob_resale
- クラウドソーシング → sidejob_crowdsourcing
- スキル販売 → sidejob_skill_sales
- デジタル商品・教材販売 → sidejob_digital_product
- 営業・案件獲得 → sidejob_outreach
- リサーチ・事実確認 → sidejob_research
- 業務効率化・SOP化 → sidejob_efficiency
- AI副業選定 → sidejob_planning
- 1つの変更を無関係な全タスクへ広げない。影響するタスクだけ指定する。
- 副業Knowledgeはタスク単位の一般論だけで終わらせず、媒体・用途・初心者/経験者・販売/集客/制作・リスクなど、実際に出力を変える状況差がある場合は別候補として細分化する。
- 状況別候補は label / parent_label / guidance に「何の条件で変わるKnowledgeか」が分かる名前と説明を入れる。例: SNS運用 > Instagram、記事販売 > 完全初心者、物販 > 家電・ガジェット。
- 単一条件だけでは判断が変わらず、2〜4条件の組み合わせで出力が大きく変わる場合は、複合条件Knowledgeとして分ける。例: note × 完全初心者 × 有料記事、Instagram × 新規アカウント × 信頼形成、フリマ × 中古家電 × 精密配送。
- 複合条件は網羅的な直積を作らず、媒体・経験段階・目的・制作方法・販売導線・リスクの相互作用が明確な高価値パターンだけ候補化する。
- ただし一時的なUI配置や短命な流行では分割せず、再利用できる判断ルールだけKnowledge化する。

【最終監査】
- source_urlsが空の候補は出さない。
- keyは必ず auto: で始める。
- 最新性を理由に安全・事実性を弱めない。
- 一時的なUI文言やキャンペーンだけの変更は原則Knowledge化しない。
- 既存仕様を確認できない場合は候補にせずsummaryへ「要確認」と書く。`;
}

