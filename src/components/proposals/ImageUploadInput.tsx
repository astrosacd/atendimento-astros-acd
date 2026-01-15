import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Link as LinkIcon, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageUploadInputProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

export function ImageUploadInput({
  value,
  onChange,
  disabled = false,
  label = 'Imagem',
  placeholder = 'https://...',
}: ImageUploadInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `proposals/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('proposal-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('proposal-images')
        .getPublicUrl(filePath);

      onChange(publicUrl.publicUrl);
      toast.success('Imagem enviada com sucesso');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      <div className="flex gap-2 mb-2">
        <Button
          type="button"
          variant={mode === 'upload' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('upload')}
          disabled={disabled}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload
        </Button>
        <Button
          type="button"
          variant={mode === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('url')}
          disabled={disabled}
        >
          <LinkIcon className="h-4 w-4 mr-1" />
          URL
        </Button>
      </div>

      {mode === 'upload' ? (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Selecionar imagem
              </>
            )}
          </Button>
        </div>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}

      {value && (
        <div className="mt-2 relative">
          <img
            src={value}
            alt="Preview"
            className="w-full h-32 object-cover rounded-md border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
