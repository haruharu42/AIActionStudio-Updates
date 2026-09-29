-- Public sales settings read path.
-- Exposes only the same non-sensitive sales flags already returned by /api/sales/settings.
-- The underlying table remains force-RLS and inaccessible to anon/authenticated roles.

create or replace function public.get_public_commerce_sales_settings()
returns table(
  external_sales_enabled boolean,
  access_code_enabled boolean,
  external_sales_url text,
  stripe_checkout_enabled boolean,
  pwa_7day_enabled boolean,
  pwa_monthly_enabled boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    settings.external_sales_enabled,
    settings.access_code_enabled,
    settings.external_sales_url,
    settings.stripe_checkout_enabled,
    settings.pwa_7day_enabled,
    settings.pwa_monthly_enabled,
    settings.updated_at
  from public.commerce_sales_settings as settings
  where settings.id = 1;
$function$;

revoke all on function public.get_public_commerce_sales_settings() from public;
grant execute on function public.get_public_commerce_sales_settings() to anon, authenticated;
