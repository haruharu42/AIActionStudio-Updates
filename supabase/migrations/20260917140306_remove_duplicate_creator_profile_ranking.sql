begin;

drop trigger if exists articles_record_completion on public.articles;
drop function if exists private.record_article_completion();
drop function if exists private.creator_level_from_xp(bigint);
drop function if exists public.get_creator_leaderboard(text, integer);
drop function if exists public.get_my_creator_profile();
drop function if exists public.get_my_creator_stats();
drop function if exists public.update_my_creator_profile(text, text, text[], text, boolean, boolean, boolean);
drop table if exists public.article_completion_events;

commit;