-- Phase 65: Source Freshness Queue.
-- Admin-only read/prepare workflow for re-checking Knowledge / Prompt sources
-- before the 90-day Stable freshness gate expires.

create or replace function public.admin_get_knowledge_source_freshness_queue(
  p_warning_days integer default 30,
  p_stale_days integer default 90
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  result jsonb;
  warning_days integer := greatest(1, least(coalesce(p_warning_days, 30), 89));
  stale_days integer := greatest(2, least(coalesce(p_stale_days, 90), 365));
begin
  if (select auth.uid()) is null
     or not (select private.is_active_admin())
  then
    raise exception 'active admin required' using errcode='42501';
  end if;

  if warning_days >= stale_days then
    raise exception 'warning days must be less than stale days' using errcode='22023';
  end if;

  with knowledge_items as (
    select
      'knowledge'::text as item_type,
      item.key,
      item.label,
      item.release_channel,
      item.catalog_version,
      item.source_checked_at,
      item.source_urls,
      case
        when coalesce(cardinality(item.source_urls),0)=0 or item.source_checked_at is null then 'missing'
        when item.source_checked_at < now() - make_interval(days => stale_days) then 'stale'
        when item.source_checked_at < now() - make_interval(days => stale_days - warning_days) then 'due'
        else 'fresh'
      end as state,
      case
        when item.source_checked_at is null then null
        else floor(extract(epoch from (now() - item.source_checked_at)) / 86400)::integer
      end as age_days,
      case
        when item.source_checked_at is null then null
        else item.source_checked_at + make_interval(days => stale_days)
      end as stale_at,
      jsonb_build_object(
        'key',item.key,
        'kind',item.kind,
        'label',item.label,
        'parent_label',item.parent_label,
        'aliases',to_jsonb(item.aliases),
        'guidance',to_jsonb(item.guidance),
        'deliverables',to_jsonb(item.deliverables),
        'cautions',to_jsonb(item.cautions),
        'tasks',to_jsonb(item.tasks),
        'priority',item.priority,
        'source_urls',to_jsonb(item.source_urls),
        'source_summary',item.source_summary
      ) as payload
    from public.knowledge_catalog item
    where item.status='active'
  ),
  prompt_items as (
    select
      'prompt'::text as item_type,
      item.key,
      (item.provider || ' / ' || item.task)::text as label,
      item.release_channel,
      item.catalog_version,
      item.source_checked_at,
      item.source_urls,
      case
        when coalesce(cardinality(item.source_urls),0)=0 or item.source_checked_at is null then 'missing'
        when item.source_checked_at < now() - make_interval(days => stale_days) then 'stale'
        when item.source_checked_at < now() - make_interval(days => stale_days - warning_days) then 'due'
        else 'fresh'
      end as state,
      case
        when item.source_checked_at is null then null
        else floor(extract(epoch from (now() - item.source_checked_at)) / 86400)::integer
      end as age_days,
      case
        when item.source_checked_at is null then null
        else item.source_checked_at + make_interval(days => stale_days)
      end as stale_at,
      jsonb_build_object(
        'key',item.key,
        'provider',item.provider,
        'plan',item.plan,
        'task',item.task,
        'rules',to_jsonb(item.rules),
        'priority',item.priority,
        'source_urls',to_jsonb(item.source_urls),
        'source_summary',item.source_summary
      ) as payload
    from public.prompt_optimization_catalog item
    where item.status='active'
  ),
  all_items as (
    select * from knowledge_items
    union all
    select * from prompt_items
  )
  select jsonb_build_object(
    'warning_days',warning_days,
    'stale_days',stale_days,
    'missing_count',count(*) filter(where state='missing'),
    'stale_count',count(*) filter(where state='stale'),
    'due_count',count(*) filter(where state='due'),
    'fresh_count',count(*) filter(where state='fresh'),
    'next_due_at',min(stale_at - make_interval(days => warning_days)) filter(where state='fresh'),
    'items',coalesce(jsonb_agg(
      jsonb_build_object(
        'item_type',item_type,
        'key',key,
        'label',label,
        'state',state,
        'release_channel',release_channel,
        'catalog_version',catalog_version,
        'source_checked_at',source_checked_at,
        'source_urls',to_jsonb(source_urls),
        'age_days',age_days,
        'stale_at',stale_at,
        'payload',payload
      )
      order by
        case state when 'missing' then 0 when 'stale' then 1 when 'due' then 2 else 3 end,
        source_checked_at nulls first,
        item_type,
        key
    ),'[]'::jsonb)
  )
  into result
  from all_items;

  return coalesce(result,jsonb_build_object(
    'warning_days',warning_days,
    'stale_days',stale_days,
    'missing_count',0,
    'stale_count',0,
    'due_count',0,
    'fresh_count',0,
    'next_due_at',null,
    'items','[]'::jsonb
  ));
end;
$function$;

revoke all on function public.admin_get_knowledge_source_freshness_queue(integer, integer)
from public, anon;
grant execute on function public.admin_get_knowledge_source_freshness_queue(integer, integer)
to authenticated;


create or replace function public.admin_prepare_knowledge_source_recheck(
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  limit_value integer := greatest(1,least(coalesce(p_limit,20),30));
  request_id bigint;
  selected_items jsonb := '[]'::jsonb;
  selected_count integer := 0;
  missing_count integer := 0;
  stale_count integer := 0;
  due_count integer := 0;
begin
  if (select auth.uid()) is null
     or not (select private.is_active_admin())
  then
    raise exception 'active admin required' using errcode='42501';
  end if;

  with all_items as (
    select
      'knowledge'::text as item_type,
      item.key,
      item.label,
      item.source_checked_at,
      case
        when coalesce(cardinality(item.source_urls),0)=0 or item.source_checked_at is null then 'missing'
        when item.source_checked_at < now() - interval '90 days' then 'stale'
        when item.source_checked_at < now() - interval '60 days' then 'due'
        else 'fresh'
      end as state,
      jsonb_build_object(
        'item_type','knowledge',
        'key',item.key,
        'label',item.label,
        'source_checked_at',item.source_checked_at,
        'source_urls',to_jsonb(item.source_urls),
        'payload',jsonb_build_object(
          'key',item.key,
          'kind',item.kind,
          'label',item.label,
          'parent_label',item.parent_label,
          'aliases',to_jsonb(item.aliases),
          'guidance',to_jsonb(item.guidance),
          'deliverables',to_jsonb(item.deliverables),
          'cautions',to_jsonb(item.cautions),
          'tasks',to_jsonb(item.tasks),
          'priority',item.priority,
          'source_urls',to_jsonb(item.source_urls),
          'source_summary',item.source_summary
        )
      ) as row_payload
    from public.knowledge_catalog item
    where item.status='active'

    union all

    select
      'prompt'::text,
      item.key,
      (item.provider || ' / ' || item.task)::text,
      item.source_checked_at,
      case
        when coalesce(cardinality(item.source_urls),0)=0 or item.source_checked_at is null then 'missing'
        when item.source_checked_at < now() - interval '90 days' then 'stale'
        when item.source_checked_at < now() - interval '60 days' then 'due'
        else 'fresh'
      end,
      jsonb_build_object(
        'item_type','prompt',
        'key',item.key,
        'label',(item.provider || ' / ' || item.task)::text,
        'source_checked_at',item.source_checked_at,
        'source_urls',to_jsonb(item.source_urls),
        'payload',jsonb_build_object(
          'key',item.key,
          'provider',item.provider,
          'plan',item.plan,
          'task',item.task,
          'rules',to_jsonb(item.rules),
          'priority',item.priority,
          'source_urls',to_jsonb(item.source_urls),
          'source_summary',item.source_summary
        )
      )
    from public.prompt_optimization_catalog item
    where item.status='active'
  ),
  selected as (
    select *
    from all_items
    where state in ('missing','stale','due')
    order by
      case state when 'missing' then 0 when 'stale' then 1 else 2 end,
      source_checked_at nulls first,
      item_type,
      key
    limit limit_value
  )
  select
    coalesce(jsonb_agg(
      row_payload || jsonb_build_object('state',state)
      order by
        case state when 'missing' then 0 when 'stale' then 1 else 2 end,
        source_checked_at nulls first,
        item_type,
        key
    ),'[]'::jsonb),
    count(*)::integer,
    count(*) filter(where state='missing')::integer,
    count(*) filter(where state='stale')::integer,
    count(*) filter(where state='due')::integer
  into selected_items,selected_count,missing_count,stale_count,due_count
  from selected;

  if selected_count = 0 then
    raise exception '再確認が必要なKnowledge / Promptはありません。'
      using errcode='P0002';
  end if;

  select request.id
  into request_id
  from public.knowledge_refresh_requests request
  where request.channel='fresh'
    and request.status in ('pending','processing')
  order by request.id desc
  limit 1
  for update skip locked;

  if request_id is null then
    insert into public.knowledge_refresh_requests (
      channel,requested_at,started_at,status,research_summary
    ) values (
      'fresh',now(),now(),'processing',
      'Source Freshness Queue: 公式根拠の再確認対象を準備'
    )
    returning id into request_id;
  else
    update public.knowledge_refresh_requests
    set
      status='processing',
      started_at=coalesce(started_at,now()),
      error_message=null,
      research_summary='Source Freshness Queue: 公式根拠の再確認対象を準備'
    where id=request_id;
  end if;

  return jsonb_build_object(
    'request_id',request_id,
    'item_count',selected_count,
    'missing_count',missing_count,
    'stale_count',stale_count,
    'due_count',due_count,
    'stale_days',90,
    'warning_days',30,
    'items',selected_items
  );
end;
$function$;

revoke all on function public.admin_prepare_knowledge_source_recheck(integer)
from public, anon;
grant execute on function public.admin_prepare_knowledge_source_recheck(integer)
to authenticated;
