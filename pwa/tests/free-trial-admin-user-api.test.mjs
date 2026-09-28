import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("free-trial admin uses the current PWA user admin API", async () => {
  const [page, panel] = await Promise.all([
    read("components/free-trial-admin-page.tsx"),
    read("components/free-trial-admin-panel.tsx"),
  ]);

  assert.match(page, /listPwaAdminUsers/);
  assert.match(page, /type PwaAdminUser/);
  assert.match(panel, /import type \{ PwaAdminUser \} from "@\/lib\/pwa-admin-users"/);
  assert.doesNotMatch(page, /phase10-admin/);
  assert.doesNotMatch(panel, /phase10-admin/);
});
