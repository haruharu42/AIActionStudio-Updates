import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));

function pngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("AAS uses high-resolution Axia artwork for installed and browser app icons", async () => {
  const [icon192, icon512, manifestRaw, layout] = await Promise.all([
    readFile(path.join(pwaRoot, "public/icon-192.png")),
    readFile(path.join(pwaRoot, "public/icon-512.png")),
    readFile(path.join(pwaRoot, "public/manifest.webmanifest"), "utf8"),
    readFile(path.join(pwaRoot, "app/layout.tsx"), "utf8"),
  ]);

  assert.deepEqual(pngSize(icon192), { width: 192, height: 192 });
  assert.deepEqual(pngSize(icon512), { width: 512, height: 512 });

  // Guard against accidentally restoring tiny placeholder assets.
  assert.ok(icon192.byteLength > 20_000);
  assert.ok(icon512.byteLength > 100_000);

  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.name, "AI Action Studio");
  assert.ok(manifest.icons.some((icon) => icon.src === "/icon-192.png" && icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.src === "/icon-512.png" && icon.sizes === "512x512"));

  assert.match(layout, /icon:\s*"\/icon-192\.png"/);
  assert.match(layout, /shortcut:\s*"\/icon-192\.png"/);
  assert.match(layout, /apple:\s*"\/icon-192\.png"/);
  assert.doesNotMatch(layout, /favicon\.svg/);
});
