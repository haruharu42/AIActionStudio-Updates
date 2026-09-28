import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("root layout keeps verified access state alive across client-side route changes", async () => {
  const [layout, provider] = await Promise.all([
    read("app/layout.tsx"),
    read("components/access-state-provider.tsx"),
  ]);

  assert.match(layout, /<AccessStateProvider>/);
  assert.match(layout, /<AccessStateProvider>[\s\S]*?\{children\}[\s\S]*?<PersistentMobileNav \/>[\s\S]*?<\/AccessStateProvider>/);
  assert.match(provider, /loadAccessState/);
  assert.match(provider, /loadAccessStateOnce/);
  assert.match(provider, /requestLoaderRef/);
  assert.match(provider, /onAuthStateChange/);
  assert.match(provider, /if \(!session\) \{[\s\S]*?setState\(\{ kind: "signed_out" \}\)/);
  assert.match(provider, /useSharedAccessState/);
  assert.match(provider, /window\.addEventListener\("focus", recheckInBackground\)/);
  assert.match(provider, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(provider, /BACKGROUND_RECHECK_MIN_INTERVAL_MS = 30_000/);
  assert.match(provider, /event === "INITIAL_SESSION"/);
  assert.match(provider, /event === "TOKEN_REFRESHED" \? "background" : "strict"/);
  assert.match(provider, /current\.kind === "ready" \? current : \{ kind: "unavailable" \}/);
  assert.match(provider, /current\.kind === "ready"[\s\S]*?next\.kind === "ready"[\s\S]*?current\.profile\.status === next\.profile\.status[\s\S]*?return current/);
});

test("all client-side page changes reset the viewport to the top", async () => {
  const [layout, scrollReset] = await Promise.all([
    read("app/layout.tsx"),
    read("components/route-scroll-to-top.tsx"),
  ]);

  assert.match(layout, /RouteScrollToTop/);
  assert.match(layout, /<Suspense fallback=\{null\}><RouteScrollToTop \/><\/Suspense>/);
  assert.match(scrollReset, /usePathname\(\)/);
  assert.match(scrollReset, /useSearchParams\(\)/);
  assert.match(scrollReset, /scrollRestoration = "manual"/);
  assert.match(scrollReset, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(scrollReset, /document\.scrollingElement/);
  assert.match(scrollReset, /requestAnimationFrame\(scrollWindowToTop\)/);
  assert.match(scrollReset, /routeKey/);
});

test("home keeps background access verification invisible", async () => {
  const home = await read("components/phase18-beginner-home.tsx");

  assert.match(home, /useSharedAccessState\(\)/);
  assert.doesNotMatch(home, /loadAccessState/);
  assert.doesNotMatch(home, /onAuthStateChange/);
  assert.doesNotMatch(home, />LOADING</);
  assert.doesNotMatch(home, /アカウントと利用権を確認しています/);
  assert.doesNotMatch(home, /reference-route-loading/);
  assert.doesNotMatch(home, /準備中/);
  assert.match(home, /接続状態を確認できませんでした/);
});

test("home internal navigation uses Next Link instead of document reload anchors", async () => {
  const home = await read("components/phase18-beginner-home.tsx");

  assert.match(home, /import Link from "next\/link"/);
  assert.match(home, /<Link href="\/create"/);
  assert.match(home, /<Link href="\/missions"/);
  assert.match(home, /<Link href="\/manual"/);
  assert.match(home, /<Link href="\/ranking"/);
  assert.match(home, /<Link href="\/profile"/);
  assert.match(home, /<Link className="beginner-quick-start" href=\{quickCreateHref\}/);
  assert.doesNotMatch(home, /<a\b[^>]*href=(?:"\/|\{quickCreateHref\})/);
});

test("compact progress remains available for real content operations", async () => {
  const [layout, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/phase42-route-transition.css"),
  ]);

  assert.match(layout, /phase42-route-transition\.css/);
  assert.match(css, /\.reference-route-loading/);
  assert.match(css, /height:\s*3px/);
  assert.match(css, /@keyframes aas-route-loading/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("member routes reuse root access state and keep access verification invisible", async () => {
  const sources = await Promise.all([
    read("components/pwa-settings-page.tsx"),
    read("components/phase-tools-page.tsx"),
    read("components/user-inquiries-page.tsx"),
    read("components/phase11-create-page.tsx"),
    read("components/phase13-image-page.tsx"),
    read("components/phase14-sns-page.tsx"),
    read("components/note-operations-page.tsx"),
    read("components/platform-account-design-page.tsx"),
    read("components/phase15-member-gate.tsx"),
    read("components/article-export-page.tsx"),
    read("components/create-ai-setup.tsx"),
    read("components/phase16-publish-page.tsx"),
    read("components/phase17-analytics-page.tsx"),
    read("components/billing-account-page.tsx"),
    read("components/commerce-plans-page.tsx"),
    read("components/phase9-invite-page.tsx"),
    read("components/knowledge-runtime-bootstrap.tsx"),
  ]);

  for (const source of sources) {
    assert.match(source, /useSharedAccessState\(\)/);
    assert.doesNotMatch(
      source,
      /アカウントと利用権を確認しています|アカウント情報を確認しています|利用可能な機能を確認しています|アカウントと運営データを確認しています|アカウントと保存データを確認しています|記事ライブラリを確認しています|記事を確認しています|記事集計を作成しています|契約情報を確認しています|アカウントを確認しています|使用AIを確認しています/,
    );
    assert.doesNotMatch(source, /auth\.getUser\(\)|\.from\("profiles"\)|loadCoreAccessState|loadAccessState/);
  }

  const tools = sources[1];
  assert.match(tools, /import Link from "next\/link"/);
  assert.match(tools, /<Link className="route-back" href="\/"/);
  assert.doesNotMatch(tools, /<a className="route-back" href="\/"/);
});


test("persistent navigation and article export do not start their own auth session checks", async () => {
  const [nav, exportPage] = await Promise.all([
    read("components/persistent-mobile-nav.tsx"),
    read("components/article-export-page.tsx"),
  ]);

  assert.match(nav, /useSharedAccessState\(\)/);
  assert.doesNotMatch(nav, /getSupabaseClient|auth\.getSession|onAuthStateChange/);

  assert.match(exportPage, /useSharedAccessState\(\)/);
  assert.doesNotMatch(exportPage, /getSupabaseClient|auth\.getUser\(\)|\.from\("profiles"\)/);
  assert.doesNotMatch(exportPage, /記事ライブラリを確認しています/);
  assert.match(exportPage, /<Link className="route-back" href="\/tools"/);
});


test("auth and preview gates keep mandatory verification invisible while it runs", async () => {
  const [authGateway, releaseGate] = await Promise.all([
    read("components/phase6-app.tsx"),
    read("components/release-audience-gate.tsx"),
  ]);

  assert.match(authGateway, /useSharedAccessState\(\)/);
  assert.doesNotMatch(authGateway, /loadAccessState/);
  assert.match(authGateway, /if \(state\.kind === "loading"\) return null/);
  assert.doesNotMatch(authGateway, /アカウントと利用権を確認しています/);

  assert.match(releaseGate, /loadMyAppReleaseState/);
  assert.match(releaseGate, /if \(gate\.kind === "loading"\) return null/);
  assert.doesNotMatch(releaseGate, /候補版の利用権を確認しています/);
});



test("free trial usage verification stays invisible while loading", async () => {
  const gate = await read("components/free-trial-feature-gate.tsx");

  assert.match(gate, /if \(!status\) return null/);
  assert.doesNotMatch(gate, /利用回数を確認しています/);
});

test("member and admin route shells stay hidden until access verification settles", async () => {
  const accessStateRoutes = await Promise.all([
    read("components/phase13-image-page.tsx"),
    read("components/phase14-sns-page.tsx"),
    read("components/article-export-page.tsx"),
  ]);

  for (const source of accessStateRoutes) {
    assert.match(source, /if \(accessState\.kind === "loading"\) return null/);
  }

  const localGateRoutes = await Promise.all([
    read("components/phase11-create-page.tsx"),
    read("components/free-trial-admin-page.tsx"),
    read("components/operations-admin-page.tsx"),
    read("components/sales-settings-admin-page.tsx"),
  ]);

  for (const source of localGateRoutes) {
    assert.match(source, /if \(gate\.kind === "loading"\) return null/);
  }

  const [adminGuard, adminUsers, accountDesign, invite, inquiries, noteOperations] = await Promise.all([
    read("components/admin-route-guard.tsx"),
    read("components/pwa-admin-users-page.tsx"),
    read("components/platform-account-design-page.tsx"),
    read("components/phase9-invite-page.tsx"),
    read("components/user-inquiries-page.tsx"),
    read("components/note-operations-page.tsx"),
  ]);

  assert.match(adminGuard, /useSharedAccessState\(\)/);
  assert.match(adminGuard, /gate\.kind === "ready"/);
  assert.match(adminUsers, /state === "loading"/);
  assert.match(accountDesign, /if \(state\.kind === "loading"\) return null/);
  assert.match(invite, /if \(state\.kind === "loading"\) return null/);
  assert.match(inquiries, /if \(state\.kind === "loading"\) return null/);
  assert.match(noteOperations, /if \(gate\.kind === "loading" \|\| \(gate\.kind === "ready" && !profile\)\) return null/);
});

test("admin authorization stays centralized while admin feature pages avoid page-level profile queries", async () => {
  const [guard, users, ...sharedStatePages] = await Promise.all([
    read("components/admin-route-guard.tsx"),
    read("components/pwa-admin-users-page.tsx"),
    read("components/operations-admin-page.tsx"),
    read("components/admin-home-topbar.tsx"),
    read("components/admin-knowledge-page.tsx"),
    read("components/free-trial-admin-page.tsx"),
    read("components/sales-settings-admin-page.tsx"),
    read("components/admin-development-prompts-page.tsx"),
  ]);

  assert.match(guard, /useSharedAccessState\(\)/);
  assert.match(guard, /profile\.role !== "admin"/);
  assert.match(guard, /profile\.status !== "active"/);

  for (const source of sharedStatePages) {
    assert.match(source, /useSharedAccessState\(\)/);
    assert.doesNotMatch(source, /auth\.getUser\(\)|\.from\("profiles"\)|loadCoreAccessState|loadAccessState/);
  }

  assert.doesNotMatch(users, /auth\.getUser\(\)|\.from\("profiles"\)|loadCoreAccessState|loadAccessState/);
  assert.match(users, /listPwaAdminUsers/);
});

