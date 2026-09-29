import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
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

const {
  ARTICLE_LIST_COLUMNS,
  ArticleLibraryError,
  buildCompatibleWorkspacePatch,
  deleteCloudArticle,
  getCloudArticleDetail,
  getMyArticleStockSummary,
  listCloudArticles,
  updateCloudArticle,
} = await vite.ssrLoadModule("/lib/phase7-articles.ts");

const OWNER = "00000000-0000-4000-8000-000000000002";
const OTHER = "00000000-0000-4000-8000-000000000099";
const ARTICLE = "10000000-0000-4000-8000-000000000001";
const ASSET = "20000000-0000-4000-8000-000000000001";

function articleRow(overrides = {}) {
  return {
    id: ARTICLE,
    user_id: OWNER,
    title: "Phase 7 fixture",
    publication_target: "note",
    article_type: "free",
    genre: "test",
    subgenre: null,
    body: "final body",
    status: "ready",
    price: null,
    tags: ["phase7"],
    scheduled_at: null,
    published_at: null,
    published_url: null,
    revision: 3,
    created_at: "2026-09-01T00:00:00+00:00",
    updated_at: "2026-09-02T00:00:00+00:00",
    ...overrides,
  };
}

function workspaceRow(overrides = {}) {
  return {
    article_id: ARTICLE,
    user_id: OWNER,
    request_json: { platform: "note" },
    workspace_json: { future: true },
    image_plan_json: { enabled: false },
    source_body: "source body",
    publish_body: "publish body",
    workspace_version: 2,
    created_at: "2026-09-01T00:00:00+00:00",
    updated_at: "2026-09-02T00:00:00+00:00",
    ...overrides,
  };
}

class Query {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.steps = [];
  }

  select(columns) {
    this.steps.push(["select", columns]);
    return this;
  }

  eq(column, value) {
    this.steps.push(["eq", column, value]);
    return this;
  }

  order(column, options) {
    this.steps.push(["order", column, options]);
    return this;
  }

  limit(value) {
    this.steps.push(["limit", value]);
    return this;
  }

  single() {
    this.steps.push(["single"]);
    return Promise.resolve(this.client.queryResult(this.table, this.steps));
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.queryResult(this.table, this.steps)).then(resolve, reject);
  }
}

function fakeClient({ articles, assets = [], revisionRow, rpc = {} } = {}) {
  const calls = [];
  const storageCalls = [];
  const articleRows = articles ?? [articleRow()];
  return {
    calls,
    storageCalls,
    auth: {
      async getUser() {
        calls.push(["auth.getUser"]);
        return { data: { user: { id: OWNER } }, error: null };
      },
    },
    from(table) {
      calls.push(["from", table]);
      return new Query(this, table);
    },
    queryResult(table, steps) {
      calls.push(["query", table, structuredClone(steps)]);
      if (table === "articles") {
        const selected = steps.find(([name]) => name === "select")?.[1];
        const isSingle = steps.some(([name]) => name === "single");
        if (selected === "id,user_id,revision") {
          return { data: revisionRow ?? { id: ARTICLE, user_id: OWNER, revision: 3 }, error: null };
        }
        return { data: isSingle ? articleRows[0] : articleRows, error: null };
      }
      if (table === "article_assets") return { data: assets, error: null };
      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name, parameters) {
      calls.push(["rpc", name, structuredClone(parameters)]);
      if (name === "can_access_product") return { data: true, error: null };
      if (name === "get_my_article_stock_summary") return {
        data: [{
          current_articles: 3,
          max_articles: 5,
          remaining_articles: 2,
          is_unlimited: false,
          publication_counts: {},
          status_counts: {},
        }],
        error: null,
      };
      const configured = rpc[name];
      if (typeof configured === "function") return configured(parameters, calls);
      if (configured) return configured;
      if (name === "get_article_workspace") return { data: workspaceRow(), error: null };
      if (name === "update_article_with_workspace") {
        return {
          data: {
            article: articleRow({ revision: 4, title: parameters.p_patch.title }),
            workspace: workspaceRow({
              workspace_version: 3,
              source_body: parameters.p_workspace_patch.source_body,
              publish_body: parameters.p_workspace_patch.publish_body,
            }),
          },
          error: null,
        };
      }
      if (name === "begin_delete_article_asset") {
        return { data: { ...assets[0], status: "delete_pending" }, error: null };
      }
      if (name === "finalize_delete_article_asset") return { data: ASSET, error: null };
      if (name === "delete_article") return { data: ARTICLE, error: null };
      throw new Error(`unexpected rpc ${name}`);
    },
    storage: {
      from(bucket) {
        storageCalls.push(["from", bucket]);
        return {
          async remove(paths) {
            storageCalls.push(["remove", structuredClone(paths)]);
            return { data: [], error: null };
          },
        };
      },
    },
  };
}

