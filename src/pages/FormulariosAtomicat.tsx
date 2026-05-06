import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, Pencil, FileText, Eye, RefreshCw, ClipboardList } from 'lucide-react';
import { copyToClipboard } from '@/utils/clipboard';

interface FormConfig {
  id: string;
  nome: string;
  identifier_type: 'form_id' | 'name_url' | 'both';
  form_id: string | null;
  form_name: string | null;
  page_url: string | null;
  message_template: string;
  instance_name: string | null;
  field_overrides: Record<string, string>;
  is_active: boolean;
  created_at: string;
}

interface Submission {
  id: string;
  form_config_id: string | null;
  atomicat_form_name: string | null;
  page_url: string | null;
  payload: any;
  extracted_nome: string | null;
  extracted_email: string | null;
  extracted_telefone: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface Settings {
  id: string;
  default_instance_name: string | null;
  api_url: string | null;
  api_key: string | null;
  enabled: boolean;
}

const emptyForm = (): Omit<FormConfig, 'id' | 'created_at'> => ({
  nome: '',
  identifier_type: 'both',
  form_id: '',
  form_name: '',
  page_url: '',
  message_template: 'Olá {{nome}}! Recebemos seu contato. Em breve falaremos com você.',
  instance_name: '',
  field_overrides: {},
  is_active: true,
});

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atomicat-webhook`;

export default function FormulariosAtomicat() {
  const { toast } = useToast();
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [overridesText, setOverridesText] = useState('');
  const [viewSub, setViewSub] = useState<Submission | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const [f, s, st] = await Promise.all([
      supabase.from('atomicat_forms').select('*').order('created_at', { ascending: false }),
      supabase.from('atomicat_submissions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('atomicat_settings').select('*').limit(1).maybeSingle(),
    ]);
    setForms((f.data as any) ?? []);
    setSubmissions((s.data as any) ?? []);
    setSettings((st.data as any) ?? null);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setOverridesText('');
    setDialogOpen(true);
  };

  const openEdit = (f: FormConfig) => {
    setEditingId(f.id);
    setFormData({
      nome: f.nome,
      identifier_type: f.identifier_type,
      form_id: f.form_id ?? '',
      form_name: f.form_name ?? '',
      page_url: f.page_url ?? '',
      message_template: f.message_template,
      instance_name: f.instance_name ?? '',
      field_overrides: f.field_overrides ?? {},
      is_active: f.is_active,
    });
    setOverridesText(JSON.stringify(f.field_overrides ?? {}, null, 2));
    setDialogOpen(true);
  };

  const saveForm = async () => {
    if (!formData.nome.trim() || !formData.message_template.trim()) {
      toast({ title: 'Preencha nome e mensagem', variant: 'destructive' });
      return;
    }
    let overrides: Record<string, string> = {};
    if (overridesText.trim()) {
      try { overrides = JSON.parse(overridesText); } catch {
        toast({ title: 'JSON de mapeamento inválido', variant: 'destructive' });
        return;
      }
    }
    const payload = {
      ...formData,
      form_id: formData.form_id || null,
      form_name: formData.form_name || null,
      page_url: formData.page_url || null,
      instance_name: formData.instance_name || null,
      field_overrides: overrides,
    };
    const op = editingId
      ? supabase.from('atomicat_forms').update(payload).eq('id', editingId)
      : supabase.from('atomicat_forms').insert(payload);
    const { error } = await op;
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingId ? 'Formulário atualizado' : 'Formulário cadastrado' });
    setDialogOpen(false);
    loadAll();
  };

  const deleteForm = async (id: string) => {
    if (!confirm('Excluir este cadastro?')) return;
    const { error } = await supabase.from('atomicat_forms').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Excluído' });
    loadAll();
  };

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase
      .from('atomicat_settings')
      .update({
        default_instance_name: settings.default_instance_name,
        api_url: settings.api_url,
        api_key: settings.api_key,
        enabled: settings.enabled,
      })
      .eq('id', settings.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Configurações salvas' });
  };

  const copyUrl = async () => {
    await copyToClipboard(WEBHOOK_URL);
    toast({ title: 'URL copiada' });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      sent: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      failed: 'bg-destructive/15 text-destructive',
      no_match: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      skipped: 'bg-muted text-muted-foreground',
      received: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    };
    return <Badge variant="secondary" className={map[s] ?? ''}>{s}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" /> Formulários Atomicat
            </h1>
            <p className="text-muted-foreground text-sm">
              Receba submissões de formulários e dispare WhatsApp automaticamente.
            </p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo formulário</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">URL do Webhook</CardTitle>
            <CardDescription>Cole esta URL no campo de webhook da Atomicat.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
              <Button variant="outline" onClick={copyUrl}><Copy className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="forms">
          <TabsList>
            <TabsTrigger value="forms">Formulários</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="forms" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : forms.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum formulário cadastrado. Clique em "Novo formulário".
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Identificação</TableHead>
                        <TableHead>Instância</TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forms.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {f.identifier_type === 'form_id' && <>ID: <span className="font-mono">{f.form_id}</span></>}
                            {f.identifier_type === 'name_url' && <>{f.form_name} {f.page_url && `· ${f.page_url}`}</>}
                            {f.identifier_type === 'both' && <>{f.form_name || f.form_id} {f.page_url && `· ${f.page_url}`}</>}
                          </TableCell>
                          <TableCell className="text-xs">{f.instance_name || <span className="text-muted-foreground">global</span>}</TableCell>
                          <TableCell>{f.is_active ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteForm(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {submissions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhuma submissão recebida ainda.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Form</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">{new Date(s.created_at).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-xs">{s.atomicat_form_name || '—'}</TableCell>
                          <TableCell>{s.extracted_nome || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{s.extracted_telefone || '—'}</TableCell>
                          <TableCell>{statusBadge(s.status)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setViewSub(s)}><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolution API global</CardTitle>
                <CardDescription>
                  Usado por padrão. Cada formulário pode sobrescrever a instância.
                  Se vazio, usa as variáveis de ambiente EVOLUTION_API_URL / KEY / INSTANCE.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>URL da API</Label>
                    <Input
                      placeholder="https://evo.exemplo.com"
                      value={settings?.api_url ?? ''}
                      onChange={(e) => setSettings(s => s ? { ...s, api_url: e.target.value } : s)}
                    />
                  </div>
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={settings?.api_key ?? ''}
                      onChange={(e) => setSettings(s => s ? { ...s, api_key: e.target.value } : s)}
                    />
                  </div>
                  <div>
                    <Label>Instância padrão</Label>
                    <Input
                      placeholder="minha-instancia"
                      value={settings?.default_instance_name ?? ''}
                      onChange={(e) => setSettings(s => s ? { ...s, default_instance_name: e.target.value } : s)}
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings?.enabled ?? true}
                        onCheckedChange={(v) => setSettings(s => s ? { ...s, enabled: v } : s)}
                      />
                      <Label>Módulo ativo</Label>
                    </div>
                  </div>
                </div>
                <Button onClick={saveSettings}>Salvar configurações</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar formulário' : 'Novo formulário'}</DialogTitle>
            <DialogDescription>
              Configure como identificar este form e a mensagem que será enviada por WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome interno *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Newsletter ACD" />
            </div>

            <div>
              <Label>Identificar por</Label>
              <Select value={formData.identifier_type} onValueChange={(v: any) => setFormData({ ...formData, identifier_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="form_id">ID do form (mais preciso)</SelectItem>
                  <SelectItem value="name_url">Nome + URL da página</SelectItem>
                  <SelectItem value="both">Ambos (tenta ID, depois nome+URL)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.identifier_type === 'form_id' || formData.identifier_type === 'both') && (
              <div>
                <Label>ID do formulário (form.id)</Label>
                <Input className="font-mono text-xs" value={formData.form_id ?? ''}
                  onChange={(e) => setFormData({ ...formData, form_id: e.target.value })}
                  placeholder="e7fdd122-c6c1-4057-90e4-b279771e9022" />
              </div>
            )}

            {(formData.identifier_type === 'name_url' || formData.identifier_type === 'both') && (
              <>
                <div>
                  <Label>Nome do formulário (form.name)</Label>
                  <Input value={formData.form_name ?? ''}
                    onChange={(e) => setFormData({ ...formData, form_name: e.target.value })}
                    placeholder="New Form" />
                </div>
                <div>
                  <Label>URL da página (opcional, prefixo)</Label>
                  <Input value={formData.page_url ?? ''}
                    onChange={(e) => setFormData({ ...formData, page_url: e.target.value })}
                    placeholder="https://www.astroscomunicacaodigital.com/contingencia-whatsapp" />
                </div>
              </>
            )}

            <div>
              <Label>Mensagem WhatsApp *</Label>
              <Textarea rows={6} value={formData.message_template}
                onChange={(e) => setFormData({ ...formData, message_template: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis: <code>{'{{nome}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{telefone}}'}</code>, <code>{'{{pagina}}'}</code>, <code>{'{{form}}'}</code>
              </p>
            </div>

            <div>
              <Label>Instância Evolution (opcional, sobrescreve a global)</Label>
              <Input value={formData.instance_name ?? ''}
                onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })} />
            </div>

            <div>
              <Label>Mapeamento de campos (override · JSON opcional)</Label>
              <Textarea rows={4} className="font-mono text-xs" value={overridesText}
                onChange={(e) => setOverridesText(e.target.value)}
                placeholder={`{"nome": "Name", "telefone": "Contato"}`} />
              <p className="text-xs text-muted-foreground mt-1">
                Por padrão, detecta automaticamente Nome/Name, Telefone/Contato/Phone, Email/E-mail. Use isto só para sobrescrever.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveForm}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission viewer */}
      <Dialog open={!!viewSub} onOpenChange={(o) => !o && setViewSub(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Submissão</DialogTitle>
          </DialogHeader>
          {viewSub && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(viewSub.status)}</div>
                <div><span className="text-muted-foreground">Data:</span> {new Date(viewSub.created_at).toLocaleString('pt-BR')}</div>
                <div><span className="text-muted-foreground">Form:</span> {viewSub.atomicat_form_name || '—'}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {viewSub.extracted_telefone || '—'}</div>
              </div>
              {viewSub.error_message && (
                <div className="rounded-md bg-destructive/10 text-destructive p-3 text-xs">{viewSub.error_message}</div>
              )}
              <div>
                <Label className="text-xs">Payload completo</Label>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-80">
                  {JSON.stringify(viewSub.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
