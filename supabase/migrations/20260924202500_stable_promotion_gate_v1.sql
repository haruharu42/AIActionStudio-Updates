-- Phase 63: Stable semantic promotion gate.
-- Replays the production Cloud Knowledge rank against the prospective Stable catalog
-- and blocks Stable publication when required side-hustle selection contracts regress.

-- Stable is a durable snapshot, not a time-based view of mutable Fresh rows.
create table if not exists public.knowledge_stable_catalog (
  key text primary key,
  kind text not null,
  label text not null,
  parent_label text,
  aliases text[] not null default '{}',
  guidance text[] not null default '{}',
  deliverables text[] not null default '{}',
  cautions text[] not null default '{}',
  tasks text[] not null default '{}',
  priority smallint not null default 50,
  status text not null default 'active',
  catalog_version bigint not null default 1,
  source_urls text[] not null default '{}',
  source_summary text,
  source_checked_at timestamptz,
  promoted_at timestamptz not null default now()
);

create table if not exists public.prompt_optimization_stable_catalog (
  key text primary key,
  provider text not null,
  plan text not null,
  task text not null,
  rules text[] not null default '{}',
  priority smallint not null default 70,
  catalog_version bigint not null default 1,
  source_urls text[] not null default '{}',
  source_summary text,
  source_checked_at timestamptz,
  status text not null default 'active',
  promoted_at timestamptz not null default now()
);

alter table public.knowledge_stable_catalog enable row level security;
alter table public.prompt_optimization_stable_catalog enable row level security;
revoke all on table public.knowledge_stable_catalog from public, anon, authenticated;
revoke all on table public.prompt_optimization_stable_catalog from public, anon, authenticated;

-- Preserve any already-explicit Stable rows if a legacy environment has them.
insert into public.knowledge_stable_catalog (
  key,kind,label,parent_label,aliases,guidance,deliverables,cautions,tasks,
  priority,status,catalog_version,source_urls,source_summary,source_checked_at,promoted_at
)
select
  key,kind,label,parent_label,aliases,guidance,deliverables,cautions,tasks,
  priority,status,catalog_version,source_urls,source_summary,source_checked_at,now()
from public.knowledge_catalog
where status='active' and release_channel='both'
on conflict (key) do nothing;

insert into public.prompt_optimization_stable_catalog (
  key,provider,plan,task,rules,priority,catalog_version,
  source_urls,source_summary,source_checked_at,status,promoted_at
)
select
  key,provider,plan,task,rules,priority,catalog_version,
  source_urls,source_summary,source_checked_at,status,now()
from public.prompt_optimization_catalog
where status='active' and release_channel='both'
on conflict (key) do nothing;

