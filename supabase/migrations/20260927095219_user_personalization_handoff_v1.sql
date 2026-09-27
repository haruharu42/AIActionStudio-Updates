alter table public.user_writing_profiles
    add column if not exists persona_context text not null default '',
    add column if not exists custom_instructions text not null default '',
    add column if not exists avoid_phrases text not null default '';

alter table public.user_writing_profiles
    drop constraint if exists user_writing_profiles_persona_context_length,
    drop constraint if exists user_writing_profiles_custom_instructions_length,
    drop constraint if exists user_writing_profiles_avoid_phrases_length;

alter table public.user_writing_profiles
    add constraint user_writing_profiles_persona_context_length
      check (char_length(persona_context) <= 1200),
    add constraint user_writing_profiles_custom_instructions_length
      check (char_length(custom_instructions) <= 2400),
    add constraint user_writing_profiles_avoid_phrases_length
      check (char_length(avoid_phrases) <= 1200);

comment on column public.user_writing_profiles.persona_context is
  'User-authored non-secret context to pass explicitly to AI prompts. Do not store credentials, API keys, payment data, or article bodies.';
comment on column public.user_writing_profiles.custom_instructions is
  'User-authored writing and response preferences for AAS prompt personalization.';
comment on column public.user_writing_profiles.avoid_phrases is
  'User-authored phrases or expression patterns the AI should avoid.';
