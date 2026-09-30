begin;

create or replace function public.admin_get_sales_launch_readiness()
returns table (
  persisted_external_sales_enabled boolean,
  persisted_access_code_enabled boolean,
  persisted_purchase_url_ready boolean,
  seller_ready boolean,
  usable_invite_count integer,
  verified_mfa_count integer,
  persisted_automated_ready boolean,
  settings_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_external_sales_enabled boolean := false;
  v_access_code_enabled boolean := false;
  v_external_sales_url text := '';
  v_stripe_checkout_enabled boolean := false;
  v_pwa_7day_enabled boolean := false;
  v_pwa_monthly_enabled boolean := false;
  v_seller_ready boolean := false;
  v_purchase_url_ready boolean := false;
  v_usable_invite_count integer := 0;
  v_verified_mfa_count integer := 0;
  v_updated_at timestamptz;
begin
  if v_user_id is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  select
    settings.external_sales_enabled,
    settings.access_code_enabled,
    coalesce(trim(settings.external_sales_url), ''),
    settings.stripe_checkout_enabled,
    settings.pwa_7day_enabled,
    settings.pwa_monthly_enabled,
    (
      nullif(trim(settings.seller_name), '') is not null
      and nullif(trim(settings.seller_address), '') is not null
      and nullif(trim(settings.seller_phone), '') is not null
      and nullif(trim(settings.seller_email), '') is not null
      and nullif(trim(settings.seller_support_url), '') is not null
      and trim(settings.seller_support_url) ~ '^https://[^[:space:]]+$'
      and position('@' in split_part(substr(trim(settings.seller_support_url), 9), '/', 1)) = 0
    ),
    settings.updated_at
  into
    v_external_sales_enabled,
    v_access_code_enabled,
    v_external_sales_url,
    v_stripe_checkout_enabled,
    v_pwa_7day_enabled,
    v_pwa_monthly_enabled,
    v_seller_ready,
    v_updated_at
  from public.commerce_sales_settings as settings
  where settings.id = 1;

  v_purchase_url_ready :=
    v_external_sales_url ~ '^https://[^[:space:]]+$'
    and position('@' in split_part(substr(v_external_sales_url, 9), '/', 1)) = 0;

  select count(*)::integer
    into v_usable_invite_count
  from public.pwa_invites as invite
  where invite.status = 'active'
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.entitlement_expires_at is null or invite.entitlement_expires_at > now())
    and (invite.max_uses is null or invite.use_count < invite.max_uses);

  select count(*)::integer
    into v_verified_mfa_count
  from auth.mfa_factors as factor
  where factor.user_id = v_user_id
    and factor.status = 'verified';

  return query
  select
    v_external_sales_enabled,
    v_access_code_enabled,
    v_purchase_url_ready,
    v_seller_ready,
    v_usable_invite_count,
    v_verified_mfa_count,
    (
      v_seller_ready
      and v_verified_mfa_count > 0
      and (
        v_external_sales_enabled
        or v_stripe_checkout_enabled
      )
      and (
        not v_external_sales_enabled
        or (
          v_access_code_enabled
          and v_purchase_url_ready
          and v_usable_invite_count > 0
        )
      )
      and (
        not v_stripe_checkout_enabled
        or v_pwa_7day_enabled
        or v_pwa_monthly_enabled
      )
    ),
    v_updated_at;
end;
$function$;

revoke all on function public.admin_get_sales_launch_readiness() from public, anon;
grant execute on function public.admin_get_sales_launch_readiness() to authenticated;

comment on function public.admin_get_sales_launch_readiness() is
'Admin-only sales readiness. Every enabled sales route must be internally ready; external sales require access code + purchase URL + usable invite, while Stripe requires at least one PWA Stripe plan. Seller info and current-admin verified MFA are common requirements.';

commit;