function readyAsset(overrides = {}) {
  return {
    id: ASSET,
    article_id: ARTICLE,
    user_id: OWNER,
    asset_type: "cover",
    status: "ready",
    storage_bucket: "article-assets",
    storage_path: `${OWNER}/${ARTICLE}/${ASSET}.png`,
    mime_type: "image/png",
    width: 640,
    height: 360,
    checksum_sha256: "a".repeat(64),
    sort_order: 0,
    created_at: "2026-09-01T00:00:00+00:00",
    ...overrides,
  };
}

test("loads the current article library save quota", async () => {
  const client = fakeClient();
  const summary = await getMyArticleStockSummary(client, OWNER);
  assert.deepEqual(summary, {
    currentArticles: 3,
    maxArticles: 5,
    remainingArticles: 2,
    isUnlimited: false,
  });
  assert.deepEqual(client.calls.slice(0, 3), [
    ["auth.getUser"],
    ["rpc", "can_access_product", { p_product_code: "AAS-PWA-BETA" }],
    ["rpc", "get_my_article_stock_summary", undefined],
  ]);
});

test("lists only summary columns after authoritative access checks", async () => {
  const client = fakeClient();
  const result = await listCloudArticles(client, OWNER);

  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Phase 7 fixture");
  assert.ok(!ARTICLE_LIST_COLUMNS.includes("body"));
  const select = client.calls.find(
    ([kind, table, steps]) =>
      kind === "query" &&
      table === "articles" &&
      steps.some(([name, columns]) => name === "select" && columns === ARTICLE_LIST_COLUMNS),
  );
  assert.ok(select);
  assert.deepEqual(client.calls.slice(0, 2), [
    ["auth.getUser"],
    ["rpc", "can_access_product", { p_product_code: "AAS-PWA-BETA" }],
  ]);
});

test("rejects any article row whose owner differs from the authenticated profile", async () => {
  const client = fakeClient({ articles: [articleRow({ user_id: OTHER })] });
  await assert.rejects(
    () => listCloudArticles(client, OWNER),
    (error) => error instanceof ArticleLibraryError && error.code === "article_owner_mismatch",
  );
});

test("loads detail and safely supports a missing legacy workspace", async () => {
  const client = fakeClient({
    rpc: {
      get_article_workspace: {
        data: null,
        error: { code: "P0002", message: "article workspace not found" },
      },
    },
  });
  const detail = await getCloudArticleDetail(client, OWNER, ARTICLE);
  assert.equal(detail.body, "final body");
  assert.equal(detail.workspace.workspaceVersion, 0);
  assert.deepEqual(detail.workspace.workspaceJson, {});
});

test("updates article and workspace atomically with the expected revision", async () => {
  const client = fakeClient();
  const updated = await updateCloudArticle(
    client,
    OWNER,
    ARTICLE,
    3,
    {
      title: "Updated",
      publication_target: "note",
      article_type: "paid",
      genre: "test",
      subgenre: null,
      body: "new final",
      status: "ready",
      price: 500,
      tags: ["phase7", "safe"],
    },
    {
      request_json: { platform: "note", article_type: "有料", future_request: 1 },
      workspace_json: { future: true, local_status: "完成", local_updated_at: null },
      source_body: "new source",
      publish_body: "new publish",
    },
  );
  assert.equal(updated.revision, 4);
  assert.equal(updated.title, "Updated");
  const call = client.calls.find((entry) => entry[0] === "rpc" && entry[1] === "update_article_with_workspace");
  assert.equal(call[2].p_expected_revision, 3);
  assert.equal(call[2].p_workspace_patch.publish_body, "new publish");
});

