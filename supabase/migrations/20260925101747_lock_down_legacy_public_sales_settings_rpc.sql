begin;

-- Browser clients read the filtered public sales state through the Worker
-- /api/sales/settings endpoint. This legacy SECURITY DEFINER RPC is not used
-- by the current PWA and does not need browser-role execution.
revoke execute on function public.get_public_commerce_sales_settings()
from public, anon, authenticated;

grant execute on function public.get_public_commerce_sales_settings()
to service_role;

commit;
