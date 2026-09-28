-- Knowledge production workflow v1
-- Adds admin recovery/operations controls without weakening the review gate.

create or replace function public.admin_cancel_knowledge_refresh(
  p_request_id bigint,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  reason_value text := left(
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Cancelled by active AAS administrator.'),
    1000
  );
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  update public.knowledge_refresh_requests
  set
    status = 'cancelled',
    completed_at = now(),
    error_message = reason_value
  where id = p_request_id
    and status in ('pending', 'processing');

  if not found then
    raise exception 'refresh request not found or not active' using errcode = 'P0002';
  end if;
end;
$function$;

create or replace function public.admin_retry_knowledge_refresh(
  p_request_id bigint
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  source_row public.knowledge_refresh_requests%rowtype;
  active_id bigint;
  retry_id bigint;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  select *
  into source_row
  from public.knowledge_refresh_requests
  where id = p_request_id;

  if not found then
    raise exception 'refresh request not found' using errcode = 'P0002';
  end if;

  if source_row.status not in ('failed', 'cancelled') then
    raise exception 'only failed or cancelled refreshes can be retried' using errcode = '22023';
  end if;

  select request.id
  into active_id
  from public.knowledge_refresh_requests as request
  where request.channel = source_row.channel
    and request.status in ('pending', 'processing')
  order by request.requested_at desc
  limit 1;

  if active_id is not null then
    return active_id;
  end if;

  insert into public.knowledge_refresh_requests (channel)
  values (source_row.channel)
  returning id into retry_id;

  update public.knowledge_refresh_channels as channel
  set
    last_refresh_requested_at = now(),
    next_refresh_due_at = now() + make_interval(hours => channel.refresh_hours),
    updated_at = now()
  where channel.channel = source_row.channel;

  return retry_id;
end;
$function$;

create or replace function public.admin_run_knowledge_scheduler()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  perform private.enqueue_due_knowledge_refreshes();
end;
$function$;

create or replace function public.admin_get_knowledge_production_health()
returns table(
  active_knowledge integer,
  active_prompt_optimizations integer,
  pending_requests integer,
  processing_requests integer,
  failed_requests integer,
  cancelled_requests integer,
  fresh_version bigint,
  stable_version bigint,
  last_knowledge_checked_at timestamptz,
  last_prompt_checked_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::integer from public.knowledge_catalog where status = 'active'),
    (select count(*)::integer from public.prompt_optimization_catalog where status = 'active'),
    (select count(*)::integer from public.knowledge_refresh_requests where status = 'pending'),
    (select count(*)::integer from public.knowledge_refresh_requests where status = 'processing'),
    (select count(*)::integer from public.knowledge_refresh_requests where status = 'failed'),
    (select count(*)::integer from public.knowledge_refresh_requests where status = 'cancelled'),
    coalesce((select current_version from public.knowledge_refresh_channels where channel = 'fresh'), 1),
    coalesce((select current_version from public.knowledge_refresh_channels where channel = 'stable'), 1),
    (select max(source_checked_at) from public.knowledge_catalog where status = 'active'),
    (select max(source_checked_at) from public.prompt_optimization_catalog where status = 'active');
end;
$function$;

revoke all on function public.admin_cancel_knowledge_refresh(bigint, text) from public, anon;
revoke all on function public.admin_retry_knowledge_refresh(bigint) from public, anon;
revoke all on function public.admin_run_knowledge_scheduler() from public, anon;
revoke all on function public.admin_get_knowledge_production_health() from public, anon;

grant execute on function public.admin_cancel_knowledge_refresh(bigint, text) to authenticated;
grant execute on function public.admin_retry_knowledge_refresh(bigint) to authenticated;
grant execute on function public.admin_run_knowledge_scheduler() to authenticated;
grant execute on function public.admin_get_knowledge_production_health() to authenticated;
