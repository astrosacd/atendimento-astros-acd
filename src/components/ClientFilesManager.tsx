import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Upload, File, Trash2, Download, Image, FileText, ExternalLink } from 'lucide-react';

interface ClientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface ClientFilesManagerProps {
  clienteId: string;
  readOnly?: boolean;
}

export function ClientFilesManager({ clienteId, readOnly = false }: ClientFilesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (clienteId) {
      loadFiles();
    }
  }, [clienteId]);

  const loadFiles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('client_files')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading files:', error);
    } else {
      setFiles(data || []);
    }
    setIsLoading(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of Array.from(selectedFiles)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${clienteId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: 'Erro no upload',
            description: `Falha ao enviar ${file.name}`,
            variant: 'destructive',
          });
          continue;
        }

        await supabase.from('client_files').insert({
          cliente_id: clienteId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          created_by: user?.id
        });
      }

      toast({
        title: 'Upload concluído',
        description: 'Arquivos enviados com sucesso',
      });
      
      loadFiles();
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    const { error: storageError } = await supabase.storage
      .from('client-files')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    const { error: dbError } = await supabase
      .from('client_files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      toast({
        title: 'Erro',
        description: 'Falha ao excluir arquivo',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Arquivo excluído',
        description: 'Arquivo removido com sucesso',
      });
      loadFiles();
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('client-files')
      .download(filePath);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao baixar arquivo',
        variant: 'destructive',
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleView = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('client-files')
      .createSignedUrl(filePath, 3600);

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType?.startsWith('image/')) {
      return <Image className="w-5 h-5 text-amber-500" />;
    }
    if (fileType?.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-amber-500" />;
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Carregando arquivos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <File className="w-4 h-4 text-amber-500" />
          <Label className="text-foreground font-medium">Arquivos ({files.length})</Label>
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Enviando...' : 'Adicionar'}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {files.length === 0 ? (
        <div className="text-center py-6 bg-secondary/30 rounded-lg border border-dashed border-border">
          <File className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum arquivo anexado</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {files.map((file) => (
            <div 
              key={file.id}
              className="flex w-full items-center gap-3 p-3 bg-secondary/50 rounded-lg border border-border overflow-hidden"
            >
              <div className="flex-shrink-0">
                {getFileIcon(file.file_type)}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p
                  className="text-sm font-medium text-foreground whitespace-normal break-all leading-snug"
                  title={file.file_name}
                >
                  {file.file_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.file_size)}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleView(file.file_path)}
                  className="text-muted-foreground hover:text-info"
                  title="Visualizar"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(file.file_path, file.file_name)}
                  className="text-muted-foreground hover:text-primary"
                  title="Baixar"
                >
                  <Download className="w-4 h-4" />
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file.id, file.file_path)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}