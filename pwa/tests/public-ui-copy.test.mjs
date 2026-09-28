import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

const publicFeatureFiles = [
  "components/phase6-app.tsx",
  "components/phase-tools-page.tsx",
  "components/phase9-invite-page.tsx",
  "components/pwa-admin-users-page.tsx",
  "components/admin-promotion-page.tsx",
  "components/phase13-image-page.tsx",
  "components/phase14-sns-page.tsx",
  "components/phase15-sidejob-page.tsx",
  "components/phase15-sns-plan-page.tsx",
  "components/phase16-publish-page.tsx",
  "components/phase17-analytics-page.tsx",
];

test("public feature surfaces do not expose development phase numbers", async () => {
  const sources = await Promise.all(publicFeatureFiles.map(read));
  for (const source of sources) {
    assert.doesNotMatch(source, /PHASE\s+\d/i);
  }
});

test("active PWA access shell avoids frozen Windows and hands successful login back to the current home", async () => {
  const accessShell = await read("components/phase6-app.tsx");
  const home = await read("components/phase18-beginner-home.tsx");
  const provider = await read("components/access-state-provider.tsx");

  assert.doesNotMatch(accessShell, /Windows版/);
  assert.doesNotMatch(accessShell, /PWA ARTICLE LIBRARY · PHASE|<p className="eyebrow">PHASE\s+\d/);
  assert.match(accessShell, /PWA ACCESS/);
  assert.doesNotMatch(accessShell, /onAccessReady/);
  assert.match(accessShell, /useSharedAccessState\(\)/);
  assert.doesNotMatch(accessShell, /loadAccessState|アカウントと利用権を確認しています/);
  assert.doesNotMatch(accessShell, /recoveryRef/);
  assert.match(accessShell, /setAuthMode\("login"\);[\s\S]*?await refreshAccess\(\)/);
  assert.match(accessShell, /navigateRoute\("\/create"\)/);
  assert.match(home, /<Phase7App \/>/);
  assert.doesNotMatch(home, /handleAccessReady|onAccessReady/);
  assert.match(home, /useSharedAccessState\(\)/);
  assert.match(provider, /const loadAccessStateOnce = useCallback/);
  assert.match(provider, /requestLoaderRef/);
  assert.match(provider, /const refresh = useCallback[\s\S]*?loadAccessStateOnce\(activeClient\)/);
  assert.match(provider, /onAuthStateChange/);
});

