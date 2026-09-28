import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readArticleStepSource = async () => (await Promise.all([
  "components/article-create/article-create-steps.tsx",
  "components/article-create/article-create-generation-steps.tsx",
  "components/article-create/article-create-finish-steps.tsx",
  "components/article-create/article-create-step-shared.tsx",
].map((relative) => read(relative)))).join("\n");

const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

after(async () => {
  await vite.close();
});

const { loadCoreAccessState, PWA_PRODUCT_CODE } = await vite.ssrLoadModule(
  "/lib/access-control.ts",
);
const {
  DEFAULT_ARTICLE_DRAFT,
  createInitialArticleDraft,
  parseStoredArticleDraft,
  validateArticleCreateStep,
} = await vite.ssrLoadModule("/lib/article-create-draft.ts");

const user = { id: "00000000-0000-4000-8000-000000000002", email: "fixture@example.test" };

function accessClient({ canAccess = true, rpcError = null } = {}) {
  const profile = {
    id: user.id,
    aas_user_id: "AAS-000002",
    display_name: "Fixture",
    role: "user",
    status: "active",
  };

  return {
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async single() { return { data: profile, error: null }; },
      };
    },
    async rpc(name, parameters) {
      assert.equal(name, "can_access_product");
      assert.deepEqual(parameters, { p_product_code: PWA_PRODUCT_CODE });
      return { data: canAccess, error: rpcError };
    },
  };
}

test("central access boundary distinguishes entitlement denial from RPC failure", async () => {
  const denied = await loadCoreAccessState(accessClient({ canAccess: false }));
  assert.equal(denied.kind, "entitlement_denied");

  await assert.rejects(
    () => loadCoreAccessState(accessClient({ rpcError: { message: "network failure" } })),
    /PWA利用権の確認に失敗しました/,
  );
});

test("article draft parser rejects malformed restored browser data", () => {
  assert.equal(parseStoredArticleDraft(null), null);
  assert.equal(parseStoredArticleDraft({ ...DEFAULT_ARTICLE_DRAFT, inlineCount: 99 }), null);
  assert.equal(parseStoredArticleDraft({ ...DEFAULT_ARTICLE_DRAFT, price: -1 }), null);
  assert.equal(parseStoredArticleDraft({ ...DEFAULT_ARTICLE_DRAFT, tags: ["ok", 42] }), null);

  const parsed = parseStoredArticleDraft({ ...DEFAULT_ARTICLE_DRAFT, tags: ["AI", "初心者"] });
  assert.ok(parsed);
  assert.deepEqual(parsed.tags, ["AI", "初心者"]);
});

test("article draft URL parsing and step validation stay pure and bounded", () => {
  const params = new URLSearchParams({
    publicationTarget: "brain",
    articleType: "paid",
    genre: "AI副業",
    subgenre: "AIおまかせ",
    inlineCount: "3",
  });
  const draft = createInitialArticleDraft(params);
  assert.equal(draft.publicationTarget, "brain");
  assert.equal(draft.articleType, "paid");
  assert.equal(draft.price, 980);
  assert.equal(draft.inlineEnabled, true);
  assert.equal(draft.inlineCount, 3);
  assert.equal(validateArticleCreateStep(3, draft), null);
  assert.match(
    validateArticleCreateStep(3, { ...draft, genre: "その他" }) ?? "",
    /ジャンル名/,
  );
});

test("article creator keeps UI, access and pure draft responsibilities separated", async () => {
  const page = await read("components/phase11-create-page.tsx");
  const stepUi = await readArticleStepSource();
  const draftHelpers = await read("lib/article-create-draft.ts");
  const progress = await read("lib/phase11-wizard-progress.ts");

  assert.match(page, /useSharedAccessState/);
  assert.doesNotMatch(page, /loadCoreAccessState/);
  assert.match(page, /AiSelectionStep/);
  assert.match(page, /loadWritingProfile/);
  assert.match(page, /saveWritingProfile/);
  assert.doesNotMatch(page, /\.from\("profiles"\)|can_access_product/);
  assert.doesNotMatch(page, /aasId/);
  assert.match(page, /AiSelectionStep/);
  assert.match(page, /GenerationMethodStep/);
  assert.match(page, /SaveStep/);
  assert.match(stepUi, /export function AiSelectionStep/);
  assert.match(stepUi, /export function GenerationMethodStep/);
  assert.match(stepUi, /export function SaveStep/);
  assert.match(draftHelpers, /export function parseStoredArticleDraft/);
  assert.match(progress, /parseStoredArticleDraft/);
});

test("signed and local runtime images stay behind the direct image boundary", async () => {
  const wrapper = await read("components/direct-runtime-image.tsx");
  const consumers = await Promise.all([
    read("app/profile/page.tsx"),
    read("app/ranking/page.tsx"),
    read("components/article-library/note-post-assistant.tsx"),
    read("components/creator-hud.tsx"),
    read("components/phase18-beginner-home.tsx"),
  ]);

  assert.match(wrapper, /Blob\/Object URLs and expiring signed URLs/);
  assert.match(wrapper, /eslint-disable-next-line @next\/next\/no-img-element/);
  assert.match(wrapper, /alt: string/);
  assert.match(wrapper, /return <img alt=\{alt\} \{\.\.\.props\} \/>/);

  for (const source of consumers) {
    assert.match(source, /DirectRuntimeImage/);
    assert.doesNotMatch(source, /<img\b/);
  }
});
