
ALTER TABLE public.social_media_daily_snapshots
  ADD COLUMN IF NOT EXISTS reach integer,
  ADD COLUMN IF NOT EXISTS impressions integer,
  ADD COLUMN IF NOT EXISTS profile_views integer,
  ADD COLUMN IF NOT EXISTS website_clicks integer,
  ADD COLUMN IF NOT EXISTS accounts_engaged integer,
  ADD COLUMN IF NOT EXISTS total_interactions integer,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'business_discovery';

ALTER TABLE public.social_media_posts_collected
  ADD COLUMN IF NOT EXISTS reach integer,
  ADD COLUMN IF NOT EXISTS impressions integer,
  ADD COLUMN IF NOT EXISTS saved integer,
  ADD COLUMN IF NOT EXISTS total_interactions integer,
  ADD COLUMN IF NOT EXISTS plays integer,
  ADD COLUMN IF NOT EXISTS shares integer,
  ADD COLUMN IF NOT EXISTS insights_source text DEFAULT 'business_discovery';

ALTER TABLE public.social_media_client_profiles
  ADD COLUMN IF NOT EXISTS audience_demographics jsonb,
  ADD COLUMN IF NOT EXISTS audience_demographics_updated_at timestamptz;
