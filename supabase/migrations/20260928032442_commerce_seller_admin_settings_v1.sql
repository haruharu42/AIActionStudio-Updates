begin;

alter table public.commerce_sales_settings
  add column if not exists seller_type text not null default 'individual',
  add column if not exists seller_disclosure_mode text not null default 'on_request',
  add column if not exists seller_name text,
  add column if not exists seller_address text,
  add column if not exists seller_phone text,
  add column if not exists seller_email text,
  add column if not exists seller_support_url text;

alter table public.commerce_sales_settings
  drop constraint if exists commerce_sales_settings_seller_type_check,
  drop constraint if exists commerce_sales_settings_seller_disclosure_mode_check,
  drop constraint if exists commerce_sales_settings_seller_support_url_https_check;

alter table public.commerce_sales_settings
  add constraint commerce_sales_settings_seller_type_check
    check (seller_type in ('individual','business')),
  add constraint commerce_sales_settings_seller_disclosure_mode_check
    check (seller_disclosure_mode in ('public','on_request')),
  add constraint commerce_sales_settings_seller_support_url_https_check
    check (
      seller_support_url is null
      or seller_support_url ~ '^https://[^[:space:]]+$'
    );

create or replace function public.admin_get_commerce_seller_settings()
returns table (
  seller_type text,
  seller_disclosure_mode text,
  seller_name text,
  seller_address text,
  seller_phone text,
  seller_email text,
  seller_support_url text,
  seller_ready boolean,
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
    settings.seller_type,
    settings.seller_disclosure_mode,
    coalesce(settings.seller_name, ''),
    coalesce(settings.seller_address, ''),
    coalesce(settings.seller_phone, ''),
    coalesce(settings.seller_email, ''),
    coalesce(settings.seller_support_url, ''),
    (
      nullif(trim(settings.seller_name), '') is not null
      and nullif(trim(settings.seller_address), '') is not null
      and nullif(trim(settings.seller_phone), '') is not null
      and nullif(trim(settings.seller_email), '') is not null
      and nullif(trim(settings.seller_support_url), '') is not null
    ),
    settings.updated_at
  from public.commerce_sales_settings as settings
  where settings.id = 1;
end;
$function$;

revoke all on function public.admin_get_commerce_seller_settings() from public, anon;
grant execute on function public.admin_get_commerce_seller_settings() to authenticated;

create or replace function public.admin_update_commerce_seller_settings(
  p_seller_type text,
  p_seller_disclosure_mode text,
  p_seller_name text,
  p_seller_address text,
  p_seller_phone text,
  p_seller_email text,
  p_seller_support_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_type text := lower(trim(coalesce(p_seller_type, '')));
  v_disclosure text := lower(trim(coalesce(p_seller_disclosure_mode, '')));
  v_name text := nullif(trim(p_seller_name), '');
  v_address text := nullif(trim(p_seller_address), '');
  v_phone text := nullif(trim(p_seller_phone), '');
  v_email text := nullif(trim(p_seller_email), '');
  v_support_url text := nullif(trim(p_seller_support_url), '');
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  if v_type not in ('individual','business') then
    raise exception 'invalid seller type' using errcode = '22023';
  end if;

  if v_disclosure not in ('public','on_request') then
    raise exception 'invalid seller disclosure mode' using errcode = '22023';
  end if;

  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid seller email' using errcode = '22023';
  end if;

  if v_support_url is not null and v_support_url !~ '^https://[^[:space:]]+$' then
    raise exception 'seller support url must use https' using errcode = '22023';
  end if;

  update public.commerce_sales_settings
     set seller_type = v_type,
         seller_disclosure_mode = v_disclosure,
         seller_name = v_name,
         seller_address = v_address,
         seller_phone = v_phone,
         seller_email = v_email,
         seller_support_url = v_support_url,
         updated_by = (select auth.uid())
   where id = 1;
end;
$function$;

revoke all on function public.admin_update_commerce_seller_settings(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_update_commerce_seller_settings(text,text,text,text,text,text,text) to authenticated;

commit;
