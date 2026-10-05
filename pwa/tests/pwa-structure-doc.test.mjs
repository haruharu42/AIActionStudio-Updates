import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("PWA structure guide records the enforced runtime boundaries", async () => {
  const guide = await readFile(path.join(root, "STRUCTURE.md"), "utf8");
  assert.match(guide, /components\/phase6-app\.tsx/);
  assert.match(guide, /components\/phase18-beginner-home\.tsx/);
  assert.match(guide, /legacy dashboards/);
  assert.match(guide, /lib\/access-control\.ts/);
  assert.match(guide, /lib\/article-create-draft\.ts/);
  assert.match(guide, /components\/article-create\/magazine-planner\.tsx/);
  assert.match(guide, /components\/action-prompt-library\//);
  assert.match(guide, /components\/action-prompt-library-page\.tsx/);
  assert.match(guide, /features\/prompts\//);
  assert.match(guide, /components\/aas-reference-shell\.tsx/);
  assert.match(guide, /lib\/magazine-planner\.ts/);
  assert.match(guide, /existing article Workspace contract/);
  assert.match(guide, /components\/article-library\//);
  assert.match(guide, /components\/phase7-library\.tsx/);
  assert.match(guide, /lib\/article-library-view\.ts/);
  assert.match(guide, /ignore stale responses/);
  assert.match(guide, /components\/admin-users\//);
  assert.match(guide, /components\/pwa-admin-users-page\.tsx/);
  assert.match(guide, /components\/admin-infrastructure-usage-page\.tsx/);
  assert.match(guide, /lib\/infrastructure-usage\.ts/);
  assert.match(guide, /phase53-crystal-ui\.css/);
  assert.match(guide, /public\/aas-mirea-rupii-hero\.svg/);
  assert.match(guide, /lib\/admin-users-view\.ts/);
  assert.match(guide, /Browser-stored data is untrusted/);
  assert.match(guide, /UI components must not duplicate profile ownership or PWA entitlement RPC logic/);
  assert.match(guide, /Presentation panels receive data and callbacks/);
  assert.match(guide, /selection changes do not accidentally trigger duplicate full-page fetches/);
});
