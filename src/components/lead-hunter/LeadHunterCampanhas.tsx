import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Play, Pause, Megaphone, Send, Loader2, Info, Trash2, Users, Globe, Ban } from 'lucide-react';
import { useLeadHunterCampanhas, useCreateCampanha, useUpdateCampanha, useDeleteCampanha, useLeadHunterLeads, useLeadHunterConfig } from '@/hooks/useLeadHunter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEFAULT_SKIP_DOMAINS = [
  "instagram.com", "facebook.com", "fb.com", "twitter.com", "x.com",
  "tiktok.com", "youtube.com", "youtu.be", "wa.me", "api.whatsapp.com",
  "web.whatsapp.com", "linktr.ee", "lnktr.ee", "bityli.com", "bit.ly",
  "goo.gl", "t.co", "linkedin.com", "pinterest.com", "threads.net", "t.me", "telegram.me",
];

function isSkippedDomain(url: string, skipDomains: string[]): boolean {
  try {
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    const hostname = new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
    return skipDomains.some(d => {
      const cleanD = d.toLowerCase().replace(/^www\./, "");
      return hostname === cleanD || hostname.endsWith("." + cleanD);
    });
  } catch {
    return false;
  }
}

export default function LeadHunterCampanhas() {
  const { data: campanhas = [], isLoading } = useLeadHunterCampanhas();
  const { data: allLeads = [] } = useLeadHunterLeads();
  const { data: config = {} } = useLeadHunterConfig();
  const [metaTemplates, setMetaTemplates] = useState<{ id: string; template_name: string }[]>([]);

  useEffect(() => {
    const loadTemplates = async () => {
      const { data } = await supabase.from('meta_template_mapping').select('id, template_name');
      if (data) setMetaTemplates(data);
    };
    loadTemplates();
  }, []);

  const skipDomains: string[] = (() => {
    try { return config.scrape_skip_domains ? JSON.parse(config.scrape_skip_domains) : DEFAULT_SKIP_DOMAINS; } catch { return DEFAULT_SKIP_DOMAINS; }
  })();
  const createCampanha = useCreateCampanha();
  const updateCampanha = useUpdateCampanha();
  const deleteCampanha = useDeleteCampanha();
  const [showCreate, setShowCreate] = useState(false);
  const [showLinkLeads, setShowLinkLeads] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    tipo_mensagem: 'personalizada',
    mensagem_modelo: '',
    prompt_ia: 'Você é um especialista em vendas B2B. Gere uma mensagem curta e persuasiva para WhatsApp (máximo 500 caracteres) apresentando nossos serviços para o lead. Use o nome da empresa e o setor para personalizar. Seja direto, profissional e amigável.',
    provedor_ia: 'lovable',
    modelo_ia: '',
    delay_entre_mensagens: 10,
    whatsapp_provider: 'evolution',
    meta_template_name: '',
  });

  const unlinkedLeads = allLeads.filter(l => !l.campanha_id && l.status === 'novo');
  const campaignLeads = (campId: string) => allLeads.filter(l => l.campanha_id === campId);

  const handleCreate = async () => {
    if (!form.nome) return toast.error('Nome da campanha é obrigatório');
    await createCampanha.mutateAsync(form as any);
    setShowCreate(false);
    setForm({
      nome: '', descricao: '', tipo_mensagem: 'personalizada', mensagem_modelo: '',
      prompt_ia: form.prompt_ia, provedor_ia: 'lovable', modelo_ia: '', delay_entre_mensagens: 10,
      whatsapp_provider: 'evolution', meta_template_name: '',
    });
  };

  const handleLinkLeads = async (campanhaId: string) => {
    if (selectedLeadIds.size === 0) return toast.error('Selecione pelo menos um lead');
    try {
      for (const leadId of selectedLeadIds) {
        await supabase.from('lead_hunter_leads').update({ campanha_id: campanhaId } as any).eq('id', leadId);
      }
      toast.success(`${selectedLeadIds.size} leads vinculados à campanha`);
      setShowLinkLeads(null);
      setSelectedLeadIds(new Set());
    } catch {
      toast.error('Erro ao vincular leads');
    }
  };

  const handleDispatch = async (campanhaId: string) => {
    setDispatching(campanhaId);
    try {
      const { data, error } = await supabase.functions.invoke('lead-hunter-dispatch', {
        body: { campanhaId },
      });
      if (error) throw error;
      toast.success(data?.message || 'Disparo iniciado!');
    } catch {
      toast.error('Erro ao iniciar disparo');
    } finally {
      setDispatching(null);
    }
  };

  const handleToggleStatus = async (campanha: any) => {
    const newStatus = campanha.status === 'ativa' ? 'pausada' : 'ativa';
    await updateCampanha.mutateAsync({ id: campanha.id, status: newStatus });
  };

  const statusColor: Record<string, string> = {
    rascunho: 'bg-muted text-muted-foreground',
    ativa: 'bg-primary/20 text-primary',
    pausada: 'bg-amber-500/20 text-amber-500',
    concluida: 'bg-emerald-500/20 text-emerald-500',
  };

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p><strong>Como funciona:</strong></p>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>Crie uma campanha com as configurações de mensagem/IA desejadas.</li>
            <li>Clique em <strong>"Vincular Leads"</strong> para adicionar leads (somente leads com status "Novo" e sem campanha aparecem).</li>
            <li>Clique em <strong>"Disparar Agora"</strong> para enviar mensagens para todos os leads vinculados.</li>
          </ol>
          <p className="mt-1">Você também pode disparar leads individualmente na aba <strong>Leads</strong> sem precisar de uma campanha.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Campanhas ({campanhas.length})
        </h2>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Campanha
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : campanhas.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma campanha criada</p>
            <p className="text-sm">Você pode disparar leads diretamente na aba Leads sem precisar de uma campanha.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campanhas.map(c => {
            const linked = campaignLeads(c.id);
            return (
              <Card key={c.id} className="border-border/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">{c.nome}</CardTitle>
                    {c.descricao && <p className="text-sm text-muted-foreground mt-1">{c.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColor[c.status] || ''}>{c.status}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4 flex-wrap">
                    <span>Leads vinculados: <strong className="text-foreground">{linked.length}</strong></span>
                    <span>Enviados: <strong className="text-primary">{c.total_enviados}</strong></span>
                    <span>Erros: <strong className="text-destructive">{c.total_erros}</strong></span>
                    <span>Respondidos: <strong className="text-emerald-500">{c.total_respondidos}</strong></span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedLeadIds(new Set()); setShowLinkLeads(c.id); }}
                    >
                      <Users className="h-4 w-4 mr-1" /> Vincular Leads ({unlinkedLeads.length} disponíveis)
                    </Button>
                    <Button
                      size="sm"
                      variant={c.status === 'ativa' ? 'outline' : 'default'}
                      onClick={() => handleToggleStatus(c)}
                    >
                      {c.status === 'ativa' ? <><Pause className="h-4 w-4 mr-1" /> Pausar</> : <><Play className="h-4 w-4 mr-1" /> Ativar</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDispatch(c.id)}
                      disabled={dispatching === c.id || linked.length === 0}
                    >
                      {dispatching === c.id ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processando...</>
                      ) : (
                        <><Send className="h-4 w-4 mr-1" /> Disparar Agora</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Link Leads Dialog */}
      <Dialog open={!!showLinkLeads} onOpenChange={() => setShowLinkLeads(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular Leads à Campanha</DialogTitle>
          </DialogHeader>
          {unlinkedLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lead disponível (somente leads com status "Novo" e sem campanha aparecem aqui).</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={selectedLeadIds.size === unlinkedLeads.length}
                  onCheckedChange={(checked) => {
                    setSelectedLeadIds(checked ? new Set(unlinkedLeads.map(l => l.id)) : new Set());
                  }}
                />
                <span className="text-sm font-medium">Selecionar todos ({unlinkedLeads.length})</span>
              </div>
              {unlinkedLeads.map(lead => (
                <div key={lead.id} className="flex items-center gap-2 p-2 rounded border border-border/40 hover:bg-muted/30">
                  <Checkbox
                    checked={selectedLeadIds.has(lead.id)}
                    onCheckedChange={(checked) => {
                      setSelectedLeadIds(prev => {
                        const next = new Set(prev);
                        checked ? next.add(lead.id) : next.delete(lead.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.nome || lead.telefone}</p>
                    {lead.empresa && <p className="text-xs text-muted-foreground">{lead.empresa}</p>}
                  </div>
                  {lead.website ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isSkippedDomain(lead.website, skipDomains)
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-emerald-500/10 text-emerald-600'
                    }`}>
                      {isSkippedDomain(lead.website, skipDomains) ? <Ban className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                      {isSkippedDomain(lead.website, skipDomains) ? 'Bloqueado' : 'Permitido'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sem site</span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground">{lead.telefone}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkLeads(null)}>Cancelar</Button>
            <Button onClick={() => showLinkLeads && handleLinkLeads(showLinkLeads)} disabled={selectedLeadIds.size === 0}>
              Vincular {selectedLeadIds.size} lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha será excluída e os leads vinculados serão desvinculados (não excluídos).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) { deleteCampanha.mutate(deleteId); setDeleteId(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Campanha *</Label>
              <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Prospecção Restaurantes SP" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Mensagem</Label>
                <Select value={form.tipo_mensagem} onValueChange={v => setForm(p => ({ ...p, tipo_mensagem: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personalizada">Personalizada por lead (IA)</SelectItem>
                    <SelectItem value="modelo_unico">Modelo único</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Delay entre mensagens (seg)</Label>
                <Input type="number" value={form.delay_entre_mensagens} onChange={e => setForm(p => ({ ...p, delay_entre_mensagens: parseInt(e.target.value) || 10 }))} />
              </div>
            </div>

            {form.tipo_mensagem === 'modelo_unico' ? (
              <div>
                <Label>Mensagem Modelo</Label>
                <Textarea value={form.mensagem_modelo} onChange={e => setForm(p => ({ ...p, mensagem_modelo: e.target.value }))} rows={4} placeholder="Use {nome}, {empresa} para variáveis" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Provedor IA</Label>
                    <Select value={form.provedor_ia} onValueChange={v => setForm(p => ({ ...p, provedor_ia: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lovable">Lovable AI (padrão)</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modelo IA (opcional)</Label>
                    <Input value={form.modelo_ia} onChange={e => setForm(p => ({ ...p, modelo_ia: e.target.value }))} placeholder="Ex: gpt-4o-mini" />
                  </div>
                </div>
                <div>
                  <Label>Prompt da IA</Label>
                  <Textarea value={form.prompt_ia} onChange={e => setForm(p => ({ ...p, prompt_ia: e.target.value }))} rows={5} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createCampanha.isPending}>Criar Campanha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
