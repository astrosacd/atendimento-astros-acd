import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, Shield, Users, Eye, UserPlus, Edit, Trash2, 
  CreditCard, Webhook, Key, FileText, Settings, LayoutDashboard,
  Plus, Save, X, Check, Pencil, Download, Tag, Megaphone,
  MessageSquare, Send, UserMinus, BarChart3, Database, ShoppingCart,
  Award, Share2, Phone, Crosshair, Globe, Search, Instagram, Smartphone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  color: string;
  is_system_role: boolean;
}

interface SystemPermission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
}

interface RolePermission {
  id: string;
  role_name: string;
  permission_key: string;
}

const getColorOptions = (t: (key: string) => string) => [
  { value: 'emerald', label: t('permissions.colors.green'), class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500' },
  { value: 'orange', label: t('permissions.colors.orange'), class: 'bg-orange-500/20 text-orange-400 border-orange-500' },
  { value: 'purple', label: t('permissions.colors.purple'), class: 'bg-purple-500/20 text-purple-400 border-purple-500' },
  { value: 'blue', label: t('permissions.colors.blue'), class: 'bg-blue-500/20 text-blue-400 border-blue-500' },
  { value: 'red', label: t('permissions.colors.red'), class: 'bg-red-500/20 text-red-400 border-red-500' },
  { value: 'yellow', label: t('permissions.colors.yellow'), class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500' },
  { value: 'pink', label: t('permissions.colors.pink'), class: 'bg-pink-500/20 text-pink-400 border-pink-500' },
  { value: 'gray', label: t('permissions.colors.gray'), class: 'bg-gray-500/20 text-gray-400 border-gray-500' },
];

const categoryIcons: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />,
  clientes: <Users className="h-4 w-4" />,
  admin: <Settings className="h-4 w-4" />,
  tags: <Tag className="h-4 w-4" />,
  divulgador: <Megaphone className="h-4 w-4" />,
  tarefas: <FileText className="h-4 w-4" />,
  cobranca: <CreditCard className="h-4 w-4" />,
  'Guia': <FileText className="h-4 w-4" />,
  'Consulta de Números': <Eye className="h-4 w-4" />,
  'Status de Números': <Phone className="h-4 w-4" />,
  'Relatórios': <BarChart3 className="h-4 w-4" />,
  'Chamados': <MessageSquare className="h-4 w-4" />,
  'Despesas': <CreditCard className="h-4 w-4" />,
  'Follow-ups': <Send className="h-4 w-4" />,
  'Propostas': <FileText className="h-4 w-4" />,
  'Pipeline': <Users className="h-4 w-4" />,
  'Gateway': <ShoppingCart className="h-4 w-4" />,
  'Revendedor': <Award className="h-4 w-4" />,
  'Social Media': <Share2 className="h-4 w-4" />,
  'Lead Hunter': <Crosshair className="h-4 w-4" />,
  'Agenda': <Eye className="h-4 w-4" />,
  'Link de Pagamento': <CreditCard className="h-4 w-4" />,
  'Aprovações': <Check className="h-4 w-4" />,
  'Automações': <Database className="h-4 w-4" />,
  'Chat': <MessageSquare className="h-4 w-4" />,
  'Vendas': <BarChart3 className="h-4 w-4" />,
  'Conexões': <Globe className="h-4 w-4" />,
  'Sala dos Agentes': <Eye className="h-4 w-4" />,
  'Instagram': <Instagram className="h-4 w-4" />,
  'Segurança de Pagamento': <Shield className="h-4 w-4" />,
  'Seguros': <Shield className="h-4 w-4 text-emerald-500" />,
  'Scans': <Search className="h-4 w-4 text-blue-500" />,
  'RCS': <Smartphone className="h-4 w-4 text-indigo-500" />,
};

// Icons removed from individual permissions — only category titles have icons

export default function AdminPermissoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [newRole, setNewRole] = useState({
    name: '',
    display_name: '',
    description: '',
    color: 'gray',
  });

  // Fetch roles
  const { data: roles = [] } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system_role', { ascending: false })
        .order('display_name');
      if (error) throw error;
      return data as CustomRole[];
    },
  });

  // Fetch permissions
  const { data: permissions = [] } = useQuery({
    queryKey: ['system-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_permissions')
        .select('*')
        .order('category')
        .order('name');
      if (error) throw error;
      return data as SystemPermission[];
    },
  });

  // Fetch role permissions
  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');
      if (error) throw error;
      return data as RolePermission[];
    },
  });

  // Fetch available tags
  const { data: availableTags = [] } = useQuery({
    queryKey: ['available-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_config')
        .select('config_value')
        .like('config_key', 'tag_%');
      if (error) throw error;
      return data.map(d => d.config_value).filter(Boolean) as string[];
    },
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (role: typeof newRole) => {
      const slug = role.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const { data, error } = await supabase
        .from('custom_roles')
        .insert([{ 
          name: slug, 
          display_name: role.display_name, 
          description: role.description,
          color: role.color 
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success(t('permissions.roleCreated'));
      setIsRoleDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(t('permissions.errorCreating') + ': ' + error.message);
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (role: CustomRole) => {
      const { error } = await supabase
        .from('custom_roles')
        .update({ 
          display_name: role.display_name, 
          description: role.description,
          color: role.color 
        })
        .eq('id', role.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success(t('permissions.roleUpdated'));
      setEditingRole(null);
      setIsRoleDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(t('permissions.errorUpdating') + ': ' + error.message);
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success(t('permissions.roleDeleted'));
    },
    onError: (error: Error) => {
      toast.error(t('permissions.errorDeleting') + ': ' + error.message);
    },
  });

  // Toggle permission mutation
  const togglePermissionMutation = useMutation({
    mutationFn: async ({ roleName, permissionKey, hasPermission }: { 
      roleName: string; 
      permissionKey: string; 
      hasPermission: boolean;
    }) => {
      if (hasPermission) {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_name', roleName)
          .eq('permission_key', permissionKey);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .insert([{ role_name: roleName, permission_key: permissionKey }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
    onError: (error: Error) => {
      toast.error(t('permissions.errorPermission') + ': ' + error.message);
    },
  });

  const hasPermission = (roleName: string, permissionKey: string) => {
    return rolePermissions.some(rp => rp.role_name === roleName && rp.permission_key === permissionKey);
  };

  const getRoleColor = (colorName: string) => {
    const colors = getColorOptions(t);
    return colors.find(c => c.value === colorName)?.class || colors[7].class;
  };

  const resetForm = () => {
    setNewRole({ name: '', display_name: '', description: '', color: 'gray' });
    setEditingRole(null);
  };

  const openEditDialog = (role: CustomRole) => {
    setEditingRole(role);
    setNewRole({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      color: role.color,
    });
    setIsRoleDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingRole) {
      updateRoleMutation.mutate({
        ...editingRole,
        display_name: newRole.display_name,
        description: newRole.description,
        color: newRole.color,
      });
    } else {
      createRoleMutation.mutate(newRole);
    }
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, SystemPermission[]>);

  const getCategoryNames = () => ({
    dashboard: t('permissions.categories.dashboard'),
    clientes: t('permissions.categories.clients'),
    admin: t('permissions.categories.admin'),
    tags: t('permissions.categories.tags'),
    divulgador: t('permissions.categories.broadcaster'),
    tarefas: t('permissions.categories.tasks'),
    cobranca: t('permissions.categories.billing'),
    'Guia': t('permissions.categories.guide'),
    'Consulta de Números': t('permissions.categories.numberQuery'),
    'Status de Números': 'Status de Números',
    'Relatórios': t('permissions.categories.reports'),
    'Chamados': t('permissions.categories.tickets'),
    'Follow-ups': 'Follow-ups',
    'Propostas': 'Propostas',
    'Pipeline': 'Pipeline',
    'Gateway': 'Gateway',
    'Revendedor': 'Revendedor',
    'Social Media': 'Social Media',
    'Despesas': 'Despesas',
    'Lead Hunter': 'Lead Hunter',
    'Agenda': 'Agenda',
    'Link de Pagamento': 'Link de Pagamento',
    'Aprovações': 'Aprovações',
    'Automações': 'Automações',
    'Chat': 'Chat',
    'Vendas': 'Vendas',
    'Conexões': 'Conexões',
    'Sala dos Agentes': 'Sala dos Agentes',
    'Instagram': 'Instagram',
    'Segurança de Pagamento': 'Segurança de Pagamento',
    'Agenda Histórico': 'Agenda Histórico',
    'Follow-ups Configuração': 'Follow-ups Configuração',
    'Seguros': 'Seguros de Números',
    'Scans': 'Módulo de Scans',
    'RCS': 'Módulo RCS',
  });

  const colorOptions = getColorOptions(t);
  const categoryNames = getCategoryNames();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {t('permissions.title')}
              </h1>
              <p className="text-muted-foreground">
                {t('permissions.subtitle')}
              </p>
            </div>
          </div>
          <Button 
            onClick={() => {
              resetForm();
              setIsRoleDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('permissions.newRole')}
          </Button>
        </div>

        {/* Roles Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((role) => (
            <Card 
              key={role.id} 
              className={cn(
                "border-2 transition-all hover:shadow-lg",
                getRoleColor(role.color).replace('bg-', 'border-').replace('/20', '/40')
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className={cn("h-5 w-5", getRoleColor(role.color).split(' ')[1])} />
                    <CardTitle className="text-lg">{role.display_name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => openEditDialog(role)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.is_system_role && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteRoleMutation.mutate(role.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {role.is_system_role && (
                  <Badge variant="outline" className="w-fit text-xs">
                    {t('permissions.systemRole')}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {role.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {rolePermissions.filter(rp => rp.role_name === role.name).length} permissões
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Permissions Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('permissions.permissionMatrix')}
            </CardTitle>
            <CardDescription>
              {t('permissions.permissionMatrixDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">{t('permissions.permission')}</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role.id} className="text-center min-w-[120px]">
                      <Badge className={cn("text-xs", getRoleColor(role.color))}>
                        {role.display_name}
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <>
                    <TableRow key={category} className="bg-muted/30">
                      <TableCell colSpan={roles.length + 1} className="font-semibold">
                        <div className="flex items-center gap-2">
                          {categoryIcons[category]}
                          {categoryNames[category] || category}
                        </div>
                      </TableCell>
                    </TableRow>
                    {perms.map((perm) => (
                      <TableRow key={perm.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{perm.name}</p>
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          </div>
                        </TableCell>
                        {roles.map((role) => {
                          const isAdmin = role.name === 'admin';
                          const hasPerm = isAdmin ? true : hasPermission(role.name, perm.key);
                          return (
                            <TableCell key={role.id} className="text-center">
                              <button
                                onClick={() => !isAdmin && togglePermissionMutation.mutate({
                                  roleName: role.name,
                                  permissionKey: perm.key,
                                  hasPermission: hasPerm,
                                })}
                                disabled={isAdmin}
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all",
                                  hasPerm 
                                    ? "bg-primary/20 text-primary" 
                                    : "bg-muted text-muted-foreground",
                                  !isAdmin && "hover:scale-110 cursor-pointer",
                                  isAdmin && "opacity-60 cursor-not-allowed"
                                )}
                              >
                                {hasPerm ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </>
                ))}
                {/* Tags Section in Matrix */}
                {availableTags.length > 0 && (
                  <>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={roles.length + 1} className="font-semibold">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Tags
                        </div>
                      </TableCell>
                    </TableRow>
                    {availableTags.map((tag) => {
                      const tagPermKey = `tag_access_${tag.toLowerCase().replace(/\s+/g, '_')}`;
                      return (
                        <TableRow key={tag}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium capitalize">{tag}</p>
                                <p className="text-xs text-muted-foreground">{t('permissions.tagAccess')}</p>
                              </div>
                            </div>
                          </TableCell>
                          {roles.map((role) => {
                            const isAdmin = role.name === 'admin';
                            const hasPerm = isAdmin ? true : hasPermission(role.name, tagPermKey);
                            return (
                              <TableCell key={role.id} className="text-center">
                                <button
                                  onClick={() => !isAdmin && togglePermissionMutation.mutate({
                                    roleName: role.name,
                                    permissionKey: tagPermKey,
                                    hasPermission: hasPerm,
                                  })}
                                  disabled={isAdmin}
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all",
                                    hasPerm 
                                      ? "bg-primary/20 text-primary" 
                                      : "bg-muted text-muted-foreground",
                                    !isAdmin && "hover:scale-110 cursor-pointer",
                                    isAdmin && "opacity-60 cursor-not-allowed"
                                  )}
                                >
                                  {hasPerm ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                </button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="border-border bg-muted/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-muted-foreground">{t('permissions.legend.allowed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                  <X className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">{t('permissions.legend.notAllowed')}</span>
              </div>
              <div className="text-muted-foreground/70 text-xs ml-auto">
                {t('permissions.legend.clickToToggle')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRole ? t('permissions.dialog.editTitle') : t('permissions.dialog.createTitle')}
              </DialogTitle>
              <DialogDescription>
                {editingRole ? t('permissions.dialog.editDesc') : t('permissions.dialog.createDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingRole && (
                <div className="space-y-2">
                  <Label>{t('permissions.dialog.slugLabel')}</Label>
                  <Input
                    placeholder={t('permissions.dialog.slugPlaceholder')}
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('permissions.dialog.slugHelp')}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('permissions.dialog.displayNameLabel')}</Label>
                <Input
                  placeholder={t('permissions.dialog.displayNamePlaceholder')}
                  value={newRole.display_name}
                  onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('permissions.dialog.descriptionLabel')}</Label>
                <Textarea
                  placeholder={t('permissions.dialog.descriptionPlaceholder')}
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('permissions.dialog.colorLabel')}</Label>
                <Select
                  value={newRole.color}
                  onValueChange={(value) => setNewRole({ ...newRole, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-4 h-4 rounded-full", color.class.split(' ')[0])} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                {t('permissions.cancel')}
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!newRole.display_name || (!editingRole && !newRole.name)}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingRole ? t('permissions.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}