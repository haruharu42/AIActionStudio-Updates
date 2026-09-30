#!/usr/bin/env bash
# Real local Supabase Auth + Edge Function check for pwa-release-deploy.
# No GitHub token, no remote Supabase, no dispatch.
set -euo pipefail

: "${API_URL:?API_URL missing}"
: "${DB_URL:?DB_URL missing}"
: "${ANON_KEY:?ANON_KEY missing}"
: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY missing}"

ADMIN_EMAIL="aas-release-admin@example.test"
USER_EMAIL="aas-release-user@example.test"
PASSWORD="LocalOnly-AAS-Release-2026!"

create_user() {
  local email="$1"
  curl --fail-with-body --silent --show-error     -X POST "$API_URL/auth/v1/admin/users"     -H "apikey: $SERVICE_ROLE_KEY"     -H "Authorization: Bearer $SERVICE_ROLE_KEY"     -H "Content-Type: application/json"     -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true}"
}

sign_in() {
  local email="$1"
  curl --fail-with-body --silent --show-error     -X POST "$API_URL/auth/v1/token?grant_type=password"     -H "apikey: $ANON_KEY"     -H "Content-Type: application/json"     -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}"
}

admin_json="$(create_user "$ADMIN_EMAIL")"
user_json="$(create_user "$USER_EMAIL")"
admin_id="$(jq -er '.id' <<<"$admin_json")"
user_id="$(jq -er '.id' <<<"$user_json")"

psql "$DB_URL" -v ON_ERROR_STOP=1 -v admin_id="$admin_id" -v user_id="$user_id" <<'SQL' >/dev/null
insert into public.profiles(id,role,status)
values (:'admin_id'::uuid,'admin','active'), (:'user_id'::uuid,'user','active');
SQL

admin_token="$(sign_in "$ADMIN_EMAIL" | jq -er '.access_token')"
user_token="$(sign_in "$USER_EMAIL" | jq -er '.access_token')"
FUNCTION_URL="$API_URL/functions/v1/pwa-release-deploy"

invoke_readiness() {
  local token="$1"
  local output="$2"
  curl --silent --show-error -o "$output" -w '%{http_code}'     -X POST "$FUNCTION_URL"     -H "apikey: $ANON_KEY"     -H "Authorization: Bearer $token"     -H "Content-Type: application/json"     -d '{"action":"github_readiness"}'
}

# Normal authenticated users must be rejected by the internal admin RPC before any GitHub check.
code="$(invoke_readiness "$user_token" /tmp/aas-release-user.json)"
if [[ "$code" != "403" ]]; then
  echo "FAIL: normal user readiness request returned HTTP $code, expected 403" >&2
  cat /tmp/aas-release-user.json >&2
  exit 1
fi

# Admin can inspect capability safely. With no token configured, no GitHub request or dispatch occurs.
code="$(invoke_readiness "$admin_token" /tmp/aas-release-admin.json)"
if [[ ! "$code" =~ ^2 ]]; then
  echo "FAIL: admin readiness request failed HTTP $code" >&2
  cat /tmp/aas-release-admin.json >&2
  exit 1
fi
jq -e '
  .supported == true and
  .configured == false and
  .repositoryReadable == false and
  .workflowReadable == false and
  .dispatchPermissionTested == false
' /tmp/aas-release-admin.json >/dev/null

# Status path advertises readiness support while remaining read-only.
code="$(curl --silent --show-error -o /tmp/aas-release-status.json -w '%{http_code}'   -X POST "$FUNCTION_URL"   -H "apikey: $ANON_KEY"   -H "Authorization: Bearer $admin_token"   -H "Content-Type: application/json"   -d '{"action":"status"}')"
if [[ ! "$code" =~ ^2 ]]; then
  echo "FAIL: admin status failed HTTP $code" >&2
  cat /tmp/aas-release-status.json >&2
  exit 1
fi
jq -e '
  .configured == false and
  .supportsGithubReadiness == true and
  .previewBranch == "main" and
  (.deployments | type == "array") and
  (.deployments | length == 0)
' /tmp/aas-release-status.json >/dev/null

count="$(psql "$DB_URL" -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from public.app_release_deployments;')"
if [[ "$count" != "0" ]]; then
  echo "FAIL: read-only diagnostics unexpectedly mutated release deployments" >&2
  exit 1
fi

echo "PASS: release Worker real local JWT admin gate and no-token read-only diagnostics."
