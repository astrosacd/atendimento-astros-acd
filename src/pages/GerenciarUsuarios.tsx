import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, Shield, Eye, Check, X, Clock, Trash2, MessageSquare, History, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  color: string;
  is_system_role: boolean;
}

interface UserWithRole {
  id: string;
  email: string;
  name: string;
  role: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  user_response: string | null;
  created_at: string;
}

interface ApprovalHistoryEntry {
  id: string;
  user_id: string;
  admin_id: string;
  action: 'approved' | 'rejected';
  role_assigned: string | null;
  rejection_reason: string | null;
  created_at: string;
  user_name?: string;
  admin_name?: string;
}

export default function GerenciarUsuarios() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('user');
  const [isCreating, setIsCreating] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Rejection dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // View response dialog state
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [selectedUserResponse, setSelectedUserResponse] = useState<{ name: string; response: string } | null>(null);

  // Approval dialog state (with role selection)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<string>('user');

  // Fetch custom roles from database
  const { data: customRoles = [] } = useQuery({
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

  // Fetch all users with their roles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email || '',
          name: profile.name,
          role: userRole?.role || 'user',
          approval_status: (profile.approval_status as 'pending' | 'approved' | 'rejected') || 'pending',
          rejection_reason: profile.rejection_reason,
          user_response: profile.user_response,
          created_at: profile.created_at,
        };
      });

      return usersWithRoles;
    },
  });

  // Fetch approval history
  const { data: approvalHistory = [] } = useQuery({
    queryKey: ['approval-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get user names for the history
      const historyWithNames = (data || []).map((entry) => {
        const user = users.find(u => u.id === entry.user_id);
        const admin = users.find(u => u.id === entry.admin_id);
        return {
          ...entry,
          action: entry.action as 'approved' | 'rejected',
          user_name: user?.name || 'Usuário removido',
          admin_name: admin?.name || 'Admin',
        };
      });

      return historyWithNames as ApprovalHistoryEntry[];

      return historyWithNames;
    },
    enabled: users.length > 0,
  });

  const pendingUsers = users.filter(u => u.approval_status === 'pending' || (u.approval_status === 'rejected' && u.user_response));
  const approvedUsers = users.filter(u => {
    const isApproved = u.approval_status === 'approved';
    const matchesRoleFilter = roleFilter === 'all' || u.role === roleFilter;
    return isApproved && matchesRoleFilter;
  });

  // Count users by role
  const roleCounts = users.reduce((acc, user) => {
    if (user.approval_status === 'approved') {
      acc[user.role] = (acc[user.role] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Approve user mutation with role selection
  const approveMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          approved: true, 
          approval_status: 'approved',
          rejection_reason: null,
          user_response: null 
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Update role - cast to any since we now support dynamic roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: role as any })
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Add to history - get role display name from customRoles
      const roleInfo = customRoles.find(r => r.name === role);
      const roleDisplayName = roleInfo?.display_name || role;
      
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          user_id: userId,
          admin_id: currentUser?.id,
          action: 'approved',
          role_assigned: roleDisplayName,
        });

      if (historyError) console.error('Error adding to history:', historyError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['approval-history'] });
      setApproveDialogOpen(false);
      setApprovingUserId(null);
      setApproveRole('user');
      toast({
        title: 'Usuário aprovado!',
        description: 'O usuário agora pode acessar o sistema.',
      });
    },
    onError: (error) => {
      console.error('Error approving user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar o usuário.',
        variant: 'destructive',
      });
    },
  });

  // Reject user mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          approved: false, 
          approval_status: 'rejected',
          rejection_reason: reason,
          user_response: null 
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Add to history
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          user_id: userId,
          admin_id: currentUser?.id,
          action: 'rejected',
          rejection_reason: reason,
        });

      if (historyError) console.error('Error adding to history:', historyError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['approval-history'] });
      setRejectDialogOpen(false);
      setRejectingUserId(null);
      setRejectionReason('');
      toast({
        title: 'Usuário rejeitado!',
        description: 'O usuário foi notificado com o motivo da rejeição.',
      });
    },
    onError: (error) => {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível rejeitar o usuário.',
        variant: 'destructive',
      });
    },
  });

  const handleReject = (userId: string) => {
    setRejectingUserId(userId);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (rejectingUserId && rejectionReason.trim()) {
      rejectMutation.mutate({ userId: rejectingUserId, reason: rejectionReason });
    }
  };

  const confirmApprove = () => {
    if (approvingUserId) {
      approveMutation.mutate({ userId: approvingUserId, role: approveRole });
    }
  };

  const viewUserResponse = (user: UserWithRole) => {
    setSelectedUserResponse({ name: user.name, response: user.user_response || '' });
    setResponseDialogOpen(true);
  };

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as any })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Sucesso!',
        description: 'Papel do usuário atualizado.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o papel.',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete from user_roles first (foreign key constraint)
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Delete from profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Usuário excluído!',
        description: 'O usuário foi removido do sistema.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o usuário.',
        variant: 'destructive',
      });
    },
  });

  // Create new user - auto-approved when created by admin
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: newUserName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Wait for trigger to create profile and role
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Update role based on selection
        if (newUserRole !== 'user') {
          await supabase
            .from('user_roles')
            .update({ role: newUserRole })
            .eq('user_id', authData.user.id);
        }

        // Auto-approve user created by admin
        await supabase
          .from('profiles')
          .update({ 
            approved: true,
            approval_status: 'approved'
          })
          .eq('user_id', authData.user.id);

        // Log the approval action
        if (currentUser) {
          await supabase.from('approval_history').insert({
            user_id: authData.user.id,
            admin_id: currentUser.id,
            action: 'approved',
            role_assigned: newUserRole,
          });
        }

        // Send welcome message (email/whatsapp)
        try {
          await supabase.functions.invoke('send-welcome', {
            body: {
              userName: newUserName,
              userEmail: newUserEmail,
              userPassword: newUserPassword,
              userPhone: newUserPhone || undefined,
              sendEmail: true,
              sendWhatsapp: !!newUserPhone,
            },
          });
        } catch (welcomeError) {
          console.error('Error sending welcome message:', welcomeError);
        }

        toast({
          title: 'Usuário criado!',
          description: `${newUserEmail} foi cadastrado e aprovado com sucesso.`,
        });

        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserName('');
        setNewUserPhone('');
        setNewUserRole('user');
        
        queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    if (userId === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode alterar seu próprio papel.',
        variant: 'destructive',
      });
      return;
    }
    updateRoleMutation.mutate({ userId, newRole });
  };

  const getRoleColor = (colorName: string) => {
    const colorMap: Record<string, string> = {
      emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500',
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500',
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500',
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500',
      red: 'bg-red-500/20 text-red-400 border-red-500',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
      pink: 'bg-pink-500/20 text-pink-400 border-pink-500',
      gray: 'bg-gray-500/20 text-gray-400 border-gray-500',
    };
    return colorMap[colorName] || colorMap.gray;
  };

  const getRoleBadge = (roleName: string) => {
    const roleInfo = customRoles.find(r => r.name === roleName);
    if (roleInfo) {
      return (
        <Badge className={cn(getRoleColor(roleInfo.color))}>
          <Shield className="h-3 w-3 mr-1" />
          {roleInfo.display_name}
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-muted-foreground"><Eye className="h-3 w-3 mr-1" />Usuário</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/')}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Gerenciar Usuários</h1>
            <p className="text-muted-foreground">Crie e gerencie usuários do sistema</p>
          </div>
        </div>

        {/* Pending Approvals */}
        {pendingUsers.length > 0 && (
          <Card className="border-yellow-500/50 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <Clock className="h-5 w-5" />
                Solicitações Pendentes ({pendingUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Solicitado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((user) => (
                      <TableRow key={user.id} className="border-border">
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.user_response ? (
                            <Badge variant="outline" className="border-blue-500 text-blue-500">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Respondeu
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {user.user_response && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => viewUserResponse(user)}
                                className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Ver Resposta
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => {
                                setApprovingUserId(user.id);
                                setApproveRole('user');
                                setApproveDialogOpen(true);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(user.id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create User Form */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" />
              Criar Novo Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp (opcional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Senha segura"
                  required
                  minLength={6}
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Tipo</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v)}>
                  <SelectTrigger className="border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customRoles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        <span className="flex items-center gap-2">
                          <Shield className={cn("h-4 w-4", getRoleColor(role.color).split(' ')[1])} />
                          {role.display_name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isCreating ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Approved Users List */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-primary">Usuários Aprovados</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={roleFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRoleFilter('all')}
                  className={roleFilter === 'all' ? 'bg-primary text-primary-foreground' : 'border-border'}
                >
                  Todos ({users.filter(u => u.approval_status === 'approved').length})
                </Button>
                {customRoles.map((role) => (
                  <Button
                    key={role.id}
                    variant={roleFilter === role.name ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoleFilter(role.name)}
                    className={cn(
                      roleFilter === role.name 
                        ? getRoleColor(role.color).replace('/20', '') 
                        : `border-${role.color}-500 text-${role.color}-500`
                    )}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {role.display_name} ({roleCounts[role.name] || 0})
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : approvedUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário aprovado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedUsers.map((user) => (
                      <TableRow key={user.id} className="border-border">
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {getRoleBadge(user.role)}
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {user.id !== currentUser?.id ? (
                            <div className="flex items-center gap-2">
                              <Select
                                value={user.role}
                                onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                              >
                                <SelectTrigger className="w-[160px] border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {customRoles.map((role) => (
                                    <SelectItem key={role.id} value={role.name}>
                                      {role.display_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir <strong>{user.name}</strong>? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(user.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">(você)</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval History */}
        {approvalHistory.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <History className="h-5 w-5" />
                Histórico de Aprovações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>Data</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Por</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalHistory.map((entry) => (
                      <TableRow key={entry.id} className="border-border">
                        <TableCell>
                          {new Date(entry.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="font-medium">{entry.user_name}</TableCell>
                        <TableCell>
                          {entry.action === 'approved' ? (
                            <Badge className="bg-green-600 text-white">
                              <Check className="h-3 w-3 mr-1" />
                              Aprovado
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <X className="h-3 w-3 mr-1" />
                              Rejeitado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.role_assigned || '-'}
                        </TableCell>
                        <TableCell>{entry.admin_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.rejection_reason || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval Dialog with Role Selection */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar Usuário</DialogTitle>
              <DialogDescription>
                Escolha o tipo de acesso que este usuário terá no sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <Select value={approveRole} onValueChange={(v) => setApproveRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customRoles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        <span className="flex items-center gap-2">
                          <Shield className={cn("h-4 w-4", getRoleColor(role.color).split(' ')[1])} />
                          {role.display_name} - {role.description?.substring(0, 30)}...
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmApprove}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {approveMutation.isPending ? 'Aprovando...' : 'Confirmar Aprovação'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Usuário</DialogTitle>
              <DialogDescription>
                Informe o motivo da rejeição. O usuário poderá ver este motivo e enviar uma resposta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Motivo da Rejeição</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Não foi possível verificar sua identidade..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Response Dialog */}
        <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resposta de {selectedUserResponse?.name}</DialogTitle>
              <DialogDescription>
                Mensagem enviada pelo usuário após a rejeição:
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-secondary p-4 rounded-lg">
                <p className="text-foreground whitespace-pre-wrap">{selectedUserResponse?.response}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setResponseDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}