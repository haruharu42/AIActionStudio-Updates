create table if not exists public.promotion_screenshot_analysis_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  provider text not null default 'openai' check (provider = 'openai'),
  model text not null default 'gpt-5.6-luna',
  max_images smallint not null default 4 check (max_images between 1 and 4),
  secret_name text not null default 'aas_promotion_screenshot_openai_api_key',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.promotion_screenshot_analysis_settings enable row level security;
alter table public.promotion_screenshot_analysis_settings force row level security;

revoke all on table public.promotion_screenshot_analysis_settings from public, anon, authenticated;

insert into public.promotion_screenshot_analysis_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.admin_get_promotion_screenshot_analysis_config()
returns table (
  enabled boolean,
  provider text,
  model text,
  max_images smallint,
  api_key_configured boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  return query
  select
    settings.enabled,
    settings.provider,
    settings.model,
    settings.max_images,
    exists(select 1 from vault.secrets secret where secret.name = settings.secret_name),
    settings.updated_at
  from public.promotion_screenshot_analysis_settings settings
  where settings.id = 1;
end;
$function$;

create or replace function public.admin_set_promotion_screenshot_analysis_config(
  p_enabled boolean,
  p_model text,
  p_max_images integer,
  p_api_key text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  model_value text := btrim(coalesce(p_model, ''));
  max_images_value integer := greatest(1, least(coalesce(p_max_images, 4), 4));
  api_key_value text := btrim(coalesce(p_api_key, ''));
  secret_name_value text;
  secret_id uuid;
  key_exists boolean := false;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  if model_value = '' or model_value !~ '^[A-Za-z0-9._:-]{1,120}$' then
    raise exception 'invalid AI model id' using errcode = '22023';
  end if;

  select settings.secret_name
  into secret_name_value
  from public.promotion_screenshot_analysis_settings settings
  where settings.id = 1
  for update;

  if secret_name_value is null then
    raise exception 'promotion screenshot analysis settings missing' using errcode = 'P0001';
  end if;

  if api_key_value <> '' then
    select secret.id
    into secret_id
    from vault.secrets secret
    where secret.name = secret_name_value
    limit 1;

    if secret_id is null then
      perform vault.create_secret(
        api_key_value,
        secret_name_value,
        'AAS promotion screenshot analysis OpenAI API key'
      );
    else
      perform vault.update_secret(
        secret_id,
        api_key_value,
        secret_name_value,
        'AAS promotion screenshot analysis OpenAI API key'
      );
    end if;
  end if;

  select exists(
    select 1 from vault.secrets secret where secret.name = secret_name_value
  ) into key_exists;

  if coalesce(p_enabled, false) and not key_exists then
    raise exception 'AI API key is required before enabling screenshot analysis' using errcode = '22023';
  end if;

  update public.promotion_screenshot_analysis_settings
  set enabled = coalesce(p_enabled, false),
      provider = 'openai',
      model = model_value,
      max_images = max_images_value,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = 1;
end;
$function$;

create or replace function public.get_promotion_screenshot_analysis_worker_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'enabled', settings.enabled,
    'provider', settings.provider,
    'model', settings.model,
    'max_images', settings.max_images,
    'api_key', coalesce((
      select secret.decrypted_secret
      from vault.decrypted_secrets secret
      where secret.name = settings.secret_name
      limit 1
    ), '')
  )
  from public.promotion_screenshot_analysis_settings settings
  where settings.id = 1;
$function$;

revoke all on function public.admin_get_promotion_screenshot_analysis_config() from public, anon, authenticated;
revoke all on function public.admin_set_promotion_screenshot_analysis_config(boolean,text,integer,text) from public, anon, authenticated;
revoke all on function public.get_promotion_screenshot_analysis_worker_config() from public, anon, authenticated;

grant execute on function public.admin_get_promotion_screenshot_analysis_config() to authenticated;
grant execute on function public.admin_set_promotion_screenshot_analysis_config(boolean,text,integer,text) to authenticated;
grant execute on function public.get_promotion_screenshot_analysis_worker_config() to service_role;

comment on table public.promotion_screenshot_analysis_settings is
  'Admin-only configuration for ephemeral social promotion screenshot analysis. Image bytes are never stored in this table.';
