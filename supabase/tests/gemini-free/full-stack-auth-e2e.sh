#!/usr/bin/env bash
# Full local Supabase Auth/Vault E2E for the staged Gemini migration.
# Uses disposable local users and a fake Gemini key only.
set -euo pipefail

: "${API_URL:?API_URL missing from supabase status -o env}"
: "${DB_URL:?DB_URL missing from supabase status -o env}"
: "${ANON_KEY:?ANON_KEY missing from supabase status -o env}"
: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY missing from supabase status -o env}"

ADMIN_EMAIL="aas-gemini-admin@example.test"
USER_EMAIL="aas-gemini-user@example.test"
PASSWORD="LocalOnly-AAS-Gemini-Auth-2026!"
FAKE_KEY="TEST_FAKE_GEMINI_KEY_LOCAL_ONLY"

create_user() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true}"
}

sign_in() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    -X POST "$API_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}"
}

rpc() {
  local token="$1"
  local function_name="$2"
  local body="$3"
  local output="$4"
  curl --silent --show-error \
    -o "$output" -w '%{http_code}' \
    -X POST "$API_URL/rest/v1/rpc/$function_name" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body"
}

admin_json="$(create_user "$ADMIN_EMAIL")"
user_json="$(create_user "$USER_EMAIL")"
admin_id="$(jq -er '.id' <<<"$admin_json")"
user_id="$(jq -er '.id' <<<"$user_json")"

psql "$DB_URL" -v ON_ERROR_STOP=1 \
  -v admin_id="$admin_id" -v user_id="$user_id" <<'SQL' >/dev/null
insert into public.profiles(id, role, status)
values (:'admin_id'::uuid, 'admin', 'active'), (:'user_id'::uuid, 'user', 'active');
SQL

admin_token="$(sign_in "$ADMIN_EMAIL" | jq -er '.access_token')"
user_token="$(sign_in "$USER_EMAIL" | jq -er '.access_token')"

# A normal authenticated user must not be able to change the provider or store a key.
code="$(rpc "$user_token" admin_set_knowledge_automation_ai_config \
  '{"p_enabled":true,"p_provider":"gemini","p_model":"gemini-3.5-flash-lite","p_max_candidates_per_run":3,"p_api_key":"TEST_SHOULD_NOT_STORE"}' \
  /tmp/aas-non-admin.json)"
if [[ "$code" =~ ^2 ]]; then
  echo "FAIL: non-admin unexpectedly changed Gemini configuration" >&2
  cat /tmp/aas-non-admin.json >&2
  exit 1
fi

# An active administrator can select the allowlisted model with a fake key.
code="$(rpc "$admin_token" admin_set_knowledge_automation_ai_config \
  "{\"p_enabled\":true,\"p_provider\":\"gemini\",\"p_model\":\"gemini-3.5-flash-lite\",\"p_max_candidates_per_run\":9,\"p_api_key\":\"$FAKE_KEY\"}" \
  /tmp/aas-admin-set.json)"
if [[ ! "$code" =~ ^2 ]]; then
  echo "FAIL: active admin could not configure staged Gemini provider (HTTP $code)" >&2
  cat /tmp/aas-admin-set.json >&2
  exit 1
fi

# The migration must clamp Gemini to at most three candidates per run.
clamped="$(psql "$DB_URL" -XAt -v ON_ERROR_STOP=1 -c \
  "select ai_max_candidates_per_run from public.knowledge_automation_settings where id=1;")"
if [[ "$clamped" != "3" ]]; then
  echo "FAIL: Gemini per-run maximum was not clamped to 3 (got $clamped)" >&2
  exit 1
fi

# Admin-only capability status works through a real JWT and never returns the key.
code="$(rpc "$admin_token" admin_get_knowledge_gemini_free_agent_status '{}' /tmp/aas-admin-status.json)"
if [[ ! "$code" =~ ^2 ]]; then
  echo "FAIL: admin Gemini status RPC failed (HTTP $code)" >&2
  cat /tmp/aas-admin-status.json >&2
  exit 1
fi
jq -e '
  .supported == true and
  .model == "gemini-3.5-flash-lite" and
  .daily_limit == 10 and
  .daily_used == 0 and
  .key_configured == true and
  .selected == true and
  .enabled == true
' /tmp/aas-admin-status.json >/dev/null
if grep -Fq "$FAKE_KEY" /tmp/aas-admin-status.json; then
  echo "FAIL: Gemini API key leaked from admin status RPC" >&2
  exit 1
fi

# Even an authenticated administrator must not have browser access to the server-only quota RPC.
code="$(rpc "$admin_token" reserve_knowledge_gemini_free_call '{}' /tmp/aas-admin-reserve.json)"
if [[ "$code" =~ ^2 ]]; then
  echo "FAIL: authenticated admin unexpectedly executed server-only quota RPC" >&2
  cat /tmp/aas-admin-reserve.json >&2
  exit 1
fi

# The model allowlist is enforced through the same real Auth path.
code="$(rpc "$admin_token" admin_set_knowledge_automation_ai_config \
  '{"p_enabled":false,"p_provider":"gemini","p_model":"gemini-3.5-pro","p_max_candidates_per_run":3,"p_api_key":null}' \
  /tmp/aas-invalid-model.json)"
if [[ "$code" =~ ^2 ]]; then
  echo "FAIL: non-allowlisted Gemini model was accepted" >&2
  cat /tmp/aas-invalid-model.json >&2
  exit 1
fi

# Confirm Vault stores the fake key and the plain-text value is not in vault.secrets.
plain_count="$(psql "$DB_URL" -XAt -v ON_ERROR_STOP=1 -c \
  "select count(*) from vault.secrets where name='aas_knowledge_gemini_api_key' and secret='$FAKE_KEY';")"
decrypted_count="$(psql "$DB_URL" -XAt -v ON_ERROR_STOP=1 -c \
  "select count(*) from vault.decrypted_secrets where name='aas_knowledge_gemini_api_key' and decrypted_secret='$FAKE_KEY';")"
if [[ "$plain_count" != "0" || "$decrypted_count" != "1" ]]; then
  echo "FAIL: local Vault encryption/decryption assertion failed" >&2
  exit 1
fi

echo "PASS: real local Supabase Auth JWT gates, admin config, model allowlist, Vault isolation, and server-only quota access."
