alter table public.note_operation_profiles
  drop constraint if exists note_operation_profiles_paid_posts_per_month_check,
  drop constraint if exists note_operation_profiles_tone_preset_check;

alter table public.note_operation_profiles
  add constraint note_operation_profiles_paid_posts_per_month_check
    check (paid_posts_per_month >= 0 and paid_posts_per_month <= 60),
  add constraint note_operation_profiles_free_posts_per_month_check
    check (free_posts_per_month >= 0 and free_posts_per_month <= 60),
  add constraint note_operation_profiles_free_target_length_check
    check (free_target_length >= 500 and free_target_length <= 50000),
  add constraint note_operation_profiles_paid_target_length_check
    check (paid_target_length >= 500 and paid_target_length <= 50000),
  add constraint note_operation_profiles_article_defaults_length
    check (
      char_length(article_genre) <= 120
      and char_length(article_subgenre) <= 120
    ),
  add constraint note_operation_profiles_tone_preset_check
    check (
      tone_preset = any (
        array[
          'friendly'::text,
          'gentle'::text,
          'professional'::text,
          'casual'::text,
          'expert'::text,
          'energetic'::text,
          'logical'::text,
          'empathetic'::text,
          'storytelling'::text,
          'concise'::text,
          'essay'::text,
          'warm'::text,
          'formal'::text,
          'humorous'::text,
          'other'::text
        ]
      )
    );
