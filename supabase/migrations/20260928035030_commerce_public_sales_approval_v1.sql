begin;

alter table public.commerce_sales_settings
  add column if not exists public_sales_approved boolean not null default false,
  add column if not exists public_sales_approved_at timestamptz,
  add column if not exists public_sales_approved_by uuid;

alter table public.commerce_sales_settings
  drop constraint if exists commerce_sales_settings_public_sales_approved_by_fkey;

alter table public.commerce_sales_settings
  add constraint commerce_sales_settings_public_sales_approved_by_fkey
    foreign key (public_sales_approved_by)
    references public.profiles(id)
    on delete set null;

create index if not exists commerce_sales_settings_public_sales_approved_by_idx
  on public.commerce_sales_settings(public_sales_approved_by)
  where public_sales_approved_by is not null;

create or replace function public.admin_get_public_sales_approval()
returns table (
  public_sales_approved boolean,
  public_sales_approved_at timestamptz,
  public_sales_approved_by uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  return query
  select
    settings.public_sales_approved,
    settings.public_sales_approved_at,
    settings.public_sales_approved_by
  from public.commerce_sales_settings as settings
  where settings.id = 1;
end;
$function$;

revoke all on function public.admin_get_public_sales_approval() from public, anon;
grant execute on function public.admin_get_public_sales_approval() to authenticated;

create or replace function public.admin_set_public_sales_approval(
  p_approved boolean
)
returns table (
  public_sales_approved boolean,
  public_sales_approved_at timestamptz,
  public_sales_approved_by uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_ready boolean := false;
begin
  if v_user_id is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  if p_approved is null then
    raise exception 'approval value is required' using errcode = '22023';
  end if;

  if p_approved then
    select readiness.persisted_automated_ready
      into v_ready
    from public.admin_get_sales_launch_readiness() as readiness
    limit 1;

    if not coalesce(v_ready, false) then
      raise exception 'sales launch readiness requirements not met' using errcode = '55000';
    end if;

    update public.commerce_sales_settings
       set public_sales_approved = true,
           public_sales_approved_at = now(),
           public_sales_approved_by = v_user_id,
           updated_at = now(),
           updated_by = v_user_id
     where id = 1;
  else
    update public.commerce_sales_settings
       set public_sales_approved = false,
           public_sales_approved_at = null,
           public_sales_approved_by = null,
           updated_at = now(),
           updated_by = v_user_id
     where id = 1;
  end if;

  return query
  select
    settings.public_sales_approved,
    settings.public_sales_approved_at,
    settings.public_sales_approved_by
  from public.commerce_sales_settings as settings
  where settings.id = 1;
end;
$function$;

revoke all on function public.admin_set_public_sales_approval(boolean) from public, anon;
grant execute on function public.admin_set_public_sales_approval(boolean) to authenticated;

create or replace function public.service_get_sales_launch_runtime()
returns table (
  public_sales_approved boolean,
  external_route_ready boolean,
  stripe_route_ready boolean,
  usable_invite_count integer,
  active_admin_mfa_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_settings public.commerce_sales_settings%rowtype;
  v_purchase_url_ready boolean := false;
  v_seller_ready boolean := false;
  v_usable_invite_count integer := 0;
  v_active_admin_mfa_count integer := 0;
begin
  select settings.*
    into v_settings
  from public.commerce_sales_settings as settings
  where settings.id = 1;

  if not found then
    return;
  end if;

  v_purchase_url_ready :=
    coalesce(trim(v_settings.external_sales_url), '') ~ '^https://[^[:space:]]+$'
    and position('@' in split_part(substr(trim(v_settings.external_sales_url), 9), '/', 1)) = 0;

  v_seller_ready :=
    nullif(trim(v_settings.seller_name), '') is not null
    and nullif(trim(v_settings.seller_address), '') is not null
    and nullif(trim(v_settings.seller_phone), '') is not null
    and nullif(trim(v_settings.seller_email), '') is not null
    and nullif(trim(v_settings.seller_support_url), '') is not null
    and trim(v_settings.seller_support_url) ~ '^https://[^[:space:]]+$'
    and position('@' in split_part(substr(trim(v_settings.seller_support_url), 9), '/', 1)) = 0;

  select count(*)::integer
    into v_usable_invite_count
  from public.pwa_invites as invite
  where invite.status = 'active'
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.entitlement_expires_at is null or invite.entitlement_expires_at > now())
    and (invite.max_uses is null or invite.use_count < invite.max_uses);

  select count(distinct profile.id)::integer
    into v_active_admin_mfa_count
  from public.profiles as profile
  join auth.mfa_factors as factor
    on factor.user_id = profile.id
   and factor.status = 'verified'
  where profile.role = 'admin'
    and profile.status = 'active';

  return query
  select
    v_settings.public_sales_approved,
    (
      v_settings.external_sales_enabled
      and v_settings.access_code_enabled
      and v_purchase_url_ready
      and v_seller_ready
      and v_usable_invite_count > 0
      and v_active_admin_mfa_count > 0
    ),
    (
      v_settings.stripe_checkout_enabled
      and (v_settings.pwa_7day_enabled or v_settings.pwa_monthly_enabled)
      and v_seller_ready
      and v_active_admin_mfa_count > 0
    ),
    v_usable_invite_count,
    v_active_admin_mfa_count;
end;
$function$;

revoke all on function public.service_get_sales_launch_runtime() from public, anon, authenticated;
grant execute on function public.service_get_sales_launch_runtime() to service_role;

create or replace function public.admin_update_commerce_sales_settings(
    p_external_sales_enabled boolean,
    p_access_code_enabled boolean,
    p_external_sales_url text,
    p_stripe_checkout_enabled boolean,
    p_pwa_7day_enabled boolean,
    p_pwa_monthly_enabled boolean,
    p_windows_monthly_enabled boolean,
    p_bundle_monthly_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
    cleaned_external_sales_url text := nullif(trim(p_external_sales_url), '');
begin
    if (select auth.uid()) is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;
    if p_external_sales_enabled is null
       or p_access_code_enabled is null
       or p_stripe_checkout_enabled is null
       or p_pwa_7day_enabled is null
       or p_pwa_monthly_enabled is null
       or p_windows_monthly_enabled is null
       or p_bundle_monthly_enabled is null then
        raise exception 'sales settings cannot be null' using errcode = '22023';
    end if;
    if cleaned_external_sales_url is not null
       and cleaned_external_sales_url !~ '^https://[^[:space:]]+$' then
        raise exception 'external sales url must use https' using errcode = '22023';
    end if;

    update public.commerce_sales_settings
       set external_sales_enabled = p_external_sales_enabled,
           access_code_enabled = p_access_code_enabled,
           external_sales_url = cleaned_external_sales_url,
           stripe_checkout_enabled = p_stripe_checkout_enabled,
           pwa_7day_enabled = p_pwa_7day_enabled,
           pwa_monthly_enabled = p_pwa_monthly_enabled,
           windows_monthly_enabled = p_windows_monthly_enabled,
           bundle_monthly_enabled = p_bundle_monthly_enabled,
           public_sales_approved = false,
           public_sales_approved_at = null,
           public_sales_approved_by = null,
           updated_at = now(),
           updated_by = (select auth.uid())
     where id = 1;
end;
$function$;

create or replace function public.admin_update_commerce_sales_settings(
    p_external_sales_enabled boolean,
    p_access_code_enabled boolean,
    p_stripe_checkout_enabled boolean,
    p_pwa_7day_enabled boolean,
    p_pwa_monthly_enabled boolean,
    p_windows_monthly_enabled boolean,
    p_bundle_monthly_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if (select auth.uid()) is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;
    if p_external_sales_enabled is null
       or p_access_code_enabled is null
       or p_stripe_checkout_enabled is null
       or p_pwa_7day_enabled is null
       or p_pwa_monthly_enabled is null
       or p_windows_monthly_enabled is null
       or p_bundle_monthly_enabled is null then
        raise exception 'sales settings cannot be null' using errcode = '22023';
    end if;

    update public.commerce_sales_settings
       set external_sales_enabled = p_external_sales_enabled,
           access_code_enabled = p_access_code_enabled,
           stripe_checkout_enabled = p_stripe_checkout_enabled,
           pwa_7day_enabled = p_pwa_7day_enabled,
           pwa_monthly_enabled = p_pwa_monthly_enabled,
           windows_monthly_enabled = p_windows_monthly_enabled,
           bundle_monthly_enabled = p_bundle_monthly_enabled,
           public_sales_approved = false,
           public_sales_approved_at = null,
           public_sales_approved_by = null,
           updated_at = now(),
           updated_by = (select auth.uid())
     where id = 1;
end;
$function$;

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
         public_sales_approved = false,
         public_sales_approved_at = null,
         public_sales_approved_by = null,
         updated_at = now(),
         updated_by = v_user_id
   where id = 1;
end;
$function$;

revoke all on function public.admin_update_commerce_seller_settings(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_update_commerce_seller_settings(text,text,text,text,text,text,text) to authenticated;

commit;
