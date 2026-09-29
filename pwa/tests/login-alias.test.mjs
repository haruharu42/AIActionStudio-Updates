import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("login compatibility route redirects to the canonical AAS auth entry", async () => {
  const [login, gate] = await Promise.all([
    read("app/login/page.tsx"),
    read("components/release-audience-gate.tsx"),
  ]);
  assert.match(login, /redirect\("\/"\)/);
  const publicPreviewPaths = gate.split("\n").find((line) => line.startsWith("const ALWAYS_PUBLIC_PREVIEW_PATHS = ")) ?? "";
  assert.ok(publicPreviewPaths.includes('"/login"'));
});
