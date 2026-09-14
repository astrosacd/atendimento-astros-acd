import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Search, Trash2, Send, Upload, Users, AlertCircle, CheckCircle, Clock, XCircle, Globe, Loader2, Ban } from 'lucide-react';
import { useLeadHunterLeads, useCreateLead, useDeleteLead, useLeadHunterConfig } from '@/hooks/useLeadHunter';
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

export default function LeadHunterLeads() {
  const { data: leads = [], isLoading } = useLeadHunterLeads();
  const { data: config = {} } = useLeadHunterConfig();
  const createLead = useCreateLead();
  const deleteLead = useDeleteLead();
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', empresa: '', website: '', cidade: '', estado: '', categoria: '' });

  const skipDomains: string[] = (() => {
    try { return config.scrape_skip_domains ? JSON.parse(config.scrape_skip_domains) : DEFAULT_SKIP_DOMAINS; } catch { return DEFAULT_SKIP_DOMAINS; }
  })();

  const filtered = leads.filter(l => 
    (l.nome || '').toLowerCase().includes(search.toLowerCase()) ||
    l.telefone.includes(search) ||
    (l.empresa || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; label: string }> = {
      novo: { variant: 'secondary', icon: Clock, label: 'Novo' },
      enviado: { variant: 'default', icon: CheckCircle, label: 'Enviado' },
      erro: { variant: 'destructive', icon: XCircle, label: 'Erro' },
      respondeu: { variant: 'outline', icon: CheckCircle, label: 'Respondeu' },
      bloqueado: { variant: 'destructive', icon: AlertCircle, label: 'Bloqueado' },
    };
    const s = map[status] || map.novo;
    return (
      <Badge variant={s.variant} className="gap-1">
        <s.icon className="h-3 w-3" />
        {s.label}
      </Badge>
    );
  };

  const handleAdd = async () => {
    if (!form.telefone) return toast.error('Telefone é obrigatório');
    await createLead.mutateAsync({ ...form, fonte: 'manual' } as any);
    setShowAddDialog(false);
    setForm({ nome: '', telefone: '', email: '', empresa: '', website: '', cidade: '', estado: '', categoria: '' });
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return toast.error('CSV vazio ou sem dados');
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const phoneIdx = headers.findIndex(h => ['telefone', 'phone', 'numero', 'whatsapp'].includes(h));
    if (phoneIdx === -1) return toast.error('Coluna de telefone não encontrada');
    
    const nameIdx = headers.findIndex(h => ['nome', 'name', 'empresa'].includes(h));
    const emailIdx = headers.findIndex(h => ['email', 'e-mail'].includes(h));
    
    let imported = 0;
    let errors = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const telefone = cols[phoneIdx]?.replace(/\D/g, '');
      if (!telefone) continue;
      
      const { error } = await supabase.from('lead_hunter_leads').insert({
        telefone,
        nome: nameIdx >= 0 ? cols[nameIdx] : null,
        email: emailIdx >= 0 ? cols[emailIdx] : null,
        fonte: 'csv',
      } as any);
      
      if (error) errors++;
      else imported++;
    }
    
    toast.success(`${imported} leads importados${errors > 0 ? `, ${errors} duplicados/erros` : ''}`);
    setShowImportDialog(false);
  };

  const handleSendSingle = async (leadId: string) => {
    setSendingIds(prev => new Set(prev).add(leadId));
    try {
      const { data, error } = await supabase.functions.invoke('lead-hunter-send', {
        body: { leadIds: [leadId] },
      });
      if (error) throw error;

      toast.success(`${data?.message || 'Disparo enviado com sucesso!'} (via Evolution)`);
    } catch (error: any) {
      console.error('Send error:', error);
      toast.error(`Erro ao disparar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  const getSiteStatus = (website: string | null) => {
    if (!website) return null;
    const blocked = isSkippedDomain(website, skipDomains);
    return { url: website, blocked };
  };

  const stats = {
    total: leads.length,
    novos: leads.filter(l => l.status === 'novo').length,
    enviados: leads.filter(l => l.status === 'enviado').length,
    erros: leads.filter(l => l.status === 'erro').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total de Leads</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{stats.novos}</p>
            <p className="text-xs text-muted-foreground">Novos</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{stats.enviados}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{stats.erros}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card className="border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Leads ({filtered.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar CSV
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Lead
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou empresa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-auto max-h-[500px]">
            <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Nome</TableHead>
                    <TableHead className="w-[130px]">Telefone</TableHead>
                    <TableHead className="w-[100px]">Site</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[90px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
                  ) : filtered.slice(0, 100).map(lead => {
                    const siteStatus = getSiteStatus(lead.website);
                    const isSending = sendingIds.has(lead.id);
                    
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium max-w-[180px]">
                          <div className="truncate" title={lead.nome || '-'}>{lead.nome || '-'}</div>
                          {lead.empresa && <div className="text-xs text-muted-foreground truncate" title={lead.empresa}>{lead.empresa}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{lead.telefone}</TableCell>
                        <TableCell>
                          {siteStatus ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  {siteStatus.blocked ? (
                                    <Badge variant="destructive" className="gap-1 text-[10px]">
                                      <Ban className="h-3 w-3" /> Bloqueado
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500 text-emerald-600">
                                      <Globe className="h-3 w-3" /> Permitido
                                    </Badge>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{siteStatus.url}</p>
                                <p className="text-xs text-muted-foreground">
                                  {siteStatus.blocked 
                                    ? 'Este domínio está na lista de ignorados (scraping não será feito)' 
                                    : 'Site será scraped para personalizar a mensagem via IA'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {statusBadge(lead.status)}
                          {lead.erro_mensagem && (
                            <p className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={lead.erro_mensagem}>
                              {lead.erro_mensagem}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {lead.status === 'novo' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleSendSingle(lead.id)} 
                                disabled={isSending}
                                title="Disparar"
                                className="hover:bg-primary/10 hover:text-primary"
                              >
                                {isSending ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                  <Send className="h-4 w-4 text-primary" />
                                )}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => deleteLead.mutate(lead.id)} title="Remover" className="hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="5585999999999" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <Label>Empresa</Label>
                <Input value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Website</Label>
                <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={createLead.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O CSV deve conter pelo menos uma coluna chamada <strong>telefone</strong>, <strong>phone</strong> ou <strong>numero</strong>.
              Opcionalmente: nome, email.
            </p>
            <Input type="file" accept=".csv,.txt" onChange={handleCSVImport} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
