-- Admin-only pause/resume control for official Knowledge monitoring sources.
-- Source history is preserved; resuming schedules an immediate recheck.

create or replace function public.admin_set_knowledge_automation_source_enabled(
  p_source_id bigint,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  update public.knowledge_automation_sources source
  set
    enabled=coalesce(p_enabled,false),
    next_check_at=case
      when coalesce(p_enabled,false) then now()
      else source.next_check_at
    end,
    updated_at=now()
  where source.id=p_source_id;

  if not found then
    raise exception 'knowledge automation source not found' using errcode='P0002';
  end if;
end;
$function$;

revoke all on function public.admin_set_knowledge_automation_source_enabled(bigint,boolean)
  from public, anon, authenticated;
grant execute on function public.admin_set_knowledge_automation_source_enabled(bigint,boolean)
  to authenticated;
