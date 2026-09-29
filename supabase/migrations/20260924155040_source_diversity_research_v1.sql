-- Phase 68: actionable source diversity research.
-- Admin-only preparation for investigating single-source / single-domain items.
-- This does not publish or mutate Knowledge/Prompt rows.

create or replace function public.admin_prepare_source_diversity_research(
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  limit_value integer := greatest(1,least(coalesce(p_limit,12),30));
  request_id bigint;
  items_value jsonb := '[]'::jsonb;
  item_count_value integer := 0;
  single_source_count_value integer := 0;
  single_domain_count_value integer := 0;
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
      item.catalog_version,
      item.source_checked_at,
      item.source_urls,
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

    union all

    select
      'prompt'::text,
      item.key,
      (item.provider || ' / ' || item.task)::text,
      item.catalog_version,
      item.source_checked_at,
      item.source_urls,
      jsonb_build_object(
        'key',item.key,
        'provider',item.provider,
        'plan',item.plan,
        'task',item.task,
        'rules',to_jsonb(item.rules),
        'priority',item.priority,
        'source_urls',to_jsonb(item.source_urls),
        'source_summary',item.source_summary
      )
    from public.prompt_optimization_catalog item
    where item.status='active'
  ),
  url_rows as (
    select
      item.item_type,
      item.key,
      regexp_replace(
        lower(
          regexp_replace(
            regexp_replace(source_url,'^https?://','','i'),
            '/.*$','',''
          )
        ),
        '^www\.','','i'
      ) as domain
    from all_items item
    cross join lateral unnest(coalesce(item.source_urls,array[]::text[])) source_url
    where source_url ~* '^https://'
  ),
  scored as (
    select
      item.item_type,
      item.key,
      item.label,
      item.catalog_version,
      item.source_checked_at,
      coalesce(item.source_urls,array[]::text[]) as source_urls,
      coalesce(cardinality(item.source_urls),0)::integer as source_count,
      count(distinct url.domain)::integer as domain_count,
      coalesce(
        jsonb_agg(distinct url.domain) filter(where nullif(url.domain,'') is not null),
        '[]'::jsonb
      ) as domains,
      item.payload
    from all_items item
    left join url_rows url
      on url.item_type=item.item_type and url.key=item.key
    group by
      item.item_type,item.key,item.label,item.catalog_version,
      item.source_checked_at,item.source_urls,item.payload
  ),
  candidates as (
    select *
    from scored
    where source_count <= 1 or domain_count <= 1
    order by
      case
        when source_count=0 then 0
        when source_count=1 then 1
        when domain_count=0 then 2
        else 3
      end,
      source_checked_at nulls first,
      item_type,
      key
    limit limit_value
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'item_type',item_type,
          'key',key,
          'label',label,
          'catalog_version',catalog_version,
          'source_checked_at',source_checked_at,
          'source_urls',to_jsonb(source_urls),
          'source_count',source_count,
          'domain_count',domain_count,
          'domains',domains,
          'payload',payload
        )
        order by
          case
            when source_count=0 then 0
            when source_count=1 then 1
            when domain_count=0 then 2
            else 3
          end,
          source_checked_at nulls first,
          item_type,
          key
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    count(*) filter(where source_count<=1)::integer,
    count(*) filter(where domain_count<=1)::integer
  into
    items_value,
    item_count_value,
    single_source_count_value,
    single_domain_count_value
  from candidates;

  if item_count_value = 0 then
    raise exception '追加根拠リサーチ対象はありません。' using errcode='P0002';
  end if;

  select request.id
  into request_id
  from public.knowledge_refresh_requests request
  where request.channel='fresh'
    and request.status in ('pending','processing')
  order by request.id desc
  limit 1;

  if request_id is null then
    insert into public.knowledge_refresh_requests (
      channel,
      requested_at,
      status,
      research_summary
    ) values (
      'fresh',
      now(),
      'pending',
      'Source Diversity Research: independent official/primary evidence review'
    )
    returning id into request_id;

    update public.knowledge_refresh_channels channel
    set
      last_refresh_requested_at=now(),
      next_refresh_due_at=now()+make_interval(hours=>channel.refresh_hours),
      updated_at=now()
    where channel.channel='fresh';
  end if;

  return jsonb_build_object(
    'request_id',request_id,
    'item_count',item_count_value,
    'single_source_count',single_source_count_value,
    'single_domain_count',single_domain_count_value,
    'items',items_value
  );
end;
$function$;

revoke all on function public.admin_prepare_source_diversity_research(integer)
from public, anon;
grant execute on function public.admin_prepare_source_diversity_research(integer)
to authenticated;
