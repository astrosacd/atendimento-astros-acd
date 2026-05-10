import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Quote, Users } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ProposalSection } from '@/hooks/useProposalSections';
import type { 
  Proposal, 
  CoverContent, 
  TextContent, 
  PricingContent, 
  TimelineContent,
  TermsContent,
  SignatureContent,
  GalleryContent,
  TeamContent,
  TestimonialsContent,
  VideoContent,
  FAQContent,
  BenefitsContent,
  ProcessContent,
  LinksContent,
} from '@/types/proposals';
import { useProposalBranding, type ProposalBranding, type SocialLinks, type ClientLogo, type Certification } from '@/hooks/useProposalBranding';
import { Instagram, Facebook, Linkedin, Twitter, Youtube, Globe, Phone, Mail } from 'lucide-react';

interface ProposalPreviewProps {
  proposal: Proposal;
  sections: ProposalSection[];
  client?: { id: string; nome: string; email: string; numero: string } | null;
  onGalleryView?: (sectionId: string) => void;
  brandingOverride?: ProposalBranding | null;
}

interface BrandingStyles {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl: string | null;
  companyName: string | null;
  tagline: string | null;
  showLogoOnCover: boolean;
  showLogoOnPages: boolean;
  coverBackgroundUrl: string | null;
  footerContact: string | null;
  footerWebsite: string | null;
  footerSocial: SocialLinks;
  clientLogos: ClientLogo[];
  certifications: Certification[];
}

