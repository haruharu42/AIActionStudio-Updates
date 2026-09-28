import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("AAS crystal theme is loaded last and uses the finalized Axia and Rumo asset", async () => {
  const [layout, css, asset] = await Promise.all([
    read("app/layout.tsx"),
    read("app/phase53-crystal-ui.css"),
    read("public/aas-axia-rumo-hero.svg"),
  ]);

  assert.match(layout, /phase52-infrastructure-usage\.css";\s*import "\.\/phase53-crystal-ui\.css"/);
  assert.match(layout, /<body className="aas-crystal-theme">/);
  assert.match(css, /url\("\/aas-axia-rumo-hero\.svg"\)/);
  assert.match(css, /\.action-studio-hero::after/);
  assert.match(css, /\.aas-reference-desktop-nav/);
  assert.match(css, /\.aas-reference-bottom-nav/);
  assert.match(css, /main select/);
  assert.match(css, /main textarea/);
  assert.match(asset, /data:image\/webp;base64,/);
});

test("home puts creator and article library before the Axia and Rumo hero and keeps quick actions lower", async () => {
  const home = await read("components/phase18-beginner-home.tsx");
  const creator = home.indexOf('className="reference-creator-card"');
  const library = home.indexOf("記事ライブラリ / noteマガジン");
  const hero = home.indexOf("<ActionStudioHomeHero />");
  const quick = home.indexOf("<ActionStudioQuickActions");

  assert.ok(creator >= 0);
  assert.ok(library > creator);
  assert.ok(hero > library);
  assert.ok(quick > hero);
});

test("crystal UI keeps desktop and mobile treatments separate", async () => {
  const css = await read("app/phase53-crystal-ui.css");

  assert.match(css, /@media \(min-width: 900px\)[\s\S]*?\.aas-reference-desktop-nav/);
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*?\.aas-reference-bottom-nav/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.action-studio-hero/);
  assert.match(css, /\.action-studio-primary-grid[\s\S]*?repeat\(4,/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.action-studio-primary-grid[\s\S]*?repeat\(2,/);
});
