import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Palette, Type, Image as ImageIcon } from 'lucide-react';
import { ImageUploadInput } from './ImageUploadInput';
import { useProposalBranding } from '@/hooks/useProposalBranding';

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Moderno)' },
  { value: 'Roboto', label: 'Roboto (Clean)' },
  { value: 'Poppins', label: 'Poppins (Elegante)' },
  { value: 'Montserrat', label: 'Montserrat (Bold)' },
  { value: 'Open Sans', label: 'Open Sans (Clássico)' },
  { value: 'Lato', label: 'Lato (Profissional)' },
  { value: 'Playfair Display', label: 'Playfair (Luxo)' },
];

export function BrandingConfig() {
  const { branding, isLoading, updateBranding } = useProposalBranding();
  
  const [logoUrl, setLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#1E40AF');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [showLogoOnCover, setShowLogoOnCover] = useState(true);
  const [showLogoOnPages, setShowLogoOnPages] = useState(false);

  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logo_url || '');
      setCompanyName(branding.company_name || '');
      setPrimaryColor(branding.primary_color || '#3B82F6');
      setSecondaryColor(branding.secondary_color || '#1E40AF');
      setAccentColor(branding.accent_color || '#F59E0B');
      setFontFamily(branding.font_family || 'Inter');
      setShowLogoOnCover(branding.show_logo_on_cover ?? true);
      setShowLogoOnPages(branding.show_logo_on_pages ?? false);
    }
  }, [branding]);

  const handleSave = () => {
    updateBranding.mutate({
      logo_url: logoUrl || null,
      company_name: companyName || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      font_family: fontFamily,
      show_logo_on_cover: showLogoOnCover,
      show_logo_on_pages: showLogoOnPages,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo e Nome */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo e Nome da Empresa
          </CardTitle>
          <CardDescription>
            Configure a identidade visual que aparecerá nas propostas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ImageUploadInput
                label="Logo da Empresa"
                value={logoUrl}
                onChange={setLogoUrl}
                placeholder="https://exemplo.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Recomendado: PNG transparente, máximo 500x200px
              </p>
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input
                  placeholder="Sua Empresa LTDA"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            {/* Preview do Logo */}
            <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-muted/30">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="max-h-24 max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '';
                    e.currentTarget.alt = 'Erro ao carregar logo';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <span className="text-sm">Preview do Logo</span>
                </div>
              )}
              {companyName && (
                <p className="mt-4 font-semibold text-lg">{companyName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Switch
                id="show-logo-cover"
                checked={showLogoOnCover}
                onCheckedChange={setShowLogoOnCover}
              />
              <Label htmlFor="show-logo-cover">Mostrar logo na capa</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-logo-pages"
                checked={showLogoOnPages}
                onCheckedChange={setShowLogoOnPages}
              />
              <Label htmlFor="show-logo-pages">Mostrar logo em todas páginas</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Cores da Marca
          </CardTitle>
          <CardDescription>
            Defina as cores que serão usadas nas propostas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Títulos e destaques</p>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#1E40AF"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Subtítulos e bordas</p>
            </div>
            <div className="space-y-2">
              <Label>Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#F59E0B"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Botões e CTAs</p>
            </div>
          </div>

          {/* Preview das cores */}
          <div className="mt-6 p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">Preview:</p>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-lg shadow-sm"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="w-16 h-16 rounded-lg shadow-sm"
                style={{ backgroundColor: secondaryColor }}
              />
              <div
                className="w-16 h-16 rounded-lg shadow-sm"
                style={{ backgroundColor: accentColor }}
              />
              <div className="flex-1 ml-4">
                <h3 style={{ color: primaryColor }} className="text-xl font-bold">
                  Título da Proposta
                </h3>
                <p style={{ color: secondaryColor }} className="text-sm">
                  Subtítulo explicativo
                </p>
                <button
                  style={{ backgroundColor: accentColor }}
                  className="mt-2 px-4 py-1 rounded text-white text-sm font-medium"
                >
                  Botão de Ação
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipografia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Tipografia
          </CardTitle>
          <CardDescription>
            Escolha a fonte que será usada nas propostas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Família da Fonte</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30">
              <div style={{ fontFamily }}>
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                  Proposta Comercial
                </p>
                <p className="text-muted-foreground">
                  Texto de exemplo com a fonte {fontFamily}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateBranding.isPending} size="lg">
          {updateBranding.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Palette className="h-4 w-4 mr-2" />
          )}
          Salvar Identidade Visual
        </Button>
      </div>
    </div>
  );
}
