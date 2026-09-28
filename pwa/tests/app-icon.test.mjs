import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));

function pngSize(buffer) {
  assert.equal(buffer[0], 0x89);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("AAS generates high-resolution Axia icons for desktop, PWA, iPhone, and notifications", async () => {
  const [icon180, icon192, icon512, manifestRaw, layout, generator] = await Promise.all([
    readFile(path.join(pwaRoot, "public/aas-axia-icon-180.png")),
    readFile(path.join(pwaRoot, "public/aas-axia-icon-192.png")),
    readFile(path.join(pwaRoot, "public/aas-axia-icon-512.png")),
    readFile(path.join(pwaRoot, "public/manifest.webmanifest"), "utf8"),
    readFile(path.join(pwaRoot, "app/layout.tsx"), "utf8"),
    readFile(path.join(pwaRoot, "scripts/generate-app-icons.mjs"), "utf8"),
  ]);

  assert.deepEqual(pngSize(icon180), { width: 180, height: 180 });
  assert.deepEqual(pngSize(icon192), { width: 192, height: 192 });
  assert.deepEqual(pngSize(icon512), { width: 512, height: 512 });
  assert.ok(icon180.byteLength > 1_000);
  assert.ok(icon192.byteLength > 1_000);
  assert.ok(icon512.byteLength > 2_000);

  assert.match(generator, /aas-axia-app-icon-v1\.svg/);
  assert.match(generator, /sharp\(source, \{ density: 384 \}\)/);
  assert.match(generator, /stats\.entropy < 3/);

  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.name, "AI Action Studio");
  assert.equal(manifest.background_color, "#f6f9ff");
  assert.equal(manifest.theme_color, "#f6f9ff");
  assert.deepEqual(manifest.icons, [
    {
      src: "/aas-axia-icon-192.png?v=20260928-axia-v2",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/aas-axia-icon-512.png?v=20260928-axia-v2",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ]);

  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest\?v=20260928-axia-v2"/);
  assert.match(layout, /icon:\s*"\/aas-axia-icon-192\.png\?v=20260928-axia-v2"/);
  assert.match(layout, /shortcut:\s*"\/aas-axia-icon-192\.png\?v=20260928-axia-v2"/);
  assert.match(layout, /apple:\s*"\/aas-axia-icon-180\.png\?v=20260928-axia-v2"/);
  assert.doesNotMatch(layout, /aas-app-icon\.svg/);
  assert.doesNotMatch(manifestRaw, /rumo-v1/);
});
