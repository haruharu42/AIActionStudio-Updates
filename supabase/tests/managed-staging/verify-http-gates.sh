#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${API_URL:-http://127.0.0.1:54321}"
FUNCTION_LOG="${TMPDIR:-/tmp}/aas-managed-staging-functions.log"
RELEASE_BODY="${TMPDIR:-/tmp}/aas-release-unauth-body.json"
KNOWLEDGE_BODY="${TMPDIR:-/tmp}/aas-knowledge-unauth-body.json"

supabase functions serve >"$FUNCTION_LOG" 2>&1 &
FUNCTIONS_PID=$!

cleanup() {
  kill "$FUNCTIONS_PID" >/dev/null 2>&1 || true
  wait "$FUNCTIONS_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

knowledge_code="000"
for _ in $(seq 1 60); do
  knowledge_code=$(curl -sS -o "$KNOWLEDGE_BODY" -w '%{http_code}'     -X POST     -H 'Content-Type: application/json'     --data '{}'     "$BASE_URL/functions/v1/knowledge-research-worker" || true)

  if [[ "$knowledge_code" == "401" ]]; then
    break
  fi

  if ! kill -0 "$FUNCTIONS_PID" >/dev/null 2>&1; then
    echo "Edge Function server exited before Knowledge Worker became ready." >&2
    cat "$FUNCTION_LOG" >&2 || true
    exit 1
  fi

  sleep 1
done

if [[ "$knowledge_code" != "401" ]]; then
  echo "Expected tokenless Knowledge Worker POST to settle on 401, got $knowledge_code." >&2
  cat "$KNOWLEDGE_BODY" >&2 || true
  cat "$FUNCTION_LOG" >&2 || true
  exit 1
fi

release_code=$(curl -sS -o "$RELEASE_BODY" -w '%{http_code}'   "$BASE_URL/functions/v1/pwa-release-deploy" || true)

if [[ "$release_code" != "401" ]]; then
  echo "Expected unauthenticated release Worker GET to return 401, got $release_code." >&2
  cat "$RELEASE_BODY" >&2 || true
  cat "$FUNCTION_LOG" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"unauthorized"' "$KNOWLEDGE_BODY"; then
  echo "Knowledge Worker did not return the expected fail-closed unauthorized body." >&2
  cat "$KNOWLEDGE_BODY" >&2 || true
  exit 1
fi

state=$(psql "$DB_URL" -At -F '|' -v ON_ERROR_STOP=1 <<'SQL'
select
  (select count(*) from public.knowledge_automation_sources),
  (select count(*) from public.knowledge_automation_runs),
  (select count(*) from public.knowledge_automation_candidates),
  (select enabled from public.knowledge_automation_settings where id=1),
  (select ai_enrichment_enabled from public.knowledge_automation_settings where id=1),
  (select ai_gemini_daily_count from public.knowledge_automation_settings where id=1),
  coalesce((select last_worker_invoked_at::text from public.knowledge_automation_settings where id=1),'NULL');
SQL
)

if [[ "$state" != "0|0|0|f|f|0|NULL" ]]; then
  echo "Rejected requests changed managed-Staging state: $state" >&2
  exit 1
fi

echo "PASS: release JWT gate and Knowledge worker-token gate fail closed with no DB side effects."
