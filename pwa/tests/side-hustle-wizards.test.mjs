import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const read = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("all side-hustle functions use dedicated definitions with dropdown plus custom input", async () => {
  const [content, sales, client, productivity, helper, catalog] = await Promise.all([
    read("features/side-hustles/definitions-content-media.ts"),
    read("features/side-hustles/definitions-sales.ts"),
    read("features/side-hustles/definitions-client-work.ts"),
    read("features/side-hustles/definitions-productivity.ts"),
    read("features/side-hustles/definition-helpers.ts"),
    read("features/side-hustles/catalog.ts"),
  ]);
  const definitions = [content, sales, client, productivity].join("\n");

  assert.equal((definitions.match(/\bslug:\s*"/g) ?? []).length, 12);
  assert.equal((definitions.match(/\bsideField\(/g) ?? []).length, 72);
  assert.match(helper, /SIDE_HUSTLE_CUSTOM_VALUE/);
  assert.match(helper, /その他・自由入力/);
  assert.match(helper, /options: \[\.\.\.options, sideOption\(SIDE_HUSTLE_CUSTOM_VALUE/);

  for (const task of [
    "sidejob_content",
    "sidejob_sns",
    "sidejob_video",
    "sidejob_affiliate",
    "sidejob_resale",
    "sidejob_crowdsourcing",
    "sidejob_skill_sales",
    "sidejob_digital_product",
    "sidejob_outreach",
    "sidejob_research",
    "sidejob_efficiency",
    "sidejob_planning",
  ]) {
    assert.match(definitions, new RegExp('knowledgeTask: "' + task + '"'));
  }

  for (const title of [
    "記事・ブログ・コンテンツ販売",
    "SNS運用・集客",
    "YouTube・ショート動画",
    "アフィリエイト",
    "物販・フリマ販売",
    "クラウドソーシング",
    "スキル販売",
    "デジタル商品・教材販売",
    "営業・案件獲得",
    "リサーチ・事実確認",
    "業務効率化・SOP化",
    "自分に合うAI副業を探す",
  ]) {
    assert.match(definitions, new RegExp(title));
  }

  assert.match(catalog, /CONTENT_MEDIA_SIDE_HUSTLES/);
  assert.match(catalog, /SALES_SIDE_HUSTLES/);
  assert.match(catalog, /CLIENT_WORK_SIDE_HUSTLES/);
  assert.match(catalog, /PRODUCTIVITY_SIDE_HUSTLES/);
  assert.doesNotMatch(definitions, /commonFields\(/);
});

test("dedicated prompts have task-specific deliverables instead of a generic shared prompt", async () => {
  const definitions = (
    await Promise.all([
      read("features/side-hustles/definitions-content-media.ts"),
      read("features/side-hustles/definitions-sales.ts"),
      read("features/side-hustles/definitions-client-work.ts"),
      read("features/side-hustles/definitions-productivity.ts"),
    ])
  ).join("\n");

  for (const uniqueDeliverable of [
    "無料・有料",
    "4週間の投稿配分",
    "サムネイル文言8個",
    "公式一次情報",
    "写真で撮るべき箇所",
    "納品前チェックリスト",
    "各章で購入者が作る成果物",
    "案件文から抜き出す要件チェック表",
    "フォローアップ文",
    "検証可能な小問",
    "AIへ渡してよい情報 / 渡さない情報",
    "30日で確認できる検証指標",
  ]) {
    assert.match(definitions, new RegExp(uniqueDeliverable.replace("/", "\\/")));
  }

  assert.match(definitions, /未確認/);
  assert.match(definitions, /作らない/);
});

test("side-hustle wizard injects cloud knowledge and prompt optimization and persists progress", async () => {
  const [builder, progress, wizard, promptStep, resultStep, field, rail, route, layout, runtime] = await Promise.all([
    read("features/side-hustles/prompt-builder.ts"),
    read("features/side-hustles/progress.ts"),
    read("components/side-hustle-wizard-page.tsx"),
    read("components/side-hustles/side-hustle-prompt-step.tsx"),
    read("components/side-hustles/side-hustle-result-step.tsx"),
    read("components/side-hustles/side-hustle-select-field.tsx"),
    read("components/side-hustles/side-hustle-step-rail.tsx"),
    read("app/side-hustles/[slug]/page.tsx"),
    read("app/layout.tsx"),
    read("lib/prompt-optimization.ts"),
  ]);

  assert.match(builder, /compileKnowledgeContext/);
  assert.match(builder, /compilePromptOptimizationContext/);
  assert.match(builder, /definition\.knowledgeTask/);
  assert.match(builder, /selectedPlan/);
  assert.match(builder, /selectedPlan: "free"/);
  assert.match(progress, /aas-side-hustle-wizard/);
  assert.match(progress, /localStorage/);
  assert.match(progress, /hasStoredSideHustleDraft/);
  assert.match(progress, /resultText/);
  assert.match(progress, /Math\.min\(4, row\.step\)/);
  assert.match(wizard, /readSideHustleDraft/);
  assert.match(wizard, /hasStoredSideHustleDraft/);
  assert.match(wizard, /loadWritingProfile/);
  assert.match(wizard, /profile\.preferredPlan/);
  assert.match(wizard, /writeSideHustleDraft/);
  assert.match(wizard, /pagehide/);
  assert.match(wizard, /beforeunload/);
  assert.match(wizard, /visibilitychange/);
  assert.match(wizard, /KNOWLEDGE_RUNTIME_EVENT/);
  assert.match(wizard, /Fresh/);
  assert.match(wizard, /Stable/);
  assert.match(wizard, /SideHustlePromptStep/);
  assert.match(wizard, /SideHustleResultStep/);
  assert.match(wizard, /resultText/);
  assert.match(promptStep, /専用プロンプト完成/);
  assert.match(promptStep, /選択内容/);
  assert.match(promptStep, /resolveSideHustleFieldValue/);
  assert.match(promptStep, /appliedKnowledge/);
  assert.match(promptStep, /コピーして/);
  assert.match(resultStep, /AIの完成結果をAASへ戻す/);
  assert.match(resultStep, /クリップボードから貼り付け/);
  assert.match(resultStep, /完成結果をコピー/);
  assert.match(resultStep, /結果だけクリア/);
  assert.match(wizard, /const nextDraft = \{ \.\.\.draft, step: 4 \}/);
  assert.match(wizard, /writeSideHustleDraft\(userId, definition, nextDraft\)/);
  assert.match(field, /<select/);
  assert.match(field, /SIDE_HUSTLE_CUSTOM_VALUE/);
  assert.match(field, /custom &&/);
  assert.match(rail, /基本設定/);
  assert.match(rail, /詳細設定/);
  assert.match(rail, /AI設定/);
  assert.match(rail, /AI出力/);
  assert.match(route, /generateStaticParams/);
  assert.match(route, /Phase15MemberGate/);
  assert.match(route, /params: Promise/);
  assert.match(layout, /phase51-side-hustle-wizard\.css/);
  assert.match(runtime, /aas:knowledge-runtime-updated/);
});

test("feature list routes side-hustle cards to dedicated functions, not category-filtered generic prompts", async () => {
  const tools = await read("features/tools/tool-catalog.ts");
  for (const slug of [
    "content-sales",
    "sns-management",
    "youtube-video",
    "affiliate",
    "resale",
    "crowdsourcing",
    "skill-sales",
    "digital-product",
    "outreach",
    "research",
    "workflow-efficiency",
    "sidejob-planner",
  ]) {
    assert.match(tools, new RegExp("/side-hustles/" + slug));
  }
  assert.doesNotMatch(tools, /\/prompts\?category=/);
});

test("database and refresh pipeline accept every dedicated side-hustle knowledge task", async () => {
  const [migration, autoUpdate, engine, optimizer] = await Promise.all([
    readRepo("supabase/migrations/20260923231331_side_hustle_knowledge_tasks_v1.sql"),
    read("lib/knowledge-auto-update.ts"),
    read("lib/knowledge-engine.ts"),
    read("lib/prompt-optimization.ts"),
  ]);

  for (const task of [
    "sidejob_content",
    "sidejob_sns",
    "sidejob_video",
    "sidejob_affiliate",
    "sidejob_resale",
    "sidejob_crowdsourcing",
    "sidejob_skill_sales",
    "sidejob_digital_product",
    "sidejob_outreach",
    "sidejob_research",
    "sidejob_efficiency",
    "sidejob_planning",
  ]) {
    for (const source of [migration, autoUpdate, engine]) {
      assert.match(source, new RegExp(task));
    }
  }

  assert.match(migration, /knowledge_catalog_tasks_check/);
  assert.match(migration, /prompt_optimization_catalog_task_check/);
  assert.match(migration, /admin_publish_knowledge_refresh_bundle/);
  assert.match(migration, /admin_review_knowledge_candidate/);
  assert.match(autoUpdate, /副業タスク割り当て/);
  assert.match(autoUpdate, /1つの変更を無関係な全タスクへ広げない/);
  assert.match(optimizer, /isKnowledgeTask/);
  assert.doesNotMatch([migration, autoUpdate].join("\n"), /service[_-]?role|sb_secret_/i);
});


test("every side-hustle has 5-10+ situation-specific knowledge rules and prompt injection", async () => {
  const [scenario, builder, autoUpdate] = await Promise.all([
    read("features/side-hustles/scenario-knowledge.ts"),
    read("features/side-hustles/prompt-builder.ts"),
    read("lib/knowledge-auto-update.ts"),
  ]);

  const slugs = [
    "content-sales",
    "sns-management",
    "youtube-video",
    "affiliate",
    "resale",
    "skill-sales",
    "digital-product",
    "crowdsourcing",
    "outreach",
    "sidejob-planner",
    "research",
    "workflow-efficiency",
  ];

  assert.equal((scenario.match(/\bR\("/g) ?? []).length, 72);
  for (const slug of slugs) {
    const start = scenario.indexOf('"' + slug + '": [');
    assert.notEqual(start, -1, "missing scenario knowledge for " + slug);
    const rest = scenario.slice(start);
    const end = rest.indexOf("\n  ],");
    const block = end >= 0 ? rest.slice(0, end) : rest;
    const count = (block.match(/\bR\("/g) ?? []).length;
    assert.ok(count >= 5, slug + " must have at least 5 scenario knowledge rules");
    assert.ok(count <= 10, slug + " should stay reviewable at 10 or fewer top-level scenario rules");
  }

  for (const category of ["medium", "experience", "objective", "production", "sales", "risk"]) {
    assert.match(scenario, new RegExp('"' + category + '"'));
  }

  assert.match(builder, /compileSideHustleScenarioKnowledge/);
  assert.match(builder, /scenarioKnowledge\.promptBlock/);
  assert.match(builder, /\.\.\.scenarioKnowledge\.applied/);
  assert.match(scenario, /状況別副業KNOWLEDGE/);
  assert.ok(scenario.includes("applied: active.map((rule) => `状況別: ${rule.label}`)"));
  assert.match(autoUpdate, /媒体・用途・初心者\/経験者・販売\/集客\/制作・リスク/);
  assert.match(autoUpdate, /状況別候補/);
});


test("combination knowledge adds 5 high-value patterns per side-hustle without cartesian explosion", async () => {
  const [combination, builder, autoUpdate] = await Promise.all([
    read("features/side-hustles/combination-knowledge.ts"),
    read("features/side-hustles/prompt-builder.ts"),
    read("lib/knowledge-auto-update.ts"),
  ]);

  const slugs = [
    "content-sales",
    "sns-management",
    "youtube-video",
    "affiliate",
    "resale",
    "skill-sales",
    "digital-product",
    "crowdsourcing",
    "outreach",
    "sidejob-planner",
    "research",
    "workflow-efficiency",
  ];

  assert.equal((combination.match(/\bC\("/g) ?? []).length, 60);
  for (const slug of slugs) {
    const start = combination.indexOf('"' + slug + '": [');
    assert.notEqual(start, -1, "missing combination knowledge for " + slug);
    const rest = combination.slice(start);
    const end = rest.indexOf("\n  ],");
    const block = end >= 0 ? rest.slice(0, end) : rest;
    assert.equal((block.match(/\bC\("/g) ?? []).length, 5, slug + " should have exactly 5 curated combination rules in this phase");
  }

  assert.match(combination, /note × 初心者 × 有料記事/);
  assert.match(combination, /Instagram × 初期アカウント × 信頼形成/);
  assert.match(combination, /家電 × 中古\/不具合あり × 精密配送/);
  assert.match(combination, /事実確認 × 現在情報 × 公式\/公的情報/);
  assert.match(combination, /公開作業 × 既存自動化 × 公開リスク/);
  assert.match(combination, /Object\.entries\(rule\.when\)\.every/);
  assert.match(combination, /【複合条件KNOWLEDGE】/);
  assert.match(combination, /複合: \$\{rule\.label\}/);

  assert.match(builder, /compileSideHustleCombinationKnowledge/);
  assert.match(builder, /combinationKnowledge\.promptBlock/);
  assert.match(builder, /\.\.\.combinationKnowledge\.applied/);

  assert.match(autoUpdate, /2〜4条件の組み合わせ/);
  assert.match(autoUpdate, /網羅的な直積を作らず/);
  assert.match(autoUpdate, /note × 完全初心者 × 有料記事/);
});


test("side-hustle scenario and combination knowledge only reference live definition fields", async () => {
  const definitions = (
    await Promise.all([
      read("features/side-hustles/definitions-content-media.ts"),
      read("features/side-hustles/definitions-sales.ts"),
      read("features/side-hustles/definitions-client-work.ts"),
      read("features/side-hustles/definitions-productivity.ts"),
    ])
  ).join("\n");
  const scenario = await read("features/side-hustles/scenario-knowledge.ts");
  const combination = await read("features/side-hustles/combination-knowledge.ts");
  const slugs = [
    "content-sales", "sns-management", "youtube-video", "affiliate", "resale", "crowdsourcing",
    "skill-sales", "digital-product", "outreach", "research", "workflow-efficiency", "sidejob-planner",
  ];

  const blockFor = (source, marker, slug) => {
    const start = source.indexOf(marker(slug));
    assert.notEqual(start, -1, "missing block for " + slug);
    const later = slugs
      .map((candidate) => source.indexOf(marker(candidate), start + 1))
      .filter((index) => index > start);
    const end = later.length ? Math.min(...later) : source.length;
    return source.slice(start, end);
  };

  for (const slug of slugs) {
    const definitionBlock = blockFor(definitions, (value) => `slug: "${value}"`, slug);
    const fields = [...definitionBlock.matchAll(/sideField\("([^"]+)"/g)].map((match) => match[1]);
    assert.equal(fields.length, 6, slug + " should keep six guided fields");

    const scenarioBlock = blockFor(scenario, (value) => `"${value}": [`, slug);
    const scenarioFields = [...scenarioBlock.matchAll(/\bR\("([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual([...scenarioFields].sort(), [...fields].sort(), slug + " scenario knowledge must map one-to-one to live fields");

    const combinationBlock = blockFor(combination, (value) => `"${value}": [`, slug);
    const conditionKeys = new Set(
      [...combinationBlock.matchAll(/\bC\("[^"]+",\s*\{([^}]*)\}/g)]
        .flatMap((match) => [...match[1].matchAll(/([A-Za-z0-9_]+)\s*:/g)].map((keyMatch) => keyMatch[1])),
    );
    for (const key of conditionKeys) {
      assert.ok(fields.includes(key), slug + " combination knowledge references unknown field " + key);
    }
  }
});


test("side-hustle roadmaps are exposed from the feature list and home", async () => {
  const [toolCatalog, home, layout] = await Promise.all([
    read("features/tools/tool-catalog.ts"),
    read("components/action-studio-home-hub.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(toolCatalog, /href: "\/side-hustle-roadmaps"/);
  assert.match(toolCatalog, /title: "副業ロードマップ"/);
  assert.match(home, /href: "\/side-hustle-roadmaps"/);
  assert.match(layout, /phase56-side-hustle-roadmaps\.css/);
});


test("side-hustle wizard protects destructive reset and lets users jump back to completed steps", async () => {
  const [wizard, rail, styles] = await Promise.all([
    read("components/side-hustle-wizard-page.tsx"),
    read("components/side-hustles/side-hustle-step-rail.tsx"),
    read("app/phase51-side-hustle-wizard.css"),
  ]);

  assert.match(wizard, /window\.confirm\(warning\)/);
  assert.match(wizard, /AIの完成結果をすべてリセットします/);
  assert.match(wizard, /fresh\.selectedAi = draft\.selectedAi/);
  assert.match(wizard, /fresh\.selectedPlan = draft\.selectedPlan/);
  assert.match(wizard, /const jumpBackToStep = \(targetStep: number\)/);
  assert.match(wizard, /targetStep >= draft\.step/);
  assert.match(wizard, /<SideHustleStepRail step=\{draft\.step\} onStepChange=\{jumpBackToStep\}/);

  assert.match(rail, /onStepChange\?: \(step: number\) => void/);
  assert.match(rail, /const canReturn = index < step/);
  assert.match(rail, /disabled=\{!canReturn\}/);
  assert.match(rail, /このSTEPへ戻って修正/);
  assert.match(styles, /\.side-hustle-step-rail li > button/);
  assert.match(styles, /\.side-hustle-step-rail li\.done > button:not\(:disabled\):hover/);
});


test("resale knowledge automation monitors multiple official marketplaces instead of relying on Mercari alone", async () => {
  const migration = await readRepo("supabase/migrations/20260929234306_side_hustle_resale_source_diversity_v1.sql");

  assert.match(migration, /paypayfleamarket\.yahoo\.co\.jp\/guide\/beginner/);
  assert.match(migration, /paypayfleamarket\.yahoo\.co\.jp\/guide\/guideline/);
  assert.match(migration, /paypayfleamarket\.yahoo\.co\.jp\/notice\/rule/);
  assert.match(migration, /faq\.fril\.jp\/hc\/ja\/articles\/39032852808973/);
  assert.match(migration, /faq\.fril\.jp\/hc\/ja\/sections\/39849581863309/);
  assert.match(migration, /array\['sidejob_resale'\]::text\[\]/);
  assert.match(migration, /official_changelog/);
  assert.match(migration, /array_agg\(distinct item order by item\)/);
  assert.doesNotMatch(migration, /delete from public\.knowledge_automation_sources/);
});
