import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("manual and Q&A routes provide full help surfaces", async () => {
  const [manual, faq, home, settings] = await Promise.all([
    read("app/manual/page.tsx"),
    read("app/faq/page.tsx"),
    read("components/phase18-beginner-home.tsx"),
    read("components/pwa-settings-page.tsx"),
  ]);

  for (const label of ["ホーム", "記事を作る", "記事ライブラリ", "note運営アシスタント：AIスケジュール", "画像生成計画", "SNS投稿を作る", "公開管理", "コンテンツ分析", "アップデート管理", "ユーザー管理", "トラブル時の確認"]) {
    assert.match(manual, new RegExp(label));
  }
  assert.match(manual, /こういう時に使います/);
  assert.match(manual, /回答全文をそのままコピー/);
  assert.match(manual, /管理者→指定テスター→全体公開/);
  for (const label of ["はじめ方・基本操作", "記事・画像・SNS", "PWA・ナビ・表示", "アカウント・利用権・決済", "トラブル・安全性"]) {
    assert.match(faq, new RegExp(label));
  }
  for (const platform of ["X", "Instagram", "Threads", "TikTok", "Facebook", "LinkedIn", "Pinterest", "YouTube"]) {
    assert.ok(manual.includes(platform), `manual missing SNS platform: ${platform}`);
    assert.ok(faq.includes(platform), `FAQ missing SNS platform: ${platform}`);
  }
  assert.match(manual, /スマホでは利用可能なSNSアプリ/);
  assert.match(manual, /PCではWeb版/);
  assert.match(faq, /選択したSNSをすぐ開けますか/);
  assert.match(home, /className="secondary" href="\/manual">使い方を見る/);
  assert.match(home, /href="\/faq">Q&A・よくある質問/);
  assert.match(settings, /href="\/manual">使い方マニュアル/);
  assert.match(settings, /href="\/faq">Q&A・よくある質問/);
});

