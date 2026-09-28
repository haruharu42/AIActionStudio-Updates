-- Keep replacement in one transaction: a failed insert must roll back deletion.
-- SECURITY INVOKER deliberately retains the existing owner/active/product RLS.
create or replace function public.replace_my_note_schedule_v1(
  p_expected_user_id uuid,
  p_items jsonb,
  p_target_month date default null
)
returns setof public.note_operation_schedule_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_start date;
  v_end date;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if v_user_id is null or p_expected_user_id is distinct from v_user_id
     or not coalesce((select private.is_active_profile()), false)
     or not coalesce((select public.can_access_product('AAS-PWA-BETA')), false) then
    raise exception 'active owner with product access required' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'schedule must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > (case when p_target_month is null then 500 else 200 end) then
    raise exception 'invalid schedule item count' using errcode = '22023';
  end if;
  if p_target_month is not null then
    if extract(day from p_target_month) <> 1 then
      raise exception 'target month must start on day one' using errcode = '22023';
    end if;
    v_start := case when date_trunc('month', v_today)::date = p_target_month
      then v_today else p_target_month end;
    v_end := (p_target_month + interval '1 month' - interval '1 day')::date;
  end if;

  -- Invalid casts and table constraints abort the entire call, including deletes.
  if exists (
    select 1 from jsonb_to_recordset(p_items) as item(
      scheduled_date date, scheduled_time time, item_type text, title text, status text, source text
    )
    where item.scheduled_date is null or item.scheduled_time is null
      or item.title is null or length(trim(item.title)) = 0
      or item.item_type is null or item.item_type not in ('free_note','paid_note','review','profile_setup','sns_share')
      or item.status is null or item.status not in ('planned','done','skipped')
      or item.source is null or item.source not in ('generated','imported','manual')
      or (p_target_month is not null and (
        item.scheduled_date < p_target_month or item.scheduled_date > v_end
        or item.item_type not in ('free_note','paid_note')
      ))
  ) then
    raise exception 'invalid schedule item' using errcode = '22023';
  end if;
  if p_target_month is not null and not exists (
    select 1 from jsonb_to_recordset(p_items) as item(scheduled_date date)
    where item.scheduled_date >= v_start
  ) then
    raise exception 'no future schedule items to replace' using errcode = '22023';
  end if;

  -- Serialize concurrent replacements belonging to the same account.
  perform pg_advisory_xact_lock(hashtextextended('aas-note-schedule:' || v_user_id::text, 0));
  if p_target_month is null then
    delete from public.note_operation_schedule_items where user_id = v_user_id;
  else
    delete from public.note_operation_schedule_items
    where user_id = v_user_id and scheduled_date between v_start and v_end
      and status = 'planned' and item_type in ('free_note','paid_note');
  end if;

  insert into public.note_operation_schedule_items (
    user_id, scheduled_date, scheduled_time, item_type, title, theme, status, source, notes
  )
  select v_user_id, item.scheduled_date, item.scheduled_time, item.item_type,
    item.title, coalesce(item.theme,''), item.status, item.source, coalesce(item.notes,'')
  from jsonb_to_recordset(p_items) as item(
    scheduled_date date, scheduled_time time, item_type text, title text,
    theme text, status text, source text, notes text
  )
  where p_target_month is null or (
    item.scheduled_date >= v_start
    and not exists (
      select 1 from public.note_operation_schedule_items preserved
      where preserved.user_id = v_user_id and preserved.scheduled_date = item.scheduled_date
        and preserved.scheduled_time = item.scheduled_time and preserved.item_type = item.item_type
    )
  );
  return query select * from public.note_operation_schedule_items
    where user_id = v_user_id order by scheduled_date, scheduled_time, id;
end;
$$;

revoke all on function public.replace_my_note_schedule_v1(uuid,jsonb,date) from public, anon;
grant execute on function public.replace_my_note_schedule_v1(uuid,jsonb,date) to authenticated;
