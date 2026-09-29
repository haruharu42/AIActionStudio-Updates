begin;

create table if not exists public.creator_profiles (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    bio text not null default '',
    favorite_genres text[] not null default '{}'::text[],
    goal text not null default '',
    ranking_opt_in boolean not null default true,
    show_level boolean not null default true,
    show_completed_count boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint creator_profiles_bio_length_check check (length(bio) <= 300),
    constraint creator_profiles_goal_length_check check (length(goal) <= 200),
    constraint creator_profiles_genre_count_check check (cardinality(favorite_genres) <= 10)
);

create table if not exists public.article_completion_events (
    article_id uuid primary key references public.articles(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    first_completed_at timestamptz not null default now(),
    xp_awarded integer not null default 100,
    constraint article_completion_events_xp_check check (xp_awarded between 0 and 10000)
);

create index if not exists article_completion_events_user_completed_idx
    on public.article_completion_events (user_id, first_completed_at desc, article_id);

create or replace function private.creator_level_from_xp(p_xp bigint)
returns integer
language sql
immutable
set search_path = ''
as $function$
    select least(99, greatest(1, floor(sqrt(greatest(coalesce(p_xp, 0), 0)::numeric / 30))::integer + 1));
$function$;

revoke all on function private.creator_level_from_xp(bigint) from public, anon, authenticated;

create or replace function private.record_article_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if new.status in ('ready', 'waiting_publish', 'published')
       and length(trim(coalesce(new.title, ''))) > 0
       and length(trim(coalesce(new.body, ''))) > 0 then
        insert into public.article_completion_events (article_id, user_id, first_completed_at, xp_awarded)
        values (new.id, new.user_id, now(), 100)
        on conflict (article_id) do nothing;
    end if;
    return new;
end;
$function$;

revoke all on function private.record_article_completion() from public, anon, authenticated;

drop trigger if exists articles_record_completion on public.articles;
create trigger articles_record_completion
after insert or update of status, title, body on public.articles
for each row execute function private.record_article_completion();

insert into public.article_completion_events (article_id, user_id, first_completed_at, xp_awarded)
select a.id, a.user_id, coalesce(a.published_at, a.updated_at, a.created_at), 100
from public.articles as a
where a.status in ('ready', 'waiting_publish', 'published')
  and length(trim(coalesce(a.title, ''))) > 0
  and length(trim(coalesce(a.body, ''))) > 0
on conflict (article_id) do nothing;

insert into public.creator_profiles (user_id)
select p.id
from public.profiles as p
on conflict (user_id) do nothing;

alter table public.creator_profiles enable row level security;
alter table public.creator_profiles force row level security;
alter table public.article_completion_events enable row level security;
alter table public.article_completion_events force row level security;

revoke all on table public.creator_profiles from public, anon, authenticated;
revoke all on table public.article_completion_events from public, anon, authenticated;
grant select on table public.creator_profiles to authenticated;
grant select on table public.article_completion_events to authenticated;

create policy creator_profiles_select_own
on public.creator_profiles
for select
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_profile()));

create policy article_completion_events_select_own
on public.article_completion_events
for select
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_profile()));

