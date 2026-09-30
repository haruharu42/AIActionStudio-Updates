import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("pins patched framework versions, current release metadata, and PWA cache generation", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const packageLock = JSON.parse(await read("package-lock.json"));
  const layout = await read("app/layout.tsx");
  const worker = await read("public/sw.js");
  const productionHelper = await read("../scripts/Prepare-AAS-PWA-Production.ps1");
  const productionPreflight = await read("../.github/workflows/pwa-production-preflight.yml");
  const pullRequestCi = await read("../.github/workflows/pwa-phase9-17-ci.yml");

  assert.equal(packageJson.dependencies.next, "16.3.4");
  assert.equal(packageJson.dependencies.react, "19.2.8");
  assert.equal(packageJson.devDependencies.vinext, "1.0.0-beta.9");
  assert.equal(packageJson.devDependencies.vite, "8.2.2");
  assert.equal(packageJson.devDependencies.wrangler, "4.129.0");
  assert.equal(packageJson.devDependencies["eslint-config-next"], "16.3.4");
  assert.equal(packageLock.packages["node_modules/brace-expansion"].version, "1.1.21");
  assert.equal(
    packageLock.packages["node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion"].version,
    "5.0.12",
  );
  assert.equal(packageLock.packages["node_modules/fast-uri"].version, "3.1.8");
  assert.match(layout, /"aas-phase": "56"/);
  assert.match(layout, /"aas-release-stage": process\.env\.NEXT_PUBLIC_AAS_RELEASE_AUDIENCE \?\? "development"/);
  assert.doesNotMatch(layout, /phase8-local/);
  assert.match(worker, /aas-pwa-phase56-runtime-v12-axia-generated/);
  assert.doesNotMatch(worker, /aas-pwa-phase17-prod-v2/);
  assert.doesNotMatch(worker, /aas-pwa-phase8-v1/);
  for (const productionGuard of [productionHelper, productionPreflight]) {
    assert.match(productionGuard, /aas-pwa-phase56-runtime-v12-axia-generated/);
    assert.match(productionGuard, /aas-pwa-phase17-prod-v2/);
    assert.match(productionGuard, /aas-pwa-phase8-v1/);
  }
  assert.match(productionHelper, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE = "public"/);
  assert.match(productionHelper, /service_worker_cache_generation = "phase56-runtime-v12-axia-generated"/);
  assert.match(productionPreflight, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: public/);
  assert.match(pullRequestCi, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: preview/);
});

test("keeps article library boundaries and routes article and image creation to active PWA flows", async () => {
  const app = await read("components/phase6-app.tsx");
  const library = await read("components/phase7-library.tsx");
  const listView = await read("components/article-library/article-library-list.tsx");
  const detailView = await read("components/article-library/article-library-detail.tsx");
  const editor = await read("components/article-library/article-library-editor.tsx");
  const viewLogic = await read("lib/article-library-view.ts");

  assert.match(app, /Phase7Library/);
  assert.match(app, /navigate\("library"\)/);
  assert.match(app, /記事を作る<small>利用可能<\/small>/);
  assert.equal((app.match(/navigateRoute\("\/create"\)/g) || []).length, 2);
  assert.match(app, /useRouter/);
  assert.match(app, /const navigateRoute = \(path: string\) => \{ if \(mayLeave\(\)\) router\.push\(path\); \};/);
  assert.match(app, /記事の画像<small>画像計画<\/small>/);
  assert.equal((app.match(/navigateRoute\("\/images"\)/g) || []).length, 2);
  assert.match(library, /listArticleLibraryPage/);
  assert.match(library, /getCloudArticleDetail/);
  assert.match(library, /updateCloudArticle/);
  assert.match(library, /deleteCloudArticle/);
  assert.doesNotMatch(library, /create_article/);
  assert.doesNotMatch(library, /prepare_article_asset/);
  assert.match(library, /ArticleLibraryListView/);
  assert.match(library, /ArticleLibraryDetailView/);
  assert.match(library, /ArticleLibraryEditor/);
  assert.match(viewLogic, /buildArticleLibrarySavePayload/);
  assert.match(viewLogic, /price <= 0/);
  assert.doesNotMatch(`${listView}\n${detailView}\n${editor}`, /listArticleLibraryPage|getCloudArticleDetail|updateCloudArticle|deleteCloudArticle/);
  assert.doesNotMatch(`${listView}\n${detailView}\n${editor}`, /getSupabaseClient|\.rpc\(/);
  assert.match(library, /listRequestIdRef/);
  assert.match(library, /detailRequestIdRef/);
  assert.match(library, /requestId !== listRequestIdRef\.current/);
  assert.match(library, /requestId !== detailRequestIdRef\.current/);
});

test("keeps list reads body-free and gates every article operation", async () => {
  const service = await read("lib/phase7-articles.ts");
  const listColumns = service.match(/ARTICLE_LIST_COLUMNS\s*=\s*\n?\s*"([^"]+)"/)?.[1] ?? "";

  assert.ok(listColumns.includes("title"));
  assert.ok(listColumns.includes("revision"));
  assert.ok(!listColumns.includes("body"));
  assert.match(service, /auth\.getUser\(\)/);
  assert.match(service, /"can_access_product"/);
  assert.match(service, /PWA_PRODUCT_CODE/);
  assert.match(service, /article_owner_mismatch/);
  assert.match(service, /workspace_owner_mismatch/);
  assert.match(service, /asset_owner_mismatch/);
});

test("uses revision-safe workspace updates and complete Storage deletion lifecycle", async () => {
  const service = await read("lib/phase7-articles.ts");

  assert.match(service, /"update_article_with_workspace"/);
  assert.match(service, /p_expected_revision/);
  assert.match(service, /"begin_delete_article_asset"/);
  assert.match(service, /\.remove\(\[asset\.storagePath\]\)/);
  assert.match(service, /"finalize_delete_article_asset"/);
  assert.match(service, /"delete_article"/);
  assert.match(service, /storage_object_exists/);
  assert.match(service, /"finalize_article_asset"/);
});
