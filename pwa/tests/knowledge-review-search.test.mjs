import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});
after(() => vite.close());
const { parseKnowledgeCandidateIdQuery } = await vite.ssrLoadModule("/lib/knowledge-review-search.ts");

test("candidate search accepts only explicit exact safe #ID tokens", () => {
  assert.equal(parseKnowledgeCandidateIdQuery("#73"), 73);
  assert.equal(parseKnowledgeCandidateIdQuery(" #75 "), 75);
  for (const term of ["73", "#", "#0", "#0073", "#-73", "#73abc", "#73 74", "title:73", "#99999999999999999"]) {
    assert.equal(parseKnowledgeCandidateIdQuery(term), null, term);
  }
});
