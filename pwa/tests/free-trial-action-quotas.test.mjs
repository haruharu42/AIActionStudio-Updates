import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readArticleStepSource = async () => (await Promise.all([
  "components/article-create/article-create-steps.tsx",
  "components/article-create/article-create-generation-steps.tsx",
  "components/article-create/article-create-finish-steps.tsx",
  "components/article-create/article-create-step-shared.tsx",
].map((relative) => read(relative)))).join("\n");

test("free-trial keeps the legacy title quota schema while current AAS actions consume only active features", async () => {
  const freeTrial = await read("lib/free-trial.ts");
  const createRoute = await read("app/create/page.tsx");
  const imageRoute = await read("app/images/page.tsx");
  const snsRoute = await read("app/sns/page.tsx");
  const creator = await read("components/phase11-create-page.tsx");
  const images = await read("components/phase13-image-page.tsx");
  const sns = await read("components/phase14-sns-page.tsx");
  const articleTools = await read("components/article-ai-tools.tsx");

  for (const feature of [
    "article_generate",
    "title_generate",
    "article_rewrite",
    "sns_generate",
    "image_generate",
    "ai_assist",
  ]) {
    assert.match(freeTrial, new RegExp(`"${feature}"`));
  }

  assert.doesNotMatch(createRoute, /FreeTrialFeatureGate/);
  assert.doesNotMatch(imageRoute, /FreeTrialFeatureGate/);
  assert.doesNotMatch(snsRoute, /FreeTrialFeatureGate/);
  assert.doesNotMatch(creator, /consumeFreeTrialUsage\(getSupabaseClient\(\), "title_generate"\)/);
  assert.match(creator, /consumeFreeTrialUsage\(getSupabaseClient\(\), "article_generate"\)/);
  assert.match(images, /consumeFreeTrialUsage\(getSupabaseClient\(\), "image_generate"\)/);
  assert.match(sns, /consumeFreeTrialUsage\(getSupabaseClient\(\), "sns_generate"\)/);
  assert.match(articleTools, /kind === "rewrite" \? "article_rewrite" : "ai_assist"/);
});

test("title creation stays external while article quota is consumed only by explicit article prompt generation", async () => {
  const creator = await read("components/phase11-create-page.tsx");
  const stepUi = await readArticleStepSource();

  assert.match(stepUi, /タイトルを5候補から選んでください/);
  assert.match(stepUi, /AIが生成した5候補をまとめて貼り付け/);
  assert.match(stepUi, /AIで生成したタイトルをここへ貼り付け/);
  assert.match(stepUi, /AI用タイトルプロンプト/);
  assert.match(stepUi, /完成記事プロンプトを作成/);
  assert.doesNotMatch(creator, /titlePromptAuthorized|titleQuotaInFlightRef|title_generate/);
  assert.match(creator, /articlePromptAuthorized === articlePrompt/);
  assert.match(creator, /articleQuotaInFlightRef\.current/);
  assert.equal((creator.match(/consumeFreeTrialUsage\(/g) || []).length, 1);
  assert.doesNotMatch(stepUi, /consumeFreeTrialUsage\(/);
  assert.match(stepUi, /<CopyButton value=\{titlePrompt\} label="タイトルプロンプトをコピー" setMessage=\{setMessage\} \/>/);
  assert.match(stepUi, /<CopyButton value=\{articlePrompt\} label="完成記事プロンプトをコピー" setMessage=\{setMessage\} \/>/);
  assert.match(stepUi, /コピーしました ✓/);
  assert.match(stepUi, /生成後のコピーやAIアプリ起動では追加消費しません/);
});

test("image quota is consumed only when image prompts are explicitly created", async () => {
  const images = await read("components/phase13-image-page.tsx");

  assert.match(images, /画像生成プロンプトを作成/);
  assert.match(images, /generateInFlightRef\.current/);
  assert.match(images, /consumeFreeTrialUsage\(getSupabaseClient\(\), "image_generate"\)/);
  assert.equal((images.match(/consumeFreeTrialUsage\(/g) || []).length, 1);
  assert.match(images, /setGeneratedPrompts\(buildImagePromptPlan/);
  assert.match(images, /generatedFingerprint === promptFingerprint/);
  assert.match(images, /生成後のコピーやChatGPT Images起動では追加消費しません/);
});

test("SNS quota is consumed only when the SNS prompt is explicitly created", async () => {
  const sns = await read("components/phase14-sns-page.tsx");

  assert.match(sns, /SNS投稿プロンプトを作成/);
  assert.match(sns, /generateInFlightRef\.current/);
  assert.match(sns, /consumeFreeTrialUsage\(getSupabaseClient\(\), "sns_generate"\)/);
  assert.equal((sns.match(/consumeFreeTrialUsage\(/g) || []).length, 1);
  assert.match(sns, /setGeneratedPrompt\(prompt\)/);
  assert.match(sns, /generatedFingerprint === promptFingerprint/);
  assert.match(sns, /生成後のコピーでは追加消費しません/);
});

test("rewrite and AI assist prompts consume once before reveal and guard fast double clicks", async () => {
  const tools = await read("components/article-ai-tools.tsx");

  assert.match(tools, /if \(inFlightRef\.current \|\| !input\.body\.trim\(\)\) return/);
  assert.match(tools, /const result = await consumeFreeTrialUsage\(client, feature\)/);
  assert.match(tools, /if \(!result\.allowed\)/);
  assert.match(tools, /setPrompt\(kind === "rewrite" \? buildArticleRewritePrompt\(input\) : buildArticleAssistPrompt\(input\)\)/);
  assert.equal((tools.match(/consumeFreeTrialUsage\(/g) || []).length, 1);
  assert.match(tools, /コピーやAIアプリを開く操作では追加消費しません/);
});

test("article AI tools keep editorial safety rules and do not invent factual additions", async () => {
  const prompts = await read("lib/article-ai-tools.ts");

  assert.match(prompts, /実体験・実績・レビュー・購入経験・使用経験を事実として作らない/);
  assert.match(prompts, /確認できない変動情報を断定しない/);
  assert.match(prompts, /競合記事や既存作品の文章をコピー・近似模倣しない/);
  assert.match(prompts, /元記事にない固有名詞・数値・引用を事実として追加しない/);
  assert.match(prompts, /buildArticleRewritePrompt/);
  assert.match(prompts, /buildArticleAssistPrompt/);
});

test("article library exposes quota-aware AI tools only for the currently owned loaded article", async () => {
  const library = await read("components/phase7-library.tsx");

  assert.match(library, /ArticleAiTools/);
  assert.match(library, /key={`\$\{detail\.id\}:\$\{detail\.revision\}`}/);
  assert.match(library, /client={client}/);
  assert.match(library, /body: detail\.body/);
  assert.match(library, /getCloudArticleDetail\(client, ownerId, articleId\)/);
});
