-- Create instagram_settings table
CREATE TABLE IF NOT EXISTS public.instagram_settings (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    ig_user_id TEXT,
    page_id TEXT,
    account_username TEXT,
    access_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create posts table
DO $$ BEGIN
    CREATE TYPE post_type AS ENUM ('feed', 'reels', 'carousel', 'stories');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.posts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type post_type NOT NULL DEFAULT 'feed',
    caption TEXT,
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    status post_status NOT NULL DEFAULT 'draft',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    ig_media_id TEXT,
    permalink TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create post_logs table
DO $$ BEGIN
    CREATE TYPE log_level AS ENUM ('info', 'success', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.post_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level log_level NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_logs ENABLE ROW LEVEL SECURITY;

-- Policies for instagram_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.instagram_settings;
CREATE POLICY "Users can view their own settings" ON public.instagram_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.instagram_settings;
CREATE POLICY "Users can insert their own settings" ON public.instagram_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own settings" ON public.instagram_settings;
CREATE POLICY "Users can update their own settings" ON public.instagram_settings FOR UPDATE USING (auth.uid() = user_id);

-- Policies for posts
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
CREATE POLICY "Users can view their own posts" ON public.posts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Policies for post_logs
DROP POLICY IF EXISTS "Users can view their own logs" ON public.post_logs;
CREATE POLICY "Users can view their own logs" ON public.post_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.post_logs;
CREATE POLICY "Users can insert their own logs" ON public.post_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('instagram-media', 'instagram-media', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Instagram Media Public Access" ON storage.objects;
CREATE POLICY "Instagram Media Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'instagram-media');
DROP POLICY IF EXISTS "Instagram Media User Upload Access" ON storage.objects;
CREATE POLICY "Instagram Media User Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'instagram-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Instagram Media User Delete Access" ON storage.objects;
CREATE POLICY "Instagram Media User Delete Access" ON storage.objects FOR DELETE USING (bucket_id = 'instagram-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_instagram_settings_updated_at ON public.instagram_settings;
CREATE TRIGGER set_instagram_settings_updated_at
BEFORE UPDATE ON public.instagram_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
