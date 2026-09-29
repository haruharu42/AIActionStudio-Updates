-- Diversify resale Knowledge monitoring beyond a single marketplace.
-- All sources are official service guides/policies; publication remains admin-review gated.

insert into public.knowledge_automation_sources
  (source_url,tasks,source_kind,enabled,next_check_at)
values
  ('https://paypayfleamarket.yahoo.co.jp/guide/beginner/', array['sidejob_resale']::text[], 'official_help', true, now()),
  ('https://paypayfleamarket.yahoo.co.jp/guide/guideline/', array['sidejob_resale']::text[], 'official_policy', true, now()),
  ('https://paypayfleamarket.yahoo.co.jp/guide/guideline/detail/', array['sidejob_resale']::text[], 'official_policy', true, now()),
  ('https://paypayfleamarket.yahoo.co.jp/notice/rule/', array['sidejob_resale']::text[], 'official_changelog', true, now()),
  ('https://faq.fril.jp/hc/ja/articles/39032852808973', array['sidejob_resale']::text[], 'official_help', true, now()),
  ('https://faq.fril.jp/hc/ja/sections/39849581863309', array['sidejob_resale']::text[], 'official_policy', true, now())
on conflict (source_url) do update set
  tasks=(
    select array_agg(distinct item order by item)
    from unnest(coalesce(public.knowledge_automation_sources.tasks, array[]::text[]) || excluded.tasks) as item
  ),
  source_kind=excluded.source_kind,
  enabled=true,
  next_check_at=least(public.knowledge_automation_sources.next_check_at, now()),
  updated_at=now();
