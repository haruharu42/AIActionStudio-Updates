import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("legal and support route metadata use the current AI Action Studio brand", async () => {
  const routes = await Promise.all([
    read("app/commercial-transactions/page.tsx"),
    read("app/support/page.tsx"),
    read("app/terms/page.tsx"),
    read("app/privacy/page.tsx"),
    read("app/ai-terms/page.tsx"),
    read("app/plans/page.tsx"),
    read("app/billing/page.tsx"),
  ]);

  for (const route of routes) {
    assert.match(route, /AI Action Studio/);
    assert.doesNotMatch(route, /AI記事スタジオ|AI Article Studio/);
  }
});
