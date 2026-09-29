-- Phase 64: Stable Release Queue.
-- Detect Fresh-first rows that differ from the durable Stable snapshot.
-- Administrators may prepare an exact review bundle, but publication remains manual
-- and still passes the existing quality + Stable promotion gates.

create or replace function public.admin_get_stable_release_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  result jsonb;
begin
  if (select auth.uid()) is null
     or not (select private.is_active_admin())
  then
    raise exception 'active admin required' using errcode='42501';
  end if;

  with knowledge_diff as (
    select
      'knowledge'::text as item_type,
      fresh.key,
      fresh.label,
      fresh.stable_available_at,
      fresh.source_checked_at,
      case
        when stable.key is null then 'new'
        else 'updated'
      end as change_type,
      case
        when fresh.stable_available_at > now() then 'waiting'
        when coalesce(cardinality(fresh.source_urls),0)=0 or fresh.source_checked_at is null then 'blocked'
        when fresh.source_checked_at < now() - interval '90 days' then 'blocked'
        else 'ready'
      end as state,
      case
        when fresh.stable_available_at > now() then 'Fresh検証期間の終了待ち'
        when coalesce(cardinality(fresh.source_urls),0)=0 or fresh.source_checked_at is null then '根拠URLまたは確認日が不足'
        when fresh.source_checked_at < now() - interval '90 days' then '根拠確認から90日を超過'
        else ''
      end as state_reason
    from public.knowledge_catalog fresh
    left join public.knowledge_stable_catalog stable on stable.key=fresh.key
    where fresh.status='active'
      and fresh.release_channel='fresh_first'
      and (
        stable.key is null
        or fresh.kind is distinct from stable.kind
        or fresh.label is distinct from stable.label
        or fresh.parent_label is distinct from stable.parent_label
        or fresh.aliases is distinct from stable.aliases
        or fresh.guidance is distinct from stable.guidance
        or fresh.deliverables is distinct from stable.deliverables
        or fresh.cautions is distinct from stable.cautions
        or fresh.tasks is distinct from stable.tasks
        or fresh.priority is distinct from stable.priority
        or fresh.source_urls is distinct from stable.source_urls
        or fresh.source_summary is distinct from stable.source_summary
        or fresh.source_checked_at is distinct from stable.source_checked_at
      )
  ),
  prompt_diff as (
    select
      'prompt'::text as item_type,
      fresh.key,
      (fresh.provider || ' / ' || fresh.task)::text as label,
      fresh.stable_available_at,
      fresh.source_checked_at,
      case
        when stable.key is null then 'new'
        else 'updated'
      end as change_type,
      case
        when fresh.stable_available_at > now() then 'waiting'
        when coalesce(cardinality(fresh.source_urls),0)=0 or fresh.source_checked_at is null then 'blocked'
        when fresh.source_checked_at < now() - interval '90 days' then 'blocked'
        else 'ready'
      end as state,
      case
        when fresh.stable_available_at > now() then 'Fresh検証期間の終了待ち'
        when coalesce(cardinality(fresh.source_urls),0)=0 or fresh.source_checked_at is null then '根拠URLまたは確認日が不足'
        when fresh.source_checked_at < now() - interval '90 days' then '根拠確認から90日を超過'
        else ''
      end as state_reason
    from public.prompt_optimization_catalog fresh
    left join public.prompt_optimization_stable_catalog stable on stable.key=fresh.key
    where fresh.status='active'
      and fresh.release_channel='fresh_first'
      and (
        stable.key is null
        or fresh.provider is distinct from stable.provider
        or fresh.plan is distinct from stable.plan
        or fresh.task is distinct from stable.task
        or fresh.rules is distinct from stable.rules
        or fresh.priority is distinct from stable.priority
        or fresh.source_urls is distinct from stable.source_urls
        or fresh.source_summary is distinct from stable.source_summary
        or fresh.source_checked_at is distinct from stable.source_checked_at
      )
  ),
  all_items as (
    select * from knowledge_diff
    union all
    select * from prompt_diff
  )
  select jsonb_build_object(
    'ready_count', count(*) filter(where state='ready'),
    'waiting_count', count(*) filter(where state='waiting'),
    'blocked_count', count(*) filter(where state='blocked'),
    'knowledge_ready_count', count(*) filter(where state='ready' and item_type='knowledge'),
    'prompt_ready_count', count(*) filter(where state='ready' and item_type='prompt'),
    'next_ready_at', min(stable_available_at) filter(where state='waiting'),
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'item_type',item_type,
        'key',key,
        'label',label,
        'change_type',change_type,
        'state',state,
        'state_reason',state_reason,
        'stable_available_at',stable_available_at,
        'source_checked_at',source_checked_at
      )
      order by
        case state when 'ready' then 0 when 'waiting' then 1 else 2 end,
        stable_available_at,
        item_type,
        key
    ),'[]'::jsonb)
  )
  into result
  from all_items;

  return coalesce(result,jsonb_build_object(
    'ready_count',0,
    'waiting_count',0,
    'blocked_count',0,
    'knowledge_ready_count',0,
    'prompt_ready_count',0,
    'next_ready_at',null,
    'items','[]'::jsonb
  ));
