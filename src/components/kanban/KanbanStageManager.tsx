import { useState } from 'react';
import { PipelineStage } from '@/pages/KanbanClientes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';

interface Props {
  stages: PipelineStage[];
  onRefresh: () => void;
}

export function KanbanStageManager({ stages, onRefresh }: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const addStage = async () => {
    if (!newName.trim()) return;
    const maxOrder = Math.max(0, ...stages.map(s => s.order_index));
    const { error } = await supabase.from('pipeline_stages').insert({
      name: newName.trim(),
      color: newColor,
      order_index: maxOrder + 1,
    });
    if (error) { toast.error('Erro ao criar etapa'); return; }
    toast.success('Etapa criada');
    setNewName('');
    onRefresh();
  };

  const updateStage = async (id: string) => {
    const { error } = await supabase.from('pipeline_stages').update({
      name: editName.trim(),
      color: editColor,
    }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success('Etapa atualizada');
    setEditingId(null);
    onRefresh();
  };

  const deleteStage = async (id: string) => {
    const { error } = await supabase.from('pipeline_stages').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir etapa'); return; }
    toast.success('Etapa excluída');
    onRefresh();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-4 bg-card border-border">
        <h3 className="font-semibold text-foreground mb-3">Adicionar Nova Etapa</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Qualificação" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <Input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-16 h-9 p-1 bg-secondary border-border" />
          </div>
          <Button onClick={addStage} disabled={!newName.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">Etapas Existentes</h3>
        {stages.map(stage => (
          <Card key={stage.id} className="p-3 bg-card border-border flex items-center gap-3">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            
            {editingId === stage.id ? (
              <>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 h-8 bg-secondary border-border text-sm" />
                <Input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-12 h-8 p-0.5 bg-secondary border-border" />
                <Button size="sm" variant="ghost" onClick={() => updateStage(stage.id)}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-muted-foreground">
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-foreground">{stage.name}</span>
                {stage.is_default && <span className="text-[10px] text-muted-foreground">padrão</span>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => { setEditingId(stage.id); setEditName(stage.name); setEditColor(stage.color); }}
                >
                  Editar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteStage(stage.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
