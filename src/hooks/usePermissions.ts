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
  };
}