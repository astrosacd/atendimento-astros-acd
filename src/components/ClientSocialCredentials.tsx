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
  Plus, Eye, EyeOff, Pencil, Trash2, Lock, Link2, Copy, Check,
  Upload, Image, Download, X,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildCredentialNotes,
  getClientCredentialPlatform,
  isServerCredentialPlatform,
  parseCredentialNotes,
  CLIENT_CREDENTIAL_PLATFORMS,
} from '@/utils/clientCredentials';

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

interface ClientLogo {
  id: string;
  cliente_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  created_at: string;
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

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoDescription, setLogoDescription] = useState('');
  const [deleteLogoId, setDeleteLogoId] = useState<string | null>(null);

  const [form, setForm] = useState({
    platform: 'instagram',
    login: '',
    password: '',
    url: '',
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

  // Fetch client logos
  const { data: logos = [], isLoading: isLoadingLogos } = useQuery({
    queryKey: ['client-logos', clienteId],
    enabled: open && !!clienteId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('client_logos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientLogo[];
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

  const deleteLogoMutation = useMutation({
    mutationFn: async (logo: ClientLogo) => {
      // Delete from storage
      await supabase.storage.from('client-logos').remove([logo.file_path]);
      // Delete from DB
      const { error } = await (supabase as any).from('client_logos').delete().eq('id', logo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-logos', clienteId] });
      toast.success('Logo excluída');
      setDeleteLogoId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ platform: 'instagram', login: '', password: '', url: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato não suportado. Use PNG, JPG, WebP ou SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${clienteId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await (supabase as any)
        .from('client_logos')
        .insert({
          cliente_id: clienteId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          description: logoDescription || null,
          created_by: user?.id,
        });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['client-logos', clienteId] });
      toast.success('Logo enviada com sucesso!');
      setLogoDescription('');
    } catch (err: any) {
      toast.error('Erro ao enviar logo: ' + err.message);
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const getLogoUrl = (filePath: string) => {
    const { data } = supabase.storage.from('client-logos').getPublicUrl(filePath);
    return data.publicUrl;
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

  const startEdit = (cred: SocialCredential) => {
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

  const getPlatformInfo = (value: string) => getClientCredentialPlatform(value);

  const socialCredentials = credentials.filter((cred) => !isServerCredentialPlatform(cred.platform));
  const serverCredentials = credentials.filter((cred) => isServerCredentialPlatform(cred.platform));
  const selectedPlatformIsServer = isServerCredentialPlatform(form.platform);

  const normalizeCredentialUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const renderCredentialSection = (
    sectionTitle: string,
    sectionDescription: string,
    items: SocialCredential[],
    emptyMessage: string,
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{sectionTitle}</h3>
          <p className="text-xs text-muted-foreground">{sectionDescription}</p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            <Lock className="h-7 w-7 mx-auto mb-2 opacity-50" />
            <p>{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((cred) => {
            const platform = getPlatformInfo(cred.platform);
            const Icon = platform.icon;
            const isVisible = visiblePasswords.has(cred.id);
            const { url, notes } = parseCredentialNotes(cred.notes);
            const accessUrl = normalizeCredentialUrl(url);

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
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Credenciais do Cliente — {clienteName}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="credentials" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="credentials" className="flex-1">Credenciais</TabsTrigger>
              <TabsTrigger value="logos" className="flex-1">
                <Image className="h-4 w-4 mr-1" />
                Logos
              </TabsTrigger>
            </TabsList>

            {/* Credentials Tab */}
            <TabsContent value="credentials" className="space-y-4">
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
                    <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma credencial cadastrada</p>
                    {canManage && (
                      <p className="text-xs mt-1">Clique em "Nova Credencial" para adicionar</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-5">
                  {renderCredentialSection(
                    'Social Media',
                    'Instagram, Facebook, YouTube e outras contas sociais.',
                    socialCredentials,
                    'Nenhuma credencial de social media cadastrada.',
                  )}
                  {renderCredentialSection(
                    'Servidores e ferramentas',
                    'Evolution, Chatwoot, n8n, VPS e outros acessos técnicos.',
                    serverCredentials,
                    'Nenhuma credencial de servidor cadastrada.',
                  )}
                </div>
              )}
            </TabsContent>

            {/* Logos Tab */}
            <TabsContent value="logos" className="space-y-4">
              {canManage && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Descrição (opcional)</Label>
                      <Input
                        placeholder="Ex: Logo principal, Logo marca d'água, Logo branca..."
                        value={logoDescription}
                        onChange={e => setLogoDescription(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <Label htmlFor="logo-upload" className="cursor-pointer">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                          {isUploadingLogo ? (
                            <div className="text-sm text-muted-foreground">Enviando...</div>
                          ) : (
                            <>
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">Clique para fazer upload da logo</p>
                              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP ou SVG — máx. 5MB</p>
                            </>
                          )}
                        </div>
                      </Label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoadingLogos ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : logos.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma logo cadastrada</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {logos.map((logo: ClientLogo) => (
                    <Card key={logo.id} className="overflow-hidden">
                      <div className="relative aspect-square bg-muted/30 flex items-center justify-center p-2">
                        <img
                          src={getLogoUrl(logo.file_path)}
                          alt={logo.file_name}
                          className="max-w-full max-h-full object-contain"
                        />
                        {canManage && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => setDeleteLogoId(logo.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium truncate">{logo.description || logo.file_name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {logo.file_size ? `${(logo.file_size / 1024).toFixed(0)} KB` : ''}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              const url = getLogoUrl(logo.file_path);
                              window.open(url, '_blank');
                            }}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
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
              <Label>Tipo de acesso</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_CREDENTIAL_PLATFORMS.map(p => (
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
              <Label>{selectedPlatformIsServer ? 'Login / usuário técnico' : 'Login (e-mail ou usuário)'}</Label>
              <Input
                value={form.login}
                onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                placeholder={selectedPlatformIsServer ? 'admin, root, suporte@...' : 'usuario@email.com ou @usuario'}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>URL de acesso {selectedPlatformIsServer ? '(recomendado)' : '(opcional)'}</Label>
              <Input
                type="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder={selectedPlatformIsServer ? 'https://painel.cliente.com' : 'https://instagram.com/cliente'}
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={selectedPlatformIsServer ? 'Senha do painel / servidor' : 'Senha da conta'}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={selectedPlatformIsServer ? 'Ex: ambiente do cliente, porta, observações técnicas...' : 'Ex: conta principal, perfil da empresa...'}
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

      {/* Delete Logo Confirmation */}
      <AlertDialog open={!!deleteLogoId} onOpenChange={() => setDeleteLogoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir logo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const logo = logos.find((l: ClientLogo) => l.id === deleteLogoId);
                if (logo) deleteLogoMutation.mutate(logo);
              }}
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
                  Quem acessar este link poderá ver as credenciais deste cliente (somente leitura).
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
