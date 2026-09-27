import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));

test("AAS uses the Rumo SVG for installed and browser app icons", async () => {
  const [iconSvg, manifestRaw, layout] = await Promise.all([
    readFile(path.join(pwaRoot, "public/aas-app-icon.svg"), "utf8"),
    readFile(path.join(pwaRoot, "public/manifest.webmanifest"), "utf8"),
    readFile(path.join(pwaRoot, "app/layout.tsx"), "utf8"),
  ]);

  assert.match(iconSvg, /AI Action Studio ルーモ アイコン/);
  assert.match(iconSvg, /data:image\/webp;base64,/);
  assert.ok(iconSvg.length > 20_000);

  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.name, "AI Action Studio");
  assert.equal(manifest.background_color, "#f6f9ff");
  assert.equal(manifest.theme_color, "#f6f9ff");
  assert.ok(manifest.icons.some((icon) =>
    icon.src === "/aas-app-icon.svg?v=20260927-rumo-v1"
    && icon.sizes === "any"
    && icon.type === "image/svg+xml"
    && icon.purpose.includes("maskable")
  ));

  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest\?v=20260927-rumo-v1"/);
  assert.match(layout, /icon:\s*"\/aas-app-icon\.svg\?v=20260927-rumo-v1"/);
  assert.match(layout, /shortcut:\s*"\/aas-app-icon\.svg\?v=20260927-rumo-v1"/);
  assert.match(layout, /apple:\s*"\/aas-app-icon\.svg\?v=20260927-rumo-v1"/);
  assert.doesNotMatch(layout, /icon-192\.png\?v=20260927-axia-v2/);
});
