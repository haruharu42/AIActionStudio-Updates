import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("desktop inner routes use the same fixed left rail as Home without the old dock override", async () => {
  const [shell, desktopCss, crystalCss] = await Promise.all([
    readRepo("pwa/components/aas-reference-shell.tsx"),
    readRepo("pwa/app/phase36-desktop-nav.css"),
    readRepo("pwa/app/phase53-crystal-ui.css"),
  ]);

  assert.match(shell, /usePathname/);
  assert.match(shell, /pathname === "\/"/);
  assert.match(shell, /"aas-reference-desktop-nav side"/);
  assert.match(shell, /className=\{desktopNavClassName\}/);

  assert.doesNotMatch(desktopCss, /Desktop routes other than Home use a fixed left rail/);
  assert.match(crystalCss, /\.aas-reference-desktop-nav\.side/);
  assert.match(crystalCss, /body\.aas-crystal-theme:has\(\.aas-reference-desktop-nav\.side\)/);
  assert.match(crystalCss, /width:\s*188px/);
  assert.match(crystalCss, /transform:\s*none/);
  assert.match(crystalCss, /grid-auto-flow:\s*row/);
  assert.match(crystalCss, /padding-left:\s*216px/);
});
