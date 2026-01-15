import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  GripVertical,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  X,
  Layout,
  Type,
  DollarSign,
  Calendar,
  Users,
  MessageSquare,
  Image,
  FileText,
  PenTool,
} from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';
import { ImageUploadInput } from './ImageUploadInput';
import type { ProposalSection, SectionType } from '@/hooks/useProposalSections';
import type { 
  CoverContent,
  TextContent,
  PricingContent,
  PricingItem,
  TimelineContent,
  TimelinePhase,
  TermsContent,
  SignatureContent,
} from '@/types/proposals';

const sectionIcons: Record<SectionType, React.ReactNode> = {
  cover: <Layout className="h-4 w-4" />,
  text: <Type className="h-4 w-4" />,
  pricing: <DollarSign className="h-4 w-4" />,
  timeline: <Calendar className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
  testimonials: <MessageSquare className="h-4 w-4" />,
  gallery: <Image className="h-4 w-4" />,
  terms: <FileText className="h-4 w-4" />,
  signature: <PenTool className="h-4 w-4" />,
};

const sectionLabels: Record<SectionType, string> = {
  cover: 'Capa',
  text: 'Texto',
  pricing: 'Preços',
  timeline: 'Cronograma',
  team: 'Equipe',
  testimonials: 'Depoimentos',
  gallery: 'Galeria',
  terms: 'Termos',
  signature: 'Assinatura',
};

interface SectionEditorProps {
  section: ProposalSection;
  onUpdate: (updates: Partial<ProposalSection>) => void;
  onDelete: () => void;
  canEdit: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function SectionEditor({
  section,
  onUpdate,
  onDelete,
  canEdit,
  dragHandleProps,
}: SectionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const sectionType = section.section_type as SectionType;

  const updateContent = (updates: Record<string, unknown>) => {
    onUpdate({
      content: { ...section.content, ...updates },
    });
  };

  const renderContent = () => {
    switch (sectionType) {
      case 'cover':
        return <CoverEditor content={section.content as unknown as CoverContent} onChange={updateContent} disabled={!canEdit} />;
      case 'text':
        return <TextEditor content={section.content as unknown as TextContent} onChange={updateContent} disabled={!canEdit} />;
      case 'pricing':
        return <PricingEditor content={section.content as unknown as PricingContent} onChange={updateContent} disabled={!canEdit} />;
      case 'timeline':
        return <TimelineEditor content={section.content as unknown as TimelineContent} onChange={updateContent} disabled={!canEdit} />;
      case 'terms':
        return <TermsEditor content={section.content as unknown as TermsContent} onChange={updateContent} disabled={!canEdit} />;
      case 'signature':
        return <SignatureEditor content={section.content as unknown as SignatureContent} onChange={updateContent} disabled={!canEdit} />;
      default:
        return (
          <div className="text-center py-4 text-muted-foreground">
            Editor para "{sectionType}" em desenvolvimento
          </div>
        );
    }
  };

  return (
    <Card className="relative">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          {canEdit && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="flex items-center gap-2 flex-1">
            {sectionIcons[sectionType]}
            <span className="font-medium text-sm">{sectionLabels[sectionType]}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onUpdate({ is_visible: !section.is_visible })}
              disabled={!canEdit}
            >
              {section.is_visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4 border-t">
          <div className="pt-4">{renderContent()}</div>
        </CardContent>
      )}
    </Card>
  );
}

// Editores específicos por tipo

