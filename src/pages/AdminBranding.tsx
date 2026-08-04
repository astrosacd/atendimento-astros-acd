import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ImageIcon, Upload, Trash2, Save, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchBranding, DEFAULT_LOGIN_LOGO, DEFAULT_FAVICON } from '@/hooks/useBranding';

type FieldKey = 'login_logo_url' | 'favicon_url' | 'og_image_url' | 'sidebar_logo_url';

interface FieldConfig {
  key: FieldKey;
  title: string;
  description: string;
  maxSize: number; // maior dimensão (px) após redimensionamento
  fallback: string | null;
  previewClass: string;
}

const FIELDS: FieldConfig[] = [
  {
    key: 'login_logo_url',
    title: 'Logo de Login',
    description: 'Exibida na tela de login, recuperação e redefinição de senha. Recomendado: PNG quadrado com fundo transparente ou sólido.',
    maxSize: 512,
    fallback: DEFAULT_LOGIN_LOGO,
    previewClass: 'h-20 w-20 object-contain',
  },
  {
    key: 'favicon_url',
    title: 'Favicon',
    description: 'Ícone exibido na aba do navegador. Será redimensionado automaticamente para 64x64.',
    maxSize: 64,
    fallback: DEFAULT_FAVICON,
    previewClass: 'h-10 w-10 object-contain',
  },
  {
    key: 'og_image_url',
    title: 'Imagem Social (og:image)',
    description: 'Aparece na prévia ao compartilhar o link do sistema. Ideal 1200x630. Para funcionar em redes sociais, use uma URL pública (https://...) — arquivos enviados aqui ficam embutidos e não são lidos por crawlers.',
    maxSize: 1200,
    fallback: null,
    previewClass: 'h-24 w-auto max-w-full object-contain',
  },
  {
    key: 'sidebar_logo_url',
    title: 'Logo do Menu / Dashboard',
    description: 'Exibida no topo do menu lateral e no cabeçalho mobile. Se vazio, usa a logo de login.',
    maxSize: 256,
    fallback: null,
    previewClass: 'h-14 w-14 object-contain',
  },
];

const MAX_DATA_URL_BYTES = 400 * 1024;

async function fileToResizedDataUrl(file: File, maxSize: number): Promise<string> {
  if (file.type === 'image/svg+xml') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.drawImage(img, 0, 0, w, h);

  let out = canvas.toDataURL('image/png');
  if (out.length > MAX_DATA_URL_BYTES) {
    out = canvas.toDataURL('image/jpeg', 0.85);
  }
  return out;
}

export default function AdminBranding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    login_logo_url: '',
    favicon_url: '',
    og_image_url: '',
    sidebar_logo_url: '',
  });
  const [rowId, setRowId] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('system_branding')
        .select('id, login_logo_url, favicon_url, og_image_url, sidebar_logo_url')
        .limit(1)
        .maybeSingle();
      if (error) toast.error('Erro ao carregar identidade visual: ' + error.message);
      if (data) {
        setRowId(data.id);
        setValues({
          login_logo_url: data.login_logo_url ?? '',
          favicon_url: data.favicon_url ?? '',
          og_image_url: data.og_image_url ?? '',
          sidebar_logo_url: data.sidebar_logo_url ?? '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleFile = async (field: FieldConfig, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (PNG, JPG ou SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file, field.maxSize);
      if (dataUrl.length > MAX_DATA_URL_BYTES * 2) {
        toast.error('Imagem muito pesada após processamento. Use uma imagem menor.');
        return;
      }
      setValues((v) => ({ ...v, [field.key]: dataUrl }));
      toast.success(`${field.title} carregada. Clique em Salvar para aplicar.`);
    } catch (e: any) {
      toast.error('Falha ao processar a imagem: ' + (e?.message ?? 'erro desconhecido'));
    }
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      login_logo_url: values.login_logo_url.trim() || null,
      favicon_url: values.favicon_url.trim() || null,
      og_image_url: values.og_image_url.trim() || null,
      sidebar_logo_url: values.sidebar_logo_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (rowId) {
      ({ error } = await supabase.from('system_branding').update(payload).eq('id', rowId));
    } else {
      const inserted = await supabase
        .from('system_branding')
        .insert({ ...payload, singleton: true })
        .select('id')
        .maybeSingle();
      error = inserted.error;
      if (inserted.data) setRowId(inserted.data.id);
    }

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    await fetchBranding(true);
    toast.success('Identidade visual atualizada.');
  };

  return (
    <DashboardLayout>
      <div className="container max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Palette className="h-7 w-7 text-primary shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Identidade Visual</h1>
            <p className="text-sm text-muted-foreground">
              Troque a logo de login, o favicon, a imagem social e a logo do menu sem precisar de desenvolvedor.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {FIELDS.map((field) => {
              const current = values[field.key] || field.fallback || '';
              return (
                <Card key={field.key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      {field.title}
                    </CardTitle>
                    <CardDescription>{field.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center justify-center rounded-lg border border-border bg-muted/40 p-3 min-w-[96px] min-h-[80px]">
                        {current ? (
                          <img src={current} alt={field.title} className={field.previewClass} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem imagem</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <input
                            ref={(el) => (inputsRef.current[field.key] = el)}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              handleFile(field, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => inputsRef.current[field.key]?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Enviar arquivo
                          </Button>
                          {values[field.key] && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setValues((v) => ({ ...v, [field.key]: '' }))}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ou informe uma URL pública</Label>
                          <Input
                            value={values[field.key].startsWith('data:') ? '' : values[field.key]}
                            placeholder="https://..."
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          />
                          {values[field.key].startsWith('data:') && (
                            <p className="text-[11px] text-muted-foreground">
                              Imagem enviada por upload (embutida). Remova para digitar uma URL.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Separator />

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar identidade visual
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
