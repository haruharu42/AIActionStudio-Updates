begin;

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
  v_aal text := coalesce((select auth.jwt()->>'aal'), 'aal1');
begin
  if v_user_id is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  if p_approved is null then
    raise exception 'approval value is required' using errcode = '22023';
  end if;

  if p_approved then
    if v_aal <> 'aal2' then
      raise exception 'aal2 required for public sales approval' using errcode = '42501';
    end if;

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

comment on function public.admin_set_public_sales_approval(boolean) is
'Active admins may always stop public sales. Enabling public sales additionally requires the current session to be AAL2 and all persisted launch-readiness checks to pass.';

commit;
