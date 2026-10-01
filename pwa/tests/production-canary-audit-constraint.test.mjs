import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("Production Canary audit constraint allows all emitted lifecycle actions", async () => {
  const migration = await readFile(
    path.join(repoRoot, "supabase/migrations/20261001120500_extend_release_audit_actions_for_canary.sql"),
    "utf8",
  );

  for (const action of [
    "canary_deployment_requested",
    "canary_deployment_dispatched",
    "canary_deployment_running",
    "canary_deployment_succeeded",
    "canary_deployment_failed",
    "canary_verified",
    "public_deployment_requested",
    "public_deployment_dispatched",
    "public_deployment_running",
    "public_deployment_succeeded",
    "public_deployment_failed",
  ]) {
    assert.match(migration, new RegExp("'" + action + "'"));
  }

  for (const legacy of [
    "candidate_created",
    "candidate_promoted_to_tester",
    "tester_added",
    "tester_removed",
    "published",
    "user_accepted",
    "rolled_back",
    "deployment_requested",
    "deployment_dispatched",
    "deployment_running",
    "deployment_succeeded",
    "deployment_failed",
  ]) {
    assert.match(migration, new RegExp("'" + legacy + "'"));
  }
});