create or replace function public.get_my_creator_profile()
returns table (
    user_id uuid,
    aas_user_id text,
    display_name text,
    bio text,
    favorite_genres text[],
    goal text,
    ranking_opt_in boolean,
    show_level boolean,
    show_completed_count boolean,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    current_user_id uuid := (select auth.uid());
begin
    if current_user_id is null or not (select private.is_active_profile()) then
        raise exception 'active profile required' using errcode = '42501';
    end if;

    insert into public.creator_profiles (user_id)
    values (current_user_id)
    on conflict (user_id) do nothing;

    return query
    select p.id, p.aas_user_id, p.display_name,
           cp.bio, cp.favorite_genres, cp.goal,
           cp.ranking_opt_in, cp.show_level, cp.show_completed_count, cp.updated_at
    from public.profiles as p
    join public.creator_profiles as cp on cp.user_id = p.id
    where p.id = current_user_id;
end;
$function$;

revoke all on function public.get_my_creator_profile() from public, anon;
grant execute on function public.get_my_creator_profile() to authenticated;

create or replace function public.update_my_creator_profile(
    p_display_name text,
    p_bio text default '',
    p_favorite_genres text[] default '{}'::text[],
    p_goal text default '',
    p_ranking_opt_in boolean default true,
    p_show_level boolean default true,
    p_show_completed_count boolean default true
)
returns public.creator_profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
    current_user_id uuid := (select auth.uid());
    normalized_name text := nullif(trim(coalesce(p_display_name, '')), '');
    normalized_bio text := trim(coalesce(p_bio, ''));
    normalized_goal text := trim(coalesce(p_goal, ''));
    normalized_genres text[] := coalesce(p_favorite_genres, '{}'::text[]);
    result public.creator_profiles%rowtype;
begin
    if current_user_id is null or not (select private.is_active_profile()) then
        raise exception 'active profile required' using errcode = '42501';
    end if;
    if normalized_name is null or length(normalized_name) > 80 then
        raise exception 'display name must be 1 to 80 characters' using errcode = '22023';
    end if;
    if length(normalized_bio) > 300 or length(normalized_goal) > 200 then
        raise exception 'profile text is too long' using errcode = '22023';
    end if;
    if cardinality(normalized_genres) > 10 then
        raise exception 'too many favorite genres' using errcode = '22023';
    end if;

    update public.profiles
    set display_name = normalized_name
    where id = current_user_id;

    insert into public.creator_profiles (
        user_id, bio, favorite_genres, goal,
        ranking_opt_in, show_level, show_completed_count, updated_at
    ) values (
        current_user_id, normalized_bio, normalized_genres, normalized_goal,
        coalesce(p_ranking_opt_in, true), coalesce(p_show_level, true),
        coalesce(p_show_completed_count, true), now()
    )
    on conflict (user_id) do update
    set bio = excluded.bio,
        favorite_genres = excluded.favorite_genres,
        goal = excluded.goal,
        ranking_opt_in = excluded.ranking_opt_in,
        show_level = excluded.show_level,
        show_completed_count = excluded.show_completed_count,
        updated_at = now()
    returning * into result;

    return result;
end;
$function$;

revoke all on function public.update_my_creator_profile(text, text, text[], text, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_my_creator_profile(text, text, text[], text, boolean, boolean, boolean) to authenticated;

create or replace function public.get_my_creator_stats()
returns table (
    xp bigint,
    level integer,
    completed_articles bigint,
    completed_this_week bigint,
    level_rank bigint,
    completed_rank bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    current_user_id uuid := (select auth.uid());
begin
    if current_user_id is null or not (select private.is_active_profile()) then
        raise exception 'active profile required' using errcode = '42501';
    end if;

    return query
    with stats as (
        select p.id as user_id,
               coalesce(sum(e.xp_awarded), 0)::bigint as total_xp,
               count(e.article_id)::bigint as completed_count,
               count(e.article_id) filter (
                   where e.first_completed_at >= date_trunc('week', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'
               )::bigint as week_count
        from public.profiles as p
        left join public.article_completion_events as e on e.user_id = p.id
        where p.status = 'active'
        group by p.id
    ), eligible as (
        select s.*, cp.ranking_opt_in, cp.show_level, cp.show_completed_count,
               private.creator_level_from_xp(s.total_xp) as creator_level
        from stats as s
        join public.creator_profiles as cp on cp.user_id = s.user_id
    ), ranked as (
        select e.*,
               case when e.ranking_opt_in and e.show_level then
                   rank() over (order by case when e.ranking_opt_in and e.show_level then e.creator_level end desc nulls last,
                                          case when e.ranking_opt_in and e.show_level then e.total_xp end desc nulls last,
                                          e.user_id)
               end as lr,
               case when e.ranking_opt_in and e.show_completed_count then
                   rank() over (order by case when e.ranking_opt_in and e.show_completed_count then e.completed_count end desc nulls last,
                                          case when e.ranking_opt_in and e.show_completed_count then e.total_xp end desc nulls last,
                                          e.user_id)
               end as cr
        from eligible as e
    )
    select r.total_xp, r.creator_level, r.completed_count, r.week_count,
           case when r.ranking_opt_in and r.show_level then r.lr else null end,
           case when r.ranking_opt_in and r.show_completed_count then r.cr else null end
    from ranked as r
    where r.user_id = current_user_id;
end;
$function$;

revoke all on function public.get_my_creator_stats() from public, anon;
grant execute on function public.get_my_creator_stats() to authenticated;

create or replace function public.get_creator_leaderboard(
    p_mode text default 'level',
    p_limit integer default 50
)
returns table (
    rank bigint,
    user_id uuid,
    display_name text,
    creator_level integer,
    xp bigint,
    completed_articles bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    current_user_id uuid := (select auth.uid());
    ranking_mode text := lower(trim(coalesce(p_mode, 'level')));
    result_limit integer := least(100, greatest(1, coalesce(p_limit, 50)));
begin
    if current_user_id is null or not (select private.is_active_profile()) then
        raise exception 'active profile required' using errcode = '42501';
    end if;
    if ranking_mode not in ('level', 'completed') then
        raise exception 'unsupported leaderboard mode' using errcode = '22023';
    end if;

    return query
    with stats as (
        select p.id as uid,
               coalesce(nullif(trim(p.display_name), ''), p.aas_user_id) as public_name,
               coalesce(sum(e.xp_awarded), 0)::bigint as total_xp,
               count(e.article_id)::bigint as completed_count,
               cp.show_level,
               cp.show_completed_count
        from public.profiles as p
        join public.creator_profiles as cp on cp.user_id = p.id and cp.ranking_opt_in
        left join public.article_completion_events as e on e.user_id = p.id
        where p.status = 'active'
          and ((ranking_mode = 'level' and cp.show_level) or (ranking_mode = 'completed' and cp.show_completed_count))
        group by p.id, p.display_name, p.aas_user_id, cp.show_level, cp.show_completed_count
    ), ordered as (
        select s.*,
               private.creator_level_from_xp(s.total_xp) as lvl,
               case when ranking_mode = 'level' then
                   rank() over (order by private.creator_level_from_xp(s.total_xp) desc, s.total_xp desc, s.completed_count desc, s.uid)
               else
                   rank() over (order by s.completed_count desc, s.total_xp desc, s.uid)
               end as pos
        from stats as s
    )
    select o.pos, o.uid, o.public_name, o.lvl, o.total_xp, o.completed_count
    from ordered as o
    order by o.pos, o.uid
    limit result_limit;
end;
$function$;

revoke all on function public.get_creator_leaderboard(text, integer) from public, anon;
grant execute on function public.get_creator_leaderboard(text, integer) to authenticated;

commit;