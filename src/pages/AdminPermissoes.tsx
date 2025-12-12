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
import { 
  ArrowLeft, Shield, Users, Eye, UserPlus, Edit, Trash2, 
  CreditCard, Webhook, Key, FileText, Settings, LayoutDashboard,
  Plus, Save, X, Check, Pencil, Download
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
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

const colorOptions = [
  { value: 'emerald', label: 'Verde', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-500/20 text-orange-400 border-orange-500' },
  { value: 'purple', label: 'Roxo', class: 'bg-purple-500/20 text-purple-400 border-purple-500' },
  { value: 'blue', label: 'Azul', class: 'bg-blue-500/20 text-blue-400 border-blue-500' },
  { value: 'red', label: 'Vermelho', class: 'bg-red-500/20 text-red-400 border-red-500' },
  { value: 'yellow', label: 'Amarelo', class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500/20 text-pink-400 border-pink-500' },
  { value: 'gray', label: 'Cinza', class: 'bg-gray-500/20 text-gray-400 border-gray-500' },
];

const categoryIcons: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />,
  clientes: <Users className="h-4 w-4" />,
  admin: <Settings className="h-4 w-4" />,
};

const permissionIcons: Record<string, React.ReactNode> = {
  view_dashboard: <LayoutDashboard className="h-4 w-4" />,
  view_clients: <Eye className="h-4 w-4" />,
  create_clients: <UserPlus className="h-4 w-4" />,
  update_clients: <Edit className="h-4 w-4" />,
  delete_clients: <Trash2 className="h-4 w-4" />,
  export_clients: <Download className="h-4 w-4" />,
  manage_users: <Users className="h-4 w-4" />,
  manage_permissions: <Shield className="h-4 w-4" />,
  manage_billing: <CreditCard className="h-4 w-4" />,
  manage_webhooks: <Webhook className="h-4 w-4" />,
  manage_api: <Key className="h-4 w-4" />,
  view_logs: <FileText className="h-4 w-4" />,
  manage_settings: <Settings className="h-4 w-4" />,
};

export default function AdminPermissoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      toast.success('Role criada com sucesso!');
      setIsRoleDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar role: ' + error.message);
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
      toast.success('Role atualizada!');
      setEditingRole(null);
      setIsRoleDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
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
      toast.success('Role excluída!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir: ' + error.message);
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
      toast.error('Erro ao alterar permissão: ' + error.message);
    },
  });

  const hasPermission = (roleName: string, permissionKey: string) => {
    return rolePermissions.some(rp => rp.role_name === roleName && rp.permission_key === permissionKey);
  };

  const getRoleColor = (colorName: string) => {
    return colorOptions.find(c => c.value === colorName)?.class || colorOptions[7].class;
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

  const categoryNames: Record<string, string> = {
    dashboard: 'Dashboard',
    clientes: 'Clientes',
    admin: 'Administração',
  };

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
                Permissões do Sistema
              </h1>
              <p className="text-muted-foreground">
                Gerencie roles e permissões de acesso
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
            Nova Role
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
                    Sistema
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
              Matriz de Permissões
            </CardTitle>
            <CardDescription>
              Clique nas células para ativar/desativar permissões. Admin não pode ser editado.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Permissão</TableHead>
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
                          <div className="flex items-center gap-2">
                            {permissionIcons[perm.key]}
                            <div>
                              <p className="font-medium">{perm.name}</p>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                          </div>
                        </TableCell>
                        {roles.map((role) => {
                          const hasPerm = hasPermission(role.name, perm.key);
                          const isAdmin = role.name === 'admin';
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
                <span className="text-muted-foreground">Permitido</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                  <X className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">Não Permitido</span>
              </div>
              <div className="text-muted-foreground/70 text-xs ml-auto">
                * Clique para alternar permissões (exceto Admin)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRole ? 'Editar Role' : 'Nova Role'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingRole && (
                <div className="space-y-2">
                  <Label>Identificador (slug)</Label>
                  <Input
                    placeholder="ex: financeiro"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado internamente. Apenas letras e underscore.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Nome de Exibição</Label>
                <Input
                  placeholder="ex: Financeiro"
                  value={newRole.display_name}
                  onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva as responsabilidades desta role..."
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
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
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!newRole.display_name || (!editingRole && !newRole.name)}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingRole ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}