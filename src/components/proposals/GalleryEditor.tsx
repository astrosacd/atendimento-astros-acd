import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { GalleryContent, GalleryImage } from '@/types/proposals';

interface GalleryEditorProps {
  content: GalleryContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}

export function GalleryEditor({ content, onChange, disabled }: GalleryEditorProps) {
  const images = content.images || [];
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: GalleryImage[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} não é uma imagem válida`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} é muito grande (máx. 5MB)`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('proposal-images')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Erro ao fazer upload de ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('proposal-images')
          .getPublicUrl(filePath);

        newImages.push({
          id: crypto.randomUUID(),
          url: publicUrl,
          caption: '',
        });
      }

      if (newImages.length > 0) {
        onChange({ images: [...images, ...newImages] });
        toast.success(`${newImages.length} imagem(ns) adicionada(s)`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload das imagens');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const updateCaption = (id: string, caption: string) => {
    onChange({
      images: images.map((img) => (img.id === id ? { ...img, caption } : img)),
    });
  };

  const removeImage = (id: string) => {
    onChange({ images: images.filter((img) => img.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Galeria de Imagens</Label>
        <p className="text-xs text-muted-foreground">{images.length} imagem(ns)</p>
      </div>

      {/* Grid de imagens */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={image.url}
                  alt={image.caption || 'Imagem da galeria'}
                  className="w-full h-full object-cover"
                />
              </div>
              {!disabled && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(image.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Input
                value={image.caption || ''}
                onChange={(e) => updateCaption(image.id, e.target.value)}
                placeholder="Legenda (opcional)"
                className="mt-2 text-xs"
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {!disabled && (
        <div className="flex justify-center">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <Button variant="outline" asChild disabled={isUploading}>
              <span>
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar Imagens
              </span>
            </Button>
          </label>
        </div>
      )}

      {images.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-sm">Nenhuma imagem adicionada</p>
          <p className="text-xs mt-1">Clique em "Adicionar Imagens" para começar</p>
        </div>
      )}
    </div>
  );
}
