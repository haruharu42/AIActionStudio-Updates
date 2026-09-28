-- Service-role-only snapshot RPC for the Edge worker.
-- Existing catalog table privileges remain unchanged.

create or replace function public.get_knowledge_automation_catalog_snapshot()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'knowledge',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', item.key,
          'kind', item.kind,
          'label', item.label,
          'parent_label', item.parent_label,
          'aliases', to_jsonb(item.aliases),
          'guidance', to_jsonb(item.guidance),
          'deliverables', to_jsonb(item.deliverables),
          'cautions', to_jsonb(item.cautions),
          'tasks', to_jsonb(item.tasks),
          'priority', item.priority,
          'source_urls', to_jsonb(item.source_urls),
          'source_summary', item.source_summary,
          'catalog_version', item.catalog_version
        )
        order by item.key
      )
      from public.knowledge_catalog item
      where item.status='active'
    ), '[]'::jsonb),
    'prompts',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', item.key,
          'provider', item.provider,
          'plan', item.plan,
          'task', item.task,
          'rules', to_jsonb(item.rules),
          'priority', item.priority,
          'source_urls', to_jsonb(item.source_urls),
          'source_summary', item.source_summary,
          'catalog_version', item.catalog_version
        )
        order by item.key
      )
      from public.prompt_optimization_catalog item
      where item.status='active'
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.get_knowledge_automation_catalog_snapshot() from public, anon, authenticated;
grant execute on function public.get_knowledge_automation_catalog_snapshot() to service_role;
