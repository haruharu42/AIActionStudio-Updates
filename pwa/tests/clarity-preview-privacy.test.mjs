import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const clarity = fs.readFileSync(new URL("../components/clarity-preview-analytics.tsx", import.meta.url), "utf8");
const adminLayout = fs.readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");
const envExample = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

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

test("Admin routes are explicitly masked from Clarity", () => {
  assert.match(adminLayout, /data-clarity-mask="true"/);
});
