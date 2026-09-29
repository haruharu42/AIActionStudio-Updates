-- Phase 60: server-enforced Knowledge / Prompt quality gate.
-- Validates review bundles before publication and re-validates inside v3 publish.
-- No public/anon access is granted.

create or replace function private.aas_validate_knowledge_refresh_bundle(p_bundle jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  bundle jsonb := coalesce(p_bundle, '{}'::jsonb);
  knowledge_items jsonb;
  prompt_items jsonb;
  item jsonb;
  blocking jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;

  clean_key text;
  clean_label text;
  clean_kind text;
  clean_provider text;
  clean_plan text;
  clean_task text;
  clean_summary text;
  priority_text text;
  priority_value integer := 70;

  tasks_value text[] := '{}';
  guidance_value text[] := '{}';
  deliverables_value text[] := '{}';
  cautions_value text[] := '{}';
  rules_value text[] := '{}';
  source_urls_value text[] := '{}';

  source_count integer := 0;
  task_reference_count integer := 0;

  allowed_tasks text[] := array[
    'title','article','image','social','promotion',
    'sidejob_content','sidejob_sns','sidejob_video','sidejob_affiliate',
    'sidejob_resale','sidejob_crowdsourcing','sidejob_skill_sales',
    'sidejob_digital_product','sidejob_outreach','sidejob_research',
    'sidejob_efficiency','sidejob_planning'
  ]::text[];

  allowed_prompt_tasks text[] := array[
    'all','title','article','image','social','promotion',
    'sidejob_content','sidejob_sns','sidejob_video','sidejob_affiliate',
    'sidejob_resale','sidejob_crowdsourcing','sidejob_skill_sales',
    'sidejob_digital_product','sidejob_outreach','sidejob_research',
    'sidejob_efficiency','sidejob_planning'
  ]::text[];
begin
  if jsonb_typeof(bundle) <> 'object' then
    return jsonb_build_object(
      'valid', false,
      'blocking', jsonb_build_array(jsonb_build_object(
        'code','bundle_not_object','item_type','bundle','key','',
        'message','JSONの最上位はオブジェクトである必要があります。'
      )),
      'warnings', warnings,
      'stats', jsonb_build_object(
        'knowledge_count',0,'prompt_count',0,'source_url_count',0,'task_reference_count',0
      )
    );
  end if;

  knowledge_items := coalesce(bundle -> 'knowledge_rules', '[]'::jsonb);
  prompt_items := coalesce(bundle -> 'prompt_optimizations', '[]'::jsonb);

  if jsonb_typeof(knowledge_items) <> 'array'
     or jsonb_typeof(prompt_items) <> 'array'
  then
    return jsonb_build_object(
      'valid', false,
      'blocking', jsonb_build_array(jsonb_build_object(
        'code','bundle_arrays_invalid','item_type','bundle','key','',
        'message','knowledge_rules と prompt_optimizations は配列である必要があります。'
      )),
      'warnings', warnings,
      'stats', jsonb_build_object(
        'knowledge_count',0,'prompt_count',0,'source_url_count',0,'task_reference_count',0
      )
    );
  end if;

  if jsonb_array_length(knowledge_items) = 0
     and jsonb_array_length(prompt_items) = 0
  then
    blocking := blocking || jsonb_build_array(jsonb_build_object(
      'code','bundle_empty','item_type','bundle','key','',
      'message','更新候補が1件もありません。'
    ));
  end if;

  if jsonb_array_length(knowledge_items) > 60
     or jsonb_array_length(prompt_items) > 60
  then
    blocking := blocking || jsonb_build_array(jsonb_build_object(
      'code','bundle_too_large','item_type','bundle','key','',
      'message','1回の更新でKnowledge / Promptはそれぞれ60件以下にしてください。'
    ));
  end if;

  if trim(coalesce(bundle ->> 'summary','')) = '' then
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code','summary_missing','item_type','bundle','key','',
      'message','今回の調査要約 summary が空です。変更なし領域を含めて確認内容を残すことを推奨します。'
    ));
  end if;

  if exists (
    select 1
    from (
      select trim(coalesce(value ->> 'key','')) as key
      from jsonb_array_elements(knowledge_items)
      union all
      select trim(coalesce(value ->> 'key','')) as key
      from jsonb_array_elements(prompt_items)
    ) as keys
    where key <> ''
    group by key
    having count(*) > 1
  ) then
    blocking := blocking || jsonb_build_array(jsonb_build_object(
      'code','duplicate_key','item_type','bundle','key','',
      'message','同じkeyがBundle内で重複しています。各Knowledge / Promptには一意のkeyを使用してください。'
    ));
  end if;

  for item in
    select value from jsonb_array_elements(knowledge_items)
  loop
    tasks_value := '{}';
    guidance_value := '{}';
    deliverables_value := '{}';
    cautions_value := '{}';
    source_urls_value := '{}';
    priority_value := 70;

    if jsonb_typeof(item) <> 'object' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_not_object','item_type','knowledge','key','',
        'message','Knowledge候補はJSONオブジェクトである必要があります。'
      ));
      continue;
    end if;

    clean_key := left(trim(coalesce(item ->> 'key','')),180);
    clean_label := left(trim(coalesce(item ->> 'label','')),120);
    clean_kind := lower(trim(coalesce(item ->> 'kind','')));
    clean_summary := left(trim(coalesce(item ->> 'source_summary','')),1000);
    priority_text := trim(coalesce(item ->> 'priority',''));

    if priority_text <> '' then
      if priority_text !~ '^[0-9]{1,3}$' then
        blocking := blocking || jsonb_build_array(jsonb_build_object(
          'code','knowledge_priority_invalid','item_type','knowledge','key',clean_key,
          'message','Knowledge priorityは0〜100の整数で指定してください。'
        ));
      else
        priority_value := priority_text::integer;
        if priority_value < 0 or priority_value > 100 then
          blocking := blocking || jsonb_build_array(jsonb_build_object(
            'code','knowledge_priority_invalid','item_type','knowledge','key',clean_key,
            'message','Knowledge priorityは0〜100の範囲で指定してください。'
          ));
        end if;
      end if;
    end if;

    if clean_key = '' or clean_key not like 'auto:%' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_key_invalid','item_type','knowledge','key',clean_key,
        'message','Knowledge keyは auto: で始まる一意の値が必要です。'
      ));
    end if;

    if clean_label = '' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_label_missing','item_type','knowledge','key',clean_key,
        'message','Knowledgeの表示名 label が必要です。'
      ));
    end if;

    if clean_kind not in ('age','genre','subgenre','publication','task','combination') then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_kind_invalid','item_type','knowledge','key',clean_key,
        'message','Knowledge kind が許可値ではありません。'
      ));
    end if;

    begin
      tasks_value := private.aas_json_text_array(item -> 'tasks', 20, 32);
      guidance_value := private.aas_json_text_array(item -> 'guidance', 40, 600);
      deliverables_value := private.aas_json_text_array(item -> 'deliverables', 40, 300);
      cautions_value := private.aas_json_text_array(item -> 'cautions', 40, 600);
      source_urls_value := private.aas_json_text_array(item -> 'source_urls', 20, 500);
    exception when others then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_arrays_invalid','item_type','knowledge','key',clean_key,
        'message','Knowledgeの配列項目（tasks / guidance / deliverables / cautions / source_urls）を確認してください。'
      ));
      continue;
    end;

    if not (tasks_value <@ allowed_tasks) then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_tasks_invalid','item_type','knowledge','key',clean_key,
        'message','Knowledgeに未対応のtaskが含まれています。'
      ));
    end if;

    if clean_kind = 'task' and cardinality(tasks_value) <> 1 then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','task_rule_scope_invalid','item_type','knowledge','key',clean_key,
        'message','kind=task のKnowledgeは対象taskを1つだけ指定してください。複数機能共通はcombinationを使用してください。'
      ));
    end if;

    if cardinality(guidance_value)
       + cardinality(deliverables_value)
       + cardinality(cautions_value) < 1
    then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_content_empty','item_type','knowledge','key',clean_key,
        'message','Knowledgeにはguidance / deliverables / cautionsのいずれか1件以上が必要です。'
      ));
    end if;

    if cardinality(source_urls_value) < 1 then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_sources_missing','item_type','knowledge','key',clean_key,
        'message','Knowledgeには根拠URLが1件以上必要です。'
      ));
    elsif exists (
      select 1
      from unnest(source_urls_value) as source_url
      where source_url !~* '^https://[^[:space:]]+$'
    ) then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_source_url_invalid','item_type','knowledge','key',clean_key,
        'message','Knowledgeの根拠URLはhttps://で始まる完全URLにしてください。'
      ));
    end if;

    if clean_summary = '' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','knowledge_source_summary_missing','item_type','knowledge','key',clean_key,
        'message','Knowledgeには根拠と変更点を説明するsource_summaryが必要です。'
      ));
    end if;

    if priority_value between 98 and 100 then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'code','knowledge_priority_high','item_type','knowledge','key',clean_key,
        'message','priorityが98以上です。高優先度が必要な理由と既存ルールとの競合を確認してください。'
      ));
    end if;

    source_count := source_count + cardinality(source_urls_value);
    task_reference_count := task_reference_count + cardinality(tasks_value);
  end loop;

  for item in
    select value from jsonb_array_elements(prompt_items)
  loop
    rules_value := '{}';
    source_urls_value := '{}';
    priority_value := 70;

    if jsonb_typeof(item) <> 'object' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_not_object','item_type','prompt','key','',
        'message','Prompt最適化候補はJSONオブジェクトである必要があります。'
      ));
      continue;
    end if;

    clean_key := left(trim(coalesce(item ->> 'key','')),180);
    clean_provider := lower(trim(coalesce(item ->> 'provider','all')));
    clean_plan := lower(trim(coalesce(item ->> 'plan','all')));
    clean_task := lower(trim(coalesce(item ->> 'task','all')));
    clean_summary := left(trim(coalesce(item ->> 'source_summary','')),1000);
    priority_text := trim(coalesce(item ->> 'priority',''));

    if priority_text <> '' then
      if priority_text !~ '^[0-9]{1,3}$' then
        blocking := blocking || jsonb_build_array(jsonb_build_object(
          'code','prompt_priority_invalid','item_type','prompt','key',clean_key,
          'message','Prompt priorityは0〜100の整数で指定してください。'
        ));
      else
        priority_value := priority_text::integer;
        if priority_value < 0 or priority_value > 100 then
          blocking := blocking || jsonb_build_array(jsonb_build_object(
            'code','prompt_priority_invalid','item_type','prompt','key',clean_key,
            'message','Prompt priorityは0〜100の範囲で指定してください。'
          ));
        end if;
      end if;
    end if;

    if clean_key = '' or clean_key not like 'auto:%' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_key_invalid','item_type','prompt','key',clean_key,
        'message','Prompt keyは auto: で始まる一意の値が必要です。'
      ));
    end if;

    if clean_provider not in ('all','chatgpt','claude','gemini') then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_provider_invalid','item_type','prompt','key',clean_key,
        'message','Prompt provider が許可値ではありません。'
      ));
    end if;

    if clean_plan not in ('all','free','paid') then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_plan_invalid','item_type','prompt','key',clean_key,
        'message','Prompt plan が許可値ではありません。'
      ));
    end if;

    if not (clean_task = any(allowed_prompt_tasks)) then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_task_invalid','item_type','prompt','key',clean_key,
        'message','Prompt task が未対応です。'
      ));
    end if;

    begin
      rules_value := private.aas_json_text_array(item -> 'rules', 40, 600);
      source_urls_value := private.aas_json_text_array(item -> 'source_urls', 20, 500);
    exception when others then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_arrays_invalid','item_type','prompt','key',clean_key,
        'message','Promptのrules / source_urls配列を確認してください。'
      ));
      continue;
    end;

    if cardinality(rules_value) < 1 then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_rules_missing','item_type','prompt','key',clean_key,
        'message','Prompt最適化にはrulesが1件以上必要です。'
      ));
    end if;

    if cardinality(source_urls_value) < 1 then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_sources_missing','item_type','prompt','key',clean_key,
        'message','Prompt最適化には根拠URLが1件以上必要です。'
      ));
    elsif exists (
      select 1
      from unnest(source_urls_value) as source_url
      where source_url !~* '^https://[^[:space:]]+$'
    ) then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_source_url_invalid','item_type','prompt','key',clean_key,
        'message','Prompt最適化の根拠URLはhttps://で始まる完全URLにしてください。'
      ));
    end if;

    if clean_summary = '' then
      blocking := blocking || jsonb_build_array(jsonb_build_object(
        'code','prompt_source_summary_missing','item_type','prompt','key',clean_key,
        'message','Prompt最適化には公式情報との対応を説明するsource_summaryが必要です。'
      ));
    end if;

    if clean_task = 'all' then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'code','prompt_task_all','item_type','prompt','key',clean_key,
        'message','task=allです。本当に全機能へ共通するルールか確認してください。'
      ));
    end if;

    if priority_value between 98 and 100 then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'code','prompt_priority_high','item_type','prompt','key',clean_key,
        'message','Prompt priorityが98以上です。全体への影響が大きいため既存ルールとの競合を確認してください。'
      ));
    end if;

    source_count := source_count + cardinality(source_urls_value);
    if clean_task <> 'all' then
      task_reference_count := task_reference_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'valid', jsonb_array_length(blocking) = 0,
    'blocking', blocking,
    'warnings', warnings,
    'stats', jsonb_build_object(
      'knowledge_count', jsonb_array_length(knowledge_items),
      'prompt_count', jsonb_array_length(prompt_items),
      'source_url_count', source_count,
      'task_reference_count', task_reference_count
    )
  );
