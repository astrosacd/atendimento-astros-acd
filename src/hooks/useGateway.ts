import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface GatewayCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface GatewayProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_brl: number;
  price_usd: number;
  category_id: string | null;
  status: 'active' | 'inactive';
  public_slug: string;
  created_at: string;
  updated_at: string;
  category?: GatewayCategory;
  order_bumps?: GatewayOrderBump[];
}

export interface GatewayOrderBump {
  id: string;
  name: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price_brl: number;
  price_usd: number;
  status: 'active' | 'inactive';
  allow_coupon: boolean;
  created_at: string;
  updated_at: string;
}

export interface GatewayCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  currency: 'BRL' | 'USD';
  starts_at: string | null;
  expires_at: string | null;
  max_uses_global: number | null;
  max_uses_per_order: number;
  usage_count: number;
  total_discount_given: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface GatewayOrder {
  id: string;
  product_id: string | null;
  order_bump_id: string | null;
  coupon_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  currency: 'BRL' | 'USD';
  status: 'pending' | 'paid' | 'cancelled' | 'abandoned' | 'rejected';
  payment_gateway: 'stripe' | 'mercadopago' | 'pix' | null;
  payment_id: string | null;
  pix_transaction_id?: string | null;
  proof_url?: string | null;
  ocr_amount?: number | null;
  ocr_status?: 'pending' | 'success' | 'mismatch' | 'error' | 'duplicate' | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  approval_flow_step?: 'pending' | 'manager' | 'finance' | 'completed' | null;
  abandoned_email_sent: boolean;
  created_at: string;
  updated_at: string;
  product?: GatewayProduct;
  order_bump?: GatewayOrderBump;
  coupon?: GatewayCoupon;
}

