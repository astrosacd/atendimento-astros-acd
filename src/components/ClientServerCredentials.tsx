import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { copyToClipboard } from '@/utils/clipboard';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSiteUrl } from '@/hooks/useSiteUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Plus, Eye, EyeOff, Pencil, Trash2, Server, Link2, Copy, Check,
  Bot, Workflow,
} from 'lucide-react';
import { buildCredentialNotes, parseCredentialNotes } from '@/utils/clientCredentials';

interface ServerCredential {
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

const SERVER_PLATFORMS = [
  { value: 'evolution', label: 'Evolution', icon: Bot, color: 'text-primary' },
  { value: 'chatwoot', label: 'Chatwoot', icon: Bot, color: 'text-primary' },
  { value: 'n8n', label: 'n8n', icon: Workflow, color: 'text-primary' },
  { value: 'servidor', label: 'Servidor / VPS', icon: Server, color: 'text-primary' },
  { value: 'outro-servidor', label: 'Outro servidor', icon: Server, color: 'text-muted-foreground' },
];

const SERVER_PLATFORM_VALUES = new Set(SERVER_PLATFORMS.map(p => p.value));

export function ClientServerCredentials({ clienteId, clienteName, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const siteUrl = useSiteUrl();
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
    platform: 'evolution',
    login: '',
    password: '',
    url: '',
    notes: '',
  });

  const { data: allCredentials = [], isLoading } = useQuery({
    queryKey: ['social-credentials', clienteId],
    enabled: open && !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_social_credentials')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('platform', { ascending: true });
      if (error) throw error;
      return data as ServerCredential[];
    },
  });

  // Only server-tool credentials
  const credentials = allCredentials.filter(c => SERVER_PLATFORM_VALUES.has(c.platform));

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
            notes: buildCredentialNotes(form.url, form.notes),
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
            notes: buildCredentialNotes(form.url, form.notes),
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
    setForm({ platform: 'evolution', login: '', password: '', url: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const generateShareLink = async () => {
    const hours = parseInt(shareExpHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('social_credential_share_links')
      .insert({ cliente_id: clienteId, expires_at: expiresAt, created_by: user?.id } as any)
      .select('token')
      .single();
    if (error) {
      toast.error('Erro ao gerar link');
      return;
    }
    const link = `${siteUrl}/credenciais/${data.token}`;
    setGeneratedLink(link);
  };

  const copyLink = () => {
    if (!generatedLink) return;
    copyToClipboard(generatedLink).then(() => {
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('Erro ao copiar'));
  };

  const startEdit = (cred: ServerCredential) => {
    const { url, notes } = parseCredentialNotes(cred.notes);
    setForm({
      platform: cred.platform,
      login: cred.login,
      password: cred.encrypted_password,
      url,
      notes,
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

  const getPlatformInfo = (value: string) => {
    return SERVER_PLATFORMS.find(p => p.value === value) || SERVER_PLATFORMS[SERVER_PLATFORMS.length - 1];
  };

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Ferramentas / Servidores — {clienteName}
            </DialogTitle>
          </DialogHeader>

          {canManage && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setGeneratedLink(null); setCopied(false); setShowShareDialog(true); }}>
                <Link2 className="h-4 w-4 mr-1" /> Gerar Link
              </Button>
              <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova Credencial
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : credentials.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma credencial de ferramenta cadastrada</p>
                {canManage && (
                  <p className="text-xs mt-1">Adicione acessos do Evolution, Chatwoot, n8n, VPS, etc.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {credentials.map(cred => {
                const platform = getPlatformInfo(cred.platform);
                const Icon = platform.icon;
                const isVisible = visiblePasswords.has(cred.id);
                const { url, notes } = parseCredentialNotes(cred.notes);
                const accessUrl = normalizeUrl(url);
                return (
                  <Card key={cred.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Icon className={`h-5 w-5 shrink-0 ${platform.color}`} />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-sm">{platform.label}</span>
                            <p className="text-xs text-muted-foreground truncate">Login: {cred.login}</p>
                            {url && (
                              <p className="text-xs text-muted-foreground truncate">
                                URL:{' '}
                                <a
                                  href={accessUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline underline-offset-2"
                                >
                                  {url}
                                </a>
                              </p>
                            )}
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
                            {notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">📝 {notes}</p>
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
            <DialogTitle>{editingId ? 'Editar Credencial' : 'Nova Credencial de Ferramenta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de ferramenta</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVER_PLATFORMS.map(p => (
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
              <Label>URL de acesso</Label>
              <Input
                type="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://painel.cliente.com"
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label>Login / usuário</Label>
              <Input
                value={form.login}
                onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                placeholder="admin, root, suporte@..."
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Senha do painel / servidor"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ex: porta SSH, ambiente, observações técnicas..."
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

      {/* Share Link Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Gerar Link de Acesso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Validade do link</Label>
              <Select value={shareExpHours} onValueChange={setShareExpHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="48">48 horas</SelectItem>
                  <SelectItem value="72">3 dias</SelectItem>
                  <SelectItem value="168">7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {generatedLink && (
              <div className="space-y-2">
                <Label>Link gerado</Label>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quem acessar este link poderá ver as credenciais (sociais e ferramentas) deste cliente em modo somente leitura.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Fechar</Button>
            {!generatedLink && (
              <Button onClick={generateShareLink}>
                <Link2 className="h-4 w-4 mr-1" /> Gerar Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