end;
$function$;

revoke all on function public.admin_get_stable_release_queue() from public, anon;
grant execute on function public.admin_get_stable_release_queue() to authenticated;


create or replace function public.admin_prepare_stable_release()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  knowledge_items jsonb := '[]'::jsonb;
  prompt_items jsonb := '[]'::jsonb;
  knowledge_count integer := 0;
  prompt_count integer := 0;
  request_id bigint;
  bundle jsonb;
begin
  if (select auth.uid()) is null
     or not (select private.is_active_admin())
  then
    raise exception 'active admin required' using errcode='42501';
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'key',fresh.key,
        'kind',fresh.kind,
        'label',fresh.label,
        'parent_label',fresh.parent_label,
        'aliases',to_jsonb(fresh.aliases),
        'guidance',to_jsonb(fresh.guidance),
        'deliverables',to_jsonb(fresh.deliverables),
        'cautions',to_jsonb(fresh.cautions),
        'tasks',to_jsonb(fresh.tasks),
        'priority',fresh.priority,
        'source_urls',to_jsonb(fresh.source_urls),
        'source_summary',fresh.source_summary
      )
      order by fresh.priority desc,fresh.key
    ),'[]'::jsonb),
    count(*)::integer
  into knowledge_items,knowledge_count
  from public.knowledge_catalog fresh
  left join public.knowledge_stable_catalog stable on stable.key=fresh.key
  where fresh.status='active'
    and fresh.release_channel='fresh_first'
    and fresh.stable_available_at <= now()
    and coalesce(cardinality(fresh.source_urls),0)>0
    and fresh.source_checked_at is not null
    and fresh.source_checked_at >= now() - interval '90 days'
    and (
      stable.key is null
      or fresh.kind is distinct from stable.kind
      or fresh.label is distinct from stable.label
      or fresh.parent_label is distinct from stable.parent_label
      or fresh.aliases is distinct from stable.aliases
      or fresh.guidance is distinct from stable.guidance
      or fresh.deliverables is distinct from stable.deliverables
      or fresh.cautions is distinct from stable.cautions
      or fresh.tasks is distinct from stable.tasks
      or fresh.priority is distinct from stable.priority
      or fresh.source_urls is distinct from stable.source_urls
      or fresh.source_summary is distinct from stable.source_summary
      or fresh.source_checked_at is distinct from stable.source_checked_at
    );

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'key',fresh.key,
        'provider',fresh.provider,
        'plan',fresh.plan,
        'task',fresh.task,
        'rules',to_jsonb(fresh.rules),
        'priority',fresh.priority,
        'source_urls',to_jsonb(fresh.source_urls),
        'source_summary',fresh.source_summary
      )
      order by fresh.priority desc,fresh.key
    ),'[]'::jsonb),
    count(*)::integer
  into prompt_items,prompt_count
  from public.prompt_optimization_catalog fresh
  left join public.prompt_optimization_stable_catalog stable on stable.key=fresh.key
  where fresh.status='active'
    and fresh.release_channel='fresh_first'
    and fresh.stable_available_at <= now()
    and coalesce(cardinality(fresh.source_urls),0)>0
    and fresh.source_checked_at is not null
    and fresh.source_checked_at >= now() - interval '90 days'
    and (
      stable.key is null
      or fresh.provider is distinct from stable.provider
      or fresh.plan is distinct from stable.plan
      or fresh.task is distinct from stable.task
      or fresh.rules is distinct from stable.rules
      or fresh.priority is distinct from stable.priority
      or fresh.source_urls is distinct from stable.source_urls
      or fresh.source_summary is distinct from stable.source_summary
      or fresh.source_checked_at is distinct from stable.source_checked_at
    );

  if knowledge_count + prompt_count = 0 then
    raise exception 'Stableへ昇格可能な候補はありません。' using errcode='P0002';
  end if;

  bundle := jsonb_build_object(
    'summary',
    'Stable Release Queue: Fresh検証期間を完了し、Stableとの差分がある候補を自動構成。Knowledge '
      || knowledge_count || '件 / Prompt ' || prompt_count || '件。',
    'knowledge_rules',knowledge_items,
    'prompt_optimizations',prompt_items
  );

  select request.id
  into request_id
  from public.knowledge_refresh_requests request
  where request.channel='stable'
    and request.status in ('pending','processing')
  order by request.id desc
  limit 1
  for update skip locked;

  if request_id is null then
    insert into public.knowledge_refresh_requests (
      channel,requested_at,started_at,status,research_summary
    ) values (
      'stable',now(),now(),'processing','Stable Release Queueから自動準備'
    )
    returning id into request_id;
  else
    update public.knowledge_refresh_requests
    set
      status='processing',
      started_at=coalesce(started_at,now()),
      error_message=null
    where id=request_id;
  end if;

  return jsonb_build_object(
    'request_id',request_id,
    'knowledge_count',knowledge_count,
    'prompt_count',prompt_count,
    'bundle',bundle
  );
end;
$function$;

revoke all on function public.admin_prepare_stable_release() from public, anon;
grant execute on function public.admin_prepare_stable_release() to authenticated;
