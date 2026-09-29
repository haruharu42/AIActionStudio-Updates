-- Phase 67: Knowledge Source Risk / Diversity Dashboard.
-- Read-only admin reporting. No source is accepted/rejected automatically.

create or replace function public.admin_get_knowledge_source_risk_report()
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

  with all_items as (
    select
      'knowledge'::text as item_type,
      item.key,
      item.label,
      item.catalog_version,
      item.release_channel,
      item.source_checked_at,
      item.source_urls
    from public.knowledge_catalog item
    where item.status='active'

    union all

    select
      'prompt'::text,
      item.key,
      (item.provider || ' / ' || item.task)::text,
      item.catalog_version,
      item.release_channel,
      item.source_checked_at,
      item.source_urls
    from public.prompt_optimization_catalog item
    where item.status='active'
  ),
  url_rows as (
    select
      item.item_type,
      item.key,
      item.label,
      item.catalog_version,
      item.release_channel,
      item.source_checked_at,
      source_url,
      lower(
        regexp_replace(
          regexp_replace(source_url, '^https?://', '', 'i'),
          '/.*$',
          ''
        )
      ) as raw_host
    from all_items item
    cross join lateral unnest(coalesce(item.source_urls, array[]::text[])) as source_url
    where source_url ~* '^https://'
  ),
  normalized_urls as (
    select
      url_rows.*,
      regexp_replace(raw_host, '^www\.', '', 'i') as domain
    from url_rows
  ),
  item_domain_counts as (
    select
      item.item_type,
      item.key,
      item.label,
      item.catalog_version,
      item.release_channel,
      item.source_checked_at,
      coalesce(cardinality(item.source_urls),0)::integer as source_count,
      count(distinct urls.domain)::integer as domain_count,
      to_jsonb(coalesce(item.source_urls,array[]::text[])) as source_urls
    from all_items item
    left join normalized_urls urls
      on urls.item_type=item.item_type and urls.key=item.key
    group by
      item.item_type,item.key,item.label,item.catalog_version,
      item.release_channel,item.source_checked_at,item.source_urls
  ),
  domain_usage as (
    select
      domain,
      count(*)::integer as url_count,
      count(distinct item_type || ':' || key)::integer as item_count
    from normalized_urls
    where nullif(domain,'') is not null
    group by domain
  ),
  domain_summary as (
    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'domain',domain,
          'item_count',item_count,
          'url_count',url_count
        )
        order by item_count desc,url_count desc,domain
      ),'[]'::jsonb) as domains,
      count(*)::integer as unique_domains,
      coalesce(max(item_count),0)::integer as top_item_count
    from domain_usage
  ),
  review_items as (
    select *
    from item_domain_counts
    where source_count <= 1 or domain_count <= 1
    order by
      case when source_count=0 then 0 when domain_count=0 then 1 when source_count=1 then 2 else 3 end,
      item_type,
      key
    limit 30
  ),
  review_summary as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'item_type',item_type,
        'key',key,
        'label',label,
        'catalog_version',catalog_version,
        'release_channel',release_channel,
        'source_checked_at',source_checked_at,
        'source_count',source_count,
        'domain_count',domain_count,
        'source_urls',source_urls
      )
      order by
        case when source_count=0 then 0 when domain_count=0 then 1 when source_count=1 then 2 else 3 end,
        item_type,key
    ),'[]'::jsonb) as items
    from review_items
  )
  select jsonb_build_object(
    'item_count',count(*)::integer,
    'knowledge_count',count(*) filter(where item_type='knowledge')::integer,
    'prompt_count',count(*) filter(where item_type='prompt')::integer,
    'zero_source_count',count(*) filter(where source_count=0)::integer,
    'single_source_count',count(*) filter(where source_count=1)::integer,
    'single_domain_count',count(*) filter(where domain_count=1)::integer,
    'multi_domain_count',count(*) filter(where domain_count>=2)::integer,
    'unique_domain_count',(select unique_domains from domain_summary),
    'top_domain_item_count',(select top_item_count from domain_summary),
    'top_domain_share_percent',
      case when count(*)=0 then 0
           else round(((select top_item_count from domain_summary)::numeric / count(*)::numeric) * 100,1)
      end,
    'domains',(select domains from domain_summary),
    'review_items',(select items from review_summary)
  )
  into result
  from item_domain_counts;

  return coalesce(result,jsonb_build_object(
    'item_count',0,
    'knowledge_count',0,
    'prompt_count',0,
    'zero_source_count',0,
    'single_source_count',0,
    'single_domain_count',0,
    'multi_domain_count',0,
    'unique_domain_count',0,
    'top_domain_item_count',0,
    'top_domain_share_percent',0,
    'domains','[]'::jsonb,
    'review_items','[]'::jsonb
  ));
end;
$function$;

revoke all on function public.admin_get_knowledge_source_risk_report()
from public, anon;
grant execute on function public.admin_get_knowledge_source_risk_report()
to authenticated;
