import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Wand2, Server, PenLine } from 'lucide-react';

interface FinalizeGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: {
    id: string;
    group_name: string;
    group_jid: string | null;
    motivo: string | null;
    participants: string[];
  };
  clienteName: string;
  onFinalized: () => void;
}

export function FinalizeGroupDialog({ open, onOpenChange, group, clienteName, onFinalized }: FinalizeGroupDialogProps) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [messageMode, setMessageMode] = useState<'manual' | 'ai'>('ai');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('3');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

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

  // Load saved delay config
  useQuery({
    queryKey: ['whatsapp-group-config', 'delay'],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_group_config')
        .select('config_value')
        .eq('config_key', 'participant_removal_delay_seconds')
        .single();
      if (data?.config_value) setDelaySeconds(data.config_value);
      return data;
    },
  });

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-farewell-message', {
        body: {
          groupName: group.group_name,
          motivo: group.motivo,
          clienteName,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar mensagem');
      setMessage(data.message);
      toast.success('Mensagem gerada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar mensagem com IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!reason.trim() || !message.trim() || !selectedInstanceId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const selectedInstance = instances.find((i: any) => i.id === selectedInstanceId);
    if (!selectedInstance) {
      toast.error('Selecione uma instância');
      return;
    }

    setIsFinalizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('finalize-whatsapp-group', {
        body: {
          groupId: group.id,
          reason: reason.trim(),
          message: message.trim(),
          instanceApiUrl: selectedInstance.api_url,
          instanceApiKey: selectedInstance.api_key,
          instanceName: selectedInstance.instance_name,
          delaySeconds: parseInt(delaySeconds) || 3,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao finalizar');

      toast.success('Projeto finalizado com sucesso! Participantes estão sendo removidos.');
      onFinalized();
      onOpenChange(false);
      // Reset
      setReason('');
      setMessage('');
      setSelectedInstanceId('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao finalizar projeto');
    } finally {
      setIsFinalizing(false);
    }
  };

  const isValid = reason.trim() && message.trim() && selectedInstanceId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-destructive">Finalizar Projeto</DialogTitle>
          <DialogDescription>
            Encerrar o grupo <strong>{group.group_name}</strong>. Uma mensagem de despedida será enviada e os participantes serão removidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instance Selector */}
          <div className="space-y-2">
            <Label className="font-medium">Instância WhatsApp <span className="text-destructive">*</span></Label>
            {loadingInstances ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância..." />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst: any) => (
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

          {/* Reason */}
          <div className="space-y-2">
            <Label className="font-medium">Motivo da Finalização <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Informe o motivo do encerramento do projeto..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Message Mode */}
          <div className="space-y-2">
            <Label className="font-medium">Mensagem de Despedida <span className="text-destructive">*</span></Label>
            <Tabs value={messageMode} onValueChange={(v) => setMessageMode(v as 'manual' | 'ai')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai" className="gap-1">
                  <Wand2 className="h-3.5 w-3.5" /> Gerar com IA
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-1">
                  <PenLine className="h-3.5 w-3.5" /> Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="space-y-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando mensagem...</>
                  ) : (
                    <><Wand2 className="h-4 w-4 mr-2" /> Gerar Mensagem com IA</>
                  )}
                </Button>
                {message && (
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="A mensagem gerada aparecerá aqui..."
                  />
                )}
              </TabsContent>

              <TabsContent value="manual" className="mt-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Escreva a mensagem de despedida que será enviada ao grupo..."
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Delay Config */}
          <div className="space-y-2">
            <Label className="font-medium">Delay entre remoções (segundos)</Label>
            <Input
              type="number"
              min="1"
              max="30"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Intervalo entre a remoção de cada participante ({group.participants?.length || 0} participantes)
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isFinalizing}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleFinalize}
            disabled={isFinalizing || !isValid}
          >
            {isFinalizing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finalizando...</>
            ) : (
              'Finalizar Projeto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
