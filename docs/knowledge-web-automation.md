# Knowledge Web Automation

AI Action Studio (AAS) keeps curated seed Knowledge in code and versioned cloud Knowledge in Supabase.

## Automation boundary

The automation layer may:

1. Poll registered official / primary source URLs.
2. Use ETag / Last-Modified when available.
3. Hash normalized page content and detect material source changes.
4. Detect 404 / 410 and repeated retrieval failures.
5. Treat official changelog / release hubs as discovery signals.
6. Create review candidates: `new`, `update`, `recheck`, or `retire`.
7. Generate a candidate-specific verification prompt.
8. When AI enrichment is enabled, analyze the fetched official-source excerpt against the current catalog item.
9. Generate a validated draft `proposed_payload` for reusable `new` / `update` candidates.
10. Record `no_change`, `recheck`, and `retire` decisions without creating publishable JSON.

The automation layer must **not** publish Knowledge or Prompt rules. AI output is treated as an untrusted draft and is revalidated against AAS task/kind/provider/key/source-url constraints before it can be shown as a proposal.

## Publication boundary

A candidate approval only means that an administrator wants to continue verification. Final publication remains a separate flow:

`official-source candidate -> automatic source verification -> optional AI draft proposal -> Fresh review handoff -> Quality Gate -> current-data diff -> admin confirmation -> Fresh / Stable publish`

The Edge Function has no call to the Knowledge publication RPC.

## Scheduling

- `aas-knowledge-research-worker-6h`: invokes the source monitor every six hours.
- Each tracked source normally has a 24-hour recheck interval.
- The worker processes a bounded number of due sources per run.
- Existing Fresh / Stable scheduling remains independent.
- AI enrichment processes only a bounded number of pending candidates per worker run.
- If AI enrichment is disabled, unconfigured, or temporarily fails, official-source monitoring continues normally.

## Security

- The worker is authenticated with a dedicated random token stored in Supabase Vault.
- Only the SHA-256 token hash is stored in the automation settings table.
- The service-role credential is never passed through the scheduled HTTP request.
- Existing Knowledge / Prompt tables keep their direct Data API restrictions.
- The worker reads a minimal catalog snapshot through a service-role-only SECURITY DEFINER RPC.
- Admin-facing RPCs still verify `private.is_active_admin()`.
- The OpenAI API key is stored in Supabase Vault under `aas_knowledge_openai_api_key`; it is never returned to the browser.
- Only the service-role-only worker config RPC can read the decrypted AI key.
- The browser only receives a boolean indicating whether a key is configured.
- The worker calls the OpenAI Responses API with `store: false` and JSON-only output, then validates every proposed task, key, kind/provider/plan, and source URL locally.

## Discovery policy

Normal official pages are change monitors only. New-page discovery is intentionally disabled for ordinary pages to avoid noisy candidates.

Official changelog / release sources are tracked separately. When a changelog's own content hash changes, the worker creates a `new` candidate so an administrator can verify whether a new reusable Knowledge / Prompt rule is warranted.


## Provider update hubs

The monitored source set includes provider update hubs for OpenAI API changes, Gemini API release notes, and Anthropic model lifecycle / prompting guidance. These hubs establish a baseline hash on first observation; only later changes create review candidates.


## AI enrichment boundary

AI enrichment is optional and defaults to disabled. An active administrator can configure:

- provider: OpenAI
- model ID
- maximum candidates analyzed per worker run
- API key (write-only from the admin screen; stored in Vault)

For each eligible candidate, the worker can produce one of:

- `no_change`: source changed but there is no reusable Knowledge/Prompt change.
- `new`: draft a new `auto:` Knowledge or Prompt item.
- `update`: draft changes while preserving the existing key.
- `recheck`: evidence is insufficient; keep it out of the publish flow.
- `retire`: source/item should be reviewed for retirement.

A completed `new` / `update` proposal can be sent from the admin UI to a Fresh update request. This action only pre-fills the existing review JSON. It does **not** run the publication RPC. The administrator must still run current-data diff review and confirm publication explicitly.

Implementation status: the AI enrichment control plane is additive and remains disabled until an administrator stores a provider API key and enables it.

Candidate lifecycle: a candidate remains pending during Fresh diff preparation and is marked converted only after the reviewed publication succeeds.

Validation note: candidate conversion is intentionally coupled to successful reviewed publication, never to draft preparation alone.

Final review gate: automated proposals remain non-published artifacts until the existing diff-confirmed publication action succeeds.
