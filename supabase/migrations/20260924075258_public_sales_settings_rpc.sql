-- Public read-only commerce sales settings for signed-out PWA surfaces.
-- Exposes only switches and the configured external purchase URL; no admin/private fields.

create or replace function public.get_public_commerce_sales_settings()
returns table (
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
  where settings.id = 1
  limit 1
$function$;

revoke all on function public.get_public_commerce_sales_settings() from public;
grant execute on function public.get_public_commerce_sales_settings() to anon, authenticated, service_role;
