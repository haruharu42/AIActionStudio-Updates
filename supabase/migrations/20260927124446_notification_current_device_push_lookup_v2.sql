-- Resolve the current browser/device push state against the server-side subscription record.
-- This prevents a stale local PushSubscription from making the UI look enabled after the
-- corresponding AAS subscription has already been disabled server-side.

create function public.is_my_push_subscription_enabled_v2(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;
  perform private.assert_notification_feature_access();
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 4096 then
    raise exception 'invalid push endpoint' using errcode='22023';
  end if;
  return exists(
    select 1
    from public.user_push_subscriptions s
    where s.user_id=v_user
      and s.endpoint=p_endpoint
      and s.enabled=true
  );
end;
$function$;

revoke all on function public.is_my_push_subscription_enabled_v2(text) from public, anon, authenticated;
grant execute on function public.is_my_push_subscription_enabled_v2(text) to authenticated;
