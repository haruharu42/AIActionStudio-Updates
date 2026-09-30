-- Keep Knowledge refresh requests in "pending" until an admin actually starts or cancels them.
-- Pending rows are review tasks, not failed jobs. Only an already-started processing
-- request can be auto-recovered as failed when it has been stuck for more than 24 hours.

create or replace function private.enqueue_due_knowledge_refreshes()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.knowledge_refresh_requests
  set
    status = 'failed',
    completed_at = now(),
    error_message = coalesce(
      nullif(error_message, ''),
      'AAS auto-recovery: processing exceeded 24 hours; request was released for the next refresh cycle.'
    )
  where status = 'processing'
    and started_at is not null
    and started_at <= now() - interval '24 hours';

  insert into public.knowledge_refresh_requests (channel)
  select channel.channel
  from public.knowledge_refresh_channels as channel
  where channel.next_refresh_due_at <= now()
    and not exists (
      select 1
      from public.knowledge_refresh_requests as request
      where request.channel = channel.channel
        and request.status in ('pending', 'processing')
    )
  on conflict do nothing;

  update public.knowledge_refresh_channels as channel
  set
    last_refresh_requested_at = now(),
    next_refresh_due_at = now() + make_interval(hours => channel.refresh_hours),
    updated_at = now()
  where channel.next_refresh_due_at <= now()
    and exists (
      select 1
      from public.knowledge_refresh_requests as request
      where request.channel = channel.channel
        and request.status in ('pending', 'processing')
    );
end;
$function$;

revoke all on function private.enqueue_due_knowledge_refreshes() from public, anon, authenticated;
