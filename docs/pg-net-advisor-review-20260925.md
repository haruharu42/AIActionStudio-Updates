# pg_net Advisor Review — 2026-09-25

## Conclusion

Do **not** move, drop, or recreate the live `pg_net` extension only to remove the `extension_in_public` advisor warning.

## Live project facts

- extension: `pg_net`
- version: `0.20.4`
- extension schema metadata: `public`
- relocatable: `false`
- current AAS usage includes:
  - `private.invoke_knowledge_automation_worker(p_trigger text)`
  - `private.invoke_notification_push_worker()`
- runtime calls use the `net.*` API.

## Current Supabase documentation

Supabase's pg_net guide says pg_net creates its own `net` schema/namespace. Supabase examples for new setups also show:

```sql
create extension if not exists pg_net
with schema extensions;
```

Supabase troubleshooting guidance for pg_net suggests drop/recreate with `schema extensions` for a specific permission-repair scenario, but explicitly says that when dependencies prevent this, support should be contacted rather than forcing the operation.

## Why no migration is applied

The installed extension reports `extrelocatable=false`, so `ALTER EXTENSION pg_net SET SCHEMA ...` is not a safe supported path.

Dropping and recreating the extension would temporarily remove pg_net objects and risks breaking the Knowledge automation and notification push call paths. Those are active AAS features and a warning-only cleanup does not justify that availability risk.

## Follow-up

- Keep the warning documented as intentional.
- Revisit only during a planned maintenance window or Supabase-supported migration procedure.
- Before any future pg_net change, re-check the current extension version, dependency graph, scheduled jobs, worker invocation functions, and Supabase documentation.
- Verify both Knowledge automation and Web Push after any future pg_net maintenance.
