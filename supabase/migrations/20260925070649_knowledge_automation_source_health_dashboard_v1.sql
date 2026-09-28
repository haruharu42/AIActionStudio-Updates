-- Admin-only visibility for Knowledge automation source health and side-hustle coverage.
-- This is a read-only RPC; direct table access remains revoked.

create or replace function public.admin_list_knowledge_automation_sources(
  p_limit integer default 200
)
returns table (
  id bigint,
  source_url text,
  tasks text[],
  source_kind text,
  enabled boolean,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  last_http_status integer,
  consecutive_failures integer,
  last_error text
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  limit_value integer := greatest(1,least(coalesce(p_limit,200),500));
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  return query
  select
    source.id,
    source.source_url,
    source.tasks,
    source.source_kind,
    source.enabled,
    source.last_checked_at,
    source.next_check_at,
    source.last_http_status,
    source.consecutive_failures,
    source.last_error
  from public.knowledge_automation_sources source
  order by
    source.enabled desc,
    (source.consecutive_failures > 0) desc,
    source.consecutive_failures desc,
    source.next_check_at asc,
    source.id asc
  limit limit_value;
end;
$function$;

revoke all on function public.admin_list_knowledge_automation_sources(integer) from public, anon, authenticated;
grant execute on function public.admin_list_knowledge_automation_sources(integer) to authenticated;
