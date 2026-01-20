import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DebouncedInput } from './DebouncedInput';
import type { TeamContent, TeamMember } from '@/types/proposals';

interface TeamEditorProps {
  content: TeamContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}

export function TeamEditor({ content, onChange, disabled }: TeamEditorProps) {
  const members = content.members || [];
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const addMember = () => {
    onChange({
      members: [
        ...members,
        { id: crypto.randomUUID(), name: '', role: '', photo: '' },
      ],
    });
  };

  const updateMember = (id: string, updates: Partial<TeamMember>) => {
    onChange({
      members: members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    });
  };

  const removeMember = (id: string) => {
    onChange({ members: members.filter((m) => m.id !== id) });
  };

  const handlePhotoUpload = async (memberId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Arquivo deve ser uma imagem');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 2MB)');
      return;
    }

    setUploadingFor(memberId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `team/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('proposal-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('proposal-images')
        .getPublicUrl(filePath);

      updateMember(memberId, { photo: publicUrl });
      toast.success('Foto adicionada');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingFor(null);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Membros da Equipe</Label>

      {members.map((member, index) => (
        <div key={member.id} className="flex gap-3 items-start p-3 border rounded-lg bg-muted/30">
          {/* Photo */}
          <div className="flex-shrink-0">
            <label className="cursor-pointer block">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(member.id, file);
                  e.target.value = '';
                }}
                disabled={disabled || uploadingFor === member.id}
              />
              <div className="w-16 h-16 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                {uploadingFor === member.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : member.photo ? (
                  <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Foto</span>
                )}
              </div>
            </label>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                {index === 0 && <Label className="text-xs mb-1 block">Nome</Label>}
                <DebouncedInput
                  value={member.name}
                  onChange={(value) => updateMember(member.id, { name: value })}
                  placeholder="Nome do membro"
                  disabled={disabled}
                  className="h-9"
                />
              </div>
              <div>
                {index === 0 && <Label className="text-xs mb-1 block">Cargo</Label>}
                <DebouncedInput
                  value={member.role}
                  onChange={(value) => updateMember(member.id, { role: value })}
                  placeholder="Cargo ou função"
                  disabled={disabled}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Remove */}
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive h-8 w-8 flex-shrink-0"
              onClick={() => removeMember(member.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {!disabled && (
        <Button variant="outline" size="sm" onClick={addMember}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Membro
        </Button>
      )}

      {members.length === 0 && (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-sm">Nenhum membro adicionado</p>
        </div>
      )}
    </div>
  );
}
