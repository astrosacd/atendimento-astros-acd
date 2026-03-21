import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Play, Pause, Megaphone, Send, Loader2 } from 'lucide-react';
import { useLeadHunterCampanhas, useCreateCampanha, useUpdateCampanha } from '@/hooks/useLeadHunter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function LeadHunterCampanhas() {
  const { data: campanhas = [], isLoading } = useLeadHunterCampanhas();
  const createCampanha = useCreateCampanha();
  const updateCampanha = useUpdateCampanha();
  const [showCreate, setShowCreate] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    tipo_mensagem: 'personalizada',
    mensagem_modelo: '',
    prompt_ia: 'Você é um especialista em vendas B2B. Gere uma mensagem curta e persuasiva para WhatsApp (máximo 500 caracteres) apresentando nossos serviços para o lead. Use o nome da empresa e o setor para personalizar. Seja direto, profissional e amigável.',
    provedor_ia: 'lovable',
    modelo_ia: '',
    delay_entre_mensagens: 10,
  });

  const handleCreate = async () => {
    if (!form.nome) return toast.error('Nome da campanha é obrigatório');
    await createCampanha.mutateAsync(form as any);
    setShowCreate(false);
    setForm({
      nome: '', descricao: '', tipo_mensagem: 'personalizada', mensagem_modelo: '',
      prompt_ia: form.prompt_ia, provedor_ia: 'lovable', modelo_ia: '', delay_entre_mensagens: 10,
    });
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
            <p className="text-sm">Crie uma campanha para organizar seus disparos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campanhas.map(c => (
            <Card key={c.id} className="border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">{c.nome}</CardTitle>
                  {c.descricao && <p className="text-sm text-muted-foreground mt-1">{c.descricao}</p>}
                </div>
                <Badge className={statusColor[c.status] || ''}>{c.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                  <span>Leads: <strong className="text-foreground">{c.total_leads}</strong></span>
                  <span>Enviados: <strong className="text-primary">{c.total_enviados}</strong></span>
                  <span>Erros: <strong className="text-destructive">{c.total_erros}</strong></span>
                  <span>Respondidos: <strong className="text-emerald-500">{c.total_respondidos}</strong></span>
                  <span>IA: <strong className="text-foreground">{c.provedor_ia}</strong></span>
                  <span>Tipo: <strong className="text-foreground">{c.tipo_mensagem === 'personalizada' ? 'Personalizada por lead' : 'Modelo único'}</strong></span>
                </div>
                <div className="flex gap-2">
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
                    disabled={dispatching === c.id}
                  >
                    {dispatching === c.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Disparar Agora
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
