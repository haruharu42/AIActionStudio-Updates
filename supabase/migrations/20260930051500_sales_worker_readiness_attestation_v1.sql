begin;

create table if not exists public.sales_worker_readiness_attestations (
  id smallint primary key default 1 check (id = 1),
  mode text not null check (mode in ('off','test','live')),
  backend_ready boolean not null default false,
  pwa_7day_ready boolean not null default false,
  pwa_monthly_ready boolean not null default false,
  checked_at timestamptz not null default now()
);

alter table public.sales_worker_readiness_attestations enable row level security;
revoke all on table public.sales_worker_readiness_attestations from public, anon, authenticated;

create or replace function public.service_record_sales_worker_readiness(
  p_mode text,
  p_backend_ready boolean,
  p_pwa_7day_ready boolean,
  p_pwa_monthly_ready boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mode text := lower(trim(coalesce(p_mode, '')));
begin
  if v_mode not in ('off','test','live') then
    raise exception 'invalid commerce mode' using errcode = '22023';
  end if;
  if p_backend_ready is null
     or p_pwa_7day_ready is null
     or p_pwa_monthly_ready is null then
    raise exception 'worker readiness values cannot be null' using errcode = '22023';
  end if;

  insert into public.sales_worker_readiness_attestations (
    id,
    mode,
    backend_ready,
    pwa_7day_ready,
    pwa_monthly_ready,
    checked_at
  )
  values (
    1,
    v_mode,
    p_backend_ready,
    p_pwa_7day_ready,
    p_pwa_monthly_ready,
    now()
  )
  on conflict (id) do update
  set mode = excluded.mode,
      backend_ready = excluded.backend_ready,
      pwa_7day_ready = excluded.pwa_7day_ready,
      pwa_monthly_ready = excluded.pwa_monthly_ready,
      checked_at = excluded.checked_at;
end;
$function$;

revoke all on function public.service_record_sales_worker_readiness(text,boolean,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.service_record_sales_worker_readiness(text,boolean,boolean,boolean)
  to service_role;

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
  v_settings public.commerce_sales_settings%rowtype;
  v_worker public.sales_worker_readiness_attestations%rowtype;
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

    select settings.*
      into v_settings
    from public.commerce_sales_settings as settings
    where settings.id = 1
    for update;

    if v_settings.stripe_checkout_enabled then
      select attestation.*
        into v_worker
      from public.sales_worker_readiness_attestations as attestation
      where attestation.id = 1;

      if v_worker.id is null
         or v_worker.checked_at < v_settings.updated_at
         or v_worker.checked_at < now() - interval '5 minutes'
         or v_worker.mode = 'off'
         or not v_worker.backend_ready
         or (v_settings.pwa_7day_enabled and not v_worker.pwa_7day_ready)
         or (v_settings.pwa_monthly_enabled and not v_worker.pwa_monthly_ready) then
        raise exception 'stripe worker readiness attestation required' using errcode = '55000';
      end if;
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

comment on table public.sales_worker_readiness_attestations is
'Latest secret-free readiness receipt recorded by the PWA Worker. Browser roles have no direct table access.';

comment on function public.service_record_sales_worker_readiness(text,boolean,boolean,boolean) is
'Service-role only. Records secret-free Stripe Worker readiness so DB-side public sales approval cannot bypass Worker diagnostics.';

comment on function public.admin_set_public_sales_approval(boolean) is
'Active admins may always stop public sales. Enabling requires AAL2, persisted DB readiness, and when Stripe is enabled a fresh Worker readiness attestation newer than the sales settings.';

commit;
