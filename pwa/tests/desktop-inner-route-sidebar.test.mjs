import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("desktop navigation stays bottom on Home and becomes a left rail on inner routes", async () => {
  const [shell, css] = await Promise.all([
    readRepo("pwa/components/aas-reference-shell.tsx"),
    readRepo("pwa/app/phase36-desktop-nav.css"),
  ]);

  assert.match(shell, /usePathname/);
  assert.match(shell, /pathname === "\/"/);
  assert.match(shell, /"aas-reference-desktop-nav side"/);
  assert.match(shell, /className=\{desktopNavClassName\}/);

  assert.match(css, /\.aas-reference-desktop-nav\.side/);
  assert.match(css, /body:has\(\.aas-reference-desktop-nav\.side\)/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /flex-direction:\s*column/);
  assert.match(css, /@media \(min-width: 900px\)/);
});
