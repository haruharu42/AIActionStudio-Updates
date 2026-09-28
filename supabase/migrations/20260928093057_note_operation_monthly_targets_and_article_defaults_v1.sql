alter table public.note_operation_profiles
  add column if not exists article_genre text not null default 'AI副業',
  add column if not exists article_subgenre text not null default 'AIおまかせ',
  add column if not exists free_posts_per_month smallint not null default 10,
  add column if not exists free_target_length integer not null default 4000,
  add column if not exists paid_target_length integer not null default 7000;

update public.note_operation_profiles
set
  article_genre = case
    when account_genre = 'ai' then 'AI・テクノロジー'
    when account_genre = 'sidejob' then 'お金・副業'
    when account_genre = 'business' then '仕事・キャリア'
    when account_genre = 'lifestyle' then '生活・暮らし'
    when account_genre = 'gadget' then 'ガジェット'
    when account_genre = 'learning' then '学習・自己成長'
    when account_genre = 'parenting' then '子育て・教育'
    when account_genre = 'health_beauty' then '健康・フィットネス'
    when account_genre = 'money' then 'お金・副業'
    when account_genre = 'creative' then '趣味・エンタメ'
    when account_genre = 'entertainment' then '趣味・エンタメ'
    when account_genre = 'other' and nullif(trim(custom_genre), '') is not null then left(trim(custom_genre), 120)
    else article_genre
  end,
  article_subgenre = case
    when article_subgenre is null or trim(article_subgenre) = '' then 'AIおまかせ'
    else article_subgenre
  end,
  free_posts_per_month = greatest(
    0,
    least(60, (weekly_post_count::integer * 4) - paid_posts_per_month::integer)
  );
