
-- Anti-spam e blacklists por regra
ALTER TABLE public.ig_auto_reply_rules
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 3600,
  ADD COLUMN IF NOT EXISTS max_per_user_per_day INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS blacklist_keywords TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blacklist_usernames TEXT[] NOT NULL DEFAULT '{}';

-- Dedup: mesmo comentário nunca recebe mesma regra 2x
CREATE UNIQUE INDEX IF NOT EXISTS ig_auto_reply_history_dedup_idx
  ON public.ig_auto_reply_history (rule_id, ig_comment_id);

-- Índices para cooldown/rate-limit lookups
CREATE INDEX IF NOT EXISTS ig_auto_reply_history_user_created_idx
  ON public.ig_auto_reply_history (ig_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ig_auto_reply_history_rule_user_created_idx
  ON public.ig_auto_reply_history (rule_id, ig_user_id, created_at DESC);
