-- Central feature rollout + maintenance control.
-- Live migration: 20260925005852 app_feature_control_center_v1

create table if not exists public.app_feature_controls (
  feature_key text primary key,
  category text not null,
  title text not null,
  description text not null default '',
  route_prefix text,
  exact_match boolean not null default false,
  rollout_stage text not null default 'public',
  maintenance_mode boolean not null default false,
  maintenance_message text not null default '',
  admin_only boolean not null default false,
  sort_order integer not null default 100,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_feature_controls_key_check check (feature_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  constraint app_feature_controls_stage_check check (rollout_stage in ('admin','tester','public')),
  constraint app_feature_controls_admin_stage_check check (not admin_only or rollout_stage = 'admin'),
  constraint app_feature_controls_message_check check (char_length(maintenance_message) <= 500)
);

create table if not exists public.app_feature_control_audit (
  id bigint generated always as identity primary key,
  feature_key text not null references public.app_feature_controls(feature_key) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  old_state jsonb not null,
  new_state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists app_feature_controls_category_sort_idx
  on public.app_feature_controls(category, sort_order, feature_key);
create index if not exists app_feature_control_audit_feature_created_idx
  on public.app_feature_control_audit(feature_key, created_at desc);
create index if not exists app_feature_control_audit_actor_idx
  on public.app_feature_control_audit(actor_user_id);

alter table public.app_feature_controls enable row level security;
alter table public.app_feature_controls force row level security;
alter table public.app_feature_control_audit enable row level security;
alter table public.app_feature_control_audit force row level security;

revoke all on table public.app_feature_controls from public, anon, authenticated;
revoke all on table public.app_feature_control_audit from public, anon, authenticated;
revoke all on sequence public.app_feature_control_audit_id_seq from public, anon, authenticated;

insert into public.app_feature_controls
(feature_key, category, title, description, route_prefix, exact_match, rollout_stage, maintenance_mode, admin_only, sort_order)
values
('article-create','記事・コンテンツ','記事作成','記事作成ウィザードと外部AI連携。','/create',true,'public',false,false,10),
('prompt-library','記事・コンテンツ','プロンプトライブラリ','副業プロンプトの選択・入力・コピー。','/prompts',true,'public',false,false,20),
('workflow','記事・コンテンツ','AAS運営コックピット','公開前確認、再利用、シリーズ設計。','/workflow',true,'public',false,false,30),
('article-library','記事・コンテンツ','記事ライブラリ','記事ストック・編集・note投稿支援。',null,true,'public',false,false,40),
('note-operations','記事・コンテンツ','note運営アシスタント','note運用計画・投稿管理。','/note-operations',true,'public',false,false,50),
('images','画像・SNS','画像作成','記事用画像プロンプト・ローカル画像管理。','/images',true,'public',false,false,60),
('sns','画像・SNS','SNS投稿作成','X・Instagram・Threads向け投稿支援。','/sns',true,'public',false,false,70),
('sns-plan','画像・SNS','SNSアカウント設計','SNS運用設計・プロフィール・投稿方針。','/sns-plan',true,'public',false,false,80),
('account-design','運営・アカウント','アカウント設計','note・Tips・Brain向けアカウント設計。','/account-design',true,'public',false,false,90),
('publish','公開・分析','公開管理','公開予定・公開済み情報の管理。','/publish',true,'public',false,false,100),
('analytics','公開・分析','コンテンツ分析','記事・掲載先・状態の集計。','/analytics',true,'public',false,false,110),
('export','公開・分析','記事エクスポート','記事一式のPC向け書き出し。','/export',true,'public',false,false,120),
('ranking','コミュニティ','ランキング','AAS内ランキング表示。','/ranking',true,'public',false,false,130),
('profile','コミュニティ','プロフィール','プロフィールとランキング公開設定。','/profile',true,'public',false,false,140),
('missions','コミュニティ','ミッション','Creator Clubミッション。','/missions',true,'public',false,false,150),
('membership','コミュニティ','メンバーシップ','Creator Clubプラン・特典表示。','/membership',true,'public',false,false,160),
('tools','共通','機能一覧','用途別機能一覧。','/tools',true,'public',false,false,170),
('manual','共通','使い方','AAS利用ガイド。','/manual',true,'public',false,false,180),
('settings','共通','設定','AAS設定・ナビ・各種ユーザー設定。','/settings',false,'public',false,false,190),
('inquiries','共通','お問い合わせ','要望・不具合・質問の送信と返信確認。','/inquiries',true,'public',false,false,200),
('billing','販売・契約','購入・請求','PWA購入・請求関連画面。','/billing',false,'public',false,false,210),
('plans','販売・契約','プラン','利用プラン・アップグレード。','/plans',false,'public',false,false,220),
('sidejob-legacy','副業機能','副業入口','旧副業入口・互換画面。','/sidejob',true,'public',false,false,230),
('sidejob-content-sales','副業機能','記事・ブログ・コンテンツ販売','コンテンツ販売専用ウィザード。','/side-hustles/content-sales',true,'public',false,false,300),
('sidejob-sns-management','副業機能','SNS運用・集客','SNS運用専用ウィザード。','/side-hustles/sns-management',true,'public',false,false,310),
('sidejob-youtube-video','副業機能','YouTube・ショート動画','動画副業専用ウィザード。','/side-hustles/youtube-video',true,'public',false,false,320),
('sidejob-affiliate','副業機能','アフィリエイト','アフィリエイト専用ウィザード。','/side-hustles/affiliate',true,'public',false,false,330),
('sidejob-resale','副業機能','物販・フリマ販売','物販専用ウィザード。','/side-hustles/resale',true,'public',false,false,340),
('sidejob-crowdsourcing','副業機能','クラウドソーシング','案件応募・納品専用ウィザード。','/side-hustles/crowdsourcing',true,'public',false,false,350),
('sidejob-skill-sales','副業機能','スキル販売','スキル販売専用ウィザード。','/side-hustles/skill-sales',true,'public',false,false,360),
('sidejob-digital-product','副業機能','デジタル商品・教材販売','デジタル商品専用ウィザード。','/side-hustles/digital-product',true,'public',false,false,370),
('sidejob-outreach','副業機能','営業・案件獲得','営業・案件獲得専用ウィザード。','/side-hustles/outreach',true,'public',false,false,380),
('sidejob-research','副業機能','リサーチ・事実確認','リサーチ専用ウィザード。','/side-hustles/research',true,'public',false,false,390),
('sidejob-workflow-efficiency','副業機能','業務効率化・SOP化','業務効率化専用ウィザード。','/side-hustles/workflow-efficiency',true,'public',false,false,400),
('sidejob-planner','副業機能','AI副業プランナー','副業候補比較・30日検証計画。','/side-hustles/sidejob-planner',true,'public',false,false,410),
('admin-dashboard','管理者機能','管理ダッシュボード','管理機能の入口。','/admin',true,'admin',false,true,1000),
('admin-users','管理者機能','ユーザー・利用権','ユーザー承認・停止・利用権。','/admin/users',true,'admin',false,true,1010),
('admin-membership','管理者機能','メンバーシップ管理','Creator Club管理。','/admin/membership',true,'admin',false,true,1020),
('admin-free-trial','管理者機能','無料利用・回数制限','無料利用設定。','/admin/free-trial',true,'admin',false,true,1030),
('admin-sales','管理者機能','販売設定','販売・アップグレード設定。','/admin/sales',true,'admin',false,true,1040),
('admin-promotion','管理者機能','販売・プロモーション','販促・告知管理。','/admin/promotion',true,'admin',false,true,1050),
('admin-development-prompts','管理者機能','開発依頼プロンプト','AAS開発依頼文の作成。','/admin/development-prompts',true,'admin',false,true,1060),
('admin-prompts','管理者機能','副業プロンプト管理','ユーザー向けプロンプト管理。','/admin/prompts',true,'admin',false,true,1070),
('admin-knowledge','管理者機能','ナレッジ管理','Knowledge・Prompt更新管理。','/admin/knowledge',true,'admin',false,true,1080),
('admin-releases','管理者機能','アップデート管理','3段階リリース管理。','/admin/releases',true,'admin',false,true,1090),
('admin-features','管理者機能','全機能管理センター','機能公開段階・メンテナンス管理。','/admin/features',true,'admin',false,true,1100),
('admin-security','管理者機能','管理者MFA・認証器','管理者認証管理。','/admin/security',true,'admin',false,true,1110),
('admin-infrastructure','管理者機能','インフラ使用量・料金','Supabase・GitHub利用量確認。','/admin/infrastructure',true,'admin',false,true,1120),
('admin-operations','管理者機能','セキュリティ・運用','監査・障害・容量監視。','/admin/operations',true,'admin',false,true,1130),
('admin-inquiries','管理者機能','問い合わせ確認','問い合わせ対応。','/admin/inquiries',true,'admin',false,true,1140)
on conflict (feature_key) do update
set category = excluded.category,
    title = excluded.title,
    description = excluded.description,
    route_prefix = excluded.route_prefix,
    exact_match = excluded.exact_match,
    admin_only = excluded.admin_only,
    sort_order = excluded.sort_order,
    rollout_stage = case when excluded.admin_only then 'admin' else public.app_feature_controls.rollout_stage end,
    updated_at = now();

create or replace function private.can_use_app_feature(p_feature_key text, p_user_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := coalesce(p_user_id, (select auth.uid()));
  v_role text;
  v_status text;
  v_tester boolean := false;
  v_feature public.app_feature_controls%rowtype;
begin
  if v_user is null then return false; end if;
  select p.role, p.status into v_role, v_status from public.profiles p where p.id = v_user;
  if v_status is distinct from 'active' then return false; end if;
  if v_role = 'admin' then return true; end if;
  select * into v_feature from public.app_feature_controls f where f.feature_key = p_feature_key;
  if v_feature.feature_key is null or v_feature.admin_only then return false; end if;
  select exists (select 1 from public.app_release_testers t where t.user_id = v_user and t.enabled = true) into v_tester;
  if v_feature.maintenance_mode then
    return v_tester and v_feature.rollout_stage in ('tester','public');
  end if;
  if v_feature.rollout_stage = 'public' then return true; end if;
  if v_feature.rollout_stage = 'tester' then return v_tester; end if;
  return false;
end;
$function$;

create or replace function public.get_my_app_feature_controls()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_role text;
  v_status text;
  v_tester boolean := false;
begin
  if v_user is null then return jsonb_build_object('signed_in', false, 'features', '[]'::jsonb); end if;
  select p.role, p.status into v_role, v_status from public.profiles p where p.id = v_user;
  if v_status is distinct from 'active' then
    return jsonb_build_object('signed_in', true, 'active', false, 'features', '[]'::jsonb);
  end if;
  select exists (select 1 from public.app_release_testers t where t.user_id = v_user and t.enabled = true) into v_tester;

  return jsonb_build_object(
    'signed_in', true,
    'active', true,
    'is_admin', v_role = 'admin',
    'is_release_tester', v_tester,
    'features', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'feature_key', f.feature_key,
          'category', f.category,
          'title', f.title,
          'description', f.description,
          'route_prefix', f.route_prefix,
          'exact_match', f.exact_match,
          'rollout_stage', f.rollout_stage,
          'maintenance_mode', f.maintenance_mode,
          'maintenance_message', f.maintenance_message,
          'admin_only', f.admin_only,
          'sort_order', f.sort_order,
          'allowed', private.can_use_app_feature(f.feature_key, v_user),
          'access_reason', case
            when v_role = 'admin' then 'admin'
            when f.admin_only then 'admin_only'
            when f.maintenance_mode and v_tester and f.rollout_stage in ('tester','public') then 'maintenance_tester'
            when f.maintenance_mode then 'maintenance'
            when f.rollout_stage = 'public' then 'public'
            when f.rollout_stage = 'tester' and v_tester then 'tester'
            when f.rollout_stage = 'tester' then 'tester_only'
            else 'admin_only_stage'
          end
        )
        order by f.sort_order, f.feature_key
      )
      from public.app_feature_controls f
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_list_app_feature_controls()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.is_active_admin() then raise exception 'active admin required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'tester_count', (
      select count(*) from public.app_release_testers t
      join public.profiles p on p.id = t.user_id
      where t.enabled = true and p.role = 'user' and p.status = 'active'
    ),
    'features', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'feature_key', f.feature_key,
          'category', f.category,
          'title', f.title,
          'description', f.description,
          'route_prefix', f.route_prefix,
          'exact_match', f.exact_match,
          'rollout_stage', f.rollout_stage,
          'maintenance_mode', f.maintenance_mode,
          'maintenance_message', f.maintenance_message,
          'admin_only', f.admin_only,
          'sort_order', f.sort_order,
          'updated_at', f.updated_at,
          'updated_by_aas_id', updater.aas_user_id
        )
        order by f.sort_order, f.feature_key
      )
      from public.app_feature_controls f
      left join public.profiles updater on updater.id = f.updated_by
    ), '[]'::jsonb),
    'testers', coalesce((
      select jsonb_agg(jsonb_build_object('aas_user_id', p.aas_user_id) order by p.aas_user_id)
      from public.app_release_testers t
      join public.profiles p on p.id = t.user_id
      where t.enabled = true and p.role = 'user' and p.status = 'active'
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_update_app_feature_control(
  p_feature_key text,
  p_rollout_stage text,
  p_maintenance_mode boolean,
  p_maintenance_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_feature public.app_feature_controls%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  if not private.is_active_admin() then raise exception 'active admin required' using errcode = '42501'; end if;
  p_feature_key := lower(btrim(coalesce(p_feature_key, '')));
  p_rollout_stage := lower(btrim(coalesce(p_rollout_stage, '')));
  p_maintenance_message := btrim(coalesce(p_maintenance_message, ''));
  if p_rollout_stage not in ('admin','tester','public') then raise exception 'invalid rollout stage' using errcode = '22023'; end if;
  if char_length(p_maintenance_message) > 500 then raise exception 'maintenance message too long' using errcode = '22023'; end if;
  select * into v_feature from public.app_feature_controls f where f.feature_key = p_feature_key for update;
  if v_feature.feature_key is null then raise exception 'feature not found' using errcode = '22023'; end if;
  if v_feature.admin_only and p_rollout_stage <> 'admin' then raise exception 'admin-only feature cannot be released to users' using errcode = '22023'; end if;

  v_old := jsonb_build_object('rollout_stage', v_feature.rollout_stage, 'maintenance_mode', v_feature.maintenance_mode, 'maintenance_message', v_feature.maintenance_message);
  update public.app_feature_controls
  set rollout_stage = p_rollout_stage,
      maintenance_mode = coalesce(p_maintenance_mode, false),
      maintenance_message = p_maintenance_message,
      updated_by = v_admin,
      updated_at = now()
  where feature_key = p_feature_key
  returning * into v_feature;
  v_new := jsonb_build_object('rollout_stage', v_feature.rollout_stage, 'maintenance_mode', v_feature.maintenance_mode, 'maintenance_message', v_feature.maintenance_message);

  if v_new is distinct from v_old then
    insert into public.app_feature_control_audit(feature_key, actor_user_id, old_state, new_state)
    values (p_feature_key, v_admin, v_old, v_new);
  end if;
  return public.admin_list_app_feature_controls();
end;
$function$;

revoke all on function private.can_use_app_feature(text,uuid) from public, anon, authenticated;
grant execute on function private.can_use_app_feature(text,uuid) to service_role;

revoke all on function public.get_my_app_feature_controls() from public, anon;
grant execute on function public.get_my_app_feature_controls() to authenticated;

revoke all on function public.admin_list_app_feature_controls() from public, anon;
grant execute on function public.admin_list_app_feature_controls() to authenticated;

revoke all on function public.admin_update_app_feature_control(text,text,boolean,text) from public, anon;
grant execute on function public.admin_update_app_feature_control(text,text,boolean,text) to authenticated;
