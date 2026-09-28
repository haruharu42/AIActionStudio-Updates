import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("knowledge refresh scheduler releases processing requests that are stuck for more than 24 hours", async () => {
  const migration = await readRepo("supabase/migrations/20260923234555_knowledge_refresh_stale_recovery.sql");
  const panel = await readPwa("components/knowledge-refresh-panel.tsx");
  const display = await readPwa("components/knowledge-refresh/knowledge-refresh-display.ts");

  assert.match(migration, /status = 'failed'/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(migration, /next refresh cycle/);
  assert.match(migration, /enqueue_due_knowledge_refreshes/);
  assert.match(migration, /revoke all on function private\.enqueue_due_knowledge_refreshes/);
  assert.match(display, /24時間以上処理中だったため自動解除/);
  assert.match(panel, /knowledgeRefreshErrorLabel/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);
});

test("knowledge auto-update control plane keeps Fresh and Stable review-gated and versioned", async () => {
  const migration = await readRepo("supabase/migrations/20260919083000_knowledge_prompt_auto_update.sql");

  assert.match(migration, /create table if not exists public\.prompt_optimization_catalog/);
  assert.match(migration, /alter table public\.prompt_optimization_catalog enable row level security/);
  assert.match(migration, /alter table public\.prompt_optimization_catalog force row level security/);
  assert.match(migration, /revoke all on table public\.prompt_optimization_catalog from public, anon, authenticated/);
  assert.match(migration, /admin_publish_knowledge_refresh_bundle/);
  assert.match(migration, /request_row\.channel = 'fresh'.*'fresh_first'/s);
  assert.match(migration, /stable_knowledge_refresh_hours/);
  assert.match(migration, /current_version = next_version/);
  assert.match(migration, /published_version = next_version/);
  assert.match(migration, /knowledge key must start with auto:/);
  assert.match(migration, /prompt key must start with auto:/);
  assert.match(migration, /source_urls are required/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);
});

test("runtime loads cloud knowledge and task-aware prompt optimizations together", async () => {
  const bootstrap = await readPwa("components/knowledge-runtime-bootstrap.tsx");
  const promptOptimization = await readPwa("lib/prompt-optimization.ts");
  const personalization = await readPwa("lib/user-personalization.ts");

  assert.match(bootstrap, /loadActiveKnowledgeCatalog/);
  assert.match(bootstrap, /loadActivePromptOptimizations/);
  assert.match(bootstrap, /loadKnowledgeRuntimeState/);
  assert.match(bootstrap, /Promise\.all/);
  assert.match(promptOptimization, /compilePromptOptimizationContext/);
  assert.match(promptOptimization, /KNOWLEDGE_RUNTIME_EVENT/);
  assert.match(promptOptimization, /isKnowledgeTask/);
  assert.match(promptOptimization, /AAS CLOUD PROMPT OPTIMIZATION/);
  assert.match(promptOptimization, /rule\.provider === "all" \|\| rule\.provider === provider/);
  assert.match(promptOptimization, /rule\.task === "all" \|\| rule\.task === task/);
  assert.match(personalization, /task: KnowledgeTask = "article"/);
  assert.match(personalization, /compilePromptOptimizationContext/);
});

test("all major exported prompt builders can consume the cloud optimization layer", async () => {
  const creator = await readPwa("lib/phase11-create.ts");
  const image = await readPwa("lib/phase13-image-prompts.ts");
  const social = await readPwa("lib/phase14-sns.ts");
  const promotion = await readPwa("lib/admin-promotion.ts");
  const sidejob = await readPwa("lib/phase15-sidejob.ts");
  const snsPlan = await readPwa("lib/phase15-sns-plan.ts");

  assert.match(creator, /promptContextBlock\("title"\)/);
  assert.match(creator, /promptContextBlock\("article"\)/);
  assert.match(image, /buildUserPromptContext\(getRuntimeWritingProfile\(\), "image"\)/);
  assert.match(social, /buildUserPromptContext\(getRuntimeWritingProfile\(\), "social"\)/);
  assert.match(promotion, /buildUserPromptContext\(getRuntimeWritingProfile\(\), "promotion"\)/);
  assert.match(sidejob, /buildUserPromptContext\(getRuntimeWritingProfile\(\), "article"\)/);
  assert.match(snsPlan, /buildUserPromptContext\(getRuntimeWritingProfile\(\), "social"\)/);
  assert.match(creator, /cloud_knowledge_channel/);
  assert.match(creator, /cloud_knowledge_version/);
  assert.match(creator, /prompt_optimization_version/);
});

test("admin refresh UI requires sourced JSON review before publication", async () => {
  const panel = await readPwa("components/knowledge-refresh-panel.tsx");
  const client = await readPwa("lib/knowledge-auto-update.ts");
  const admin = await readPwa("components/admin-knowledge-page.tsx");

  assert.match(admin, /KnowledgeRefreshPanel/);
  assert.match(panel, /自動収集＝自動公開ではありません/);
  assert.match(panel, /調査プロンプトをコピー/);
  assert.match(panel, /差分確認後に公開/);
  assert.match(client, /まず公式ヘルプ、公式ドキュメント、公式発表を使う/);
  assert.match(client, /可能な限り2つ以上の独立した根拠/);
  assert.match(client, /source_urlsが空の候補は出さない/);
  assert.match(client, /副業タスク割り当て/);
  assert.match(client, /sidejob_affiliate/);
  assert.match(client, /sidejob_resale/);
  assert.match(client, /sidejob_crowdsourcing/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle/);
  assert.doesNotMatch(`${panel}\n${client}`, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service[_-]?role/i);
});


test("knowledge update diff migration records material changes before publish", async () => {
  const migration = await readRepo("supabase/migrations/20260919122008_knowledge_prompt_update_diff_visibility.sql");

  assert.match(migration, /add column if not exists change_details jsonb/);
  assert.match(migration, /private\.aas_knowledge_refresh_diff/);
  assert.match(migration, /admin_preview_knowledge_refresh_bundle_diff/);
  assert.match(migration, /admin_publish_knowledge_refresh_bundle_v2/);
  assert.match(migration, /admin_list_knowledge_refresh_requests_v2/);
  assert.match(migration, /admin_get_knowledge_refresh_channels/);
  assert.match(migration, /changed_fields/);
  assert.match(migration, /'added'/);
  assert.match(migration, /'updated'/);
  assert.match(migration, /'unchanged'/);
  assert.match(migration, /private\.is_active_admin/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);
});

test("Fresh and Stable are explained clearly and publication requires diff review", async () => {
  const panel = await readPwa("components/knowledge-refresh-panel.tsx");
  const client = await readPwa("lib/knowledge-auto-update.ts");
  const css = await readPwa("app/phase26-knowledge.css");

  assert.match(panel, /FRESH/);
  assert.match(panel, /先行確認版/);
  assert.match(panel, /STABLE/);
  assert.match(panel, /標準版/);
  assert.match(panel, /Fresh = 早めに確認する場所/);
  assert.match(panel, /Stable = 一般利用の基準/);
  assert.match(panel, /変更点を確認/);
  assert.match(panel, /差分確認後に公開/);
  assert.match(panel, /今回どこが変わるか/);
  assert.match(panel, /変更した場所を詳しく見る/);
  assert.match(panel, /adminPreviewKnowledgeRefreshBundleDiff/);
  assert.match(panel, /adminGetKnowledgeRefreshChannels/);

  assert.match(client, /admin_list_knowledge_refresh_requests_v2/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle_v2/);
  assert.match(client, /parseKnowledgeRefreshDiff/);
  assert.match(css, /\.knowledge-channel-guide/);
  assert.match(css, /\.knowledge-diff-summary/);
});


test("side-hustle knowledge migration expands task constraints without changing the review gate", async () => {
  const migration = await readRepo("supabase/migrations/20260923231331_side_hustle_knowledge_tasks_v1.sql");
  assert.match(migration, /sidejob_content/);
  assert.match(migration, /sidejob_sns/);
  assert.match(migration, /sidejob_video/);
  assert.match(migration, /sidejob_affiliate/);
  assert.match(migration, /sidejob_resale/);
  assert.match(migration, /sidejob_crowdsourcing/);
  assert.match(migration, /sidejob_skill_sales/);
  assert.match(migration, /sidejob_digital_product/);
  assert.match(migration, /sidejob_outreach/);
  assert.match(migration, /sidejob_research/);
  assert.match(migration, /sidejob_efficiency/);
  assert.match(migration, /sidejob_planning/);
  assert.match(migration, /admin_publish_knowledge_refresh_bundle/);
  assert.match(migration, /admin_review_knowledge_candidate/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
});


test("official-source automation detects changes but never auto-publishes Knowledge", async () => {
  const [foundation, scheduler, snapshot, tuning, providerHubs, worker, panel, client] = await Promise.all([
    readRepo("supabase/migrations/20260924194519_knowledge_web_automation_foundation_v1.sql"),
    readRepo("supabase/migrations/20260924195007_knowledge_web_automation_scheduler_v1.sql"),
    readRepo("supabase/migrations/20260924195224_knowledge_web_automation_snapshot_rpc_v1.sql"),
    readRepo("supabase/migrations/20260924195615_knowledge_web_automation_discovery_tuning_v1.sql"),
    readRepo("supabase/migrations/20260924200421_knowledge_web_automation_provider_hubs_v1.sql"),
    readRepo("supabase/functions/knowledge-research-worker/index.ts"),
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("lib/knowledge-auto-update.ts"),
  ]);

  assert.match(foundation, /knowledge_automation_sources/);
  assert.match(foundation, /knowledge_automation_runs/);
  assert.match(foundation, /knowledge_automation_candidates/);
  assert.match(foundation, /candidate_action in \('new','update','recheck','retire'\)/);
  assert.match(foundation, /aas_knowledge_worker_token/);
  assert.match(foundation, /worker_token_hash/);
  assert.match(foundation, /enable row level security/);
  assert.match(foundation, /revoke all on table public\.knowledge_automation_candidates from anon, authenticated/);

  assert.match(scheduler, /private\.invoke_knowledge_automation_worker/);
  assert.match(scheduler, /vault\.decrypted_secrets/);
  assert.match(scheduler, /net\.http_post/);
  assert.match(scheduler, /aas-knowledge-research-worker-6h/);
  assert.match(scheduler, /23 \*\/6 \* \* \*/);

  assert.match(snapshot, /get_knowledge_automation_catalog_snapshot/);
  assert.match(snapshot, /security definer/);
  assert.match(snapshot, /revoke all on function public\.get_knowledge_automation_catalog_snapshot\(\) from public, anon, authenticated/);
  assert.match(snapshot, /grant execute on function public\.get_knowledge_automation_catalog_snapshot\(\) to service_role/);

  assert.match(tuning, /max_discovered_links_per_source=0/);
  assert.match(tuning, /official_changelog/);
  assert.match(tuning, /gemini-api\/docs\/changelog/);

  assert.match(providerHubs, /developers\.openai\.com\/api\/docs\/changelog/);
  assert.match(providerHubs, /docs\.anthropic\.com\/en\/docs\/about-claude\/model-deprecations/);
  assert.match(providerHubs, /prompt-engineering\/prompt-templates-and-variables/);
  assert.match(providerHubs, /official_changelog/);

  assert.match(worker, /x-aas-worker-token/);
  assert.match(worker, /get_knowledge_automation_catalog_snapshot/);
  assert.match(worker, /last_content_hash/);
  assert.match(worker, /official_changelog/);
  assert.match(worker, /candidate\(runId,source,action/);
  assert.match(worker, /knowledge_automation_candidates"\)\.upsert/);
  assert.match(worker, /onConflict:\s*"fingerprint"/);
  assert.match(worker, /ignoreDuplicates:\s*true/);
  assert.match(worker, /\.select\("id"\)/);
  assert.doesNotMatch(worker, /knowledge_automation_candidates"\)\.insert/);
  assert.match(worker, /404 \|\| res\.status === 410/);
  assert.doesNotMatch(worker, /admin_publish_knowledge_refresh_bundle/);
  assert.doesNotMatch(worker, /knowledge_catalog"\)\.insert|knowledge_catalog"\)\.update/);

  assert.match(panel, /公式ソース自動監視/);
  assert.match(panel, /自動調査 ≠ 自動公開/);
  assert.match(panel, /今すぐ公式ソースを調査/);
  assert.match(panel, /候補承認（公開しない）/);
  assert.match(panel, /adminReviewKnowledgeAutomationCandidate/);

  assert.match(client, /admin_get_knowledge_automation_status/);
  assert.match(client, /admin_list_knowledge_automation_candidates/);
  assert.match(client, /admin_request_knowledge_automation_run/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle_v4/);
  assert.match(client, /isMissingRpc/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle_v3/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle_v2/);
});

test("automation approval is candidate review only and remains separate from publication", async () => {
  const [foundation, panel, client] = await Promise.all([
    readRepo("supabase/migrations/20260924194519_knowledge_web_automation_foundation_v1.sql"),
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("lib/knowledge-auto-update.ts"),
  ]);

  assert.match(foundation, /status='approved'|approved/);
  assert.match(foundation, /admin_review_knowledge_automation_candidate/);
  assert.doesNotMatch(foundation, /admin_review_knowledge_automation_candidate[\s\S]*admin_publish_knowledge_refresh_bundle/);

  assert.match(panel, /まだ正式Knowledgeには公開されていません/);
  assert.match(panel, /正式反映には従来のQuality Gate・差分確認・Fresh \/ Stable公開操作が必要/);
  assert.match(client, /decision: "approved" \| "rejected" \| "converted"/);
});


test("AI enrichment drafts Knowledge candidates but keeps final publication admin-gated", async () => {
  const [migration, worker, panel, client, docs] = await Promise.all([
    readRepo("supabase/migrations/20260924201026_knowledge_ai_enrichment_v1.sql"),
    readRepo("supabase/functions/knowledge-research-worker/index.ts"),
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("lib/knowledge-auto-update.ts"),
    readRepo("docs/knowledge-web-automation.md"),
  ]);

  assert.match(migration, /ai_enrichment_enabled boolean not null default false/);
  assert.match(migration, /aas_knowledge_openai_api_key/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /vault\.update_secret/);
  assert.match(migration, /get_knowledge_automation_worker_ai_config/);
  assert.match(migration, /grant execute on function public\.get_knowledge_automation_worker_ai_config\(\) to service_role/);
  assert.match(migration, /revoke all on function public\.get_knowledge_automation_worker_ai_config\(\) from public, anon, authenticated/);
  assert.match(migration, /analysis_status/);
  assert.match(migration, /proposed_payload/);
  assert.match(migration, /admin_list_knowledge_automation_candidates_v2/);
  assert.match(migration, /admin_retry_knowledge_automation_candidate_ai/);

  assert.match(worker, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(worker, /store:false/);
  assert.match(worker, /text:\{ format:\{ type:"json_object" \} \}/);
  assert.match(worker, /sanitizeAiProposal/);
  assert.match(worker, /allowedTasks/);
  assert.match(worker, /allowedKnowledgeKinds/);
  assert.match(worker, /allowedSourceUrls/);
  assert.match(worker, /analysis_status:"completed"/);
  assert.match(worker, /analysis_status:"failed"/);
  assert.match(worker, /get_knowledge_automation_worker_ai_config/);
  assert.match(worker, /enrichPendingCandidates/);
  assert.doesNotMatch(worker, /admin_publish_knowledge_refresh_bundle/);
  assert.doesNotMatch(worker, /knowledge_catalog"\)\.insert|knowledge_catalog"\)\.update/);

  assert.match(client, /admin_get_knowledge_automation_ai_config/);
  assert.match(client, /admin_set_knowledge_automation_ai_config/);
  assert.match(client, /admin_list_knowledge_automation_candidates_v2/);
  assert.match(client, /buildKnowledgeAutomationCandidateBundle/);
  assert.match(client, /analysisStatus !== "completed"/);

  assert.match(panel, /AI候補JSON自動生成/);
  assert.match(panel, /APIキー.*Vault設定済み/);
  assert.match(panel, /type="password"/);
  assert.match(panel, /Fresh差分へ取り込む/);
  assert.match(panel, /候補状態もまだ確定していません/);
  assert.match(panel, /変更点を確認/);
  assert.match(panel, /adminSetKnowledgeAutomationAiConfig/);
  assert.match(panel, /buildKnowledgeAutomationCandidateBundle/);

  assert.match(docs, /AI output is treated as an untrusted draft/);
  assert.match(docs, /does \*\*not\*\* run the publication RPC/);
});

test("AI enrichment can fail or be disabled without stopping official-source monitoring", async () => {
  const worker = await readRepo("supabase/functions/knowledge-research-worker/index.ts");

  assert.match(worker, /if \(config\.enabled !== true \|\| typeof config\.api_key !== "string" \|\| !config\.api_key\)/);
  assert.match(worker, /return \{ enabled:false,analyzed:0,failed:0 \}/);
  assert.match(worker, /try \{\s*ai = await enrichPendingCandidates\(\);/s);
  assert.match(worker, /AI enrichment:/);
  assert.match(worker, /status:"completed"/);
  assert.match(worker, /candidates_analyzed:ai\.analyzed/);
  assert.match(worker, /analysis_failures:ai\.failed/);
});

test("AI proposal handoff only pre-fills a Fresh review request and does not bypass diff confirmation", async () => {
  const [panel, client] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("lib/knowledge-auto-update.ts"),
  ]);

  assert.match(panel, /adminRequestKnowledgeRefresh\(client, "fresh"\)/);
  assert.match(panel, /preparedAutomationCandidateId/);
  assert.match(panel, /"converted"/);
  assert.match(panel, /setBundleText\(JSON\.stringify\(bundle, null, 2\)\)/);
  assert.match(panel, /setDiffPreview\(null\)/);
  assert.match(panel, /adminPublishKnowledgeRefreshBundle[\s\S]*preparedAutomationCandidateId[\s\S]*"converted"/);
  assert.match(panel, /公開に成功した場合だけ処理済みにします/);
  assert.match(panel, /disabled=\{busy \|\| !diffPreview\}/);
  assert.match(client, /proposalItemType === "knowledge"/);
  assert.match(client, /proposalItemType === "prompt"/);
});


test("knowledge monitor dashboard exposes admin-only source health and side-hustle coverage", async () => {
  const [migration, panel, sourceHealth, display, client, css] = await Promise.all([
    readRepo("supabase/migrations/20260925070649_knowledge_automation_source_health_dashboard_v1.sql"),
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("components/knowledge-refresh/knowledge-source-health-panel.tsx"),
    readPwa("components/knowledge-refresh/knowledge-refresh-display.ts"),
    readPwa("lib/knowledge-auto-update.ts"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(migration, /admin_list_knowledge_automation_sources/);
  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /consecutive_failures/);
  assert.match(migration, /last_http_status/);
  assert.match(migration, /revoke all on function public\.admin_list_knowledge_automation_sources\(integer\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_list_knowledge_automation_sources\(integer\) to authenticated/);

  assert.match(client, /export type KnowledgeAutomationSource/);
  assert.match(client, /admin_list_knowledge_automation_sources/);
  assert.match(client, /公式ソース監視一覧を取得できませんでした/);

  assert.match(sourceHealth, /監視ソース健全性/);
  assert.match(sourceHealth, /副業Knowledgeカバレッジ/);
  assert.match(sourceHealth, /SIDE_HUSTLE_COVERAGE_TASKS/);
  assert.match(panel, /KnowledgeSourceHealthPanel/);
  assert.match(display, /sidejob_affiliate/);
  assert.match(display, /sidejob_resale/);
  assert.match(sourceHealth, /監視URL一覧/);
  assert.match(sourceHealth, /連続失敗/);
  assert.match(css, /\.knowledge-source-health/);
  assert.match(css, /\.knowledge-source-coverage-grid/);
  assert.match(css, /\.knowledge-source-list/);
});


test("admin Knowledge quality analyzer reuses existing RPCs without auto-publish", async () => {
  const [panel, quality, client, css] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("components/knowledge-refresh/knowledge-quality-analyzer.tsx"),
    readPwa("lib/knowledge-auto-update.ts"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(client, /adminGetKnowledgeProductionHealth/);
  assert.match(client, /client\.rpc\("admin_get_knowledge_production_health"\)/);
  assert.match(client, /adminGetKnowledgeSourceRiskReport/);
  assert.match(client, /client\.rpc\("admin_get_knowledge_source_risk_report"\)/);
  assert.match(client, /singleSourceCount/);
  assert.match(client, /multiDomainCount/);
  assert.match(client, /adminPrepareSourceDiversityResearch/);
  assert.match(client, /client\.rpc\("admin_prepare_source_diversity_research"/);

  const prepareStart = client.indexOf("export async function adminPrepareSourceDiversityResearch");
  const prepareEnd = client.indexOf("export async function adminListKnowledgeAutomationCandidates", prepareStart);
  assert.notEqual(prepareStart, -1);
  assert.notEqual(prepareEnd, -1);
  const prepareSource = client.slice(prepareStart, prepareEnd);
  assert.doesNotMatch(prepareSource, /admin_publish_knowledge_refresh_bundle/);

  assert.match(quality, /Knowledge品質・カバレッジ分析/);
  assert.match(quality, /追加根拠リサーチを準備/);
  assert.match(quality, /公開されません/);
  assert.match(panel, /KnowledgeQualityAnalyzer/);
  assert.match(quality, /最多ドメインへの集中率/);
  assert.match(quality, /追加根拠を確認する項目/);
  assert.match(panel, /正式Knowledgeは変わりません/);
  assert.match(css, /\.knowledge-quality-analyzer/);
  assert.match(css, /\.knowledge-quality-metrics/);
  assert.match(css, /\.knowledge-quality-review/);
});


test("knowledge refresh UI keeps pure display and diff rendering in feature modules", async () => {
  const [panel, display, diff] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("components/knowledge-refresh/knowledge-refresh-display.ts"),
    readPwa("components/knowledge-refresh/knowledge-diff-summary.tsx"),
  ]);

  assert.match(panel, /KnowledgeDiffSummary/);
  assert.match(panel, /formatKnowledgeDate/);
  assert.doesNotMatch(panel, /^function formatDate/m);
  assert.doesNotMatch(panel, /^function DiffGroup/m);
  assert.match(display, /knowledgeRefreshStatusLabel/);
  assert.match(display, /knowledgeAutomationActionLabel/);
  assert.match(display, /SIDE_HUSTLE_COVERAGE_TASKS/);
  assert.match(diff, /export function KnowledgeDiffSummary/);
  assert.match(diff, /FIELD_LABELS/);
});


test("knowledge source health and quality analysis are isolated from refresh orchestration", async () => {
  const [panel, sourceHealth, quality] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("components/knowledge-refresh/knowledge-source-health-panel.tsx"),
    readPwa("components/knowledge-refresh/knowledge-quality-analyzer.tsx"),
  ]);

  assert.match(panel, /KnowledgeSourceHealthPanel/);
  assert.match(panel, /KnowledgeQualityAnalyzer/);
  assert.doesNotMatch(panel, /const enabledAutomationSources = useMemo/);
  assert.doesNotMatch(panel, /const automationCoverage = useMemo/);
  assert.match(sourceHealth, /useMemo/);
  assert.match(sourceHealth, /SIDE_HUSTLE_COVERAGE_TASKS/);
  assert.match(quality, /onPrepareSourceDiversity/);
  assert.doesNotMatch(sourceHealth, /getSupabaseClient|adminPrepareSourceDiversityResearch/);
  assert.doesNotMatch(quality, /getSupabaseClient|adminPrepareSourceDiversityResearch/);
});