export interface GatewaySetting {
  id: string;
  key: string;
  value: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Helper to generate slug from name
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Categories Hook
export function useGatewayCategories() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gateway-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as GatewayCategory[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (category: Partial<GatewayCategory>) => {
      const slug = generateSlug(category.name || '');
      const { data, error } = await supabase
        .from('gateway_categories')
        .insert([{ name: category.name || '', description: category.description, status: category.status || 'active', slug }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-categories'] });
      toast.success('Categoria criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar categoria: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...category }: Partial<GatewayCategory> & { id: string }) => {
      const updates: any = { ...category };
      if (category.name) {
        updates.slug = generateSlug(category.name);
      }
      const { data, error } = await supabase
        .from('gateway_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-categories'] });
      toast.success('Categoria atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar categoria: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if category has products
      const { count } = await supabase
        .from('gateway_products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id);
      
      if (count && count > 0) {
        throw new Error('Não é possível excluir categoria com produtos vinculados');
      }

      const { error } = await supabase
        .from('gateway_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-categories'] });
      toast.success('Categoria excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    categories: query.data || [],
    isLoading: query.isLoading,
    createCategory: createMutation.mutate,
    updateCategory: updateMutation.mutate,
    deleteCategory: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Products Hook
export function useGatewayProducts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gateway-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_products')
        .select(`
          *,
          category:gateway_categories(*)
        `)
        .order('name');
      if (error) throw error;
      return data as GatewayProduct[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (product: Partial<GatewayProduct>) => {
      const { data, error } = await supabase
        .from('gateway_products')
        .insert([{ name: product.name || '', description: product.description, image_url: product.image_url, price_brl: product.price_brl || 0, price_usd: product.price_usd || 0, category_id: product.category_id, status: product.status || 'active' }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-products'] });
      toast.success('Produto criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar produto: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...product }: Partial<GatewayProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from('gateway_products')
        .update(product as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-products'] });
      toast.success('Produto atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar produto: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gateway_products')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-products'] });
      toast.success('Produto excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir produto: ' + error.message);
    },
  });

  return {
    products: query.data || [],
    isLoading: query.isLoading,
    createProduct: createMutation.mutate,
    updateProduct: updateMutation.mutate,
    deleteProduct: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Order Bumps Hook
export function useGatewayOrderBumps() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gateway-order-bumps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_order_bumps')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as GatewayOrderBump[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (orderBump: Partial<GatewayOrderBump>) => {
      const { data, error } = await supabase
        .from('gateway_order_bumps')
        .insert([{ name: orderBump.name || '', title: orderBump.title || '', description: orderBump.description, image_url: orderBump.image_url, price_brl: orderBump.price_brl || 0, price_usd: orderBump.price_usd || 0, status: orderBump.status || 'active', allow_coupon: orderBump.allow_coupon ?? true }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-order-bumps'] });
      toast.success('Order Bump criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar order bump: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...orderBump }: Partial<GatewayOrderBump> & { id: string }) => {
      const { data, error } = await supabase
        .from('gateway_order_bumps')
        .update(orderBump)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-order-bumps'] });
      toast.success('Order Bump atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar order bump: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gateway_order_bumps')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-order-bumps'] });
      toast.success('Order Bump excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir order bump: ' + error.message);
    },
  });

  return {
    orderBumps: query.data || [],
    isLoading: query.isLoading,
    createOrderBump: createMutation.mutate,
    updateOrderBump: updateMutation.mutate,
    deleteOrderBump: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Coupons Hook
export function useGatewayCoupons() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gateway-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_coupons')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as GatewayCoupon[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (coupon: Partial<GatewayCoupon>) => {
      const { data, error } = await supabase
        .from('gateway_coupons')
        .insert([{ code: coupon.code || '', discount_type: coupon.discount_type || 'percentage', discount_value: coupon.discount_value || 0, currency: coupon.currency || 'BRL', starts_at: coupon.starts_at, expires_at: coupon.expires_at, max_uses_global: coupon.max_uses_global, max_uses_per_order: coupon.max_uses_per_order || 1, status: coupon.status || 'active' }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-coupons'] });
      toast.success('Cupom criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar cupom: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...coupon }: Partial<GatewayCoupon> & { id: string }) => {
      const { data, error } = await supabase
        .from('gateway_coupons')
        .update(coupon)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-coupons'] });
      toast.success('Cupom atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar cupom: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gateway_coupons')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-coupons'] });
      toast.success('Cupom excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir cupom: ' + error.message);
    },
  });

  return {
    coupons: query.data || [],
    isLoading: query.isLoading,
    createCoupon: createMutation.mutate,
    updateCoupon: updateMutation.mutate,
    deleteCoupon: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Orders Hook
export function useGatewayOrders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gateway-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_orders')
        .select(`
          *,
          product:gateway_products(*),
          order_bump:gateway_order_bumps(*),
          coupon:gateway_coupons(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GatewayOrder[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...order }: Partial<GatewayOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('gateway_orders')
        .update(order as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-orders'] });
      toast.success('Pedido atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar pedido: ' + error.message);
    },
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    updateOrder: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    refetch: query.refetch,
  };
}

// Settings Hook
export function useGatewaySettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gateway-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_settings')
        .select('*');
      if (error) throw error;
      
      const settings: Record<string, any> = {};
      data.forEach((s: GatewaySetting) => {
        settings[s.key] = s.value;
      });
      return settings;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('gateway_settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-settings'] });
      toast.success('Configuração salva com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar configuração: ' + error.message);
    },
  });

  return {
    settings: query.data || {},
    isLoading: query.isLoading,
    updateSetting: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}

// Product Order Bumps Hook
export function useProductOrderBumps(productId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['product-order-bumps', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('gateway_product_order_bumps')
        .select(`
          *,
          order_bump:gateway_order_bumps(*)
        `)
        .eq('product_id', productId)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const setOrderBumpsMutation = useMutation({
    mutationFn: async ({ productId, orderBumpIds }: { productId: string; orderBumpIds: string[] }) => {
      // Remove all existing
      await supabase
        .from('gateway_product_order_bumps')
        .delete()
        .eq('product_id', productId);

      // Insert new ones
      if (orderBumpIds.length > 0) {
        const inserts = orderBumpIds.map((id, index) => ({
          product_id: productId,
          order_bump_id: id,
          display_order: index,
        }));
        const { error } = await supabase
          .from('gateway_product_order_bumps')
          .insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-order-bumps'] });
      toast.success('Order bumps vinculados com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao vincular order bumps: ' + error.message);
    },
  });

  return {
    productOrderBumps: query.data || [],
    isLoading: query.isLoading,
    setOrderBumps: setOrderBumpsMutation.mutate,
    isSetting: setOrderBumpsMutation.isPending,
  };
}

// Dashboard Stats Hook
export function useGatewayDashboard() {
  return useQuery({
    queryKey: ['gateway-dashboard'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all paid orders
      const { data: orders, error } = await supabase
        .from('gateway_orders')
        .select('*')
        .eq('status', 'paid');
      
      if (error) throw error;

      const totalSales = orders?.reduce((acc, o) => acc + Number(o.total), 0) || 0;
      const todayOrders = orders?.filter(o => new Date(o.created_at) >= today) || [];
      const todaySales = todayOrders.reduce((acc, o) => acc + Number(o.total), 0);
      const avgTicket = orders?.length ? totalSales / orders.length : 0;

      // Get all orders for conversion rate
      const { count: totalOrders } = await supabase
        .from('gateway_orders')
        .select('*', { count: 'exact', head: true });

      const conversionRate = totalOrders ? ((orders?.length || 0) / totalOrders) * 100 : 0;

      // Sales by day for chart
      const salesByDay: Record<string, number> = {};
      orders?.forEach(o => {
        const date = new Date(o.created_at).toISOString().split('T')[0];
        salesByDay[date] = (salesByDay[date] || 0) + Number(o.total);
      });

      const chartData = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        chartData.push({
          date: dateStr,
          sales: salesByDay[dateStr] || 0,
        });
      }

      return {
        totalSales,
        todaySales,
        todayOrdersCount: todayOrders.length,
        avgTicket,
        conversionRate,
        chartData,
        totalOrders: orders?.length || 0,
      };
    },
  });
}
