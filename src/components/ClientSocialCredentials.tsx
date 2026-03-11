import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Plus, Eye, EyeOff, Pencil, Trash2, Lock, Instagram, Facebook, Twitter, Youtube, Globe, Link2, Copy, Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  { value: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-sky-500' },
  { value: 'threads', label: 'Threads', icon: Globe, color: 'text-foreground' },
  { value: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-500' },
  { value: 'tiktok', label: 'TikTok', icon: Globe, color: 'text-foreground' },
  { value: 'linkedin', label: 'LinkedIn', icon: Globe, color: 'text-blue-700' },
  { value: 'outro', label: 'Outro', icon: Globe, color: 'text-muted-foreground' },
];

interface SocialCredential {
  id: string;
  cliente_id: string;
  platform: string;
  login: string;
  encrypted_password: string;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  clienteId: string;
  clienteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientSocialCredentials({ clienteId, clienteName, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = hasPermission('manage_social_credentials');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareExpHours, setShareExpHours] = useState('24');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    platform: 'instagram',
    login: '',
    password: '',
    notes: '',
  });

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['social-credentials', clienteId],
    enabled: open && !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_social_credentials')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('platform', { ascending: true });
      if (error) throw error;
      return data as SocialCredential[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.login || !form.password) throw new Error('Preencha login e senha');

      if (editingId) {
        const { error } = await supabase
          .from('client_social_credentials')
          .update({
            platform: form.platform,
            login: form.login,
            encrypted_password: form.password,
            notes: form.notes || null,
            updated_by: user?.id,
          } as any)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_social_credentials')
          .insert({
            cliente_id: clienteId,
            platform: form.platform,
            login: form.login,
            encrypted_password: form.password,
            notes: form.notes || null,
            created_by: user?.id,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-credentials', clienteId] });
      toast.success(editingId ? 'Credencial atualizada!' : 'Credencial salva!');
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_social_credentials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-credentials', clienteId] });
      toast.success('Credencial excluída');
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ platform: 'instagram', login: '', password: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (cred: SocialCredential) => {
    setForm({
      platform: cred.platform,
      login: cred.login,
      password: cred.encrypted_password,
      notes: cred.notes || '',
    });
    setEditingId(cred.id);
    setShowForm(true);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPlatformInfo = (value: string) =>
    PLATFORMS.find(p => p.value === value) || PLATFORMS[PLATFORMS.length - 1];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Credenciais Social Media — {clienteName}
            </DialogTitle>
          </DialogHeader>

          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova Credencial
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : credentials.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma credencial cadastrada</p>
                {canManage && (
                  <p className="text-xs mt-1">Clique em "Nova Credencial" para adicionar</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {credentials.map(cred => {
                const platform = getPlatformInfo(cred.platform);
                const Icon = platform.icon;
                const isVisible = visiblePasswords.has(cred.id);

                return (
                  <Card key={cred.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Icon className={`h-5 w-5 shrink-0 ${platform.color}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{platform.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              Login: {cred.login}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-muted-foreground">Senha:</span>
                              <span className="text-xs font-mono">
                                {isVisible ? cred.encrypted_password : '••••••••'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => togglePasswordVisibility(cred.id)}
                              >
                                {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                            </div>
                            {cred.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">📝 {cred.notes}</p>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(cred)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(cred.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Credencial' : 'Nova Credencial'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <p.icon className={`h-4 w-4 ${p.color}`} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Login (e-mail ou usuário)</Label>
              <Input
                value={form.login}
                onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                placeholder="usuario@email.com ou @usuario"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Senha da conta"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ex: conta principal, perfil da empresa..."
                maxLength={500}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.login || !form.password || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir credencial?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
