import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Webhook, Plus, Trash2, Eye, EyeOff, RefreshCw, Copy, Zap, Globe, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';
import { motion, AnimatePresence } from "framer-motion";

const EVENTOS = [
  { value: 'chamado.criado', label: 'Chamado Criado' },
  { value: 'chamado.atualizado', label: 'Chamado Atualizado' },
  { value: 'chamado.fechado', label: 'Chamado Fechado' },
];

const AdminChamadosWebhooks = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ nome: '', url: '', secret_key: '', eventos: [] as string[], is_active: true });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['chamados-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chamados_webhooks').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (w: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('chamados_webhooks').insert({ ...w, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-webhooks'] });
      setIsDialogOpen(false);
      setForm({ nome: '', url: '', secret_key: '', eventos: [], is_active: true });
      toast.success('Webhook configurado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chamados_webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-webhooks'] });
      toast.success('Webhook removido');
    },
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/chamados')} className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Webhook className="h-5 w-5 text-indigo-600" /></div>
              <div><h1 className="text-xl font-bold text-slate-900 tracking-tight">Webhooks</h1><p className="text-xs text-slate-500 font-medium">Integrações em tempo real</p></div>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild><Button className="font-bold shadow-lg shadow-indigo-200"><Plus className="h-4 w-4 mr-2" /> Novo Webhook</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-none shadow-2xl">
              <DialogHeader><DialogTitle className="text-xl font-extrabold flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Configurar Webhook</DialogTitle><DialogDescription>Defina para onde enviar as notificações do sistema.</DialogDescription></DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="space-y-2"><Label className="text-sm font-bold text-slate-700">Nome da Integração</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Zapier, N8N, Servidor Próprio" className="h-11" /></div>
                <div className="space-y-2"><Label className="text-sm font-bold text-slate-700">URL de Destino</Label><div className="relative"><Globe className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://api.seuservidor.com/webhook" className="pl-10 h-11" /></div></div>
                <div className="space-y-3"><Label className="text-sm font-bold text-slate-700">Eventos para Notificar</Label><div className="grid grid-cols-1 gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100">{EVENTOS.map(ev => (<label key={ev.value} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-none hover:shadow-sm"><Checkbox checked={form.eventos.includes(ev.value)} onCheckedChange={c => setForm({...form, eventos: c ? [...form.eventos, ev.value] : form.eventos.filter(x => x !== ev.value)})} /><span className="text-sm font-bold text-slate-600">{ev.label}</span></label>))}</div></div>
                <Button className="w-full h-12 font-bold text-lg" onClick={() => createMutation.mutate(form)} disabled={!form.nome || !form.url || form.eventos.length === 0 || createMutation.isPending}>{createMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "Ativar Integração"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <div className="h-1.5 w-full bg-indigo-500" />
            <CardHeader className="pb-2"><CardTitle className="text-lg font-extrabold tracking-tight text-slate-800">Conexões Ativas</CardTitle><CardDescription>Gerencie seus endpoints de recebimento de dados.</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <div className="py-12 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-indigo-500" /></div> : webhooks?.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-slate-50/50"><Webhook className="h-12 w-12 text-slate-200 mx-auto mb-4" /><h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs">Nenhum webhook ativo</h3></div>
              ) : (
                <div className="space-y-4">
                  {webhooks?.map(w => (
                    <motion.div key={w.id} layout className="p-5 rounded-2xl border-2 border-slate-50 bg-white hover:border-indigo-100 hover:shadow-md transition-all group">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-extrabold text-slate-800">{w.nome}</h3>
                            <Badge variant={w.is_active ? "default" : "secondary"} className={w.is_active ? "bg-emerald-500" : ""}>{w.is_active ? "Ativo" : "Inativo"}</Badge>
                          </div>
                          <p className="text-xs font-mono text-slate-400 truncate max-w-md bg-slate-50 p-2 rounded-lg border border-slate-100">{w.url}</p>
                          <div className="flex flex-wrap gap-2 pt-1">{w.eventos?.map((e: string) => (<Badge key={e} variant="outline" className="text-[9px] font-extrabold uppercase border-indigo-100 text-indigo-600">{e.split('.')[1]}</Badge>))}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive transition-colors rounded-full" onClick={() => deleteMutation.mutate(w.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminChamadosWebhooks;
