-- Gateway Categories
CREATE TABLE public.gateway_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gateway Products
CREATE TABLE public.gateway_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price_brl NUMERIC NOT NULL DEFAULT 0,
  price_usd NUMERIC NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.gateway_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  public_slug UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gateway Order Bumps
CREATE TABLE public.gateway_order_bumps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price_brl NUMERIC NOT NULL DEFAULT 0,
  price_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gateway Product Order Bumps (N:N)
CREATE TABLE public.gateway_product_order_bumps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.gateway_products(id) ON DELETE CASCADE,
  order_bump_id UUID NOT NULL REFERENCES public.gateway_order_bumps(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, order_bump_id)
);

-- Gateway Coupons
CREATE TABLE public.gateway_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD')),
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses_global INTEGER,
  max_uses_per_order INTEGER DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  total_discount_given NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gateway Orders
CREATE TABLE public.gateway_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.gateway_products(id) ON DELETE SET NULL,
  order_bump_id UUID REFERENCES public.gateway_order_bumps(id) ON DELETE SET NULL,
  coupon_id UUID REFERENCES public.gateway_coupons(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'abandoned')),
  payment_gateway TEXT CHECK (payment_gateway IN ('stripe', 'mercadopago')),
  payment_id TEXT,
  abandoned_email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gateway Coupon Usages
CREATE TABLE public.gateway_coupon_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.gateway_coupons(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.gateway_orders(id) ON DELETE CASCADE,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gateway Settings (key-value JSON)
CREATE TABLE public.gateway_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_gateway_products_category ON public.gateway_products(category_id);
CREATE INDEX idx_gateway_products_public_slug ON public.gateway_products(public_slug);
CREATE INDEX idx_gateway_products_status ON public.gateway_products(status);
CREATE INDEX idx_gateway_orders_status ON public.gateway_orders(status);
CREATE INDEX idx_gateway_orders_created_at ON public.gateway_orders(created_at);
CREATE INDEX idx_gateway_coupons_code ON public.gateway_coupons(code);

-- Enable RLS on all tables
ALTER TABLE public.gateway_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_order_bumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_product_order_bumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Admin access
CREATE POLICY "Admins can manage gateway_categories" ON public.gateway_categories FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage gateway_products" ON public.gateway_products FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage gateway_order_bumps" ON public.gateway_order_bumps FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage gateway_product_order_bumps" ON public.gateway_product_order_bumps FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage gateway_coupons" ON public.gateway_coupons FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage gateway_orders" ON public.gateway_orders FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage gateway_coupon_usages" ON public.gateway_coupon_usages FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage gateway_settings" ON public.gateway_settings FOR ALL USING (is_admin());

-- Public access policies for checkout pages
CREATE POLICY "Public can view active products" ON public.gateway_products FOR SELECT USING (status = 'active');
CREATE POLICY "Public can view active categories" ON public.gateway_categories FOR SELECT USING (status = 'active');
CREATE POLICY "Public can view active order bumps" ON public.gateway_order_bumps FOR SELECT USING (status = 'active');
CREATE POLICY "Public can view product order bumps" ON public.gateway_product_order_bumps FOR SELECT USING (true);
CREATE POLICY "Public can view active coupons" ON public.gateway_coupons FOR SELECT USING (status = 'active');

-- Service policies for order creation (from edge functions)
CREATE POLICY "Service can insert orders" ON public.gateway_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update orders" ON public.gateway_orders FOR UPDATE USING (true);
CREATE POLICY "Service can insert coupon usages" ON public.gateway_coupon_usages FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update coupons" ON public.gateway_coupons FOR UPDATE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_gateway_categories_updated_at BEFORE UPDATE ON public.gateway_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_products_updated_at BEFORE UPDATE ON public.gateway_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_order_bumps_updated_at BEFORE UPDATE ON public.gateway_order_bumps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_coupons_updated_at BEFORE UPDATE ON public.gateway_coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_orders_updated_at BEFORE UPDATE ON public.gateway_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_settings_updated_at BEFORE UPDATE ON public.gateway_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('gateway-products', 'gateway-products', true);

-- Storage policies
CREATE POLICY "Public can view gateway product images" ON storage.objects FOR SELECT USING (bucket_id = 'gateway-products');
CREATE POLICY "Admins can upload gateway product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gateway-products' AND is_admin());
CREATE POLICY "Admins can update gateway product images" ON storage.objects FOR UPDATE USING (bucket_id = 'gateway-products' AND is_admin());
CREATE POLICY "Admins can delete gateway product images" ON storage.objects FOR DELETE USING (bucket_id = 'gateway-products' AND is_admin());

-- Insert default settings
INSERT INTO public.gateway_settings (key, value) VALUES
  ('stripe', '{"enabled": false, "publishable_key": "", "secret_key": ""}'),
  ('mercadopago', '{"enabled": false, "access_token": ""}'),
  ('email', '{"smtp_host": "", "smtp_port": 587, "smtp_user": "", "smtp_password": "", "from_email": "", "from_name": ""}'),
  ('abandoned_cart', '{"enabled": false, "delay_minutes": 30, "email_subject": "Você esqueceu algo no carrinho!", "email_template": ""}')