function CoverEditor({
  content,
  onChange,
  disabled,
}: {
  content: CoverContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Título da Proposta</Label>
        <Input
          value={content.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Digite o título..."
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label>Subtítulo</Label>
        <Input
          value={content.subtitle || ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Digite o subtítulo..."
          disabled={disabled}
        />
      </div>
      <ImageUploadInput
        value={content.backgroundImage || ''}
        onChange={(url) => onChange({ backgroundImage: url })}
        disabled={disabled}
        label="Imagem de Fundo"
      />
    </div>
  );
}

function TextEditor({
  content,
  onChange,
  disabled,
}: {
  content: TextContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Conteúdo</Label>
      <Textarea
        value={content.content || ''}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Digite o conteúdo..."
        rows={6}
        disabled={disabled}
      />
    </div>
  );
}

function PricingEditor({
  content,
  onChange,
  disabled,
}: {
  content: PricingContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const items = content.items || [];

  const addItem = () => {
    onChange({
      items: [
        ...items,
        { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
      ],
    });
  };

  const updateItem = (id: string, updates: Partial<PricingItem>) => {
    onChange({
      items: items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    });
  };

  const removeItem = (id: string) => {
    onChange({ items: items.filter((item) => item.id !== id) });
  };

  const total = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-5">
            {index === 0 && <Label className="mb-2 block">Descrição</Label>}
            <Input
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              placeholder="Descrição do item"
              disabled={disabled}
            />
          </div>
          <div className="col-span-2">
            {index === 0 && <Label className="mb-2 block">Qtd</Label>}
            <Input
              type="number"
              min="0"
              value={item.quantity}
              onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
              disabled={disabled}
            />
          </div>
          <div className="col-span-3">
            {index === 0 && <Label className="mb-2 block">Valor Unit.</Label>}
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
              disabled={disabled}
            />
          </div>
          <div className="col-span-2 flex justify-end">
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeItem(item.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {!disabled && (
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Item
        </Button>
      )}

      {items.length > 0 && (
        <div className="pt-4 border-t flex justify-end">
          <div className="text-right">
            <span className="text-sm text-muted-foreground">Total: </span>
            <span className="font-bold text-lg">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineEditor({
  content,
  onChange,
  disabled,
}: {
  content: TimelineContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const items = content.items || [];

  const addItem = () => {
    onChange({
      items: [
        ...items,
        { id: crypto.randomUUID(), phase: '', duration: '', description: '' },
      ],
    });
  };

  const updateItem = (id: string, updates: Partial<TimelinePhase>) => {
    onChange({
      items: items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    });
  };

  const removeItem = (id: string) => {
    onChange({ items: items.filter((item) => item.id !== id) });
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-3">
            {index === 0 && <Label className="mb-2 block">Fase</Label>}
            <Input
              value={item.phase}
              onChange={(e) => updateItem(item.id, { phase: e.target.value })}
              placeholder="Nome da fase"
              disabled={disabled}
            />
          </div>
          <div className="col-span-2">
            {index === 0 && <Label className="mb-2 block">Duração</Label>}
            <Input
              value={item.duration}
              onChange={(e) => updateItem(item.id, { duration: e.target.value })}
              placeholder="Ex: 2 semanas"
              disabled={disabled}
            />
          </div>
          <div className="col-span-5">
            {index === 0 && <Label className="mb-2 block">Descrição</Label>}
            <Input
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              placeholder="Descrição da fase"
              disabled={disabled}
            />
          </div>
          <div className="col-span-2 flex justify-end">
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeItem(item.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {!disabled && (
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Fase
        </Button>
      )}
    </div>
  );
}

function TermsEditor({
  content,
  onChange,
  disabled,
}: {
  content: TermsContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Termos e Condições</Label>
      <Textarea
        value={content.content || ''}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Digite os termos e condições..."
        rows={8}
        disabled={disabled}
      />
    </div>
  );
}

function SignatureEditor({
  content,
  onChange,
  disabled,
}: {
  content: SignatureContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome do Responsável</Label>
          <Input
            value={content.signerName || ''}
            onChange={(e) => onChange({ signerName: e.target.value })}
            placeholder="Nome completo"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Cargo</Label>
          <Input
            value={content.signerRole || ''}
            onChange={(e) => onChange({ signerRole: e.target.value })}
            placeholder="Cargo ou função"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Assinatura do Responsável</Label>
        <SignatureCanvas
          signature={content.signerSignature || ''}
          onChange={(signature) => onChange({ signerSignature: signature })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