test("feature hub groups supporting features by genre and avoids article-creator duplication", async () => {
  const tools = await read("components/phase-tools-page.tsx");
  const toolCatalog = await read("features/tools/tool-catalog.ts");
  for (const label of ["記事・コンテンツ", "SNS・動画・集客", "販売・収益化", "受託・案件獲得", "リサーチ・業務効率化", "運営・アカウント", "公開・分析", "サポート"]) {
    assert.match(toolCatalog, new RegExp(label));
  }
  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(tools, /tool-group-section/);
  assert.doesNotMatch(toolCatalog, /href: "\/create"/);
  assert.doesNotMatch(toolCatalog, /href: "\/images"/);
  assert.doesNotMatch(toolCatalog, /href: "\/export"/);
  assert.doesNotMatch(`${tools}\n${toolCatalog}`, /OPENAI_LINKS|外部AIツール|ChatGPT Work|ChatGPT Images/);
  assert.doesNotMatch(tools, /phase:\s*["']/i);
});

test("feature hub keeps four desktop, three tablet and two mobile columns", async () => {
  const css = await read("app/phase12-17.css");
  assert.match(css, /\.tool-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*1000px\)[\s\S]*?\.tool-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*?\.tool-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test("admin user dashboard exposes the current PWA-only management workflow", async () => {
  const [admin, panels, codes, history] = await Promise.all([
    read("components/pwa-admin-users-page.tsx"),
    read("components/admin-users/admin-user-panels.tsx"),
    read("components/admin-users/admin-access-code-panel.tsx"),
    read("components/admin-users/admin-access-code-redemption-history.tsx"),
  ]);

  assert.match(admin, /PWAユーザー利用管理/);
  assert.match(admin, /承認待ち/);
  assert.match(admin, /利用中/);
  assert.match(admin, /有効コード/);
  assert.match(panels, /ユーザーを選ぶ/);
  assert.match(panels, /PWA利用権/);
  assert.match(panels, /Creator Club特典/);
  assert.match(codes, /販売用PWA利用コード/);
  assert.match(codes, /利用コードを作成する/);
  assert.match(history, /利用コード使用履歴/);
  assert.doesNotMatch(`${admin}\n${panels}\n${codes}`, /Windows利用者|AAS-WIN-BETA/);
});

test("admin dashboard keeps two-column summary cards on narrow mobile screens", async () => {
  const css = await read("app/phase23-admin-dashboard.css");
  const layout = await read("app/layout.tsx");
  assert.match(layout, /phase23-admin-dashboard\.css/);
  assert.match(css, /@media \(max-width: 650px\)[\s\S]*?\.admin-summary-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /\.admin-workspace/);
  assert.match(css, /\.admin-invite-layout/);
});

test("admin tools are removed from the user feature hub and collected in the admin card hub", async () => {
  const tools = await read("components/phase-tools-page.tsx");
  const adminHub = await read("app/admin/page.tsx");
  const sections = await read("lib/admin-sections.ts");
  const guard = await read("components/admin-route-guard.tsx");
  const promotion = await read("components/admin-promotion-page.tsx");
  const route = await read("app/admin/promotion/page.tsx");

  assert.doesNotMatch(tools, /管理者専用/);
  assert.doesNotMatch(tools, /\/admin\/promotion/);
  assert.doesNotMatch(tools, /\/admin\/development-prompts/);

  assert.match(adminHub, /className="admin-only-tools-section admin-management-hub"/);
  assert.match(adminHub, /className="admin-section-groups"/);
  assert.match(adminHub, /className="admin-section-group-grid"/);
  assert.match(adminHub, /className="admin-only-tool-card"/);
  assert.match(adminHub, /ADMIN_SECTION_GROUPS\.map/);
  assert.match(adminHub, /ADMIN_SECTIONS\.filter/);
  assert.match(adminHub, /<span>\{section\.eyebrow\}<\/span>/);
  assert.match(adminHub, /<h3>\{section\.title\}<\/h3>/);
  assert.match(adminHub, /<p>\{section\.description\}<\/p>/);
  assert.match(adminHub, /管理機能/);
  assert.match(adminHub, /この機能を開く →/);
  assert.match(adminHub, /まず「日常の管理」を確認/);

  for (const label of ["メンバーシップ管理", "販売・プロモーション", "開発依頼プロンプト", "ナレッジ管理", "アップデート管理", "セキュリティ・運用"]) {
    assert.match(sections, new RegExp(label));
  }
  assert.match(guard, /profile\.role !== "admin"/);
  assert.match(guard, /profile\.status !== "active"/);
  assert.match(promotion, /active管理者のみ利用できます/);
  assert.match(promotion, /販売・プロモーションセンター/);
  assert.match(route, /AdminPromotionPage/);
  assert.doesNotMatch(`${tools}\n${adminHub}\n${promotion}`, /sb_secret_|service[_-]?role/i);
});

test("admin promotion prompts protect confirmed product facts and cover article plus social sales", async () => {
  const api = await read("lib/admin-promotion.ts");
  for (const label of ["確認済み製品情報", "紹介・販売", "販売前", "実運用テスト", "Instagram", "Threads", "TikTok", "YouTube Shorts", "14日分の投稿カレンダー"]) {
    assert.match(api, new RegExp(label));
  }
  assert.match(api, /価格、実績、利用者数、売上、レビュー、キャンペーン/);
  assert.match(api, /成果保証や過度な煽り/);
  assert.match(api, /架空の購入者レビュー/);
  assert.doesNotMatch(api, /service[_-]?role|sb_secret_/i);
});

test("active admins keep admin access without changing the shared five-item mobile nav", async () => {
  const topbar = await read("components/admin-home-topbar.tsx");
  const sections = await read("lib/admin-sections.ts");
  const nav = await read("components/persistent-mobile-nav.tsx");
  const settings = await read("components/pwa-settings-page.tsx");
  const layout = await read("app/layout.tsx");
  assert.match(topbar, /pathname !== "\/"/);
  assert.match(topbar, /useSharedAccessState\(\)/);
  assert.match(topbar, /state\.profile\.role === "admin"/);
  assert.match(topbar, /state\.profile\.status === "active"/);
  assert.match(topbar, /管理ダッシュボード/);
  assert.match(topbar, /ADMIN_HOME_SHORTCUT_IDS/);
  assert.match(sections, /販売・プロモーション/);
  assert.match(sections, /\/admin\/promotion/);
  assert.match(nav, /AasReferenceBottomNav/);
  assert.match(nav, /activeKeyForPathname/);
  assert.doesNotMatch(nav, />管理<\/button>|go\("\/admin"\)|admin-enabled|CANONICAL_NAV_ITEMS/);
  assert.match(settings, /profile\?\.role === "admin"/);
  assert.match(settings, /href="\/admin">管理者画面/);
  assert.match(layout, /AdminHomeTopbar/);
  assert.match(layout, /PersistentMobileNav/);
});
