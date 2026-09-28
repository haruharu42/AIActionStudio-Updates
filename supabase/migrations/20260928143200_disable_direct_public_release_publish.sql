begin;

revoke execute on function public.admin_publish_app_release(uuid) from authenticated;
grant execute on function public.admin_publish_app_release(uuid) to service_role;

comment on function public.admin_publish_app_release(uuid) is
'Legacy direct publish RPC. Interactive admin clients must use the Preview-to-public deployment pipeline; service_role is retained only for controlled recovery.';

commit;
