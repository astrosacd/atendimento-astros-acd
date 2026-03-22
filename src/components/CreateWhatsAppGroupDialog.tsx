import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, Plus, X, ImageIcon, MessageSquare, History, Loader2, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clienteId: string;
  clienteName: string;
  clienteNumero?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWhatsAppGroupDialog({ clienteId, clienteName, clienteNumero, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('criar');
  const [isCreating, setIsCreating] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [motivo, setMotivo] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>(clienteNumero ? [clienteNumero] : []);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  const addParticipant = () => {
    const num = participantInput.replace(/\D/g, '').trim();
    if (!num) return;
    if (participants.includes(num)) {
      toast.error('Número já adicionado');
      return;
    }
    setParticipants(prev => [...prev, num]);
    setParticipantInput('');
  };

  const removeParticipant = (num: string) => {
    setParticipants(prev => prev.filter(p => p !== num));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }
    if (participants.length === 0) {
      toast.error('Adicione pelo menos um participante');
      return;
    }

    setIsCreating(true);
    try {
      let imageBase64: string | null = null;
      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      const { data, error } = await supabase.functions.invoke('create-whatsapp-group', {
        body: {
          clienteId,
          groupName: groupName.trim(),
          groupDescription: groupDescription.trim(),
          participants,
          imageBase64,
          motivo: motivo.trim(),
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Grupo criado com sucesso no WhatsApp!');
      refetchHistory();
      // Reset form
      setGroupName('');
      setGroupDescription('');
      setMotivo('');
      setParticipants(clienteNumero ? [clienteNumero] : []);
      setImageFile(null);
      setImagePreview(null);
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="criar">
              <Plus className="h-4 w-4 mr-1" /> Criar Grupo
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-4 w-4 mr-1" /> Histórico ({groupHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criar" className="space-y-4 mt-4">
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
              <Label className="font-medium">Descrição do Grupo</Label>
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
              <Label className="font-medium">Motivo da Criação</Label>
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
                  {participants.map((num) => (
                    <Badge key={num} variant="secondary" className="gap-1 text-xs py-1">
                      {num}
                      <button onClick={() => removeParticipant(num)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {participants.length} participante(s) — inclua o número com DDI (ex: 5511999999999)
              </p>
            </div>

            {/* Group Image */}
            <div className="space-y-2">
              <Label className="font-medium">Imagem do Grupo (opcional)</Label>
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
              disabled={isCreating || !groupName.trim() || participants.length === 0}
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
                        <Badge variant={group.status === 'created' ? 'default' : 'destructive'} className="text-xs">
                          {group.status === 'created' ? 'Criado' : 'Erro'}
                        </Badge>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
