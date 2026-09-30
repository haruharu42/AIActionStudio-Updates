import assert from "node:assert/strict";
import test from "node:test";

const phase56Meta =
  /<meta(?=[^>]*\bname=["']aas-phase["'])(?=[^>]*\bcontent=["']56["'])[^>]*>/i;
const expectedReleaseStage = process.env.NEXT_PUBLIC_AAS_RELEASE_AUDIENCE ?? "development";
const releaseStageMeta = new RegExp(
  `<meta(?=[^>]*\\bname=["']aas-release-stage["'])(?=[^>]*\\bcontent=["']${expectedReleaseStage}["'])[^>]*>`,
  "i",
);

test("renders current Phase 56 deployment metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, phase56Meta);
  assert.match(html, releaseStageMeta);
  assert.doesNotMatch(html, /codex-preview/i);
  assert.doesNotMatch(html, /phase8-local/i);
});
