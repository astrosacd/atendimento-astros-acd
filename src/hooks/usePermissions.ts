import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RolePermission {
  role_name: string;
  permission_key: string;
}

export function usePermissions() {
  const { userRole, isAdmin } = useAuth();

  const { data: permissions = [] } = useQuery({
    queryKey: ['user-permissions', userRole],
    queryFn: async () => {
      if (!userRole) return [];
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_name', userRole);
      
      if (error) throw error;
      return data.map((p: { permission_key: string }) => p.permission_key);
    },
    enabled: !!userRole,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent refetch on navigation
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
  });

  const hasPermission = (permissionKey: string): boolean => {
    if (isAdmin) return true;
    return permissions.includes(permissionKey);
  };

  const canViewDashboard = () => hasPermission('view_dashboard');
  const canViewClients = () => hasPermission('view_clients');
  const canCreateClients = () => hasPermission('create_clients');
  const canUpdateClients = () => hasPermission('update_clients');
  const canDeleteClients = () => hasPermission('delete_clients');
  const canExportClients = () => hasPermission('export_clients');
  const canManageUsers = () => hasPermission('manage_users');
  const canManagePermissions = () => hasPermission('manage_permissions');
  const canManageBilling = () => hasPermission('manage_billing');
  const canManageWebhooks = () => hasPermission('manage_webhooks');
  const canManageApi = () => hasPermission('manage_api');
  const canViewLogs = () => hasPermission('view_logs');
  const canManageSettings = () => hasPermission('manage_settings');
  const canViewDivulgador = () => hasPermission('view_divulgador');
  const canManageDivulgadorConfig = () => hasPermission('manage_divulgador_config');
  const canManageDivulgadorCampaigns = () => hasPermission('manage_divulgador_campaigns');
  const canManageDivulgadorGroups = () => hasPermission('manage_divulgador_groups');
  const canManageDivulgadorMessages = () => hasPermission('manage_divulgador_messages');
  const canManageDivulgadorParticipants = () => hasPermission('manage_divulgador_participants');
  const canViewDivulgadorReports = () => hasPermission('view_divulgador_reports');
  
  // Status de Números permissions
  const canViewNumeros = () => hasPermission('view_numeros');
  const canCreateNumeros = () => hasPermission('create_numeros');
  const canEditNumeros = () => hasPermission('edit_numeros');
  const canChangeNumerosStatus = () => hasPermission('change_numeros_status');
  const canChangeNumerosObs = () => hasPermission('change_numeros_obs');
  const canDeleteNumeros = () => hasPermission('delete_numeros');
  const canExportNumeros = () => hasPermission('export_numeros');
  const canViewNumerosHistory = () => hasPermission('view_numeros_history');
  const canManageNumerosWebhooks = () => hasPermission('manage_numeros_webhooks');
  const canManageNumerosApi = () => hasPermission('manage_numeros_api');

  // Consulta de Números permissions
  const canViewConsultaNumeros = () => hasPermission('view_consulta_numeros');

  // Chamados permissions
  const canViewChamados = () => hasPermission('view_chamados');
  const canManageChamados = () => hasPermission('manage_chamados');
  const canManageChamadosConfig = () => hasPermission('manage_chamados_config');
  const canManageChamadosWebhooks = () => hasPermission('manage_chamados_webhooks');
  const canManageChamadosApi = () => hasPermission('manage_chamados_api');

  // Guia permissions
  const canViewGuia = () => hasPermission('view_guia');
  const canViewGuiaComunicacao = () => hasPermission('view_guia_comunicacao');
  const canViewGuiaIntegracoes = () => hasPermission('view_guia_integracoes');
  const canViewGuiaUsuarios = () => hasPermission('view_guia_usuarios');
  const canViewGuiaCobranca = () => hasPermission('view_guia_cobranca');
  const canViewGuiaClientes = () => hasPermission('view_guia_clientes');
  const canViewGuiaDivulgador = () => hasPermission('view_guia_divulgador');
  const canViewGuiaNumeros = () => hasPermission('view_guia_numeros');
  const canViewGuiaAvancado = () => hasPermission('view_guia_avancado');
  const canViewGuiaChamados = () => hasPermission('view_guia_chamados');
  // Gateway permissions
  const canViewGateway = () => hasPermission('view_gateway');
  const canManageGatewayProducts = () => hasPermission('manage_gateway_products');
  const canManageGatewayCategories = () => hasPermission('manage_gateway_categories');
  const canManageGatewayOrderBumps = () => hasPermission('manage_gateway_order_bumps');
  const canManageGatewayCoupons = () => hasPermission('manage_gateway_coupons');
  const canViewGatewayOrders = () => hasPermission('view_gateway_orders');
  const canManageGatewayOrders = () => hasPermission('manage_gateway_orders');
  const canManageGatewaySettings = () => hasPermission('manage_gateway_settings');
  const canViewGatewayReports = () => hasPermission('view_gateway_reports');

  // Revendedor permissions
  const canViewRevendedor = () => hasPermission('view_revendedor');
  const canManageRevendedorPlanos = () => hasPermission('manage_revendedor_planos');
  const canManageRevendedorLicencas = () => hasPermission('manage_revendedor_licencas');

  return {
    permissions,
    hasPermission,
    canViewDashboard,
    canViewClients,
    canCreateClients,
    canUpdateClients,
    canDeleteClients,
    canExportClients,
    canManageUsers,
    canManagePermissions,
    canManageBilling,
    canManageWebhooks,
    canManageApi,
    canViewLogs,
    canManageSettings,
    canViewDivulgador,
    canManageDivulgadorConfig,
    canManageDivulgadorCampaigns,
    canManageDivulgadorGroups,
    canManageDivulgadorMessages,
    canManageDivulgadorParticipants,
    canViewDivulgadorReports,
    canViewNumeros,
    canCreateNumeros,
    canEditNumeros,
    canChangeNumerosStatus,
    canChangeNumerosObs,
    canDeleteNumeros,
    canExportNumeros,
    canViewNumerosHistory,
    canManageNumerosWebhooks,
    canManageNumerosApi,
    canViewConsultaNumeros,
    // Chamados
    canViewChamados,
    canManageChamados,
    canManageChamadosConfig,
    canManageChamadosWebhooks,
    canManageChamadosApi,
    // Guia
    canViewGuia,
    canViewGuiaComunicacao,
    canViewGuiaIntegracoes,
    canViewGuiaUsuarios,
    canViewGuiaCobranca,
    canViewGuiaClientes,
    canViewGuiaDivulgador,
    canViewGuiaNumeros,
    canViewGuiaAvancado,
    canViewGuiaChamados,
    // Gateway
    canViewGateway,
    canManageGatewayProducts,
    canManageGatewayCategories,
    canManageGatewayOrderBumps,
    canManageGatewayCoupons,
    canViewGatewayOrders,
    canManageGatewayOrders,
    canManageGatewaySettings,
    canViewGatewayReports,
    // Revendedor
    canViewRevendedor,
    canManageRevendedorPlanos,
    canManageRevendedorLicencas,
  };
}