create or replace function private.aas_validate_stable_promotion_bundle(p_bundle jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  bundle jsonb := coalesce(p_bundle, '{}'::jsonb);
  quality jsonb;
  task_reports jsonb := '[]'::jsonb;
  blocking jsonb := '[]'::jsonb;
  task_report jsonb;
  task_name text;
  selected_count integer;
  core_pass boolean;
  support_pass boolean;
  top_task_specific boolean;
  missing_source_count integer;
  stale_source_count integer;
  stale_days integer := 90;
  item jsonb;
  clean_key text;
  existing_release text;
  existing_stable_at timestamptz;
  existing_matches boolean;
begin
  quality := private.aas_validate_knowledge_refresh_bundle(bundle);

  if coalesce((quality ->> 'valid')::boolean, false) is not true then
    return jsonb_build_object(
      'valid', false,
      'blocking', coalesce(quality -> 'blocking', '[]'::jsonb),
      'tasks', task_reports,
      'stale_days', stale_days
    );
  end if;

  -- Stable may only promote a key that was first published to Fresh and completed its wait window.
  for item in
    select value from jsonb_array_elements(coalesce(bundle -> 'knowledge_rules','[]'::jsonb))
  loop
    clean_key := left(trim(coalesce(item ->> 'key','')),180);
    existing_release := null;
    existing_stable_at := null;
    existing_matches := null;

    select
      catalog.release_channel,
      catalog.stable_available_at,
      (
        lower(trim(coalesce(item ->> 'kind',''))) = catalog.kind
        and left(trim(coalesce(item ->> 'label','')),120) = catalog.label
        and nullif(left(trim(coalesce(item ->> 'parent_label','')),120),'') is not distinct from catalog.parent_label
        and private.aas_json_text_array(item -> 'aliases',40,120) = catalog.aliases
        and private.aas_json_text_array(item -> 'guidance',40,600) = catalog.guidance
        and private.aas_json_text_array(item -> 'deliverables',40,300) = catalog.deliverables
        and private.aas_json_text_array(item -> 'cautions',40,600) = catalog.cautions
        and private.aas_json_text_array(item -> 'tasks',20,32) = catalog.tasks
        and greatest(0,least(100,coalesce(nullif(item ->> 'priority','')::integer,70))) = catalog.priority::integer
        and private.aas_json_text_array(item -> 'source_urls',20,500) = catalog.source_urls
        and nullif(left(trim(coalesce(item ->> 'source_summary','')),1000),'') is not distinct from catalog.source_summary
      )
    into existing_release,existing_stable_at,existing_matches
    from public.knowledge_catalog as catalog
    where catalog.key=clean_key and catalog.status='active';

    if not found or existing_release <> 'fresh_first' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_requires_fresh_trial',
        'item_type','knowledge',
        'key',clean_key,
        'message','Stableへ昇格するKnowledgeは、先に同じkeyをFreshで公開して検証してください。'
      ));
    elsif existing_stable_at > now() then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_wait_window_active',
        'item_type','knowledge',
        'key',clean_key,
        'message','Fresh検証期間がまだ終了していません。Stable昇格可能時刻: ' || existing_stable_at::text
      ));
    elsif existing_matches is not true then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_bundle_differs_from_fresh',
        'item_type','knowledge',
        'key',clean_key,
        'message','Stable候補の内容がFreshで検証した同一keyの内容と一致しません。変更は先にFreshへ公開してください。'
      ));
    end if;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(bundle -> 'prompt_optimizations','[]'::jsonb))
  loop
    clean_key := left(trim(coalesce(item ->> 'key','')),180);
    existing_release := null;
    existing_stable_at := null;
    existing_matches := null;

    select
      catalog.release_channel,
      catalog.stable_available_at,
      (
        lower(trim(coalesce(item ->> 'provider','all'))) = catalog.provider
        and lower(trim(coalesce(item ->> 'plan','all'))) = catalog.plan
        and lower(trim(coalesce(item ->> 'task','all'))) = catalog.task
        and private.aas_json_text_array(item -> 'rules',40,600) = catalog.rules
        and greatest(0,least(100,coalesce(nullif(item ->> 'priority','')::integer,70))) = catalog.priority::integer
        and private.aas_json_text_array(item -> 'source_urls',20,500) = catalog.source_urls
        and nullif(left(trim(coalesce(item ->> 'source_summary','')),1000),'') is not distinct from catalog.source_summary
      )
    into existing_release,existing_stable_at,existing_matches
    from public.prompt_optimization_catalog as catalog
    where catalog.key=clean_key and catalog.status='active';

    if not found or existing_release <> 'fresh_first' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_requires_fresh_trial',
        'item_type','prompt',
        'key',clean_key,
        'message','Stableへ昇格するPrompt最適化は、先に同じkeyをFreshで公開して検証してください。'
      ));
    elsif existing_stable_at > now() then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_wait_window_active',
        'item_type','prompt',
        'key',clean_key,
        'message','Fresh検証期間がまだ終了していません。Stable昇格可能時刻: ' || existing_stable_at::text
      ));
    elsif existing_matches is not true then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_bundle_differs_from_fresh',
        'item_type','prompt',
        'key',clean_key,
        'message','Stable候補の内容がFreshで検証した同一keyのPrompt最適化と一致しません。変更は先にFreshへ公開してください。'
      ));
    end if;
  end loop;

  with
  contract_tasks(task, support_prefixes) as (
    values
      ('sidejob_content', array['auto:cross:commercial:','auto:cross:ecommerce:','auto:cross:promotion:','auto:cross:copyright:']::text[]),
      ('sidejob_sns', array['auto:cross:analytics:','auto:cross:sns-outreach:','auto:cross:copyright:','auto:cross:promotion:']::text[]),
      ('sidejob_video', array['auto:cross:analytics:','auto:cross:copyright:']::text[]),
      ('sidejob_affiliate', array['auto:cross:commercial:','auto:cross:ecommerce:','auto:cross:promotion:','auto:cross:copyright:']::text[]),
      ('sidejob_resale', array['auto:task:sidejob_resale:price-fee-shipping-margin','auto:cross:tax:']::text[]),
      ('sidejob_crowdsourcing', array['auto:cross:marketplace:','auto:cross:privacy:','auto:cross:service-work:']::text[]),
      ('sidejob_skill_sales', array['auto:cross:ecommerce:','auto:cross:marketplace:','auto:cross:privacy:','auto:cross:copyright:']::text[]),
      ('sidejob_digital_product', array['auto:cross:commercial:','auto:cross:ecommerce:','auto:cross:promotion:','auto:cross:copyright:']::text[]),
      ('sidejob_outreach', array['auto:cross:service-work:','auto:cross:marketplace:','auto:cross:privacy:','auto:cross:sns-outreach:']::text[]),
      ('sidejob_research', array['auto:cross:research:','auto:cross:research-planning:','auto:cross:research-efficiency:','auto:cross:ai-workflow:']::text[]),
      ('sidejob_efficiency', array['auto:cross:ai-workflow:','auto:cross:research-efficiency:','auto:cross:privacy:']::text[]),
      ('sidejob_planning', array['auto:cross:research-planning:','auto:cross:research:','auto:cross:tax:']::text[])
  ),
  bundle_knowledge as (
    select
      left(trim(coalesce(value ->> 'key','')),180) as key,
      lower(trim(coalesce(value ->> 'kind',''))) as kind,
      array(
        select value_text
        from jsonb_array_elements_text(coalesce(value -> 'tasks','[]'::jsonb)) as value_text
      )::text[] as tasks,
      greatest(0, least(100, coalesce(nullif(value ->> 'priority','')::integer,70))) as priority,
      array(
        select source_url
        from jsonb_array_elements_text(coalesce(value -> 'source_urls','[]'::jsonb)) as source_url
      )::text[] as source_urls,
      now() as source_checked_at
    from jsonb_array_elements(coalesce(bundle -> 'knowledge_rules','[]'::jsonb)) as value
  ),
  prospective_catalog as (
    select
      catalog.key,
      catalog.kind,
      catalog.tasks,
      catalog.priority::integer as priority,
      catalog.source_urls,
      catalog.source_checked_at
    from public.knowledge_stable_catalog as catalog
    where catalog.status = 'active'
      and not exists (
        select 1
        from bundle_knowledge as incoming
        where incoming.key = catalog.key
      )

    union all

    select
      incoming.key,
      incoming.kind,
      incoming.tasks,
      incoming.priority,
      incoming.source_urls,
      incoming.source_checked_at
    from bundle_knowledge as incoming
  ),
  eligible as (
    select
      contract.task,
      contract.support_prefixes,
      catalog.key,
      catalog.kind,
      catalog.tasks,
      catalog.priority,
      catalog.source_urls,
      catalog.source_checked_at,
      case catalog.kind
        when 'task' then 30
        when 'subgenre' then 25
        when 'genre' then 20
        when 'publication' then 15
        when 'age' then 10
        else 5
      end as specificity
    from contract_tasks as contract
    join prospective_catalog as catalog
      on contract.task = any(catalog.tasks)
  ),
  ranked as (
    select
      eligible.*,
      eligible.priority + eligible.specificity as score,
      row_number() over (
        partition by eligible.task
        order by
          eligible.priority + eligible.specificity desc,
          eligible.priority desc,
          eligible.specificity desc,
          eligible.key asc
      ) as position
    from eligible
  ),
  top_five as (
    select *
    from ranked
    where position <= 5
  ),
  aggregated as (
    select
      contract.task,
      coalesce(count(top_five.key),0)::integer as selected_count,
      coalesce(bool_or(top_five.key like ('auto:task:' || contract.task || ':%')),false) as core_pass,
      coalesce(bool_or(
        exists (
          select 1
          from unnest(contract.support_prefixes) as support_prefix
          where top_five.key like (support_prefix || '%')
        )
      ),false) as support_pass,
      coalesce(bool_or(
        top_five.position = 1
        and top_five.kind = 'task'
        and contract.task = any(top_five.tasks)
      ),false) as top_task_specific,
      coalesce(count(*) filter (
        where top_five.key is not null
          and (
            coalesce(cardinality(top_five.source_urls),0) = 0
            or top_five.source_checked_at is null
          )
      ),0)::integer as missing_source_count,
      coalesce(count(*) filter (
        where top_five.key is not null
          and top_five.source_checked_at is not null
          and top_five.source_checked_at < now() - make_interval(days => stale_days)
      ),0)::integer as stale_source_count
    from contract_tasks as contract
    left join top_five
      on top_five.task = contract.task
    group by contract.task
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task', aggregated.task,
      'selected_count', aggregated.selected_count,
      'core_pass', aggregated.core_pass,
      'support_pass', aggregated.support_pass,
      'top_task_specific', aggregated.top_task_specific,
      'missing_source_count', aggregated.missing_source_count,
      'stale_source_count', aggregated.stale_source_count
    )
    order by aggregated.task
  ),'[]'::jsonb)
  into task_reports
  from aggregated;

  for task_report in
    select value from jsonb_array_elements(task_reports)
  loop
    task_name := task_report ->> 'task';
    selected_count := coalesce((task_report ->> 'selected_count')::integer,0);
    core_pass := coalesce((task_report ->> 'core_pass')::boolean,false);
    support_pass := coalesce((task_report ->> 'support_pass')::boolean,false);
    top_task_specific := coalesce((task_report ->> 'top_task_specific')::boolean,false);
    missing_source_count := coalesce((task_report ->> 'missing_source_count')::integer,0);
    stale_source_count := coalesce((task_report ->> 'stale_source_count')::integer,0);

    if selected_count < 5 then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_top5_shortage',
        'item_type','bundle',
        'key',task_name,
        'message',task_name || ' のStable候補がTop 5を満たしていません（' || selected_count || '/5）。'
      ));
    end if;

    if not core_pass then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_core_contract_missing',
        'item_type','bundle',
        'key',task_name,
        'message',task_name || ' の副業固有KnowledgeがStable Top 5から外れています。'
      ));
    end if;

    if not support_pass then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_support_contract_missing',
        'item_type','bundle',
        'key',task_name,
        'message',task_name || ' の補助Knowledge選択契約をStable Top 5が満たしていません。'
      ));
    end if;

    if not top_task_specific then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_top_rule_not_task_specific',
        'item_type','bundle',
        'key',task_name,
        'message',task_name || ' のStable最上位Knowledgeが副業固有ルールではありません。'
      ));
    end if;

    if missing_source_count > 0 then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_selected_source_missing',
        'item_type','bundle',
        'key',task_name,
        'message',task_name || ' のStable Top 5に根拠URLまたは確認日がないKnowledgeがあります。'
      ));
    end if;

    if stale_source_count > 0 then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','stable_selected_source_stale',
        'item_type','bundle',
        'key',task_name,
        'message',task_name || ' のStable Top 5に根拠確認から' || stale_days || '日を超えたKnowledgeがあります。'
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'valid', jsonb_array_length(blocking) = 0,
    'blocking', blocking,
    'tasks', task_reports,
    'stale_days', stale_days
  );