export function ProposalPreview({ proposal, sections, client, onGalleryView, brandingOverride }: ProposalPreviewProps) {
  const visibleSections = sections.filter((s) => s.is_visible);
  const { branding: hookBranding, isLoading: isBrandingLoading } = useProposalBranding();

  // Use override branding (from RPC in public view) or hook branding (for editor)
  const branding = brandingOverride !== undefined ? brandingOverride : hookBranding;

  // Wait for branding to load before rendering to avoid color flash
  if (brandingOverride === undefined && isBrandingLoading) {
    return (
      <div id="proposal-preview" className="max-w-4xl mx-auto">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="py-16 text-center text-muted-foreground">
              Carregando...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = ((proposal as any).currency as 'BRL' | 'USD' | undefined) || 'BRL';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(value);
  };

  // Build branding styles from config
  const brandingStyles: BrandingStyles = {
    primaryColor: branding?.primary_color || '#3B82F6',
    secondaryColor: branding?.secondary_color || '#1E40AF',
    accentColor: branding?.accent_color || '#F59E0B',
    fontFamily: branding?.font_family || 'Inter',
    logoUrl: branding?.logo_url || null,
    companyName: branding?.company_name || null,
    tagline: branding?.tagline || null,
    showLogoOnCover: branding?.show_logo_on_cover ?? true,
    showLogoOnPages: branding?.show_logo_on_pages ?? false,
    coverBackgroundUrl: branding?.cover_background_url || null,
    footerContact: branding?.footer_contact || null,
    footerWebsite: branding?.footer_website || null,
    footerSocial: branding?.footer_social || {},
    clientLogos: branding?.client_logos || [],
    certifications: branding?.certifications || [],
  };

  const hasFooter = brandingStyles.footerContact || brandingStyles.footerWebsite || 
    Object.values(brandingStyles.footerSocial).some(v => v);
  const hasClientLogos = brandingStyles.clientLogos.length > 0;
  const hasCertifications = brandingStyles.certifications.length > 0;

  return (
    <div id="proposal-preview" className="max-w-4xl mx-auto" style={{ fontFamily: brandingStyles.fontFamily }}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {visibleSections.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Nenhuma seção visível para exibir
            </div>
          ) : (
            <div className="divide-y">
              {visibleSections.map((section, index) => (
                <div key={section.id} className="p-4 md:p-8 relative">
                  {/* Show logo on pages if enabled (except cover which has its own) */}
                  {brandingStyles.showLogoOnPages && 
                   brandingStyles.logoUrl && 
                   section.section_type !== 'cover' && 
                   index === 0 && (
                    <div className="absolute top-4 right-4">
                      <img 
                        src={brandingStyles.logoUrl} 
                        alt={brandingStyles.companyName || 'Logo'} 
                        className="h-8 object-contain"
                      />
                    </div>
                  )}
                  {renderSection(section, formatCurrency, client, onGalleryView, brandingStyles, proposal)}
                </div>
              ))}
              
              {/* Client Logos Section */}
              {hasClientLogos && (
                <div className="p-4 md:p-8 border-t">
                  <ClientLogosSection logos={brandingStyles.clientLogos} branding={brandingStyles} />
                </div>
              )}
              
              {/* Certifications Section */}
              {hasCertifications && (
                <div className="p-4 md:p-8 border-t">
                  <CertificationsSection certifications={brandingStyles.certifications} branding={brandingStyles} />
                </div>
              )}
              
              {/* Footer */}
              {hasFooter && (
                <div className="p-4 md:p-8 border-t bg-muted/30">
                  <FooterSection branding={brandingStyles} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function renderSection(
  section: ProposalSection,
  formatCurrency: (value: number) => string,
  client?: { id: string; nome: string; email: string; numero: string } | null,
  onGalleryView?: (sectionId: string) => void,
  branding?: BrandingStyles,
  proposal?: Proposal
) {
  const type = section.section_type;

  switch (type) {
    case 'cover':
      return <CoverPreview content={section.content as unknown as CoverContent} branding={branding} />;
    case 'text':
      return <TextPreview content={section.content as unknown as TextContent} title={section.title} branding={branding} />;
    case 'pricing':
      return <PricingPreview content={section.content as unknown as PricingContent} title={section.title} formatCurrency={formatCurrency} branding={branding} />;
    case 'timeline':
      return <TimelinePreview content={section.content as unknown as TimelineContent} title={section.title} branding={branding} />;
    case 'team':
      return <TeamPreview content={section.content as unknown as TeamContent} title={section.title} />;
    case 'testimonials':
      return <TestimonialsPreview content={section.content as unknown as TestimonialsContent} title={section.title} branding={branding} />;
    case 'gallery':
      return <GalleryPreview content={section.content as unknown as GalleryContent} title={section.title} sectionId={section.id} onView={onGalleryView} branding={branding} />;
    case 'terms':
      return <TermsPreview content={section.content as unknown as TermsContent} title={section.title} branding={branding} />;
    case 'signature':
      return <SignaturePreview content={section.content as unknown as SignatureContent} client={client} branding={branding} proposal={proposal} />;
    case 'video':
      return <VideoPreview content={section.content as unknown as VideoContent} title={section.title} branding={branding} />;
    case 'faq':
      return <FAQPreview content={section.content as unknown as FAQContent} title={section.title} branding={branding} />;
    case 'benefits':
      return <BenefitsPreview content={section.content as unknown as BenefitsContent} title={section.title} branding={branding} />;
    case 'process':
      return <ProcessPreview content={section.content as unknown as ProcessContent} title={section.title} branding={branding} />;
    case 'links':
      return <LinksPreview content={section.content as unknown as LinksContent} title={section.title} branding={branding} />;
    default:
      return (
        <div className="text-center text-muted-foreground">
          Seção "{type}" não suportada
        </div>
      );
  }
}

function CoverPreview({ content, branding }: { content: CoverContent; branding?: BrandingStyles }) {
  return (
    <div
      className="min-h-[200px] md:min-h-[300px] flex flex-col justify-center items-center text-center p-4 md:p-8 rounded-lg"
      style={{
        background: content.backgroundImage 
          ? undefined 
          : `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}15, ${branding?.secondaryColor || '#1E40AF'}10)`,
        backgroundImage: content.backgroundImage ? `url(${content.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {branding?.showLogoOnCover && branding?.logoUrl && (
        <img 
          src={branding.logoUrl} 
          alt={branding.companyName || 'Logo'} 
          className="h-10 md:h-16 object-contain mb-4 md:mb-6"
        />
      )}
      <h1 
        className="text-2xl md:text-4xl font-bold mb-2 md:mb-4"
        style={{ color: branding?.primaryColor }}
      >
        {content.title || 'Proposta Comercial'}
      </h1>
      {content.subtitle && (
        <p 
          className="text-base md:text-xl"
          style={{ color: branding?.secondaryColor }}
        >
          {content.subtitle}
        </p>
      )}
      {branding?.companyName && !branding?.logoUrl && (
        <p className="mt-4 md:mt-6 text-sm text-muted-foreground">{branding.companyName}</p>
      )}
    </div>
  );
}

// Títulos genéricos que não devem ser exibidos na preview
const GENERIC_TITLES = ['texto', 'termos', 'preços', 'cronograma', 'equipe', 'depoimentos', 'galeria', 'assinatura', 'vídeo', 'capa'];

function isGenericTitle(title: string | null): boolean {
  if (!title) return true;
  return GENERIC_TITLES.includes(title.toLowerCase().trim());
}

function TextPreview({ content, title, branding }: { content: TextContent; title: string | null; branding?: BrandingStyles }) {
  const showTitle = title && !isGenericTitle(title);
  
  return (
    <div>
      {showTitle && (
        <h2 
          className="text-2xl font-semibold mb-4"
          style={{ color: branding?.primaryColor }}
        >
          {title}
        </h2>
      )}
      <MarkdownRenderer content={content.content || ''} />
    </div>
  );
}

function PricingPreview({
  content,
  title,
  formatCurrency,
  branding,
}: {
  content: PricingContent;
  title: string | null;
  formatCurrency: (value: number) => string;
  branding?: BrandingStyles;
}) {
  const items = content.items || [];
  const total = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  return (
    <div>
      {title && (
        <h2 
          className="text-xl md:text-2xl font-semibold mb-4 md:mb-6"
          style={{ color: branding?.primaryColor }}
        >
          {title}
        </h2>
      )}
      {/* Desktop table */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead style={{ backgroundColor: `${branding?.primaryColor || '#3B82F6'}10` }}>
            <tr>
              <th className="text-left py-3 px-4 font-medium">Descrição</th>
              <th className="text-center py-3 px-4 font-medium w-20">Qtd</th>
              <th className="text-right py-3 px-4 font-medium w-32">Valor Unit.</th>
              <th className="text-right py-3 px-4 font-medium w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 px-4">{item.description}</td>
                <td className="py-3 px-4 text-center">{item.quantity}</td>
                <td className="py-3 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="py-3 px-4 text-right font-medium">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot style={{ backgroundColor: `${branding?.accentColor || '#F59E0B'}10` }}>
            <tr>
              <td colSpan={3} className="py-4 px-4 text-right font-semibold">Total:</td>
              <td className="py-4 px-4 text-right font-bold text-lg" style={{ color: branding?.accentColor }}>
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-3 space-y-1">
            <p className="font-medium text-sm">{item.description}</p>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{item.quantity}x {formatCurrency(item.unitPrice)}</span>
              <span className="font-medium text-foreground">{formatCurrency(item.quantity * item.unitPrice)}</span>
            </div>
          </div>
        ))}
        <div 
          className="rounded-lg p-3 flex justify-between items-center"
          style={{ backgroundColor: `${branding?.accentColor || '#F59E0B'}10` }}
        >
          <span className="font-semibold">Total:</span>
          <span className="font-bold text-lg" style={{ color: branding?.accentColor }}>
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimelinePreview({ content, title, branding }: { content: TimelineContent; title: string | null; branding?: BrandingStyles }) {
  const items = content.items || [];

  return (
    <div>
      {title && (
        <h2 
          className="text-2xl font-semibold mb-6"
          style={{ color: branding?.primaryColor }}
        >
          {title}
        </h2>
      )}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div 
                className="w-8 h-8 rounded-full text-white flex items-center justify-center font-semibold"
                style={{ backgroundColor: branding?.primaryColor || '#3B82F6' }}
              >
                {index + 1}
              </div>
              {index < items.length - 1 && <div className="w-0.5 flex-1 bg-border my-1" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="font-semibold">{item.phase}</h3>
                {item.duration && (
                  <span className="text-sm text-muted-foreground">({item.duration})</span>
                )}
              </div>
              {item.description && <p className="text-muted-foreground">{item.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TermsPreview({ content, title, branding }: { content: TermsContent; title: string | null; branding?: BrandingStyles }) {
  const showTitle = title && !isGenericTitle(title);
  
  return (
    <div>
      {showTitle && (
        <h2 
          className="text-2xl font-semibold mb-4"
          style={{ color: branding?.primaryColor }}
        >
          {title}
        </h2>
      )}
      <MarkdownRenderer content={content.content || ''} className="prose-sm" />
    </div>
  );
}

function GalleryPreview({ 
  content, 
  title, 
  sectionId,
  onView,
  branding,
}: { 
  content: GalleryContent; 
  title: string | null;
  sectionId?: string;
  onView?: (sectionId: string) => void;
  branding?: BrandingStyles;
}) {
  const images = content.images || [];

  const handleInteraction = () => {
    if (sectionId && onView) {
      onView(sectionId);
    }
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma imagem na galeria
      </div>
    );
  }

  return (
    <div onMouseEnter={handleInteraction} onTouchStart={handleInteraction}>
      {title && (
        <h2 
          className="text-2xl font-semibold mb-6"
          style={{ color: branding?.primaryColor }}
        >
          {title}
        </h2>
      )}
      <Carousel className="w-full">
        <CarouselContent>
          {images.map((image) => (
            <CarouselItem key={image.id} className="md:basis-1/2 lg:basis-1/3">
              <div className="p-1">
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={image.url}
                    alt={image.caption || 'Imagem da galeria'}
                    className="w-full h-full object-cover"
                  />
                </div>
                {image.caption && (
                  <p className="text-sm text-muted-foreground text-center mt-2">{image.caption}</p>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-4" />
        <CarouselNext className="-right-4" />
      </Carousel>
    </div>
  );
}

function TeamPreview({ content, title }: { content: TeamContent; title: string | null }) {
  const members = content.members || [];

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum membro da equipe
      </div>
    );
  }

  return (
    <div>
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {members.map((member) => (
          <div key={member.id} className="text-center">
            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-muted mb-3">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
            </div>
            <h4 className="font-medium">{member.name || 'Nome'}</h4>
            <p className="text-sm text-muted-foreground">{member.role || 'Cargo'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestimonialsPreview({ content, title, branding }: { content: TestimonialsContent; title: string | null; branding?: BrandingStyles }) {
  const items = content.items || [];

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum depoimento
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h2 
          className="text-2xl font-semibold mb-6"
          style={{ color: branding?.primaryColor }}
        >
          {title}
        </h2>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-muted/30 rounded-lg p-6 relative">
            <Quote 
              className="h-8 w-8 absolute top-4 right-4" 
              style={{ color: `${branding?.primaryColor || '#3B82F6'}30` }}
            />
            <p className="text-muted-foreground mb-4 italic">"{item.content}"</p>
            <div>
              <p className="font-medium">{item.author}</p>
              {item.company && <p className="text-sm text-muted-foreground">{item.company}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignaturePreview({
  content,
  client,
  branding,
  proposal,
}: {
  content: SignatureContent;
  client?: { id: string; nome: string; email: string; numero: string } | null;
  branding?: BrandingStyles;
  proposal?: Proposal;
}) {
  const isAccepted = proposal?.status === 'accepted';
  const clientSignatureImage = proposal?.client_signature || proposal?.signature_image || null;
  const clientSignedName = proposal?.signed_name || null;

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Assinatura do Responsável */}
      <div className="space-y-4">
        <h3 
          className="font-semibold text-lg"
          style={{ color: branding?.primaryColor }}
        >
          Responsável
        </h3>
        <div className="border rounded-lg p-4 bg-muted/20">
          {content.signerSignature ? (
            <div className="bg-white rounded p-2">
              <img
                src={content.signerSignature}
                alt="Assinatura"
                className="h-24 object-contain"
              />
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-muted-foreground border-b border-dashed">
              Assinatura pendente
            </div>
          )}
          <div className="mt-4 pt-2 border-t">
            <p className="font-medium">{content.signerName || 'Nome não informado'}</p>
            <p className="text-sm text-muted-foreground">{content.signerRole || 'Cargo não informado'}</p>
          </div>
        </div>
      </div>

      {/* Assinatura do Cliente */}
      <div className="space-y-4">
        <h3 
          className="font-semibold text-lg"
          style={{ color: branding?.primaryColor }}
        >
          Cliente
        </h3>
        <div className="border rounded-lg p-4 bg-muted/20">
          {isAccepted && clientSignatureImage ? (
            <div className="bg-white rounded p-2">
              <img
                src={clientSignatureImage}
                alt="Assinatura do cliente"
                className="h-24 object-contain"
              />
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-muted-foreground border-b border-dashed">
              {isAccepted ? 'Assinatura registrada' : 'Aguardando assinatura'}
            </div>
          )}
          <div className="mt-4 pt-2 border-t">
            <p className="font-medium">
              {isAccepted && clientSignedName 
                ? clientSignedName 
                : (client?.nome || proposal?.manual_client_name || 'Cliente não selecionado')}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAccepted && proposal?.signed_at 
                ? `Assinado em ${new Date(proposal.signed_at).toLocaleDateString('pt-BR')}`
                : (client?.email || '')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoPreview({ content, title, branding }: { content: VideoContent; title: string | null; branding?: BrandingStyles }) {
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    return null;
  };

  const embedUrl = getEmbedUrl(content.url || '');

  if (!embedUrl) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum vídeo configurado
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h2 
          className="text-2xl font-semibold mb-6"
          style={{ color: branding?.primaryColor }}
        >
          {title}
        </h2>
      )}
      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title || 'Video'}
        />
      </div>
      {content.caption && (
        <p className="text-sm text-muted-foreground text-center mt-3">{content.caption}</p>
      )}
    </div>
  );
}

// Client Logos Section
function ClientLogosSection({ logos, branding }: { logos: ClientLogo[]; branding: BrandingStyles }) {
  if (logos.length === 0) return null;

  return (
    <div className="text-center">
      <h3 
        className="text-lg font-semibold mb-6"
        style={{ color: branding.primaryColor }}
      >
        Empresas que Confiam em Nós
      </h3>
      <div className="flex flex-wrap items-center justify-center gap-8">
        {logos.map((logo) => (
          <div key={logo.id} className="flex flex-col items-center">
            {logo.url && (
              <img
                src={logo.url}
                alt={logo.name || 'Cliente'}
                className="h-12 max-w-32 object-contain grayscale hover:grayscale-0 transition-all"
              />
            )}
            {logo.name && (
              <span className="text-xs text-muted-foreground mt-2">{logo.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Certifications Section
function CertificationsSection({ certifications, branding }: { certifications: Certification[]; branding: BrandingStyles }) {
  if (certifications.length === 0) return null;

  return (
    <div className="text-center">
      <h3 
        className="text-lg font-semibold mb-6"
        style={{ color: branding.primaryColor }}
      >
        Certificações e Reconhecimentos
      </h3>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {certifications.map((cert) => (
          <div key={cert.id} className="flex flex-col items-center">
            {cert.url && (
              <img
                src={cert.url}
                alt={cert.name || 'Certificação'}
                className="h-16 w-16 object-contain"
              />
            )}
            {cert.name && (
              <span className="text-xs text-muted-foreground mt-2 max-w-24 text-center">{cert.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Footer Section
function FooterSection({ branding }: { branding: BrandingStyles }) {
  const { footerContact, footerWebsite, footerSocial, companyName, logoUrl, primaryColor } = branding;
  
  const socialIcons: { key: keyof SocialLinks; Icon: any; color: string }[] = [
    { key: 'instagram', Icon: Instagram, color: '#E4405F' },
    { key: 'facebook', Icon: Facebook, color: '#1877F2' },
    { key: 'linkedin', Icon: Linkedin, color: '#0A66C2' },
    { key: 'twitter', Icon: Twitter, color: '#1DA1F2' },
    { key: 'youtube', Icon: Youtube, color: '#FF0000' },
  ];

  return (
    <div className="text-center space-y-4">
      {/* Logo and Company Name */}
      {(logoUrl || companyName) && (
        <div className="flex items-center justify-center gap-3 mb-4">
          {logoUrl && (
            <img src={logoUrl} alt={companyName || 'Logo'} className="h-8 object-contain" />
          )}
          {companyName && (
            <span className="font-semibold" style={{ color: primaryColor }}>{companyName}</span>
          )}
        </div>
      )}
      
      {/* Contact Info */}
      {footerContact && (
        <div className="text-sm text-muted-foreground whitespace-pre-line">
          {footerContact}
        </div>
      )}
      
      {/* Website */}
      {footerWebsite && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Globe className="h-4 w-4" style={{ color: primaryColor }} />
          <a 
            href={footerWebsite.startsWith('http') ? footerWebsite : `https://${footerWebsite}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: primaryColor }}
          >
            {footerWebsite}
          </a>
        </div>
      )}
      
      {/* Social Links */}
      {Object.values(footerSocial).some(v => v) && (
        <div className="flex items-center justify-center gap-4 pt-2">
          {socialIcons.map(({ key, Icon, color }) => {
            const value = footerSocial[key];
            if (!value) return null;
            return (
              <a
                key={key}
                href={value.startsWith('http') ? value : `https://${key}.com/${value.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FAQPreview({ content, title, branding }: { content: FAQContent; title: string | null; branding?: BrandingStyles }) {
  const items = content.items || [];
  return (
    <div>
      {title && <h2 className="text-xl font-bold mb-4" style={{ color: branding?.primaryColor }}>{title}</h2>}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 bg-muted/20">
            <h3 className="font-semibold mb-2">{item.question}</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BenefitsPreview({ content, title, branding }: { content: BenefitsContent; title: string | null; branding?: BrandingStyles }) {
  const items = content.items || [];
  return (
    <div>
      {title && <h2 className="text-xl font-bold mb-6" style={{ color: branding?.primaryColor }}>{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcessPreview({ content, title, branding }: { content: ProcessContent; title: string | null; branding?: BrandingStyles }) {
  const steps = content.steps || [];
  return (
    <div>
      {title && <h2 className="text-xl font-bold mb-6" style={{ color: branding?.primaryColor }}>{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, index) => (
          <div key={step.id} className="relative">
            <div className="text-4xl font-black opacity-10 absolute -top-4 -left-2" style={{ color: branding?.primaryColor }}>
              {index + 1}
            </div>
            <div className="relative z-10">
              <h3 className="font-bold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinksPreview({ content, title, branding }: { content: LinksContent; title: string | null; branding?: BrandingStyles }) {
  const items = content.items || [];
  return (
    <div>
      {title && <h2 className="text-xl font-bold mb-4" style={{ color: branding?.primaryColor }}>{title}</h2>}
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: branding?.primaryColor }}
          >
            <ExternalLink className="h-4 w-4" />
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
