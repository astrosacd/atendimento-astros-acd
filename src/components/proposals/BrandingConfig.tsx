import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Palette, Type, Image as ImageIcon, Building, Award, Users, Globe, Plus, X, Instagram, Facebook, Linkedin, Twitter, Youtube } from 'lucide-react';
import { ImageUploadInput } from './ImageUploadInput';
import { useProposalBranding, type SocialLinks, type ClientLogo, type Certification } from '@/hooks/useProposalBranding';

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
  
  // Basic branding
  const [logoUrl, setLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#1E40AF');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [showLogoOnCover, setShowLogoOnCover] = useState(true);
  const [showLogoOnPages, setShowLogoOnPages] = useState(false);
  
  // Cover background
  const [coverBackgroundUrl, setCoverBackgroundUrl] = useState('');
  
  // Footer
  const [footerContact, setFooterContact] = useState('');
  const [footerWebsite, setFooterWebsite] = useState('');
  const [footerSocial, setFooterSocial] = useState<SocialLinks>({});
  
  // Client logos
  const [clientLogos, setClientLogos] = useState<ClientLogo[]>([]);
  
  // Certifications
  const [certifications, setCertifications] = useState<Certification[]>([]);

  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logo_url || '');
      setCompanyName(branding.company_name || '');
      setTagline(branding.tagline || '');
      setPrimaryColor(branding.primary_color || '#3B82F6');
      setSecondaryColor(branding.secondary_color || '#1E40AF');
      setAccentColor(branding.accent_color || '#F59E0B');
      setFontFamily(branding.font_family || 'Inter');
      setShowLogoOnCover(branding.show_logo_on_cover ?? true);
      setShowLogoOnPages(branding.show_logo_on_pages ?? false);
      setCoverBackgroundUrl(branding.cover_background_url || '');
      setFooterContact(branding.footer_contact || '');
      setFooterWebsite(branding.footer_website || '');
      setFooterSocial(branding.footer_social || {});
      setClientLogos(branding.client_logos || []);
      setCertifications(branding.certifications || []);
    }
  }, [branding]);

  const handleSave = () => {
    updateBranding.mutate({
      logo_url: logoUrl || null,
      company_name: companyName || null,
      tagline: tagline || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      font_family: fontFamily,
      show_logo_on_cover: showLogoOnCover,
      show_logo_on_pages: showLogoOnPages,
      cover_background_url: coverBackgroundUrl || null,
      footer_contact: footerContact || null,
      footer_website: footerWebsite || null,
      footer_social: footerSocial,
      client_logos: clientLogos,
      certifications: certifications,
    });
  };

  const addClientLogo = () => {
    setClientLogos([...clientLogos, { id: crypto.randomUUID(), url: '', name: '' }]);
  };

  const updateClientLogo = (id: string, field: 'url' | 'name', value: string) => {
    setClientLogos(clientLogos.map(logo => 
      logo.id === id ? { ...logo, [field]: value } : logo
    ));
  };

  const removeClientLogo = (id: string) => {
    setClientLogos(clientLogos.filter(logo => logo.id !== id));
  };

  const addCertification = () => {
    setCertifications([...certifications, { id: crypto.randomUUID(), url: '', name: '' }]);
  };

  const updateCertification = (id: string, field: 'url' | 'name', value: string) => {
    setCertifications(certifications.map(cert => 
      cert.id === id ? { ...cert, [field]: value } : cert
    ));
  };

  const removeCertification = (id: string) => {
    setCertifications(certifications.filter(cert => cert.id !== id));
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
      {/* Logo, Nome e Slogan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo e Identidade
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
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input
                  placeholder="Sua Empresa LTDA"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Slogan / Tagline</Label>
                <Input
                  placeholder="Transformando ideias em resultados"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
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
              {tagline && (
                <p className="text-sm text-muted-foreground italic">{tagline}</p>
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

      {/* Imagem de Fundo da Capa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Capa da Proposta
          </CardTitle>
          <CardDescription>
            Personalize a página de capa das propostas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <ImageUploadInput
              label="Imagem de Fundo da Capa"
              value={coverBackgroundUrl}
              onChange={setCoverBackgroundUrl}
              placeholder="https://exemplo.com/background.jpg"
            />
            <div 
              className="h-48 rounded-lg border flex items-center justify-center"
              style={{
                backgroundImage: coverBackgroundUrl ? `url(${coverBackgroundUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: coverBackgroundUrl ? undefined : `${primaryColor}15`,
              }}
            >
              <div className="text-center bg-white/80 dark:bg-black/80 p-4 rounded">
                <p className="font-bold" style={{ color: primaryColor }}>Preview da Capa</p>
                <p className="text-sm text-muted-foreground">{tagline || 'Seu slogan aqui'}</p>
              </div>
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

      {/* Rodapé */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Rodapé das Propostas
          </CardTitle>
          <CardDescription>
            Informações de contato e redes sociais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Informações de Contato</Label>
              <Textarea
                placeholder="Tel: (11) 99999-9999&#10;Email: contato@empresa.com"
                value={footerContact}
                onChange={(e) => setFooterContact(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                placeholder="www.suaempresa.com.br"
                value={footerWebsite}
                onChange={(e) => setFooterWebsite(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-3 pt-4 border-t">
            <Label>Redes Sociais</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                <Input
                  placeholder="@seuinstagram"
                  value={footerSocial.instagram || ''}
                  onChange={(e) => setFooterSocial({ ...footerSocial, instagram: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                <Input
                  placeholder="/suapagina"
                  value={footerSocial.facebook || ''}
                  onChange={(e) => setFooterSocial({ ...footerSocial, facebook: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-blue-700" />
                <Input
                  placeholder="/in/seuperfil"
                  value={footerSocial.linkedin || ''}
                  onChange={(e) => setFooterSocial({ ...footerSocial, linkedin: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-sky-500" />
                <Input
                  placeholder="@seutwitter"
                  value={footerSocial.twitter || ''}
                  onChange={(e) => setFooterSocial({ ...footerSocial, twitter: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                <Input
                  placeholder="/c/seucanal"
                  value={footerSocial.youtube || ''}
                  onChange={(e) => setFooterSocial({ ...footerSocial, youtube: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logos de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes que Confiam em Nós
          </CardTitle>
          <CardDescription>
            Adicione logos de empresas parceiras para aumentar credibilidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {clientLogos.map((logo, index) => (
            <div key={logo.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <span className="text-sm text-muted-foreground pt-2">{index + 1}.</span>
              <div className="flex-1 grid md:grid-cols-2 gap-3">
                <Input
                  placeholder="Nome da empresa"
                  value={logo.name || ''}
                  onChange={(e) => updateClientLogo(logo.id, 'name', e.target.value)}
                />
                <Input
                  placeholder="URL do logo"
                  value={logo.url}
                  onChange={(e) => updateClientLogo(logo.id, 'url', e.target.value)}
                />
              </div>
              {logo.url && (
                <img src={logo.url} alt={logo.name} className="h-10 w-20 object-contain" />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeClientLogo(logo.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addClientLogo} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cliente
          </Button>
        </CardContent>
      </Card>

      {/* Certificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certificações e Selos
          </CardTitle>
          <CardDescription>
            Adicione certificações, prêmios ou selos de qualidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {certifications.map((cert, index) => (
            <div key={cert.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <span className="text-sm text-muted-foreground pt-2">{index + 1}.</span>
              <div className="flex-1 grid md:grid-cols-2 gap-3">
                <Input
                  placeholder="Nome da certificação"
                  value={cert.name}
                  onChange={(e) => updateCertification(cert.id, 'name', e.target.value)}
                />
                <Input
                  placeholder="URL da imagem/selo"
                  value={cert.url}
                  onChange={(e) => updateCertification(cert.id, 'url', e.target.value)}
                />
              </div>
              {cert.url && (
                <img src={cert.url} alt={cert.name} className="h-10 w-10 object-contain" />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCertification(cert.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addCertification} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Certificação
          </Button>
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
