import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const clarity = read("../components/clarity-preview-analytics.tsx");
const envExample = read("../.env.example");
const maskedRoutes = [
  "../app/admin/layout.tsx",
  "../app/create/page.tsx",
  "../app/prompts/page.tsx",
  "../app/account-design/page.tsx",
  "../app/billing/page.tsx",
  "../app/support/page.tsx",
];

test("Clarity analytics stays opt-in and non-production only", () => {
  assert.match(clarity, /NEXT_PUBLIC_AAS_CLARITY_ENABLED === "true"/);
  assert.match(clarity, /NEXT_PUBLIC_AAS_CLARITY_PROJECT_ID/);
  assert.match(clarity, /audience !== "production" && audience !== "public"/);
  assert.match(envExample, /NEXT_PUBLIC_AAS_CLARITY_ENABLED=false/);
});

test("Clarity starts with analytics and ad consent denied", () => {
  assert.match(clarity, /analytics_storage: "denied"/);
  assert.match(clarity, /ad_storage: "denied"/);
});

test("Sensitive AAS routes are explicitly masked from Clarity", () => {
  for (const route of maskedRoutes) {
    assert.match(read(route), /data-clarity-mask="true"/, route);
  }
});
