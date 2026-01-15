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
} from '@/types/proposals';

interface ProposalPreviewProps {
  proposal: Proposal;
  sections: ProposalSection[];
  client?: { id: string; nome: string; email: string; numero: string } | null;
}

export function ProposalPreview({ proposal, sections, client }: ProposalPreviewProps) {
  const visibleSections = sections.filter((s) => s.is_visible);

  const currency = ((proposal as any).currency as 'BRL' | 'USD' | undefined) || 'BRL';

  const formatCurrency = (value: number) => {
    // pt-BR shows BRL as "R$" and USD as "US$" (more familiar for BR audience)
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(value);
  };

  return (
    <div id="proposal-preview" className="max-w-4xl mx-auto">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {visibleSections.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Nenhuma seção visível para exibir
            </div>
          ) : (
            <div className="divide-y">
              {visibleSections.map((section) => (
                <div key={section.id} className="p-8">
                  {renderSection(section, formatCurrency, client)}
                </div>
              ))}
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
  client?: { id: string; nome: string; email: string; numero: string } | null
) {
  const type = section.section_type;

  switch (type) {
    case 'cover':
      return <CoverPreview content={section.content as unknown as CoverContent} />;
    case 'text':
      return <TextPreview content={section.content as unknown as TextContent} title={section.title} />;
    case 'pricing':
      return <PricingPreview content={section.content as unknown as PricingContent} title={section.title} formatCurrency={formatCurrency} />;
    case 'timeline':
      return <TimelinePreview content={section.content as unknown as TimelineContent} title={section.title} />;
    case 'team':
      return <TeamPreview content={section.content as unknown as TeamContent} title={section.title} />;
    case 'testimonials':
      return <TestimonialsPreview content={section.content as unknown as TestimonialsContent} title={section.title} />;
    case 'gallery':
      return <GalleryPreview content={section.content as unknown as GalleryContent} title={section.title} />;
    case 'terms':
      return <TermsPreview content={section.content as unknown as TermsContent} title={section.title} />;
    case 'signature':
      return <SignaturePreview content={section.content as unknown as SignatureContent} client={client} />;
    default:
      return (
        <div className="text-center text-muted-foreground">
          Seção "{type}" não suportada
        </div>
      );
  }
}

function CoverPreview({ content }: { content: CoverContent }) {
  return (
    <div
      className="min-h-[300px] flex flex-col justify-center items-center text-center p-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5"
      style={
        content.backgroundImage
          ? {
              backgroundImage: `url(${content.backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <h1 className="text-4xl font-bold mb-4">{content.title || 'Proposta Comercial'}</h1>
      {content.subtitle && <p className="text-xl text-muted-foreground">{content.subtitle}</p>}
    </div>
  );
}

function TextPreview({ content, title }: { content: TextContent; title: string | null }) {
  return (
    <div>
      {title && <h2 className="text-2xl font-semibold mb-4">{title}</h2>}
      <div className="prose prose-neutral max-w-none">
        {content.content?.split('\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

function PricingPreview({
  content,
  title,
  formatCurrency,
}: {
  content: PricingContent;
  title: string | null;
  formatCurrency: (value: number) => string;
}) {
  const items = content.items || [];
  const total = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  return (
    <div>
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
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
          <tfoot className="bg-primary/5">
            <tr>
              <td colSpan={3} className="py-4 px-4 text-right font-semibold">
                Total:
              </td>
              <td className="py-4 px-4 text-right font-bold text-lg text-primary">
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TimelinePreview({ content, title }: { content: TimelineContent; title: string | null }) {
  const items = content.items || [];

  return (
    <div>
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
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

function TermsPreview({ content, title }: { content: TermsContent; title: string | null }) {
  return (
    <div>
      {title && <h2 className="text-2xl font-semibold mb-4">{title}</h2>}
      <div className="prose prose-neutral prose-sm max-w-none">
        {content.content?.split('\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

function GalleryPreview({ content, title }: { content: GalleryContent; title: string | null }) {
  const images = content.images || [];

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma imagem na galeria
      </div>
    );
  }

  return (
    <div>
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
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

function TestimonialsPreview({ content, title }: { content: TestimonialsContent; title: string | null }) {
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
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-muted/30 rounded-lg p-6 relative">
            <Quote className="h-8 w-8 text-primary/20 absolute top-4 right-4" />
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
}: {
  content: SignatureContent;
  client?: { id: string; nome: string; email: string; numero: string } | null;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Assinatura do Responsável */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Responsável</h3>
        <div className="border rounded-lg p-4 bg-muted/20">
          {content.signerSignature ? (
            <img
              src={content.signerSignature}
              alt="Assinatura"
              className="h-24 object-contain"
            />
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
        <h3 className="font-semibold text-lg">Cliente</h3>
        <div className="border rounded-lg p-4 bg-muted/20">
          <div className="h-24 flex items-center justify-center text-muted-foreground border-b border-dashed">
            Aguardando assinatura
          </div>
          <div className="mt-4 pt-2 border-t">
            <p className="font-medium">{client?.nome || 'Cliente não selecionado'}</p>
            <p className="text-sm text-muted-foreground">{client?.email || ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
