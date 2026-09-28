import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");

test("home prioritizes creator through article library before the AAS hero and keeps frequent actions lower", async () => {
  const home = await read("components/phase18-beginner-home.tsx");

  const creator = home.indexOf('className="reference-creator-card"');
  const library = home.indexOf("記事ライブラリ / noteマガジン");
  const hero = home.indexOf("<ActionStudioHomeHero />");
  const ranking = home.indexOf("週間ランキング");
  const quick = home.indexOf("<ActionStudioQuickActions");

  assert.ok(creator >= 0);
  assert.ok(library > creator);
  assert.ok(hero > library);
  assert.ok(ranking > hero);
  assert.ok(quick > ranking);
});

test("Axia and Rumo hero is bundled locally and used by the home hero", async () => {
  const [asset, css, hub, layout] = await Promise.all([
    read("public/aas-axia-rumo-hero.svg"),
    read("app/phase53-crystal-ui.css"),
    read("components/action-studio-home-hub.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(asset, /AAS アクシアとルーモ/);
  assert.match(asset, /data:image\/webp;base64,/);
  assert.match(css, /url\("\/aas-axia-rumo-hero\.svg"\)/);
  assert.match(hub, /アクシア × ルーモ/);
  assert.match(hub, /今日はAIで何を進めますか？/);
  assert.match(layout, /phase53-crystal-ui\.css/);
  assert.match(layout, /className="aas-crystal-theme"/);
});

test("desktop and mobile keep separate responsive treatments without replacing route behavior", async () => {
  const [css, shell] = await Promise.all([
    read("app/phase53-crystal-ui.css"),
    read("components/aas-reference-shell.tsx"),
  ]);

  assert.match(css, /@media \(min-width: 1100px\)/);
  assert.match(css, /\.reference-home > \.aas-reference-desktop-nav/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /\.aas-reference-bottom-nav/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(shell, /SharedMobileBottomNav/);
  assert.match(shell, /DEFAULT_DESKTOP_NAV_ITEMS/);
  assert.match(shell, /writeDesktopNavItems/);
});

test("crystal UI restyles dropdowns text inputs textareas cards and navigation", async () => {
  const css = await read("app/phase53-crystal-ui.css");

  for (const token of [
    "main select",
    "main input",
    "main textarea",
    ".primary-action",
    ".tool-card",
    ".side-hustle-wizard-card",
    ".admin-panel",
    ".aas-reference-header",
    ".aas-reference-bottom-nav",
    ".reference-home > .aas-reference-desktop-nav",
  ]) {
    assert.match(css, new RegExp(escapeRegExp(token)));
  }

  assert.match(css, /appearance: none/);
  assert.match(css, /background-image:[\s\S]*linear-gradient\(45deg/);
  assert.match(css, /backdrop-filter: blur/);
});

test("new mobile defaults match the preview information architecture while preserving customization support", async () => {
  const nav = await read("lib/mobile-nav-preference.ts");

  assert.match(nav, /DEFAULT_MOBILE_NAV_ITEMS:[^\n]+\["tools", "create", "library", "settings"\]/);
  assert.match(nav, /readMobileNavItems/);
  assert.match(nav, /writeMobileNavItems/);
  assert.match(nav, /mobileNavItemsStorageKey/);
});

test("signed-out auth and access surfaces use the Axia and Rumo crystal design", async () => {
  const [app, css, layout, config, sw] = await Promise.all([
    read("components/phase6-app.tsx"),
    read("app/phase53-crystal-ui.css"),
    read("app/layout.tsx"),
    read("next.config.ts"),
    read("public/sw.js"),
  ]);

  assert.match(app, /auth-crystal-page/);
  assert.match(app, /auth-character-stage/);
  assert.match(app, /アクシア × ルーモ/);
  assert.match(app, /auth-build-stamp/);
  assert.match(css, /auth-character-visual/);
  assert.match(css, /auth-character-copy \{[\s\S]*width: min\(42%, 500px\)/);
  assert.match(css, /auth-character-visual \{[\s\S]*width: min\(48%, 580px\)[\s\S]*right: 0;/);
  assert.match(css, /url\("\/aas-login-tile-1\.svg\?v=20260927-hq-v2"\)/);
  assert.match(css, /url\("\/aas-login-tile-4\.svg\?v=20260927-hq-v2"\)/);
  assert.match(css, /background-size: 51.5% 51.4%/);
  assert.match(css, /mask-image: radial-gradient\(ellipse 76% 78% at 52% 52%/);
  assert.match(css, /auth-character-visual::before/);
  assert.match(css, /auth-character-visual::after/);
  assert.match(css, /status-card::after/);
  assert.match(css, /@media \(min-width: 901px\) and \(max-width: 1440px\)[\s\S]*auth-character-copy h1[\s\S]*auth-character-visual/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*auth-character-stage/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*auth-character-visual \{[\s\S]*position: relative;[\s\S]*width: min\(94vw, 560px\);[\s\S]*background-size: 51.5% 51.4%;/);
  assert.match(layout, /"aas-build-sha"/);
  assert.match(config, /NEXT_PUBLIC_AAS_BUILD_SHA/);
  assert.match(sw, /runtime-v11-axia-generated/);
});

test("shared header exposes build identity for live deployment verification", async () => {
  const shell = await read("components/aas-reference-shell.tsx");
  assert.match(shell, /AAS_BUILD_SHA/);
  assert.match(shell, /aas-reference-build/);
  assert.match(shell, /build \{AAS_BUILD_SHA\}/);
});

test("current implemented feature links stay wired into the redesigned home", async () => {
  const hub = await read("components/action-studio-home-hub.tsx");
  const home = await read("components/phase18-beginner-home.tsx");

  for (const route of [
    "/create",
    "/images",
    "/prompts",
    "/?section=library",
    "/sns",
    "/account-design",
    "/workflow",
    "/note-operations",
    "/tools",
    "/admin",
  ]) {
    assert.match(hub + "\n" + home, new RegExp(escapeRegExp(route)));
  }
});
