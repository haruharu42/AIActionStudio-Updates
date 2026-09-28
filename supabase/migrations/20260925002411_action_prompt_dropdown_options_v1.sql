-- Add dropdown choices to existing action prompt audience/goal fields.
-- The UI still keeps "other/custom" free input available.

with option_sets as (
  select
    '["完全初心者","初心者","経験者","会社員・働く人","副業を始めたい人","クリエイター・発信者","個人事業主・経営者","既存フォロワー","購入を検討している人","幅広い読者"]'::jsonb as audience_options,
    '["認知を広げる","保存・ブックマークにつなげる","プロフィール閲覧・フォローにつなげる","購入判断を助ける","商品・サービス購入につなげる","問い合わせ・相談につなげる","応募・案件獲得につなげる","理解・学習を助ける","継続して読んでもらう","作業を効率化する"]'::jsonb as goal_options
),
updated as (
  select
    template.id,
    jsonb_agg(
      case field->>'key'
        when 'audience' then field || jsonb_build_object('options', option_sets.audience_options)
        when 'goal' then field || jsonb_build_object('options', option_sets.goal_options)
        else field
      end
      order by field_ord
    ) as next_schema
  from public.action_prompt_templates template
  cross join option_sets
  cross join lateral jsonb_array_elements(template.input_schema) with ordinality as fields(field, field_ord)
  group by template.id, option_sets.audience_options, option_sets.goal_options
)
update public.action_prompt_templates target
set input_schema=updated.next_schema,
    updated_at=now()
from updated
where target.id=updated.id;
