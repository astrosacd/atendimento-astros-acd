import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FinalizeGroupDialog } from '@/components/FinalizeGroupDialog';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, Plus, X, ImageIcon, MessageSquare, History, Loader2, Phone, Server, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clienteId: string;
  clienteName: string;
  clienteNumero?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NumberStatus = 'pending' | 'checking' | 'valid' | 'invalid';

interface ParticipantInfo {
  number: string;
  status: NumberStatus;
}

export function CreateWhatsAppGroupDialog({ clienteId, clienteName, clienteNumero, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { canFinalizeWhatsAppGroups } = usePermissions();
  const [activeTab, setActiveTab] = useState('criar');
  const [isCreating, setIsCreating] = useState(false);
  const [newDefaultName, setNewDefaultName] = useState('');
  const [newDefaultPhone, setNewDefaultPhone] = useState('');
  const [finalizeGroup, setFinalizeGroup] = useState<any>(null);

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [motivo, setMotivo] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  // Fetch WhatsApp instances
  const { data: instances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ['whatsapp-instances'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_whatsapp_instances')
        .select('*')
        .eq('is_active', true)
        .order('instance_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch default participants
  const { data: defaultParticipants = [] } = useQuery({
    queryKey: ['whatsapp-default-participants'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_group_default_participants')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as { id: string; phone_number: string; name: string; is_active: boolean }[];
    },
  });

  const { data: groupHistory = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['whatsapp-groups', clienteId],
    enabled: open && !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_whatsapp_groups')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Pre-fill client number and default participants when dialog opens
  useEffect(() => {
    if (open) {
      const initial: ParticipantInfo[] = [];
      
      // Add default participants
      defaultParticipants.forEach(dp => {
        const cleanNum = dp.phone_number.replace(/\D/g, '');
        if (cleanNum && !initial.some(p => p.number === cleanNum)) {
          initial.push({ number: cleanNum, status: 'pending' });
        }
      });
      
      // Add client number
      if (clienteNumero) {
        const cleanNum = clienteNumero.replace(/\D/g, '');
        if (cleanNum && !initial.some(p => p.number === cleanNum)) {
          initial.push({ number: cleanNum, status: 'pending' });
        }
      }
      
      if (initial.length > 0) {
        setParticipants(initial);
      }
    }
  }, [open, clienteNumero, defaultParticipants]);

  // Auto-validate pending numbers when an instance is selected
  const validateNumber = useCallback(async (number: string) => {
    const selectedInstance = instances.find(i => i.id === selectedInstanceId);
    if (!selectedInstance) return;

    setParticipants(prev =>
      prev.map(p => p.number === number ? { ...p, status: 'checking' as NumberStatus } : p)
    );

    try {
      const cleanNum = number.replace(/\D/g, '');
      const response = await fetch(
        `${selectedInstance.api_url}/chat/whatsappNumbers/${selectedInstance.instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': selectedInstance.api_key,
          },
          body: JSON.stringify({ numbers: [cleanNum] }),
        }
      );

      const data = await response.json();
      // Evolution API returns array with exists field
      const exists = Array.isArray(data) && data.length > 0 && data[0]?.exists === true;

      setParticipants(prev =>
        prev.map(p => p.number === number ? { ...p, status: exists ? 'valid' : 'invalid' } : p)
      );
    } catch (err) {
      console.error('Error validating number:', err);
      // On error, keep as pending (don't block)
      setParticipants(prev =>
        prev.map(p => p.number === number ? { ...p, status: 'pending' as NumberStatus } : p)
      );
    }
  }, [instances, selectedInstanceId]);

  // When instance changes, re-validate all pending/invalid numbers
  useEffect(() => {
    if (!selectedInstanceId || participants.length === 0) return;
    participants.forEach(p => {
      if (p.status === 'pending') {
        validateNumber(p.number);
      }
    });
  }, [selectedInstanceId]);

  const addParticipant = () => {
    const num = participantInput.replace(/\D/g, '').trim();
    if (!num) return;
    if (participants.some(p => p.number === num)) {
      toast.error('Número já adicionado');
      return;
    }
    const newParticipant: ParticipantInfo = { number: num, status: 'pending' };
    setParticipants(prev => [...prev, newParticipant]);
    setParticipantInput('');

    // Validate immediately if instance is selected
    if (selectedInstanceId) {
      setTimeout(() => validateNumber(num), 100);
    }
  };

  const removeParticipant = (num: string) => {
    setParticipants(prev => prev.filter(p => p.number !== num));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isFormValid = () => {
    return (
      groupName.trim() !== '' &&
      groupDescription.trim() !== '' &&
      motivo.trim() !== '' &&
      participants.length > 0 &&
      imageFile !== null &&
      selectedInstanceId !== ''
    );
  };

  const invalidParticipants = participants.filter(p => p.status === 'invalid');
  const hasInvalidNumbers = invalidParticipants.length > 0;

  const handleCreate = async () => {
    if (!isFormValid()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const selectedInstance = instances.find(i => i.id === selectedInstanceId);
    if (!selectedInstance) {
      toast.error('Selecione uma instância do WhatsApp');
      return;
    }

    // Warn about invalid numbers but allow creation
    if (hasInvalidNumbers) {
      const invalidNums = invalidParticipants.map(p => p.number).join(', ');
      toast.warning(`Atenção: os números ${invalidNums} não foram encontrados no WhatsApp. Eles serão ignorados na criação do grupo.`);
    }

    setIsCreating(true);
    try {
      let imageBase64: string | null = null;
      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64Only = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64Only);
          };
          reader.readAsDataURL(imageFile);
        });
      }

      // Only send valid/pending/checking numbers (exclude invalid)
      const validNumbers = participants
        .filter(p => p.status !== 'invalid')
        .map(p => p.number);

      if (validNumbers.length === 0) {
        toast.error('Nenhum participante com número válido. Adicione pelo menos um número válido.');
        setIsCreating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-whatsapp-group', {
        body: {
          clienteId,
          groupName: groupName.trim(),
          groupDescription: groupDescription.trim(),
          participants: validNumbers,
          imageBase64,
          motivo: motivo.trim(),
          instanceApiUrl: selectedInstance.api_url,
          instanceApiKey: selectedInstance.api_key,
          instanceName: selectedInstance.instance_name,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Grupo criado com sucesso no WhatsApp!');
      refetchHistory();
      setGroupName('');
      setGroupDescription('');
      setMotivo('');
      setParticipants(clienteNumero ? [{ number: clienteNumero.replace(/\D/g, ''), status: 'pending' }] : []);
      setImageFile(null);
      setImagePreview(null);
      setSelectedInstanceId('');
      setActiveTab('historico');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar grupo');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addParticipant();
    }
  };

  const getStatusIcon = (status: NumberStatus) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
      case 'valid':
        return <CheckCircle className="h-3 w-3 text-emerald-500" />;
      case 'invalid':
        return <XCircle className="h-3 w-3 text-destructive" />;
      default:
        return <AlertCircle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: NumberStatus): 'secondary' | 'destructive' | 'outline' | 'default' => {
    switch (status) {
      case 'valid': return 'default';
      case 'invalid': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Grupo WhatsApp — {clienteName}
          </DialogTitle>
          <DialogDescription>
            Crie grupos do WhatsApp diretamente pelo painel usando a Evolution API
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="criar">
              <Plus className="h-4 w-4 mr-1" /> Criar
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-4 w-4 mr-1" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="config">
              <Users className="h-4 w-4 mr-1" /> Padrões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criar" className="space-y-4 mt-4">
            {/* Instance Selector */}
            <div className="space-y-2">
              <Label className="font-medium">Instância WhatsApp *</Label>
              {loadingInstances ? (
                <p className="text-sm text-muted-foreground">Carregando instâncias...</p>
              ) : instances.length === 0 ? (
                <p className="text-sm text-destructive">
                  Nenhuma instância ativa encontrada. Configure no módulo de Cobrança.
                </p>
              ) : (
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a instância..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        <div className="flex items-center gap-2">
                          <Server className="h-3 w-3 text-muted-foreground" />
                          {inst.instance_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Group Name */}
            <div className="space-y-2">
              <Label className="font-medium">Nome do Grupo *</Label>
              <Input
                placeholder="Ex: Projeto Social Media - Cliente"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="font-medium">Descrição do Grupo *</Label>
              <Textarea
                placeholder="Descrição que aparecerá no grupo do WhatsApp..."
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label className="font-medium">Motivo da Criação *</Label>
              <Input
                placeholder="Ex: Atendimento de Social Media, Tráfego Pago..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <Label className="font-medium">Participantes *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="5511999999999"
                    value={participantInput}
                    onChange={(e) => setParticipantInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                  />
                </div>
                <Button type="button" size="icon" onClick={addParticipant} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {participants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {participants.map((p) => (
                    <Badge
                      key={p.number}
                      variant={getStatusVariant(p.status)}
                      className="gap-1 text-xs py-1"
                    >
                      {getStatusIcon(p.status)}
                      {p.number}
                      {p.number === clienteNumero?.replace(/\D/g, '') && (
                        <span className="text-[10px] opacity-70">(cliente)</span>
                      )}
                      <button onClick={() => removeParticipant(p.number)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {hasInvalidNumbers && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {invalidParticipants.length === 1
                    ? `O número ${invalidParticipants[0].number} não foi encontrado no WhatsApp`
                    : `${invalidParticipants.length} números não foram encontrados no WhatsApp`
                  }
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {participants.length} participante(s) — inclua o número com DDI (ex: 5511999999999)
                {!selectedInstanceId && participants.some(p => p.status === 'pending') && (
                  <span className="block text-amber-500 mt-0.5">
                    Selecione uma instância para validar os números
                  </span>
                )}
              </p>
            </div>

            {/* Group Image */}
            <div className="space-y-2">
              <Label className="font-medium">Imagem do Grupo *</Label>
              <div className="flex items-center gap-3">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-full object-cover border border-border" />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-secondary border border-dashed border-border flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="flex-1"
                />
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !isFormValid()}
              className="w-full"
            >
              {isCreating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando grupo...</>
              ) : (
                <><MessageSquare className="h-4 w-4 mr-2" /> Criar Grupo no WhatsApp</>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {loadingHistory ? (
              <div className="py-8 text-center text-muted-foreground">Carregando...</div>
            ) : groupHistory.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum grupo criado para este cliente</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {groupHistory.map((group: any) => (
                  <Card key={group.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{group.group_name}</span>
                        <div className="flex items-center gap-2">
                          {group.status === 'created' && group.group_jid && canFinalizeWhatsAppGroups() && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 text-xs px-2"
                              onClick={() => setFinalizeGroup(group)}
                            >
                              Finalizar Projeto
                            </Button>
                          )}
                          <Badge
                            variant={group.status === 'created' ? 'default' : group.status === 'finalized' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {group.status === 'created' ? 'Criado' : group.status === 'finalized' ? 'Finalizado' : 'Erro'}
                          </Badge>
                        </div>
                      </div>
                      {group.group_description && (
                        <p className="text-xs text-muted-foreground">{group.group_description}</p>
                      )}
                      {group.motivo && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Motivo:</span> {group.motivo}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {(group.participants || []).map((p: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                        <span>
                          Criado por: <span className="font-medium text-foreground">{group.created_by_name || group.created_by_email}</span>
                        </span>
                        <span>
                          {format(new Date(group.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {group.error_message && (
                        <p className="text-xs text-destructive">Erro: {group.error_message}</p>
                      )}
                      {group.status === 'finalized' && (
                        <div className="text-xs space-y-1 pt-1 border-t border-border bg-muted/50 -mx-4 -mb-4 px-4 py-2 rounded-b-lg">
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Finalizado por:</span> {group.finalized_by_name || group.finalized_by_email}
                          </p>
                          {group.finalized_at && (
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">Em:</span> {format(new Date(group.finalized_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                          {group.finalization_reason && (
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">Motivo:</span> {group.finalization_reason}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="config" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Números que serão adicionados automaticamente em todos os novos grupos.
            </p>
            <div className="flex gap-2">
              <Input placeholder="Nome (ex: Gerente)" value={newDefaultName} onChange={(e) => setNewDefaultName(e.target.value)} className="flex-1" />
              <Input placeholder="5511999999999" value={newDefaultPhone} onChange={(e) => setNewDefaultPhone(e.target.value)} className="flex-1" />
              <Button size="icon" variant="outline" onClick={async () => {
                const name = newDefaultName.trim();
                const phone = newDefaultPhone.replace(/\D/g, '').trim();
                if (!name || !phone) { toast.error('Preencha nome e número'); return; }
                const { error } = await supabase.from('whatsapp_group_default_participants').insert({ name, phone_number: phone });
                if (error) { toast.error('Erro ao salvar'); return; }
                toast.success('Participante padrão adicionado!');
                setNewDefaultName(''); setNewDefaultPhone('');
                queryClient.invalidateQueries({ queryKey: ['whatsapp-default-participants'] });
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {defaultParticipants.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum participante padrão configurado</p>
            ) : (
              <div className="space-y-2">
                {defaultParticipants.map((dp) => (
                  <div key={dp.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <span className="text-sm font-medium">{dp.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{dp.phone_number}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => {
                      await supabase.from('whatsapp_group_default_participants').delete().eq('id', dp.id);
                      queryClient.invalidateQueries({ queryKey: ['whatsapp-default-participants'] });
                      toast.success('Removido');
                    }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {finalizeGroup && (
        <FinalizeGroupDialog
          open={!!finalizeGroup}
          onOpenChange={(v) => { if (!v) setFinalizeGroup(null); }}
          group={finalizeGroup}
          clienteName={clienteName}
          onFinalized={() => {
            setFinalizeGroup(null);
            refetchHistory();
          }}
        />
      )}
    </Dialog>
  );
}
