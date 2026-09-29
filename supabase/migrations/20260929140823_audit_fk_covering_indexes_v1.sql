create index if not exists article_library_quota_settings_updated_by_idx
  on public.article_library_quota_settings (updated_by);

create index if not exists promotion_content_assets_draft_owner_idx
  on public.promotion_content_assets (draft_id, user_id);