end;
$function$;

revoke all on function private.aas_validate_knowledge_refresh_bundle(jsonb)
from public, anon, authenticated;

create or replace function public.admin_validate_knowledge_refresh_bundle(p_bundle jsonb)
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

  return private.aas_validate_knowledge_refresh_bundle(p_bundle);
end;
$function$;

revoke all on function public.admin_validate_knowledge_refresh_bundle(jsonb)
from public, anon;
grant execute on function public.admin_validate_knowledge_refresh_bundle(jsonb)
to authenticated;

create or replace function public.admin_publish_knowledge_refresh_bundle_v3(
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
  result_row record;
begin
  if (select auth.uid()) is null
     or not (select private.is_active_admin())
  then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  quality := private.aas_validate_knowledge_refresh_bundle(p_bundle);

  if coalesce((quality ->> 'valid')::boolean, false) is not true then
    raise exception 'knowledge quality gate failed: %',
      coalesce(quality -> 'blocking', '[]'::jsonb)::text
      using errcode = '22023';
  end if;

  select *
  into result_row
  from public.admin_publish_knowledge_refresh_bundle_v2(p_request_id, p_bundle);

  return query
  select
    result_row.channel::text,
    result_row.published_version::bigint,
    result_row.knowledge_count::integer,
    result_row.prompt_count::integer,
    result_row.change_details::jsonb;
end;
$function$;

revoke all on function public.admin_publish_knowledge_refresh_bundle_v3(bigint, jsonb)
from public, anon;
grant execute on function public.admin_publish_knowledge_refresh_bundle_v3(bigint, jsonb)
to authenticated;
