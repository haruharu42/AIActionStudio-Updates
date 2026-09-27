import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Axia and Rumo are local presentation assets and the crystal theme loads last", async () => {
  const [layout, css, asset, hub] = await Promise.all([
    read("app/layout.tsx"),
    read("app/phase53-crystal-ui.css"),
    read("public/aas-axia-rumo-hero.svg"),
    read("components/action-studio-home-hub.tsx"),
  ]);

  assert.ok(layout.lastIndexOf('import "./phase53-crystal-ui.css";') > layout.lastIndexOf('import "./phase52-infrastructure-usage.css";'));
  assert.doesNotMatch(layout, /phase53-crystal-character-ui/);
  assert.match(asset, /data:image\/webp;base64,/);
  assert.doesNotMatch(asset, /<image[^>]+href="https?:\/\//);
  assert.match(css, /url\("\/aas-axia-rumo-hero\.svg"\)/);
  assert.match(css, /url\("\/aas-login-tile-1\.svg\?v=20260927-hq-v1"\)/);
  assert.match(css, /url\("\/aas-login-tile-4\.svg\?v=20260927-hq-v1"\)/);
  assert.match(css, /\.auth-character-visual[\s\S]*?width:\s*min\(72%, 690px\)/);
  assert.match(css, /\.auth-character-visual[\s\S]*?background-size:\s*50% 50%/);
  assert.match(css, /\.action-studio-hero::after[\s\S]*?background:\s*url\("\/aas-axia-rumo-hero\.svg"\) center right \/ contain no-repeat/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.auth-character-visual[\s\S]*?background-size:\s*contain/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.action-studio-hero::after[\s\S]*?background-size:\s*contain/);
  assert.match(hub, /アクシア × ルーモ/);
  assert.match(hub, /今日はAIで何を進めますか？/);
  assert.doesNotMatch(`${css}\n${asset}\n${hub}`, /service[_-]?role|sb_secret_|ghp_|github_token/i);
});

test("home puts user and article library before lower quick actions", async () => {
  const home = await read("components/phase18-beginner-home.tsx");
  const hero = home.indexOf("<ActionStudioHomeHero />");
  const creator = home.indexOf('className="reference-creator-card"');
  const library = home.indexOf("記事ライブラリ / noteマガジン");
  const quick = home.indexOf("<ActionStudioQuickActions");
  const ranking = home.indexOf("週間ランキング");

  assert.ok(creator >= 0);
  assert.ok(library > creator);
  assert.ok(hero > library);
  assert.ok(quick > hero);
  assert.ok(quick > ranking);
});

test("crystal UI styles desktop, mobile, controls and navigation without replacing behavior", async () => {
  const css = await read("app/phase53-crystal-ui.css");

  for (const selector of [
    ".aas-reference-header",
    ".action-studio-hero",
    ".action-studio-primary-grid",
    ".action-studio-card-grid",
    ".reference-creator-card",
    ".reference-home-section",
    ".aas-reference-bottom-nav",
    "main select",
    "main textarea",
    ".side-hustle-wizard-card",
    ".tool-card",
    ".admin-panel",
    ".editor-card",
    ".infra-summary-grid",
    ".reference-home > .aas-reference-desktop-nav",
  ]) {
    assert.ok(css.includes(selector), `missing crystal selector: ${selector}`);
  }

  assert.match(css, /@media \(min-width: 1100px\)[\s\S]*?\.reference-home > \.aas-reference-desktop-nav/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.action-studio-card-grid[\s\S]*?grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /font-size: 16px/);
});

test("hero primary cards and lower quick actions map to implemented AAS routes", async () => {
  const hub = await read("components/action-studio-home-hub.tsx");
  for (const route of [
    'href: "/create"',
    'href: "/images"',
    'href: "/prompts"',
    'href: "/?section=library"',
    'href: "/sns"',
    'href: "/account-design"',
    'href: "/workflow"',
    'href: "/note-operations"',
    'href: "/tools"',
    'href: "/admin"',
  ]) {
    assert.ok(hub.includes(route), `missing route: ${route}`);
  }
  assert.match(hub, /const cards:[\s\S]*?showAdmin/);
});
