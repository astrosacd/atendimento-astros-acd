import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Key, Plus, Trash2, Eye, EyeOff, RefreshCw, Copy, ShieldCheck, Zap, Loader2, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';
import { motion, AnimatePresence } from "framer-motion";

const PERMISSIONS = [
  { value: 'read', label: 'Leitura', description: 'Consultar chamados e logs' },
  { value: 'write', label: 'Escrita', description: 'Responder e atualizar status' },
  { value: 'delete', label: 'Exclusão', description: 'Remover registros permanentemente' },
];

const AdminChamadosApiKeys = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '', permissions: ['read'], is_active: true });

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['chamados-api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chamados_api_keys').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generateApiKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return 'acd_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const createMutation = useMutation({
    mutationFn: async (d: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const key = generateApiKey();
      const { error } = await supabase.from('chamados_api_keys').insert({ ...d, api_key: key, created_by: user?.id });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ['chamados-api-keys'] });
      setNewApiKey(key);
      setForm({ nome: '', descricao: '', permissions: ['read'], is_active: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chamados_api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-api-keys'] });
      toast.success('Chave removida');
    },
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/chamados')} className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center"><Key className="h-5 w-5 text-amber-600" /></div>
              <div><h1 className="text-xl font-bold text-slate-900 tracking-tight">API Keys</h1><p className="text-xs text-slate-500 font-medium">Acesso programático seguro</p></div>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={o => { setIsDialogOpen(o); if (!o) setNewApiKey(null); }}>
            <DialogTrigger asChild><Button className="font-bold shadow-lg shadow-amber-200"><Plus className="h-4 w-4 mr-2" /> Gerar Nova Chave</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-none shadow-2xl">
              <DialogHeader><DialogTitle className="text-xl font-extrabold flex items-center gap-2">{newApiKey ? <ShieldCheck className="h-6 w-6 text-emerald-500" /> : <Zap className="h-5 w-5 text-amber-500" />} {newApiKey ? "Chave Gerada!" : "Nova API Key"}</DialogTitle><DialogDescription>{newApiKey ? "Copie a chave agora, ela não será exibida novamente por segurança." : "Crie chaves exclusivas para integrações externas."}</DialogDescription></DialogHeader>
              {newApiKey ? (
                <div className="space-y-6 pt-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Sua Chave Privada</p>
                    <div className="flex gap-2"><Input value={newApiKey} readOnly className="font-mono text-xs bg-white h-11" /><Button variant="secondary" onClick={() => { __copyToClipboard(newApiKey); toast.success('Copiado!'); }} className="h-11"><Copy className="h-4 w-4" /></Button></div>
                  </div>
                  <Button className="w-full h-12 font-bold" onClick={() => { setIsDialogOpen(false); setNewApiKey(null); }}>Concluído</Button>
                </div>
              ) : (
                <div className="space-y-6 pt-4">
                  <div className="space-y-2"><Label className="text-sm font-bold text-slate-700">Identificação</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Backend Sistema X" className="h-11" /></div>
                  <div className="space-y-4"><Label className="text-sm font-bold text-slate-700">Permissões de Acesso</Label><div className="space-y-2">{PERMISSIONS.map(p => (<label key={p.value} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer transition-colors"><Checkbox checked={form.permissions.includes(p.value)} onCheckedChange={c => setForm({...form, permissions: c ? [...form.permissions, p.value] : form.permissions.filter(x => x !== p.value)})} /><div className="space-y-0.5"><p className="text-sm font-bold text-slate-700">{p.label}</p><p className="text-xs text-slate-500">{p.description}</p></div></label>))}</div></div>
                  <Button className="w-full h-12 font-bold text-lg" onClick={() => createMutation.mutate(form)} disabled={!form.nome || form.permissions.length === 0 || createMutation.isPending}>{createMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "Gerar API Key"}</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <div className="h-1.5 w-full bg-amber-500" />
            <CardHeader><CardTitle className="text-lg font-extrabold tracking-tight text-slate-800">Suas Chaves Ativas</CardTitle><CardDescription>Gerencie o acesso seguro ao módulo de chamados via API.</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <div className="py-12 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-amber-500" /></div> : apiKeys?.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-slate-50/50"><Key className="h-12 w-12 text-slate-200 mx-auto mb-4" /><h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs">Nenhuma chave cadastrada</h3></div>
              ) : (
                <div className="space-y-4">
                  {apiKeys?.map(k => (
                    <motion.div key={k.id} layout className="p-5 rounded-2xl border-2 border-slate-50 bg-white hover:border-amber-100 hover:shadow-md transition-all group">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3"><h3 className="font-extrabold text-slate-800">{k.nome}</h3><Badge variant="outline" className="text-[10px] uppercase font-bold border-amber-100 text-amber-600">{k.permissions?.join(', ')}</Badge></div>
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100"><p className="text-xs font-mono text-slate-400">{showKeys[k.id] ? k.api_key : '••••••••••••••••'}</p><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowKeys({...showKeys, [k.id]: !showKeys[k.id]})}>{showKeys[k.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { __copyToClipboard(k.api_key); toast.success('Copiado!'); }}><Copy className="h-3 w-3" /></Button></div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider"><Info className="h-3 w-3" /> Criado em {format(new Date(k.created_at), "dd/MM/yy", { locale: ptBR })}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive transition-colors rounded-full" onClick={() => deleteMutation.mutate(k.id)}><Trash2 className="h-4 w-4" /></Button>
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

export default AdminChamadosApiKeys;
