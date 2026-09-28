import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("login hero renders as one masked composition on desktop and mobile", async () => {
  const [css, hero] = await Promise.all([
    read("app/phase53-crystal-ui.css"),
    read("public/aas-login-hero-hq.svg"),
  ]);

  assert.match(css, /auth-character-visual/);
  assert.match(css, /aas-login-hero-hq\.svg\?v=20260928-natural-v3/);
  assert.match(css, /background-size: contain/);
  assert.match(css, /mask-image: radial-gradient/);
  assert.doesNotMatch(css, /url\("\/aas-login-tile-1\.svg\?v=/);
  assert.doesNotMatch(css, /background-position: left top, right top, left bottom, right bottom/);

  assert.match(hero, /viewBox="0 0 690 750"/);
  for (const tile of [1, 2, 3, 4]) {
    assert.match(hero, new RegExp(`aas-login-tile-${tile}\\.svg`));
  }

  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?auth-character-visual[\s\S]*?background-size: contain/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?auth-character-visual[\s\S]*?mask-image: radial-gradient/);
});
