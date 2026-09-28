-- Integration audit. All fixture writes MUST stay inside this rollback-only transaction.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '2s';
do $$
declare v_owner uuid;
begin
  select id into v_owner from public.profiles where role = 'admin' and status = 'active' order by created_at limit 1;
  if v_owner is null then raise exception 'active test owner unavailable'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
end $$;
set local role authenticated;
do $$
declare
  v_owner uuid := auth.uid();
  v_original uuid;
  v_before jsonb;
  v_after jsonb;
  v_valid jsonb := '[{"scheduled_date":"2099-10-02","scheduled_time":"20:00","item_type":"free_note","title":"new plan","status":"planned","source":"imported"}]';
begin
  -- Isolated transaction fixtures; the outer ROLLBACK restores the account's actual rows.
  delete from public.note_operation_schedule_items where user_id = v_owner;
  insert into public.note_operation_schedule_items(user_id, scheduled_date, title, item_type)
    values(v_owner, '2099-10-01', 'original plan', 'free_note') returning id into v_original;
  select jsonb_agg(to_jsonb(s) order by s.id) into v_before from public.note_operation_schedule_items s where user_id = v_owner;
  begin
    perform public.replace_my_note_schedule_v1(v_owner,
      jsonb_set(v_valid, '{0,title}', to_jsonb(repeat('x',241))));
    raise exception 'expected insert constraint failure';
  exception when check_violation then null;
  end;
  select jsonb_agg(to_jsonb(s) order by s.id) into v_after from public.note_operation_schedule_items s where user_id = v_owner;
  if v_before is distinct from v_after then raise exception 'failed replacement changed original rows'; end if;
  begin
    perform public.replace_my_note_schedule_v1(gen_random_uuid(), v_valid);
    raise exception 'cross-owner replacement accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.replace_my_note_schedule_v1(v_owner, '[]');
    raise exception 'empty replacement accepted';
  exception when invalid_parameter_value then null;
  end;

  insert into public.note_operation_schedule_items(user_id,scheduled_date,title,status,item_type) values
    (v_owner,'2099-10-03','completed','done','paid_note'),
    (v_owner,'2099-10-04','skipped','skipped','free_note'),
    (v_owner,'2099-10-05','review','planned','review'),
    (v_owner,'2099-11-01','other month','planned','free_note');
  perform public.replace_my_note_schedule_v1(v_owner, v_valid, '2099-10-01');
  if exists(select 1 from public.note_operation_schedule_items where id=v_original)
    or (select count(*) from public.note_operation_schedule_items where user_id=v_owner) <> 5
    or not exists(select 1 from public.note_operation_schedule_items where user_id=v_owner and title='completed' and status='done')
    or not exists(select 1 from public.note_operation_schedule_items where user_id=v_owner and title='skipped' and status='skipped')
    or not exists(select 1 from public.note_operation_schedule_items where user_id=v_owner and title='review' and item_type='review')
    or not exists(select 1 from public.note_operation_schedule_items where user_id=v_owner and title='other month') then
    raise exception 'monthly replacement did not preserve history and other months';
  end if;
  perform public.replace_my_note_schedule_v1(v_owner, v_valid);
  if (select count(*) from public.note_operation_schedule_items where user_id=v_owner) <> 1 then
    raise exception 'full replacement failed';
  end if;
end $$;
rollback;
select 'PASS: insert rollback, owner isolation, empty input, monthly preservation, full replacement; fixture transaction rolled back' as audit_result;