test("mobile navigation uses one shared customizable source across home and other screens", async () => {
  const [prefs, shared, shell, nav, customizer, settings, manual, faq] = await Promise.all([
    read("lib/mobile-nav-preference.ts"),
    read("components/shared-mobile-bottom-nav.tsx"),
    read("components/aas-reference-shell.tsx"),
    read("components/persistent-mobile-nav.tsx"),
    read("components/mobile-nav-customizer.tsx"),
    read("components/pwa-settings-page.tsx"),
    read("app/manual/page.tsx"),
    read("app/faq/page.tsx"),
  ]);

  assert.match(prefs, /DEFAULT_MOBILE_NAV_ITEMS[^\n]*\["tools", "create", "library", "settings"\]/);
  assert.match(prefs, /MAX_CUSTOM_MOBILE_NAV_ITEMS = 4/);
  assert.match(prefs, /MOBILE_NAV_ITEMS_KEY/);
  assert.match(prefs, /mobileNavItemsStorageKey/);
  assert.match(prefs, /\$\{MOBILE_NAV_ITEMS_KEY\}:\$\{normalized\}/);
  assert.match(prefs, /writeMobileNavItems\([\s\S]*userId\?: string \| null/);
  assert.match(prefs, /localStorage\.setItem\(key, JSON\.stringify\(next\)\)/);
  for (const label of ["ライブラリ", "note運営", "設計", "画像", "機能", "SNS", "分析", "ランキング", "プロフィール", "設定"]) {
    assert.match(prefs, new RegExp(label));
  }

  assert.match(shared, /readMobileNavItems\(userId, isAdmin\)/);
  assert.match(shared, /MOBILE_NAV_ITEMS_EVENT/);
  assert.match(shared, /mobileNavItemsStorageKey\(userId\)/);
  assert.match(shared, /useSharedAccessState\(\)/);
  assert.match(shared, /const userId = state\.kind === "ready" \? state\.profile\.id : ""/);
  assert.match(shared, /const isAdmin = state\.kind === "ready" && state\.profile\.role === "admin"/);
  assert.doesNotMatch(shared, /getSupabaseClient|auth\.getSession|onAuthStateChange|\.from\("profiles"\)/);
  assert.match(shared, /window\.addEventListener\("storage"/);
  assert.match(shared, /mobileNavItemFor/);
  assert.match(shared, /ホーム/);

  assert.match(shell, /SharedMobileBottomNav/);
  assert.doesNotMatch(shell, /className="aas-reference-bottom-nav aas-reference-mobile-main-nav"/);
  assert.match(nav, /AasReferenceBottomNav/);
  assert.match(nav, /MOBILE_NAV_ITEM_OPTIONS/);
  assert.match(nav, /activeKeyForPathname/);
  assert.doesNotMatch(nav, /CANONICAL_NAV_ITEMS/);

  assert.match(customizer, /残り\{MAX_CUSTOM_MOBILE_NAV_ITEMS\}枠/);
  assert.match(customizer, /全画面のスマホ下部ナビへ共通反映/);
  assert.match(customizer, /userId = ""/);
  assert.match(customizer, /readMobileNavItems\(userId, isAdmin\)/);
  assert.match(customizer, /writeMobileNavItems\(next, userId, isAdmin\)/);
  assert.match(customizer, /changeSlot/);
  assert.match(customizer, /move\(index, -1\)/);
  assert.match(customizer, /初期状態に戻す/);
  assert.match(settings, /<MobileNavCustomizer userId=\{profile\.id\} isAdmin=\{profile\.role === "admin" && profile\.status === "active"\} \/>/);
  assert.match(settings, /ナビ設定を読み込んでいます/);
  assert.match(settings, /ホームは固定、残り4枠/);
  assert.match(manual, /残り4枠を好きな機能へ入れ替え/);
  assert.match(faq, /残り4枠を設定の「下部ナビをカスタマイズ」/);
  assert.doesNotMatch(`${prefs}\n${shared}\n${shell}\n${nav}\n${settings}`, /sb_secret_|service[_-]?role|sk_(?:live|test)_|whsec_/i);
});


test("shared mobile navigation keeps five equal slots and the unified shell switches to desktop navigation", async () => {
  const [layout, flexCss, desktopCss, shared, persistent] = await Promise.all([
    read("app/layout.tsx"),
    read("app/phase31-nav-flex.css"),
    read("app/phase36-desktop-nav.css"),
    read("components/shared-mobile-bottom-nav.tsx"),
    read("components/persistent-mobile-nav.tsx"),
  ]);
  assert.match(layout, /phase31-help-nav\.css/);
  assert.match(layout, /phase31-nav-flex\.css/);
  assert.ok(layout.indexOf("phase31-help-nav.css") < layout.indexOf("phase31-nav-flex.css"));
  assert.match(flexCss, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(desktopCss, /@media \(min-width: 900px\)/);
  assert.match(desktopCss, /\.aas-reference-mobile-main-nav \{\s*display: none;/);
  assert.match(desktopCss, /\.aas-reference-desktop-nav/);
  assert.match(shared, /items\.map/);
  assert.match(shared, /onHome/);
  assert.match(persistent, /AasReferenceBottomNav/);
});




test("desktop navigation can add hide reorder reset and persist items", async () => {
  const [prefs, shell, css, layout] = await Promise.all([
    read("lib/desktop-nav-preference.ts"),
    read("components/aas-reference-shell.tsx"),
    read("app/phase36-desktop-nav.css"),
    read("app/layout.tsx"),
  ]);

  assert.match(prefs, /DESKTOP_NAV_ITEMS_KEY/);
  assert.match(prefs, /MAX_DESKTOP_NAV_ITEMS = 8/);
  assert.match(prefs, /desktopNavItemsStorageKey\(userId\?: string \| null\)/);
  assert.match(prefs, /DesktopNavItemsPreferenceEventDetail/);
  assert.match(prefs, /localStorage\.setItem\(key, JSON\.stringify\(next\)\)/);
  for (const label of ["画像作成", "機能", "SNS", "公開管理", "分析", "使い方", "ミッション"]) {
    assert.match(prefs, new RegExp(label));
  }

  assert.match(shell, /ナビをカスタマイズ/);
  assert.match(shell, /表示・非表示と順番を変更できます/);
  assert.match(shell, /move\(key, -1\)/);
  assert.match(shell, /move\(key, 1\)/);
  assert.match(shell, /初期状態に戻す/);
  assert.match(shell, /ホームと設定は常に表示されます/);
  assert.match(shell, /active=\{active === "settings"\}/);
  assert.match(shell, /useSharedAccessState\(\)/);
  assert.match(shell, /const userId = state\.kind === "ready" \? state\.profile\.id : ""/);
  assert.match(shell, /readDesktopNavItems\(userId\)/);
  assert.match(shell, /writeDesktopNavItems\(next, userId\)/);
  assert.match(shell, /desktopNavItemsStorageKey\(userId\)/);
  assert.match(shell, /detail\.userId !== userId/);
  assert.match(shell, /window\.addEventListener\("storage"/);
  assert.match(shell, /ログイン中のユーザーごとに保存されます/);

  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /\.aas-reference-desktop-nav/);
  assert.match(css, /\.aas-desktop-nav-customizer/);
  assert.match(css, /\.aas-reference-mobile-main-nav \{\s*display: none;/);
  assert.match(layout, /phase36-desktop-nav\.css/);

  assert.doesNotMatch(`${prefs}\n${shell}`, /sb_secret_|service[_-]?role|sk_(?:live|test)_|whsec_/i);
});


test("manual quick guide and readability layer are loaded for light user surfaces", async () => {
  const [manual, css, layout] = await Promise.all([
    read("app/manual/page.tsx"),
    read("app/phase39-readability.css"),
    read("app/layout.tsx"),
  ]);

  assert.match(manual, /help-quick-guide/);
  assert.match(manual, /help-when/);
  assert.match(manual, /help-card-links/);
  assert.match(css, /--aas-muted: #536b89/);
  assert.match(css, /\.help-quick-grid/);
  assert.match(css, /\.note-ai-easy-import/);
  assert.match(css, /font-size: 11px/);
  assert.match(layout, /phase39-readability\.css/);
  assert.ok(layout.indexOf("phase38-note-operations.css") < layout.indexOf("phase39-readability.css"));
});


test("home and feature screens cannot diverge because both render the same shared mobile nav", async () => {
  const [home, create, ranking, profile, shell, persistent, shared] = await Promise.all([
    read("components/phase18-beginner-home.tsx"),
    read("components/phase11-create-page.tsx"),
    read("app/ranking/page.tsx"),
    read("app/profile/page.tsx"),
    read("components/aas-reference-shell.tsx"),
    read("components/persistent-mobile-nav.tsx"),
    read("components/shared-mobile-bottom-nav.tsx"),
  ]);

  for (const source of [home, create, ranking, profile]) {
    assert.match(source, /AasReferenceBottomNav/);
  }
  assert.match(shell, /<SharedMobileBottomNav/);
  assert.match(persistent, /<AasReferenceBottomNav/);
  assert.equal((shared.match(/<nav className=\{navClass\}/g) ?? []).length, 1);
  assert.doesNotMatch(home, /CANONICAL_NAV_ITEMS|DEFAULT_MOBILE_NAV_ITEMS/);
  assert.doesNotMatch(create, /CANONICAL_NAV_ITEMS|DEFAULT_MOBILE_NAV_ITEMS/);
  assert.doesNotMatch(ranking, /CANONICAL_NAV_ITEMS|DEFAULT_MOBILE_NAV_ITEMS/);
  assert.doesNotMatch(profile, /CANONICAL_NAV_ITEMS|DEFAULT_MOBILE_NAV_ITEMS/);
});

test("article library home action clears the internal library section instead of only changing the URL", async () => {
  const [home, shell, shared] = await Promise.all([
    read("components/phase18-beginner-home.tsx"),
    read("components/aas-reference-shell.tsx"),
    read("components/shared-mobile-bottom-nav.tsx"),
  ]);

  assert.match(home, /onHome=\{\(\) => openSection\("home"\)\}/);
  assert.match(home, /window\.history\.replaceState\(\{\}, "", next === "library" \? "\/\?section=library" : "\/"\)/);
  assert.match(shell, /onHome\?: \(\) => void/);
  assert.match(shell, /onClick=\{onHome\}/);
  assert.match(shared, /onHome\?: \(\) => void/);
  assert.match(shared, /onClick=\{onHome\}/);
});

test("mobile nav choices are isolated between accounts on the same device", async () => {
  const [prefs, shared, customizer, settings] = await Promise.all([
    read("lib/mobile-nav-preference.ts"),
    read("components/shared-mobile-bottom-nav.tsx"),
    read("components/mobile-nav-customizer.tsx"),
    read("components/pwa-settings-page.tsx"),
  ]);

  assert.match(prefs, /mobileNavItemsStorageKey\(userId\?: string \| null\)/);
  assert.match(prefs, /MOBILE_NAV_ITEMS_KEY.*normalized/);
  assert.match(prefs, /MobileNavItemsPreferenceEventDetail/);
  assert.match(shared, /detail\.userId !== userId/);
  assert.match(customizer, /ログイン中のユーザーごとに保存されます/);
  assert.match(settings, /profile\s*\?\s*<MobileNavCustomizer userId=\{profile\.id\} isAdmin=/);
});


test("admin mobile navigation tools are selectable only for active admins and mobile top shortcuts are hidden", async () => {
  const [prefs, shared, customizer, settings, topbar, css, guard] = await Promise.all([
    read("lib/mobile-nav-preference.ts"),
    read("components/shared-mobile-bottom-nav.tsx"),
    read("components/mobile-nav-customizer.tsx"),
    read("components/pwa-settings-page.tsx"),
    read("components/admin-home-topbar.tsx"),
    read("app/phase24-admin-promotion.css"),
    read("components/admin-route-guard.tsx"),
  ]);

  for (const key of ["adminDashboard", "adminUsers", "adminFree", "adminSales", "adminReleases", "adminMfa", "adminOperations"]) {
    assert.match(prefs, new RegExp(key));
  }
  for (const href of ["/admin", "/admin/users", "/admin/free-trial", "/admin/sales", "/admin/releases", "/admin/security", "/admin/operations"]) {
    assert.match(prefs, new RegExp(href.replaceAll("/", "\\/")));
  }

  assert.match(prefs, /ADMIN_MOBILE_NAV_ITEM_OPTIONS/);
  assert.match(prefs, /mobileNavOptionsFor\(isAdmin: boolean\)/);
  assert.match(prefs, /normalizeMobileNavItems\(value: unknown, isAdmin = false\)/);
  assert.match(prefs, /allowedKeys = isAdmin/);
  assert.match(prefs, /return isAdmin \? MOBILE_NAV_ITEM_OPTIONS : USER_MOBILE_NAV_ITEM_OPTIONS/);

  assert.match(shared, /useSharedAccessState\(\)/);
  assert.match(shared, /const userId = state\.kind === "ready" \? state\.profile\.id : ""/);
  assert.match(shared, /const isAdmin = state\.kind === "ready" && state\.profile\.role === "admin" && state\.profile\.status === "active"/);
  assert.match(shared, /readMobileNavItems\(userId, isAdmin\)/);
  assert.match(shared, /normalizeMobileNavItems\(detail\.items, isAdmin\)/);
  assert.doesNotMatch(shared, /select\("id,role,status"\)|setIsAdmin\(/);

  assert.match(customizer, /mobileNavOptionsFor\(isAdmin\)/);
  assert.match(customizer, /管理者アカウントでは/);
  assert.match(customizer, /activeな管理者にだけ表示されます/);
  assert.match(settings, /profile\.role === "admin" && profile\.status === "active"/);

  assert.match(topbar, /useSharedAccessState\(\)/);
  assert.match(topbar, /state\.profile\.role === "admin"/);
  assert.match(topbar, /state\.profile\.status === "active"/);
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*\.admin-home-topbar[\s\S]*display: none/);

  assert.match(guard, /role/);
  assert.match(guard, /admin/);
  assert.match(guard, /status/);
  assert.doesNotMatch(`${prefs}\n${shared}\n${customizer}\n${settings}`, /sb_secret_|service[_-]?role|sk_(?:live|test)_|whsec_/i);
});
