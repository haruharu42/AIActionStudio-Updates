# Managed Staging test fixture

This directory reconstructs only the minimum schema used by the managed AAS Staging checks.

- Test/Staging only. Never apply `minimal-base.sql` to Production.
- It contains structure only; it deliberately contains no Production users, Knowledge catalog content, release rows, API keys, worker tokens, or GitHub tokens.
- Automation and AI enrichment default to OFF.
- The real product migration `supabase/migrations/20260930125200_knowledge_gemini_free_agent_v1.sql` is applied after the fixture.
- Release write/dispatch RPCs are intentionally absent. Only the read-side admin gate used by `github_readiness` is represented.
- The formal release URL migration is applied after the fixture and deliberately allows both `AIActionStudio-Updates` and legacy `AIArticleStudio-Updates` during rollout/rollback while rejecting unrelated repositories.

The GitHub Actions smoke workflow starts a disposable local Supabase stack, applies this fixture and the real Gemini migration, then runs `verify.sql`. It never links to the managed Staging or Production project.
