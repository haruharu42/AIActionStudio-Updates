-- Invoke the Knowledge research worker from pg_cron through pg_net.
-- The worker token stays in Vault and no service-role credential is sent over HTTP.

create extension if not exists pg_net;

create or replace function private.invoke_knowledge_automation_worker(
  p_trigger text default 'cron'
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  project_url text;
  worker_token text;
  request_id bigint;
  trigger_value text := case when lower(trim(coalesce(p_trigger,'')))='manual' then 'manual' else 'cron' end;
begin
  select settings.project_url
  into project_url
  from public.knowledge_automation_settings settings
  where settings.id=1;

  select secret.decrypted_secret
  into worker_token
  from vault.decrypted_secrets secret
  where secret.name='aas_knowledge_worker_token'
  limit 1;

  if project_url is null or worker_token is null or worker_token='' then
    raise exception 'knowledge automation worker configuration unavailable';
  end if;

  select net.http_post(
    url := rtrim(project_url,'/') || '/functions/v1/knowledge-research-worker',
    body := jsonb_build_object('trigger',trigger_value,'requested_at',now()),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-aas-worker-token',worker_token
    ),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end;
$function$;

revoke all on function private.invoke_knowledge_automation_worker(text) from public, anon, authenticated;

create or replace function public.admin_request_knowledge_automation_run()
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  run_id bigint;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  select run.id
  into run_id
  from public.knowledge_automation_runs run
  where run.status in ('pending','processing')
  order by run.id desc
  limit 1;

  if run_id is null then
    insert into public.knowledge_automation_runs (trigger_type,status,requested_by)
    values ('manual','pending',(select auth.uid()))
    returning id into run_id;
  end if;

  perform private.invoke_knowledge_automation_worker('manual');
  return run_id;
end;
$function$;

revoke all on function public.admin_request_knowledge_automation_run() from public, anon, authenticated;
grant execute on function public.admin_request_knowledge_automation_run() to authenticated;

select cron.schedule(
  'aas-knowledge-research-worker-6h',
  '23 */6 * * *',
  $cron$
    select private.invoke_knowledge_automation_worker('cron');
  $cron$
);
