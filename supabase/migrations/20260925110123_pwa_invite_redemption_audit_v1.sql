begin;

create or replace function public.admin_list_pwa_invite_redemptions(
  p_invite_id uuid default null,
  p_limit integer default 100
)
returns table (
  redemption_id uuid,
  invite_id uuid,
  invite_code text,
  invite_label text,
  sales_channel text,
  external_reference text,
  aas_user_id text,
  display_name text,
  redeemed_at timestamptz,
  entitlement_status text,
  entitlement_expires_at timestamptz,
  entitlement_sales_channel text,
  entitlement_external_reference text
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

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid limit' using errcode = '22023';
  end if;

  return query
  select
    redemption.id as redemption_id,
    invite.id as invite_id,
    invite.code::text as invite_code,
    invite.label as invite_label,
    invite.sales_channel,
    invite.external_reference,
    profile.aas_user_id,
    profile.display_name,
    redemption.redeemed_at,
    entitlement.status as entitlement_status,
    entitlement.expires_at as entitlement_expires_at,
    entitlement.sales_channel as entitlement_sales_channel,
    entitlement.external_reference as entitlement_external_reference
  from public.pwa_invite_redemptions as redemption
  join public.pwa_invites as invite on invite.id = redemption.invite_id
  join public.profiles as profile on profile.id = redemption.user_id
  left join lateral (
    select
      user_entitlement.status,
      user_entitlement.expires_at,
      user_entitlement.sales_channel,
      user_entitlement.external_reference
    from public.user_entitlements as user_entitlement
    join public.products as product on product.id = user_entitlement.product_id
    where user_entitlement.user_id = redemption.user_id
      and product.product_code = 'AAS-PWA-BETA'
    order by user_entitlement.granted_at desc,
             user_entitlement.created_at desc,
             user_entitlement.id desc
    limit 1
  ) as entitlement on true
  where p_invite_id is null or invite.id = p_invite_id
  order by redemption.redeemed_at desc, redemption.id
  limit p_limit;
end;
$function$;

revoke all on function public.admin_list_pwa_invite_redemptions(uuid, integer)
from public, anon;

grant execute on function public.admin_list_pwa_invite_redemptions(uuid, integer)
to authenticated;

commit;
