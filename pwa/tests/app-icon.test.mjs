import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));

test("AAS uses the high-resolution Axia PNG for installed, desktop, and mobile icons", async () => {
  const [iconPng, manifestRaw, layout] = await Promise.all([
    readFile(path.join(pwaRoot, "public/aas-axia-icon-512.png")),
    readFile(path.join(pwaRoot, "public/manifest.webmanifest"), "utf8"),
    readFile(path.join(pwaRoot, "app/layout.tsx"), "utf8"),
  ]);

  assert.equal(iconPng[0], 0x89);
  assert.equal(iconPng.subarray(1, 4).toString("ascii"), "PNG");
  assert.ok(iconPng.byteLength > 20_000);

  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.name, "AI Action Studio");
  assert.equal(manifest.background_color, "#f6f9ff");
  assert.equal(manifest.theme_color, "#f6f9ff");
  assert.deepEqual(manifest.icons, [
    {
      src: "/aas-axia-icon-512.png?v=20260928-axia-v1",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ]);

  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest\?v=20260928-axia-v1"/);
  assert.match(layout, /icon:\s*"\/aas-axia-icon-512\.png\?v=20260928-axia-v1"/);
  assert.match(layout, /shortcut:\s*"\/aas-axia-icon-512\.png\?v=20260928-axia-v1"/);
  assert.match(layout, /apple:\s*"\/aas-axia-icon-512\.png\?v=20260928-axia-v1"/);
  assert.doesNotMatch(layout, /aas-app-icon\.svg/);
  assert.doesNotMatch(manifestRaw, /rumo-v1/);
});
