import { useState, useMemo } from 'react';
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
  Bot, Workflow, Cog, Database, Cloud, Globe, Settings,
  type LucideIcon,
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

interface ServerToolType {
  id: string;
  value: string;
  label: string;
  icon: string;
  is_system: boolean;
  created_by: string | null;
}

interface Props {
  clienteId: string;
  clienteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Bot, Workflow, Server, Cog, Database, Cloud, Globe, Settings,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

export function ClientServerCredentials({ clienteId, clienteName, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const siteUrl = useSiteUrl();
  const queryClient = useQueryClient();
  const canManage = hasPermission('manage_server_credentials');
  const canShare = hasPermission('share_server_credentials');
  const canManageToolTypes = hasPermission('manage_server_tool_types');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareExpHours, setShareExpHours] = useState('24');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Manage Tool Types
  const [showToolTypesDialog, setShowToolTypesDialog] = useState(false);
  const [newToolValue, setNewToolValue] = useState('');
  const [newToolLabel, setNewToolLabel] = useState('');
  const [newToolIcon, setNewToolIcon] = useState('Server');
  const [deleteToolId, setDeleteToolId] = useState<string | null>(null);

  const [form, setForm] = useState({
    platform: 'evolution',
    login: '',
    password: '',
    url: '',
    notes: '',
  });

  // Load tool types from DB
  const { data: toolTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ['server-tool-types'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_server_tool_types' as any)
        .select('*')
        .order('is_system', { ascending: false })
        .order('label', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ServerToolType[];
    },
  });

  const platformValues = useMemo(() => new Set(toolTypes.map(t => t.value)), [toolTypes]);

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

  // Only server-tool credentials (whose platform exists in tool types)
  const credentials = allCredentials.filter(c => platformValues.has(c.platform));

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

  const createToolTypeMutation = useMutation({
    mutationFn: async () => {
      const value = newToolValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const label = newToolLabel.trim();
      if (!value || !label) throw new Error('Preencha o nome da ferramenta');
      const { error } = await supabase
        .from('client_server_tool_types' as any)
        .insert({
          value,
          label,
          icon: newToolIcon,
          is_system: false,
          created_by: user?.id,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-tool-types'] });
      toast.success('Ferramenta cadastrada!');
      setNewToolValue('');
      setNewToolLabel('');
      setNewToolIcon('Server');
    },
    onError: (err: any) => {
      if (err.code === '23505') toast.error('Já existe uma ferramenta com esse identificador');
      else toast.error(err.message);
    },
  });

  const deleteToolTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_server_tool_types' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-tool-types'] });
      toast.success('Ferramenta removida');
      setDeleteToolId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    const defaultPlatform = toolTypes[0]?.value || 'evolution';
    setForm({ platform: defaultPlatform, login: '', password: '', url: '', notes: '' });
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
    const found = toolTypes.find(p => p.value === value);
    if (found) return found;
    return { id: '', value, label: value, icon: 'Server', is_system: false, created_by: null } as ServerToolType;
  };

  const renderIcon = (iconName: string, className?: string) => {
    const Icon = ICON_MAP[iconName] || Server;
    return <Icon className={className} />;
  };

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl bg-card border-border p-0 overflow-hidden">
          <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader className="pr-10 sm:pr-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Server className="h-5 w-5 text-primary" />
              Ferramentas / Servidores — {clienteName}
            </DialogTitle>
          </DialogHeader>

          {(canManage || canShare || canManageToolTypes) && (
            <div className="flex flex-wrap justify-end gap-2">
              {canManageToolTypes && (
                <Button size="sm" variant="outline" onClick={() => setShowToolTypesDialog(true)}>
                  <Cog className="h-4 w-4 mr-1" /> Ferramentas
                </Button>
              )}
              {canShare && (
                <Button size="sm" variant="outline" onClick={() => { setGeneratedLink(null); setCopied(false); setShowShareDialog(true); }}>
                  <Link2 className="h-4 w-4 mr-1" /> Gerar Link
                </Button>
              )}
              {canManage && (
                <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Nova Credencial
                </Button>
              )}
            </div>
          )}

          {isLoading || loadingTypes ? (
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
                const isVisible = visiblePasswords.has(cred.id);
                const { url, notes } = parseCredentialNotes(cred.notes);
                const accessUrl = normalizeUrl(url);
                return (
                  <Card key={cred.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {renderIcon(platform.icon, 'h-5 w-5 shrink-0 text-primary')}
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
              <div className="flex items-center justify-between">
                <Label>Tipo de ferramenta</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowToolTypesDialog(true)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Cadastrar nova
                </Button>
              </div>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {toolTypes.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        {renderIcon(p.icon, 'h-4 w-4 text-primary')}
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

      {/* Manage Tool Types Dialog */}
      <Dialog open={showToolTypesDialog} onOpenChange={setShowToolTypesDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cog className="h-5 w-5 text-primary" />
              Ferramentas cadastradas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 space-y-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Cadastre uma nova ferramenta para reutilizar nas credenciais dos clientes.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome de exibição</Label>
                  <Input
                    placeholder="Ex: Portainer"
                    value={newToolLabel}
                    onChange={e => setNewToolLabel(e.target.value)}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Identificador</Label>
                  <Input
                    placeholder="Ex: portainer"
                    value={newToolValue}
                    onChange={e => setNewToolValue(e.target.value)}
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ícone</Label>
                <Select value={newToolIcon} onValueChange={setNewToolIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(name => (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2">
                          {renderIcon(name, 'h-4 w-4 text-primary')}
                          {name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => createToolTypeMutation.mutate()}
                disabled={!newToolLabel || !newToolValue || createToolTypeMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                {createToolTypeMutation.isPending ? 'Cadastrando...' : 'Cadastrar ferramenta'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Existentes</Label>
              {toolTypes.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderIcon(t.icon, 'h-4 w-4 text-primary shrink-0')}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.value}</p>
                    </div>
                  </div>
                  {t.is_system ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      sistema
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => setDeleteToolId(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Tool Type Confirmation */}
      <AlertDialog open={!!deleteToolId} onOpenChange={() => setDeleteToolId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ferramenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Credenciais já cadastradas com este tipo continuarão existindo, mas o tipo deixará de aparecer no seletor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteToolId && deleteToolTypeMutation.mutate(deleteToolId)}
              className="bg-destructive text-destructive-foreground"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Credential Confirmation */}
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
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe este link com quem precisa acessar as credenciais. O link expirará automaticamente.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {!generatedLink ? (
              <>
                <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancelar</Button>
                <Button onClick={generateShareLink}>
                  <Link2 className="h-4 w-4 mr-1" /> Gerar Link
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowShareDialog(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
