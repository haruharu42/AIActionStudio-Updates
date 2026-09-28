-- Reclassify fully opaque browser Script error diagnostics as warnings.
-- These events contain no Error object, filename, line, or column because the
-- browser withheld source details. Actionable client/runtime errors remain errors.

create or replace function public.record_client_error(
  p_error_code text,
  p_message text,
  p_feature text default null,
  p_route text default null,
  p_request_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_user uuid := (select auth.uid());
    v_code text;
    v_recent integer;
    v_event_kind text := 'error';
    v_severity text := 'error';
begin
    if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user) then
        return false;
    end if;

    v_code := upper(coalesce(trim(p_error_code),'CLIENT_ERROR'));
    if v_code !~ '^[A-Z0-9_.:-]{1,80}$' then
        v_code := 'CLIENT_ERROR';
    end if;

    if v_code = 'WINDOW_SCRIPT_ERROR_OPAQUE' then
        v_event_kind := 'warning';
        v_severity := 'warning';
    end if;

    select count(*)::integer
    into v_recent
    from public.ops_events e
    where e.last_user_id=v_user
      and e.last_seen_at>now()-interval '1 minute';

    if v_recent>=20 then
        return false;
    end if;

    perform private.ops_upsert_event(
      v_event_kind,
      v_severity,
      'pwa-client',
      v_code,
      p_message,
      p_feature,
      p_route,
      p_request_id,
      v_user
    );
    return true;
end;
$function$;

revoke all on function public.record_client_error(text,text,text,text,text) from public, anon;
grant execute on function public.record_client_error(text,text,text,text,text) to authenticated;

update public.ops_events
set status='resolved',
    resolved_at=now(),
    resolved_by=null,
    resolution_note='Reclassified as browser-withheld opaque script diagnostic; future occurrences are stored as warning.',
    updated_at=now()
where source='pwa-client'
  and error_code='WINDOW_SCRIPT_ERROR_OPAQUE'
  and status='open';
