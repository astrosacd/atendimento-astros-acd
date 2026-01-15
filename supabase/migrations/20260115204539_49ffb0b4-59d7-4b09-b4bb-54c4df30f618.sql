-- Create table for tracking proposal views and interactions
CREATE TABLE public.proposal_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'opened', 'scroll', 'section_viewed', 'gallery_viewed', 'signature_viewed', 'signed_accepted', 'signed_rejected'
  event_data JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_proposal_views_proposal_id ON public.proposal_views(proposal_id);
CREATE INDEX idx_proposal_views_event_type ON public.proposal_views(event_type);
CREATE INDEX idx_proposal_views_created_at ON public.proposal_views(created_at DESC);

-- Enable RLS
ALTER TABLE public.proposal_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert views (public tracking)
CREATE POLICY "Anyone can insert proposal views" 
ON public.proposal_views 
FOR INSERT 
WITH CHECK (true);

-- Only authenticated users can read views
CREATE POLICY "Authenticated users can view proposal views" 
ON public.proposal_views 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Add signature columns to proposals table
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signed_status TEXT, -- 'accepted' or 'rejected'
ADD COLUMN IF NOT EXISTS signed_name TEXT,
ADD COLUMN IF NOT EXISTS signed_ip TEXT,
ADD COLUMN IF NOT EXISTS signature_image TEXT;