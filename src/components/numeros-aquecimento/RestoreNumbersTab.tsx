import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RefreshCw, RotateCcw, Trash2, Search, Mail, Loader2, MessageSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatUltimaAtividade, NumeroStatus, NumeroModelo, useNumerosAquecimento } from '@/hooks/useNumerosAquecimento';
import { useActiveCheckinsByModelo } from '@/hooks/useCheckinDiario';
import type { Json } from '@/integrations/supabase/types';

function deriveTipoFromModeloNome(nome: string): 'normal' | 'business' | null {
  const n = nome.toLowerCase();
  if (/\bbusiness\b/.test(n)) return 'business';
  if (/\bnormal\b/.test(n)) return 'normal';
  return null;
}

interface DeletedNumber {
  id: string;
  numero_valor: string;
  dados_anteriores: {
    id?: string;
    numero: string;
    modelo_id?: string | null;
    status_id?: string | null;
    observacoes?: string | null;
    motivo_exclusao?: string;
    data_exclusao?: string;
    modelo?: { nome: string } | null;
    status?: { nome: string } | null;
  };
  usuario_email: string | null;
  created_at: string;
}

interface RestoreNumbersTabProps {
  statusList: NumeroStatus[];
  modelosList: NumeroModelo[];
}

export function RestoreNumbersTab({ statusList, modelosList }: RestoreNumbersTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<DeletedNumber | null>(null);
  const [restoreStatusId, setRestoreStatusId] = useState<string>('');
  const [restoreModeloId, setRestoreModeloId] = useState<string>('');
  const [restoreTipoWhatsapp, setRestoreTipoWhatsapp] = useState<'' | 'normal' | 'business'>('');
  const [restoreObservacoes, setRestoreObservacoes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  // Capacidade dos modelos (mesma lógica da aba Números / CheckinInlineDialog)
  const { data: numerosTotais = [] } = useNumerosAquecimento();
  const ocupadosByModelo = useActiveCheckinsByModelo();

  const modelosComVagas = useMemo(() => {
    const vendidoId = statusList.find((s) => s.nome === 'Vendido')?.id;
    const estoque = vendidoId
      ? numerosTotais.filter((n) => n.status_id !== vendidoId)
      : numerosTotais;

    return modelosList
      .filter((m) => m.capacidade_whatsapp > 0)
      .filter((m) => m.aparece_no_checkin !== false)
      .map((m) => {
        const numbersInAquecimento = new Set(
          estoque.filter((n) => n.modelo_id === m.id).map((n) => n.numero)
        );
        const numbersWithCheckin =
          ((ocupadosByModelo.get(m.id) as { numbers?: Set<string> } | undefined)?.numbers) ?? new Set<string>();
        const allUniqueNumbers = new Set([...numbersInAquecimento, ...numbersWithCheckin]);
        const ocupados = allUniqueNumbers.size;
        const livres = Math.max(0, m.capacidade_whatsapp - ocupados);
        return { modelo: m, ocupados, capacidade: m.capacidade_whatsapp, livres };
      })
      .filter((o) => o.livres > 0)
      .sort((a, b) => a.modelo.nome.localeCompare(b.modelo.nome, 'pt-BR'));
  }, [modelosList, numerosTotais, statusList, ocupadosByModelo]);

  const selectedModeloVagas = useMemo(
    () => modelosComVagas.find((o) => o.modelo.id === restoreModeloId),
    [modelosComVagas, restoreModeloId]
  );
  const tipoForcado = selectedModeloVagas
    ? deriveTipoFromModeloNome(selectedModeloVagas.modelo.nome)
    : null;


  const callRestauracaoFunction = async (payload: { channel: 'email' | 'whatsapp'; numeros: { numero: string; data_exclusao: string }[] }) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (sessionError || !accessToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-restauracao-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Falha ao enviar (${response.status})`);
    }

    return data;
  };

  // Fetch deleted numbers from history
  const { data: deletedNumbers = [], isLoading, refetch } = useQuery({
    queryKey: ['numeros-aquecimento-deleted'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_history')
        .select('*')
        .eq('acao', 'exclusao')
        .is('numero_id', null) // Deleted numbers have null numero_id
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out numbers that have been restored (check if numero exists again)
      const filteredNumbers: DeletedNumber[] = [];
      
      for (const record of data || []) {
        const dados = record.dados_anteriores as DeletedNumber['dados_anteriores'];
        if (!dados?.numero) continue;

        // Check if this number still exists (was restored)
        const { data: existingNumber } = await supabase
          .from('numeros_aquecimento')
          .select('id')
          .eq('numero', dados.numero)
          .maybeSingle();

        // Only show if the number doesn't exist anymore
        if (!existingNumber) {
          filteredNumbers.push({
            id: record.id,
            numero_valor: record.numero_valor,
            dados_anteriores: dados,
            usuario_email: record.usuario_email,
            created_at: record.created_at,
          });
        }
      }

      // Remove duplicates by numero_valor (keep most recent deletion)
      const uniqueNumbers = new Map<string, DeletedNumber>();
      for (const num of filteredNumbers) {
        if (!uniqueNumbers.has(num.numero_valor)) {
          uniqueNumbers.set(num.numero_valor, num);
        }
      }

      return Array.from(uniqueNumbers.values());
    },
  });

  // Filter deleted numbers by search query
  const filteredDeletedNumbers = useMemo(() => {
    if (!searchQuery.trim()) return deletedNumbers;
    const query = searchQuery.trim().toLowerCase();
    return deletedNumbers.filter((record) =>
      record.numero_valor.toLowerCase().includes(query)
    );
  }, [deletedNumbers, searchQuery]);

  const handleSendEmail = async () => {
    if (filteredDeletedNumbers.length === 0) {
      toast.error('Nenhum número para enviar');
      return;
    }
    setSendingEmail(true);
    try {
      await callRestauracaoFunction({
        channel: 'email',
        numeros: filteredDeletedNumbers.map((r) => ({
          numero: r.numero_valor,
          data_exclusao: r.created_at,
        })),
      });
      toast.success(`E-mail enviado com ${filteredDeletedNumbers.length} número(s)`);
    } catch (e: any) {
      toast.error(`Erro ao enviar e-mail: ${e?.message || e}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendWhatsapp = async () => {
    if (filteredDeletedNumbers.length === 0) {
      toast.error('Nenhum número para enviar');
      return;
    }
    setSendingWhatsapp(true);
    try {
      await callRestauracaoFunction({
        channel: 'whatsapp',
        numeros: filteredDeletedNumbers.map((r) => ({
          numero: r.numero_valor,
          data_exclusao: r.created_at,
        })),
      });
      toast.success(`WhatsApp enviado para o grupo (${filteredDeletedNumbers.length} número(s))`);
    } catch (e: any) {
      toast.error(`Erro ao enviar WhatsApp: ${e?.message || e}`);
    } finally {
      setSendingWhatsapp(false);
    }
  };

  // Restore number mutation
  const restoreNumber = useMutation({
    mutationFn: async ({
      deletedRecord,
      statusId,
      modeloId,
      tipoWhatsapp,
      observacoes,
    }: {
      deletedRecord: DeletedNumber;
      statusId: string;
      modeloId: string;
      tipoWhatsapp: 'normal' | 'business';
      observacoes: string;
    }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user?.id)
        .maybeSingle();

      // Insert the number back
      const { data: numero, error } = await supabase
        .from('numeros_aquecimento')
        .insert({
          numero: deletedRecord.numero_valor,
          modelo_id: modeloId || null,
          status_id: statusId || null,
          tipo_whatsapp: tipoWhatsapp,
          observacoes: observacoes || null,
          ultima_atividade: formatUltimaAtividade('cadastro'),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log restoration in history
      await supabase.from('numeros_aquecimento_history').insert([{
        numero_id: numero.id,
        numero_valor: numero.numero,
        acao: 'restauracao',
        dados_anteriores: deletedRecord.dados_anteriores as unknown as Json,
        dados_novos: numero as unknown as Json,
        usuario_id: user?.id,
        usuario_email: profile?.email || user?.email,
      }]);

      return numero;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento'] });
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-deleted'] });
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-history'] });
      toast.success('Número restaurado com sucesso');
      handleCloseRestoreDialog();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao restaurar número: ${error.message}`);
    },
  });

  const handleOpenRestoreDialog = (number: DeletedNumber) => {
    setSelectedNumber(number);
    // Não pré-preenche - usuário deve escolher novamente
    setRestoreStatusId('');
    setRestoreModeloId('');
    setRestoreTipoWhatsapp('');
    setRestoreObservacoes('');
    setRestoreDialogOpen(true);
  };

  const handleCloseRestoreDialog = () => {
    setRestoreDialogOpen(false);
    setSelectedNumber(null);
    setRestoreStatusId('');
    setRestoreModeloId('');
    setRestoreTipoWhatsapp('');
    setRestoreObservacoes('');
  };

  const handleRestore = () => {
    if (!selectedNumber) return;
    if (!restoreStatusId) {
      toast.error('Selecione um status');
      return;
    }
    if (!restoreModeloId) {
      toast.error('Selecione um modelo');
      return;
    }
    if (!restoreTipoWhatsapp) {
      toast.error('Selecione o tipo de WhatsApp');
      return;
    }

    // Validação de capacidade (defesa em profundidade)
    const vaga = modelosComVagas.find((o) => o.modelo.id === restoreModeloId);
    if (!vaga || vaga.livres <= 0) {
      toast.error('Este modelo não tem mais vagas disponíveis. Escolha outro modelo.');
      return;
    }
    if (tipoForcado && restoreTipoWhatsapp !== tipoForcado) {
      toast.error(`Este modelo aceita apenas WhatsApp ${tipoForcado === 'business' ? 'Business' : 'Normal'}.`);
      return;
    }

    restoreNumber.mutate({
      deletedRecord: selectedNumber,
      statusId: restoreStatusId,
      modeloId: restoreModeloId,
      tipoWhatsapp: restoreTipoWhatsapp,
      observacoes: restoreObservacoes,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Restaurar Números
              </CardTitle>
              <CardDescription>
                Restaure números que foram excluídos do sistema
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSendEmail}
                disabled={sendingEmail || filteredDeletedNumbers.length === 0}
                title="Envia a lista de números internos para tentativa de desbanimento"
              >
                {sendingEmail ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Enviar por e-mail
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSendWhatsapp}
                disabled={sendingWhatsapp || filteredDeletedNumbers.length === 0}
                title="Envia a lista para o grupo de WhatsApp configurado"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {sendingWhatsapp ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                Enviar para WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ℹ️ Aproveitamos as credenciais de e-mail e do grupo de WhatsApp configuradas em <strong>Consulta de Números → Configurações → Lembretes</strong> (remetente Gmail, destinatários, Evolution API e grupo). Nada é alterado naquele módulo.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Modelo Original</TableHead>
                  <TableHead>Status Original</TableHead>
                  <TableHead>Motivo da Exclusão</TableHead>
                  <TableHead>Excluído Por</TableHead>
                  <TableHead>Data Exclusão</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredDeletedNumbers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Trash2 className="h-8 w-8 text-muted-foreground/50" />
                        {searchQuery.trim() ? 'Nenhum número encontrado' : 'Nenhum número excluído para restaurar'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeletedNumbers.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.numero_valor}</TableCell>
                      <TableCell>
                        {record.dados_anteriores?.modelo?.nome || '-'}
                      </TableCell>
                      <TableCell>
                        {record.dados_anteriores?.status?.nome ? (
                          <Badge variant="secondary">{record.dados_anteriores.status.nome}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.dados_anteriores?.motivo_exclusao || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.usuario_email || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(record.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRestoreDialog(record)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restaurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar Número</DialogTitle>
            <DialogDescription>
              Configure os dados do número <strong>{selectedNumber?.numero_valor}</strong> para restauração
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <SearchableSelect
                options={statusList.map((s) => ({ value: s.id, label: s.nome }))}
                value={restoreStatusId}
                onValueChange={setRestoreStatusId}
                placeholder="Selecione o status"
                searchPlaceholder="Buscar status..."
                emptyMessage="Nenhum status encontrado."
              />
            </div>

            <div className="space-y-2">
              <Label>Modelo *</Label>
              <SearchableSelect
                options={modelosComVagas.map((o) => ({
                  value: o.modelo.id,
                  label: `${o.modelo.nome} · ${o.ocupados}/${o.capacidade} · falta ${o.livres}`,
                }))}
                value={restoreModeloId}
                onValueChange={(v) => {
                  setRestoreModeloId(v);
                  const m = modelosComVagas.find((o) => o.modelo.id === v);
                  const forced = m ? deriveTipoFromModeloNome(m.modelo.nome) : null;
                  if (forced) setRestoreTipoWhatsapp(forced);
                }}
                placeholder={modelosComVagas.length === 0 ? 'Nenhum modelo com vaga disponível' : 'Selecione o modelo'}
                searchPlaceholder="Buscar modelo..."
                emptyMessage="Nenhum modelo com vaga disponível."
              />
              {modelosComVagas.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Todos os modelos estão na capacidade máxima. Libere uma vaga (exclusão ou desvinculação de check-in) antes de restaurar.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo WhatsApp *</Label>
              <Select
                value={restoreTipoWhatsapp}
                onValueChange={(v) => setRestoreTipoWhatsapp(v as 'normal' | 'business')}
                disabled={!!tipoForcado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">📱 WhatsApp Normal</SelectItem>
                  <SelectItem value="business">💼 WhatsApp Business</SelectItem>
                </SelectContent>
              </Select>
              {tipoForcado && (
                <p className="text-[11px] text-muted-foreground">
                  Tipo definido automaticamente pelo nome do modelo ({tipoForcado === 'business' ? 'Business' : 'Normal'}).
                </p>
              )}
            </div>


            <div className="space-y-2">
              <Label htmlFor="restore-obs">Observações (opcional)</Label>
              <Textarea
                id="restore-obs"
                placeholder="Observações sobre a restauração..."
                value={restoreObservacoes}
                onChange={(e) => setRestoreObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseRestoreDialog}>
              Cancelar
            </Button>
            <Button onClick={handleRestore} disabled={restoreNumber.isPending}>
              {restoreNumber.isPending ? 'Restaurando...' : 'Restaurar Número'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
