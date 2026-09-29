import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin dashboard groups are independently collapsible and closed by default", () => {
  const page = read("app/admin/page.tsx");
  const css = read("app/globals.css");

  assert.match(page, /<details className="admin-dashboard-collapsible">/);
  assert.match(page, /管理ツールの使い方/);
  assert.match(page, /admin-dashboard-collapsible admin-dashboard-group/);
  assert.doesNotMatch(page, /<details className="admin-dashboard-collapsible"\s+open/);
  assert.doesNotMatch(page, /<details className="admin-dashboard-collapsible admin-dashboard-group"\s+open/);
  assert.match(page, /開く ▼/);

  assert.match(css, /\.admin-dashboard-collapsible-summary/);
  assert.match(css, /\.admin-dashboard-collapsible\[open\] \.admin-dashboard-collapsible-state/);
  assert.match(css, /閉じる ▲/);
});
