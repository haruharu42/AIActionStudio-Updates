import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("desktop navigation stays visible on signed-in tool routes while mobile visibility remains configurable", async () => {
  const [persistent, shell, css] = await Promise.all([
    read("components/persistent-mobile-nav.tsx"),
    read("components/aas-reference-shell.tsx"),
    read("app/phase53-crystal-ui.css"),
  ]);

  assert.match(persistent, /const desktopNavActive = signedIn && !hiddenRoute/);
  assert.match(persistent, /const mobileNavVisible = alwaysShow \|\| pathname === "\/settings"/);
  assert.match(persistent, /const renderGlobalNav = desktopNavActive && !referenceShellRoute/);
  assert.match(persistent, /classList\.toggle\("aas-desktop-nav-active", desktopNavActive\)/);
  assert.match(persistent, /showMobile=\{mobileNavVisible\}/);
  assert.doesNotMatch(
    persistent,
    /signedIn && !hiddenRoute && !referenceShellRoute && \(alwaysShow \|\| pathname === "\/settings"\)/,
  );

  assert.match(shell, /showMobile = true/);
  assert.match(shell, /showMobile\?: boolean/);
  assert.match(shell, /\{showMobile \? \(/);

  assert.match(css, /Phase 53\.2: persistent desktop left navigation/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*body\.aas-crystal-theme\.aas-desktop-nav-active/);
  assert.match(css, /padding-left: 212px/);
  assert.match(css, /\.aas-reference-desktop-nav \{[\s\S]*left: 16px;[\s\S]*top: 16px;[\s\S]*grid-auto-flow: row;/);
  assert.match(css, /\.persistent-mobile-nav-spacer \{[\s\S]*display: none !important;/);
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*\.aas-reference-desktop-nav/);
});
