import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("shared knowledge compiler combines audience genre publication and task rules without demographic stereotyping", async () => {
  const engine = await read("lib/knowledge-engine.ts");

  assert.match(engine, /export function compileKnowledgeContext/);
  assert.match(engine, /【AAS KNOWLEDGE COMPILER】/);
  assert.match(engine, /安全・事実性 → 今回の明示条件 → 媒体・タスク → 読者 → 個人最適化/);
  assert.match(engine, /年齢・性別・職業だけから家族構成、収入、能力、IT習熟度などを決めつけない/);
  assert.match(engine, /自由入力ジャンル/);
  assert.match(engine, /自由入力サブジャンル/);
  for (const genre of ["AI副業", "美容", "ガジェット", "健康・フィットネス", "子育て・教育", "旅行", "料理・グルメ", "ペット"]) {
    assert.match(engine, new RegExp(genre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("knowledge context is shared by article title image social promotion sidejob and SNS launch prompts", async () => {
  const creator = await read("lib/phase11-create.ts");
  const profileWrapper = await read("lib/phase12-prompt-profiles.ts");
  const images = await read("lib/phase13-image-prompts.ts");
  const social = await read("lib/phase14-sns.ts");
  const promotion = await read("lib/admin-promotion.ts");
  const sidejob = await read("lib/phase15-sidejob.ts");
  const snsPlan = await read("lib/phase15-sns-plan.ts");

  assert.match(creator, /getPromptSpecialization/);
  assert.match(profileWrapper, /compileKnowledgeContext/);
  for (const source of [images, social, promotion, sidejob, snsPlan]) {
    assert.match(source, /compileKnowledgeContext/);
  }
  assert.match(sidejob, /genre: "AI副業"/);
  assert.match(sidejob, /task: "article"/);
  assert.match(sidejob, /AASの候補順位は適性の参考/);
  assert.match(snsPlan, /genre: "SNS運用"/);
  assert.match(snsPlan, /task: "social"/);
  assert.match(snsPlan, /テーマから読者の属性を勝手に決めず/);
});

test("custom genre and subgenre inputs record only compact knowledge candidate signals", async () => {
  const creatorPage = await read("components/phase11-create-page.tsx");
  const stepUi = await read("components/article-create/article-create-steps.tsx");
  const creator = await read("lib/phase11-create.ts");
  const catalog = await read("lib/knowledge-catalog.ts");
  const migration = await readRepo("supabase/migrations/20260913145500_knowledge_engine.sql");

  assert.match(creatorPage, /setCustomGenre/);
  assert.match(stepUi, /genreSelectionValue/);
  assert.match(stepUi, /subgenreSelectionValue/);
  assert.match(stepUi, /taxonomy-custom-input/);
  assert.match(creator, /recordKnowledgeCandidate/);
  assert.match(creator, /isCustomGenre/);
  assert.match(creator, /isCustomSubgenre/);
  assert.match(catalog, /slice\(0, 120\)/);
  assert.match(catalog, /record_knowledge_candidate/);
  assert.match(migration, /knowledge_candidate_signals/);
  assert.match(migration, /value_original/);
  assert.match(migration, /use_count/);
  assert.doesNotMatch(migration, /knowledge_candidate_signals[\s\S]{0,600}(article_body|prompt_text|ai_answer)/i);
});

test("knowledge database keeps catalog RLS and candidate raw rows inaccessible to clients", async () => {
  const migration = await readRepo("supabase/migrations/20260913145500_knowledge_engine.sql");

  for (const table of ["knowledge_catalog", "knowledge_candidate_signals", "knowledge_candidate_decisions"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
  }
  assert.match(migration, /revoke all on table public\.knowledge_candidate_signals from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.knowledge_candidate_decisions from public, anon, authenticated/);
  assert.match(migration, /active admin required/);
  assert.match(migration, /sum\(s\.use_count\)::bigint as total_uses/);
  assert.match(migration, /count\(distinct s\.user_id\)::bigint as distinct_users/);
  assert.doesNotMatch(migration, /returns table \([\s\S]{0,300}user_id uuid/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);
});

test("runtime catalog loads only active membership-aware rules and admin review is isolated behind the admin route", async () => {
  const catalog = await read("lib/knowledge-catalog.ts");
  const membershipMigration = await readRepo("supabase/migrations/20260917202000_creator_membership_plans_missions_quota.sql");
  const bootstrap = await read("components/knowledge-runtime-bootstrap.tsx");
  const admin = await read("components/admin-knowledge-page.tsx");
  const route = await read("app/admin/knowledge/page.tsx");
  const tools = await read("components/phase-tools-page.tsx");
  const sections = await read("lib/admin-sections.ts");

  assert.match(catalog, /client\.rpc\("list_my_active_knowledge_catalog"\)/);
  assert.match(membershipMigration, /catalog\.status = 'active'/);
  assert.match(membershipMigration, /limit 500/i);
  assert.match(membershipMigration, /public\.has_active_creator_membership\(\)/);
  assert.match(bootstrap, /loadActiveKnowledgeCatalog/);
  assert.match(bootstrap, /setRuntimeKnowledgeCatalog/);
  assert.match(admin, /role === "admin"/);
  assert.match(admin, /status === "active"/);
  assert.match(admin, /adminListKnowledgeCandidates/);
  assert.match(admin, /adminReviewKnowledgeCandidate/);
  assert.match(route, /AdminKnowledgePage/);
  assert.match(sections, /href: "\/admin\/knowledge"/);
  assert.doesNotMatch(tools, /href: "\/admin\/knowledge"/);
});


test("promotion knowledge combines a shared attention layer with six channel-specific rules", async () => {
  const [engine, promotionKnowledge, channelPrompts] = await Promise.all([
    read("lib/knowledge-engine.ts"),
    read("lib/promotion-knowledge.ts"),
    read("lib/admin-promotion-channel.ts"),
  ]);

  assert.match(engine, /PROMOTION_COMMON_KNOWLEDGE/);
  assert.match(engine, /PROMOTION_PUBLICATION_KNOWLEDGE/);
  assert.match(engine, /input\.task === "promotion"/);
  assert.match(engine, /promotionPublication/);

  assert.match(promotionKnowledge, /販促共通：読まれる・信頼される・行動しやすい構成/);
  assert.match(promotionKnowledge, /タイトル・冒頭・本文・CTAの約束を一致させ/);
  assert.match(promotionKnowledge, /インプレッション、クリック、保存、購入、フォロー増加を保証しない/);
  assert.match(promotionKnowledge, /key: "promotion:publication:note"/);
  assert.match(promotionKnowledge, /key: "promotion:publication:brain"/);
  assert.match(promotionKnowledge, /key: "promotion:publication:tips"/);
  assert.match(promotionKnowledge, /key: "promotion:publication:x"/);
  assert.match(promotionKnowledge, /key: "promotion:publication:threads"/);
  assert.match(promotionKnowledge, /key: "promotion:publication:instagram"/);

  assert.match(channelPrompts, /task: "promotion"/);
  assert.match(channelPrompts, /publicationTarget: input\.channel/);
  assert.match(promotionKnowledge, /https:\/\/note\.com\/help\/pg\/howto/);
  assert.match(promotionKnowledge, /business\.x\.com/);
  assert.match(promotionKnowledge, /find-your-community-with-new-threads-educational-insights/);
  assert.match(promotionKnowledge, /best-practices-education-hub-creators-instagram/);
});


test("promotion knowledge selects exactly one platform-specific publication rule", async () => {
  const engine = await read("lib/knowledge-engine.ts");
  const promotion = await read("lib/promotion-knowledge.ts");

  for (const [key, label] of [
    ["note", "note"],
    ["brain", "Brain"],
    ["tips", "Tips"],
    ["x", "X"],
    ["threads", "Threads"],
    ["instagram", "Instagram"],
  ]) {
    assert.match(promotion, new RegExp(`key: "promotion:publication:${key}"[\\s\\S]*?label: "${label}"`));
  }

  assert.match(engine, /if \(input\.task === "promotion"\)/);
  assert.match(engine, /PROMOTION_PUBLICATION_KNOWLEDGE\.find/);
  assert.match(engine, /matches\(rule, input\.publicationTarget \?\? ""\)/);
  assert.doesNotMatch(engine, /rules\.push\(\.\.\.PROMOTION_PUBLICATION_KNOWLEDGE\)/);
});
