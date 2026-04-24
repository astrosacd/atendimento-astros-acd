-- Add category column to predefined_products
ALTER TABLE public.predefined_products 
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'mensal';

-- Create an index for category
CREATE INDEX IF NOT EXISTS idx_predefined_products_category ON public.predefined_products (category);

-- Update existing data if any
UPDATE public.predefined_products SET category = 'mensal' WHERE category IS NULL;