test("preserves future Workspace fields while keeping Windows reconstruction current", () => {
  const detail = {
    ...articleRow(),
    userId: OWNER,
    articleType: "free",
    publicationTarget: "note",
    createdAt: "2026-09-01T00:00:00+00:00",
    updatedAt: "2026-09-02T00:00:00+00:00",
    workspace: {
      articleId: ARTICLE,
      userId: OWNER,
      requestJson: { old: true, future_request: { keep: true } },
      workspaceJson: { future_workspace: { keep: true }, local_status: "完成", local_updated_at: "old" },
      imagePlanJson: {},
      sourceBody: "source",
      publishBody: "publish",
      workspaceVersion: 2,
      createdAt: null,
      updatedAt: null,
    },
  };
  const article = {
    title: "Updated",
    publication_target: "blog",
    article_type: "paid",
    genre: "new genre",
    subgenre: null,
    body: "new body",
    status: "archived",
    price: 800,
    tags: ["one"],
  };
  const patch = buildCompatibleWorkspacePatch(detail, article, "source 2", "publish 2");
  assert.deepEqual(patch.request_json.future_request, { keep: true });
  assert.equal(patch.request_json.platform, "ブログ");
  assert.equal(patch.request_json.article_type, "有料");
  assert.deepEqual(patch.workspace_json.future_workspace, { keep: true });
  assert.equal(patch.workspace_json.local_status, "archived");
  assert.equal(patch.workspace_json.local_updated_at, null);
});

test("maps a revision conflict without attempting an overwrite retry", async () => {
  let updates = 0;
  const client = fakeClient({
    rpc: {
      update_article_with_workspace() {
        updates += 1;
        return { data: null, error: { code: "40001", message: "article revision conflict", status: 409 } };
      },
    },
  });
  await assert.rejects(
    () => updateCloudArticle(
      client,
      OWNER,
      ARTICLE,
      3,
      {
        title: "Unsaved text",
        publication_target: "note",
        article_type: "free",
        genre: null,
        subgenre: null,
        body: "unsaved body",
        status: "ready",
        price: null,
        tags: [],
      },
      { request_json: {}, workspace_json: {}, source_body: null, publish_body: null },
    ),
    (error) => error instanceof ArticleLibraryError && error.category === "conflict",
  );
  assert.equal(updates, 1);
});

test("deletes a ready private image before the revision-checked article", async () => {
  const asset = readyAsset();
  const client = fakeClient({ assets: [asset] });
  await deleteCloudArticle(client, OWNER, ARTICLE, 3);

  const rpcNames = client.calls.filter(([kind]) => kind === "rpc").map(([, name]) => name);
  assert.deepEqual(rpcNames, [
    "can_access_product",
    "begin_delete_article_asset",
    "finalize_delete_article_asset",
    "delete_article",
  ]);
  assert.deepEqual(client.storageCalls, [
    ["from", "article-assets"],
    ["remove", [asset.storage_path]],
  ]);
});

test("recovers an uploaded pending image and then completes deletion", async () => {
  const pending = readyAsset({ status: "pending_upload", width: null, height: null, checksum_sha256: null });
  const client = fakeClient({
    assets: [pending],
    rpc: {
      cancel_pending_article_asset: {
        data: null,
        error: { code: "P0001", message: "storage_object_exists" },
      },
      finalize_article_asset: {
        data: { ...pending, status: "ready" },
        error: null,
      },
    },
  });
  await deleteCloudArticle(client, OWNER, ARTICLE, 3);
  const rpcNames = client.calls.filter(([kind]) => kind === "rpc").map(([, name]) => name);
  assert.deepEqual(rpcNames, [
    "can_access_product",
    "cancel_pending_article_asset",
    "finalize_article_asset",
    "begin_delete_article_asset",
    "finalize_delete_article_asset",
    "delete_article",
  ]);
});

test("stale delete revision stops before image metadata or Storage is touched", async () => {
  const client = fakeClient({ revisionRow: { id: ARTICLE, user_id: OWNER, revision: 4 }, assets: [readyAsset()] });
  await assert.rejects(
    () => deleteCloudArticle(client, OWNER, ARTICLE, 3),
    (error) => error instanceof ArticleLibraryError && error.category === "conflict",
  );
  assert.equal(client.calls.some(([kind, table]) => kind === "from" && table === "article_assets"), false);
  assert.deepEqual(client.storageCalls, []);
});
