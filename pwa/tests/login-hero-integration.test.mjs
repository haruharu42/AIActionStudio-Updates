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
  assert.match(css, /aas-login-hero-hq\.svg\?v=20260928-natural-v4/);
  assert.match(css, /background-size: contain/);
  assert.match(css, /mask-image: radial-gradient/);
  assert.match(css, /ellipse 68% 73% at 52% 51%/);
  assert.doesNotMatch(css, /url\("\/aas-login-tile-1\.svg\?v=/);
  assert.doesNotMatch(css, /background-position: left top, right top, left bottom, right bottom/);
  assert.doesNotMatch(css, /51\.5% 51\.4%/);

  assert.match(hero, /viewBox="0 0 690 750"/);
  assert.doesNotMatch(hero, /aas-login-tile-/);
  assert.equal((hero.match(/data:image\\/webp;base64,/g) ?? []).length, 4);
  assert.match(hero, /id="aas-right-seam-mask"/);
  assert.match(hero, /id="aas-bottom-seam-mask"/);
  assert.match(hero, /x="335" y="0" width="355" height="385"/);
  assert.match(hero, /x="0" y="365" width="355" height="385"/);

  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?auth-character-visual[\s\S]*?background-size: contain/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?auth-character-visual[\s\S]*?mask-image: radial-gradient/);
});
