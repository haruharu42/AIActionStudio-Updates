import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shared section collapse manager is enabled globally and resets closed on each visit", () => {
  const layout = read("app/layout.tsx");
  const manager = read("components/section-collapse-manager.tsx");
  const css = read("app/globals.css");

  assert.match(layout, /SectionCollapseManager/);
  assert.match(layout, /<SectionCollapseManager \/>/);

  for (const selector of [
    "section.admin-panel",
    "section.release-admin-panel",
    "section.knowledge-admin-panel",
    "section.admin-promo-panel",
    "section.prompt-admin-panel",
    "section.creator-card",
    "section.workflow-panel",
    "section.note-ops-panel",
    "section.side-hustle-wizard-card",
    "section.account-design-panel",
    "section.support-panel",
    "section.tool-group-section",
  ]) {
    assert.ok(manager.includes(selector), `missing selector: ${selector}`);
  }

  assert.doesNotMatch(manager, /localStorage\./);
  assert.match(manager, /let collapsed = true;/);
  assert.match(manager, /aria-expanded/);
  assert.match(manager, /MutationObserver/);
  assert.match(manager, /panel\.closest\("details"\)/);

  assert.match(css, /\.aas-collapsible-panel > \.aas-section-collapse-header/);
  assert.match(css, /\.aas-collapsible-panel\.aas-section-collapsed > :not\(\.aas-section-collapse-header\)/);
  assert.match(css, /data-aas-collapse-label/);
});

test("membership sections keep their dedicated independent details controls", () => {
  const membership = read("components/admin-membership-page.tsx");
  assert.ok((membership.match(/<details className="membership-admin-item">/g) ?? []).length >= 7);
  assert.doesNotMatch(membership, /メンバーシップ管理を開く/);
});
