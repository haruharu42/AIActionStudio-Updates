import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("pins the browser client and centralized PWA access contract", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const accessBoundary = await read("lib/access-control.ts");
  const phase6 = await read("lib/phase6-access.ts");
  const client = await read("lib/supabase.ts");

  assert.equal(packageJson.dependencies["@supabase/supabase-js"], "2.112.3");
  assert.match(accessBoundary, /AAS-PWA-BETA/);
  assert.match(accessBoundary, /auth\.getUser\(\)/);
  assert.match(accessBoundary, /\.from\("profiles"\)/);
  assert.match(accessBoundary, /"can_access_product"/);
  assert.match(accessBoundary, /PWA利用権の確認に失敗しました/);
  assert.match(phase6, /loadCoreAccessState/);
  assert.match(phase6, /ensureMyFreeTrial/);
  assert.doesNotMatch(phase6, /\.from\("profiles"\)|"can_access_product"/);
  assert.match(client, /flowType:\s*"pkce"/);
  assert.match(client, /detectSessionInUrl:\s*false/);
  assert.match(client, /sb_secret_/);
});

test("keeps the access boundary separate from article and image data", async () => {
  const source = [
    await read("lib/access-control.ts"),
    await read("lib/phase6-access.ts"),
    await read("lib/supabase.ts"),
  ].join("\n");

  assert.doesNotMatch(source, /common_articles/);
  assert.doesNotMatch(source, /article_workspaces/);
  assert.doesNotMatch(source, /article_assets/);
  assert.doesNotMatch(source, /article-assets/);
});

test("service worker never caches auth callbacks, remote Supabase traffic, or personalized root HTML", async () => {
  const worker = await read("public/sw.js");
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /\/auth\/callback/);
  assert.match(worker, /url\.searchParams\.has\("code"\)/);
  assert.match(worker, /url\.searchParams\.has\("access_token"\)/);
  assert.match(worker, /url\.searchParams\.has\("refresh_token"\)/);
  assert.match(worker, /aas-pwa-phase17-prod-v2-runtime-v10-axia-icon/);
  assert.match(worker, /const FRESH_BRANDING_ASSETS = new Set/);
  assert.match(worker, /"\/manifest\.webmanifest"/);
  assert.match(worker, /"\/aas-axia-icon-512\.png"/);
  assert.match(worker, /"\/aas-login-tile-1\.svg"/);
  assert.match(worker, /"\/aas-login-tile-4\.svg"/);
  assert.match(worker, /FRESH_BRANDING_ASSETS\.has\(url\.pathname\)/);
  const appShell = worker.match(/const APP_SHELL = \[[\s\S]*?\];/)?.[0] ?? "";
  assert.doesNotMatch(appShell, /"\/manifest\.webmanifest"/);
  assert.doesNotMatch(appShell, /"\/aas-axia-icon-512\.png"/);
  assert.doesNotMatch(appShell, /"\/aas-login-tile-1\.svg"/);
  assert.doesNotMatch(appShell, /["']\/["']/);
  assert.doesNotMatch(worker, /supabase\.co/);
});

test("manifest and install icons are complete", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["512x512"]);
  assert.equal(manifest.icons[0]?.src, "/aas-axia-icon-512.png?v=20260928-axia-v1");
  assert.equal(manifest.icons[0]?.type, "image/png");\n  assert.equal(manifest.icons[0]?.purpose, "any");
});

test("build configuration rejects secret browser keys", async () => {
  const config = await read("next.config.ts");
  assert.match(config, /sb_secret_/);
  assert.match(config, /service\[_-\]\?role/);
  assert.doesNotMatch(config, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("registration legal links use first-party routes and current support guidance", async () => {
  const client = await read("lib/supabase.ts");
  const config = await read("next.config.ts");
  const shell = await read("components/legal-document.tsx");
  const terms = await read("app/terms/page.tsx");
  const privacy = await read("app/privacy/page.tsx");
  const aiTerms = await read("app/ai-terms/page.tsx");
  const support = await read("app/support/page.tsx");

  assert.match(client, /NEXT_PUBLIC_AAS_TERMS_URL \?\? "\/terms"/);
  assert.match(client, /NEXT_PUBLIC_AAS_PRIVACY_URL \?\? "\/privacy"/);
  assert.match(client, /NEXT_PUBLIC_AAS_AI_TERMS_URL \?\? "\/ai-terms"/);
  assert.match(config, /"\/terms"/);
  assert.match(config, /"\/privacy"/);
  assert.match(config, /"\/ai-terms"/);
  assert.match(shell, /現在の提供条件/);
  assert.doesNotMatch(shell, /公開準備ドラフト/);
  assert.match(shell, /AAS内のStripe新規購入は停止中/);
  assert.match(shell, /href="\/support"/);
  assert.match(terms, /\/support/);
  assert.match(privacy, /個人情報/);
  assert.match(privacy, /\/support/);
  assert.match(aiTerms, /AI利用条件/);
  assert.match(aiTerms, /\/support/);
  assert.match(support, /SupportRequestPage/);
});

test("auth errors explain weak and leaked passwords before the generic password fallback", async () => {
  const phase6 = await read("lib/phase6-access.ts");
  const leakedIndex = phase6.indexOf("漏洩済みパスワードとして検出");
  const weakIndex = phase6.indexOf("パスワードの強度条件を満たしていません");
  const genericIndex = phase6.indexOf("パスワードを確認してください");
  assert.ok(leakedIndex >= 0);
  assert.ok(weakIndex >= 0);
  assert.ok(genericIndex >= 0);
  assert.ok(leakedIndex < genericIndex);
  assert.ok(weakIndex < genericIndex);
  assert.match(phase6, /pwned/);
  assert.match(phase6, /weak password/);
});