end;
$function$;

revoke all on function private.aas_validate_stable_promotion_bundle(jsonb)
from public, anon, authenticated;

create or replace function public.admin_validate_stable_promotion_bundle(p_bundle jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null
     or not (select private.is_active_admin())
  then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  return private.aas_validate_stable_promotion_bundle(p_bundle);
end;
$function$;

revoke all on function public.admin_validate_stable_promotion_bundle(jsonb)
from public, anon;
grant execute on function public.admin_validate_stable_promotion_bundle(jsonb)
to authenticated;

create or replace function public.admin_publish_knowledge_refresh_bundle_v4(
  p_request_id bigint,
  p_bundle jsonb
)
returns table (
  channel text,
  published_version bigint,
  knowledge_count integer,
  prompt_count integer,
  change_details jsonb
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  quality jsonb;
  stable_gate jsonb;
  request_channel text;
  result_row record;
begin
  if (select auth.uid()) is null
     or not (select private.is_active_admin())
  then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  quality := private.aas_validate_knowledge_refresh_bundle(p_bundle);
  if coalesce((quality ->> 'valid')::boolean,false) is not true then
    raise exception 'knowledge quality gate failed: %',
      coalesce(quality -> 'blocking','[]'::jsonb)::text
      using errcode = '22023';
  end if;

  select request.channel
  into request_channel
  from public.knowledge_refresh_requests as request
  where request.id = p_request_id;

  if request_channel is null then
    raise exception 'refresh request not found' using errcode = 'P0002';
  end if;

  if request_channel = 'stable' then
    stable_gate := private.aas_validate_stable_promotion_bundle(p_bundle);
    if coalesce((stable_gate ->> 'valid')::boolean,false) is not true then
      raise exception 'stable promotion gate failed: %',
        coalesce(stable_gate -> 'blocking','[]'::jsonb)::text
        using errcode = '22023';
    end if;
  end if;

  select *
  into result_row
  from public.admin_publish_knowledge_refresh_bundle_v3(p_request_id,p_bundle);

  if request_channel = 'stable' then
    insert into public.knowledge_stable_catalog (
      key,kind,label,parent_label,aliases,guidance,deliverables,cautions,tasks,
      priority,status,catalog_version,source_urls,source_summary,source_checked_at,promoted_at
    )
    select
      catalog.key,catalog.kind,catalog.label,catalog.parent_label,catalog.aliases,
      catalog.guidance,catalog.deliverables,catalog.cautions,catalog.tasks,
      catalog.priority,catalog.status,catalog.catalog_version,catalog.source_urls,
      catalog.source_summary,catalog.source_checked_at,now()
    from public.knowledge_catalog as catalog
    where catalog.key in (
      select left(trim(coalesce(value ->> 'key','')),180)
      from jsonb_array_elements(coalesce(p_bundle -> 'knowledge_rules','[]'::jsonb)) as value
    )
    on conflict (key) do update set
      kind=excluded.kind,
      label=excluded.label,
      parent_label=excluded.parent_label,
      aliases=excluded.aliases,
      guidance=excluded.guidance,
      deliverables=excluded.deliverables,
      cautions=excluded.cautions,
      tasks=excluded.tasks,
      priority=excluded.priority,
      status=excluded.status,
      catalog_version=excluded.catalog_version,
      source_urls=excluded.source_urls,
      source_summary=excluded.source_summary,
      source_checked_at=excluded.source_checked_at,
      promoted_at=now();

    insert into public.prompt_optimization_stable_catalog (
      key,provider,plan,task,rules,priority,catalog_version,
      source_urls,source_summary,source_checked_at,status,promoted_at
    )
    select
      catalog.key,catalog.provider,catalog.plan,catalog.task,catalog.rules,
      catalog.priority,catalog.catalog_version,catalog.source_urls,
      catalog.source_summary,catalog.source_checked_at,catalog.status,now()
    from public.prompt_optimization_catalog as catalog
    where catalog.key in (
      select left(trim(coalesce(value ->> 'key','')),180)
      from jsonb_array_elements(coalesce(p_bundle -> 'prompt_optimizations','[]'::jsonb)) as value
    )
    on conflict (key) do update set
      provider=excluded.provider,
      plan=excluded.plan,
      task=excluded.task,
      rules=excluded.rules,
      priority=excluded.priority,
      catalog_version=excluded.catalog_version,
      source_urls=excluded.source_urls,
      source_summary=excluded.source_summary,
      source_checked_at=excluded.source_checked_at,
      status=excluded.status,
      promoted_at=now();
  end if;

  return query
  select
    result_row.channel::text,
    result_row.published_version::bigint,
    result_row.knowledge_count::integer,
    result_row.prompt_count::integer,
    result_row.change_details::jsonb;
end;
$function$;

revoke all on function public.admin_publish_knowledge_refresh_bundle_v4(bigint,jsonb)
from public, anon;
grant execute on function public.admin_publish_knowledge_refresh_bundle_v4(bigint,jsonb)
to authenticated;


-- Admins/Creator Membership keep seeing Fresh. Ordinary users see only explicitly promoted Stable snapshots.
create or replace function public.list_my_active_knowledge_catalog_v2()
returns table (
  key text,kind text,label text,parent_label text,aliases text[],
  guidance text[],deliverables text[],cautions text[],tasks text[],
  priority smallint,status text,catalog_version bigint,source_urls text[],
  source_summary text,source_checked_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  member_access boolean := false;
begin
  if current_user_id is null
     or not (select private.is_active_profile())
     or not (select public.can_access_product('AAS-PWA-BETA'))
  then
    raise exception 'active PWA access required' using errcode='42501';
  end if;

  member_access := (select private.is_active_admin())
    or (select public.has_active_creator_membership());

  if member_access then
    return query
    select
      catalog.key,catalog.kind,catalog.label,catalog.parent_label,catalog.aliases,
      catalog.guidance,catalog.deliverables,catalog.cautions,catalog.tasks,
      catalog.priority,catalog.status,catalog.catalog_version,catalog.source_urls,
      catalog.source_summary,catalog.source_checked_at
    from public.knowledge_catalog as catalog
    where catalog.status='active'
    order by catalog.priority desc,catalog.catalog_version desc,catalog.key
    limit 500;
  else
    return query
    select
      catalog.key,catalog.kind,catalog.label,catalog.parent_label,catalog.aliases,
      catalog.guidance,catalog.deliverables,catalog.cautions,catalog.tasks,
      catalog.priority,catalog.status,catalog.catalog_version,catalog.source_urls,
      catalog.source_summary,catalog.source_checked_at
    from public.knowledge_stable_catalog as catalog
    where catalog.status='active'
    order by catalog.priority desc,catalog.catalog_version desc,catalog.key
    limit 500;
  end if;
end;
$function$;

create or replace function public.list_my_active_prompt_optimizations()
returns table (
  key text,provider text,plan text,task text,rules text[],priority smallint,
  catalog_version bigint,source_urls text[],source_summary text,source_checked_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  member_access boolean := false;
begin
  if current_user_id is null
     or not (select private.is_active_profile())
     or not (select public.can_access_product('AAS-PWA-BETA'))
  then
    raise exception 'active PWA access required' using errcode='42501';
  end if;

  member_access := (select private.is_active_admin())
    or (select public.has_active_creator_membership());

  if member_access then
    return query
    select
      item.key,item.provider,item.plan,item.task,item.rules,item.priority,
      item.catalog_version,item.source_urls,item.source_summary,item.source_checked_at
    from public.prompt_optimization_catalog as item
    where item.status='active'
    order by item.priority desc,item.catalog_version desc,item.key
    limit 300;
  else
    return query
    select
      item.key,item.provider,item.plan,item.task,item.rules,item.priority,
      item.catalog_version,item.source_urls,item.source_summary,item.source_checked_at
    from public.prompt_optimization_stable_catalog as item
    where item.status='active'
    order by item.priority desc,item.catalog_version desc,item.key
    limit 300;
  end if;
end;
$function$;

revoke all on function public.list_my_active_knowledge_catalog_v2() from public, anon;
grant execute on function public.list_my_active_knowledge_catalog_v2() to authenticated;
revoke all on function public.list_my_active_prompt_optimizations() from public, anon;
grant execute on function public.list_my_active_prompt_optimizations() to authenticated;
