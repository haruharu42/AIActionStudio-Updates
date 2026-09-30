#!/usr/bin/env bash
# Run ONLY on the disposable Postgres fixture AFTER migration and smoke.sql.
# Thirty simultaneous service-role sessions must atomically grant exactly ten calls.
set -euo pipefail

results="$(mktemp)"
trap 'rm -f "$results"' EXIT

# smoke.sql checked rollover and left the counter at one; reset this fixture.
psql -XAt -v ON_ERROR_STOP=1 -c "
  UPDATE public.knowledge_automation_settings
  SET ai_provider='gemini', ai_enrichment_enabled=true,
      ai_gemini_daily_date=(now() at time zone 'utc')::date,
      ai_gemini_daily_count=0 WHERE id=1;
" >/dev/null

seq 1 30 | xargs -P 12 -I '{}' bash -euo pipefail -c '
  psql -XAt -v ON_ERROR_STOP=1 -c \
    "SET ROLE service_role; SELECT public.reserve_knowledge_gemini_free_call()::integer;" |
  tail -n 1
' > "$results"

granted="$(grep -c '^1$' "$results" || true)"
denied="$(grep -c '^0$' "$results" || true)"
total="$(wc -l < "$results" | tr -d ' ')"
count="$(psql -XAt -v ON_ERROR_STOP=1 -c \
  "SELECT ai_gemini_daily_count FROM public.knowledge_automation_settings WHERE id=1;")"

if [[ "$total" != 30 || "$granted" != 10 || "$denied" != 20 || "$count" != 10 ]]; then
  echo "FAIL: concurrent quota mismatch (total=$total allowed=$granted denied=$denied stored=$count)" >&2
  exit 1
fi
echo "PASS: 30 concurrent attempts, exactly 10 allowed and 20 denied, final counter 10."
