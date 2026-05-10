import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DebouncedInput, DebouncedTextarea } from './DebouncedInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  Video,
  Sparkles,
  Loader2,
  Mic,
  HelpCircle,
  Star,
  Workflow,
  ExternalLink,
} from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';
import { ImageUploadInput } from './ImageUploadInput';
import { GalleryEditor } from './GalleryEditor';
import { TeamEditor } from './TeamEditor';
import { TestimonialsEditor } from './TestimonialsEditor';
import { markdownHint } from './MarkdownRenderer';
import { AudioRecorder } from './AudioRecorder';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  TeamContent,
  TestimonialsContent,
  GalleryContent,
  VideoContent,
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
  video: <Video className="h-4 w-4" />,
  faq: <HelpCircle className="h-4 w-4" />,
  benefits: <Star className="h-4 w-4" />,
  process: <Workflow className="h-4 w-4" />,
  links: <ExternalLink className="h-4 w-4" />,
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
  video: 'Vídeo',
  faq: 'FAQ',
  benefits: 'Diferenciais',
  process: 'Processo',
  links: 'Links',
};

function AIPromptDialog({ 
  onConfirm, 
  isProcessing, 
  title = "Instruções para a IA",
  buttonLabel = "Gerar com IA"
}: { 
  onConfirm: (text: string) => void, 
  isProcessing: boolean,
  title?: string,
  buttonLabel?: string
}) {
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Texto</TabsTrigger>
            <TabsTrigger value="audio">Voz</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="space-y-4 pt-4">
            <Textarea 
              placeholder="Descreva o que deseja nesta seção..." 
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
            />
            <Button 
              className="w-full" 
              onClick={() => {
                onConfirm(text);
                setIsOpen(false);
                setText('');
              }}
              disabled={isProcessing || !text.trim()}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar agora
            </Button>
          </TabsContent>
          <TabsContent value="audio" className="pt-4">
            <AudioRecorder 
              onRecordingComplete={(transcribed) => {
                onConfirm(transcribed);
                setIsOpen(false);
              }} 
              isProcessing={isProcessing} 
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface SectionEditorProps {
  section: ProposalSection;
  onUpdate: (updates: Partial<ProposalSection>) => void;
  onDelete: () => void;
  canEdit: boolean;
  currency?: 'BRL' | 'USD';
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function SectionEditor({
  section,
  onUpdate,
  onDelete,
  canEdit,
  currency = 'BRL',
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
        return (
          <PricingEditor
            content={section.content as unknown as PricingContent}
            onChange={updateContent}
            disabled={!canEdit}
            currency={currency}
          />
        );
      case 'timeline':
        return <TimelineEditor content={section.content as unknown as TimelineContent} onChange={updateContent} disabled={!canEdit} />;
      case 'team':
        return <TeamEditor content={section.content as unknown as TeamContent} onChange={updateContent} disabled={!canEdit} />;
      case 'testimonials':
        return <TestimonialsEditor content={section.content as unknown as TestimonialsContent} onChange={updateContent} disabled={!canEdit} />;
      case 'gallery':
        return <GalleryEditor content={section.content as unknown as GalleryContent} onChange={updateContent} disabled={!canEdit} />;
      case 'terms':
        return <TermsEditor content={section.content as unknown as TermsContent} onChange={updateContent} disabled={!canEdit} />;
      case 'signature':
        return <SignatureEditor content={section.content as unknown as SignatureContent} onChange={updateContent} disabled={!canEdit} />;
      case 'video':
        return <VideoEditor content={section.content as unknown as VideoContent} onChange={updateContent} disabled={!canEdit} />;
      case 'faq':
        return <FAQEditor content={section.content as unknown as FAQContent} onChange={updateContent} disabled={!canEdit} />;
      case 'benefits':
        return <BenefitsEditor content={section.content as unknown as BenefitsContent} onChange={updateContent} disabled={!canEdit} />;
      case 'process':
        return <ProcessEditor content={section.content as unknown as ProcessContent} onChange={updateContent} disabled={!canEdit} />;
      case 'links':
        return <LinksEditor content={section.content as unknown as LinksContent} onChange={updateContent} disabled={!canEdit} />;
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
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0 flex items-center gap-2">
              {sectionIcons[sectionType]}
              <span className="font-medium text-sm">{sectionLabels[sectionType]}</span>
            </div>

            <div className="min-w-0 flex-1">
              <DebouncedInput
                value={section.title ?? ''}
                onChange={(value) => {
                  const cleaned = value.trim();
                  onUpdate({ title: cleaned.length ? value : null });
                }}
                placeholder="Digite o título da seção (ex: Sobre nós, O que inclui...)"
                disabled={!canEdit}
              />
            </div>
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

function CoverEditor({
  content,
  onChange,
  disabled,
}: {
  content: CoverContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIAudio = async (transcribedText: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('proposal-ai', {
        body: {
          action: 'generate',
          sectionType: 'cover',
          context: transcribedText,
          currentContent: `Título atual: ${content.title || ''}, Subtítulo atual: ${content.subtitle || ''}`,
        },
      });

      if (error) throw error;
      if (data?.text) {
        const lines = data.text.split('\n').filter((l: string) => l.trim().length > 0);
        const title = lines[0]?.replace(/^Título:\s*/i, '') || content.title;
        const subtitle = lines[1]?.replace(/^Subtítulo:\s*/i, '') || lines.slice(1).join(' ') || content.subtitle;
        
        onChange({ title, subtitle });
        toast.success('Capa gerada!');
      }
    } catch (error) {
      console.error('AI error:', error);
      toast.error('Erro ao gerar capa.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Título da Proposta</Label>
        {!disabled && (
          <AIPromptDialog onConfirm={handleAIAudio} isProcessing={isGenerating} title="Gerar Capa com IA" />
        )}
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <DebouncedInput
            value={content.title || ''}
            onChange={(value) => onChange({ title: value })}
            placeholder="Digite o título..."
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Subtítulo</Label>
          <DebouncedInput
            value={content.subtitle || ''}
            onChange={(value) => onChange({ subtitle: value })}
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
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIGenerate = async (action: 'generate' | 'improve', transcribedText?: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('proposal-ai', {
        body: {
          action,
          sectionType: 'text',
          currentContent: content.content || '',
          context: transcribedText || '',
        },
      });

      if (error) throw error;
      if (data?.text) {
        onChange({ content: data.text });
        toast.success(transcribedText ? 'Texto gerado via voz!' : (action === 'generate' ? 'Texto gerado!' : 'Texto melhorado!'));
      }
    } catch (error) {
      console.error('AI error:', error);
      toast.error('Erro ao processar com IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Conteúdo</Label>
        {!disabled && (
          <div className="flex gap-1">
            <AIPromptDialog 
              onConfirm={(text) => handleAIGenerate('generate', text)} 
              isProcessing={isGenerating} 
              title="Gerar texto com IA"
            />
            {content.content && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAIGenerate('improve')}
                disabled={isGenerating}
                className="text-xs h-7"
              >
                {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Melhorar
              </Button>
            )}
          </div>
        )}
      </div>
      <DebouncedTextarea
        value={content.content || ''}
        onChange={(value) => onChange({ content: value })}
        placeholder="Digite o conteúdo ou use a IA para gerar..."
        rows={6}
        disabled={disabled || isGenerating}
      />
      <p className="text-xs text-muted-foreground">{markdownHint}</p>
    </div>
  );
}

function PricingEditor({
  content,
  onChange,
  disabled,
  currency,
}: {
  content: PricingContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
  currency: 'BRL' | 'USD';
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
            <DebouncedInput
              value={item.description}
              onChange={(value) => updateItem(item.id, { description: value })}
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
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(total)}
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
            <DebouncedInput
              value={item.phase}
              onChange={(value) => updateItem(item.id, { phase: value })}
              placeholder="Nome da fase"
              disabled={disabled}
            />
          </div>
          <div className="col-span-2">
            {index === 0 && <Label className="mb-2 block">Duração</Label>}
            <DebouncedInput
              value={item.duration}
              onChange={(value) => updateItem(item.id, { duration: value })}
              placeholder="Ex: 2 semanas"
              disabled={disabled}
            />
          </div>
          <div className="col-span-5">
            {index === 0 && <Label className="mb-2 block">Descrição</Label>}
            <DebouncedInput
              value={item.description}
              onChange={(value) => updateItem(item.id, { description: value })}
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
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIAudio = async (transcribedText: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('proposal-ai', {
        body: {
          action: 'generate',
          sectionType: 'terms',
          context: transcribedText,
          currentContent: content.content || '',
        },
      });

      if (error) throw error;
      if (data?.text) {
        onChange({ content: data.text });
        toast.success('Termos gerados!');
      }
    } catch (error) {
      console.error('AI error:', error);
      toast.error('Erro ao gerar termos.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Termos e Condições</Label>
        {!disabled && (
          <AIPromptDialog onConfirm={handleAIAudio} isProcessing={isGenerating} title="Gerar Termos com IA" />
        )}
      </div>
      <DebouncedTextarea
        value={content.content || ''}
        onChange={(value) => onChange({ content: value })}
        placeholder="Digite os termos e condições..."
        rows={8}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">{markdownHint}</p>
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
          <Label>Nome do Responsável (Empresa)</Label>
          <DebouncedInput
            value={content.signerName || ''}
            onChange={(value) => onChange({ signerName: value })}
            placeholder="Nome de quem envia a proposta"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Cargo</Label>
          <DebouncedInput
            value={content.signerRole || ''}
            onChange={(value) => onChange({ signerRole: value })}
            placeholder="Cargo ou função"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Assinatura do Responsável</Label>
        <SignatureCanvas
          signature={content.signerSignature || ''}
          onChange={(sig) => onChange({ signerSignature: sig })}
          disabled={disabled}
          clientName={content.signerName || ''}
        />
        <p className="text-xs text-muted-foreground">
          Desenhe ou digite a assinatura do responsável. O cliente já receberá a proposta com esta assinatura preenchida.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
      💡 A assinatura do cliente será feita quando ele aceitar a proposta.
      </p>
    </div>
  );
}

function VideoEditor({
  content,
  onChange,
  disabled,
}: {
  content: VideoContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>URL do Vídeo (YouTube ou Vimeo)</Label>
        <DebouncedInput
          value={content.url || ''}
          onChange={(value) => onChange({ url: value })}
          placeholder="https://www.youtube.com/watch?v=... ou https://vimeo.com/..."
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Cole o link do YouTube ou Vimeo
        </p>
      </div>
      <div className="space-y-2">
        <Label>Legenda (opcional)</Label>
        <DebouncedInput
          value={content.caption || ''}
          onChange={(value) => onChange({ caption: value })}
          placeholder="Descrição do vídeo..."
          disabled={disabled}
        />
      </div>
      {embedUrl && (
        <div className="space-y-2">
          <Label>Pré-visualização</Label>
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FAQEditor({
  content,
  onChange,
  disabled,
}: {
  content: FAQContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const items = content.items || [];

  const addItem = () => {
    onChange({
      items: [...items, { id: crypto.randomUUID(), question: '', answer: '' }],
    });
  };

  const updateItem = (id: string, updates: Partial<FAQItem>) => {
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
        <div key={item.id} className="space-y-2 p-4 border rounded-lg relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-destructive"
            onClick={() => removeItem(item.id)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="space-y-2">
            <Label>Pergunta {index + 1}</Label>
            <DebouncedInput
              value={item.question}
              onChange={(value) => updateItem(item.id, { question: value })}
              placeholder="Ex: Como funciona o suporte?"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Resposta</Label>
            <DebouncedTextarea
              value={item.answer}
              onChange={(value) => updateItem(item.id, { answer: value })}
              placeholder="Digite a resposta..."
              disabled={disabled}
              rows={3}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Pergunta
      </Button>
    </div>
  );
}

function BenefitsEditor({
  content,
  onChange,
  disabled,
}: {
  content: BenefitsContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const items = content.items || [];

  const addItem = () => {
    onChange({
      items: [...items, { id: crypto.randomUUID(), title: '', description: '', icon: '' }],
    });
  };

  const updateItem = (id: string, updates: Partial<BenefitItem>) => {
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
        <div key={item.id} className="space-y-2 p-4 border rounded-lg relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-destructive"
            onClick={() => removeItem(item.id)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="space-y-2">
            <Label>Diferencial {index + 1}</Label>
            <DebouncedInput
              value={item.title}
              onChange={(value) => updateItem(item.id, { title: value })}
              placeholder="Ex: Suporte 24h"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <DebouncedTextarea
              value={item.description}
              onChange={(value) => updateItem(item.id, { description: value })}
              placeholder="Descreva este benefício..."
              disabled={disabled}
              rows={2}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Diferencial
      </Button>
    </div>
  );
}

function ProcessEditor({
  content,
  onChange,
  disabled,
}: {
  content: ProcessContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const steps = content.steps || [];

  const addStep = () => {
    onChange({
      steps: [...steps, { id: crypto.randomUUID(), title: '', description: '' }],
    });
  };

  const updateStep = (id: string, updates: Partial<ProcessStep>) => {
    onChange({
      steps: steps.map((step) => (step.id === id ? { ...step, ...updates } : step)),
    });
  };

  const removeStep = (id: string) => {
    onChange({ steps: steps.filter((step) => step.id !== id) });
  };

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={step.id} className="space-y-2 p-4 border rounded-lg relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-destructive"
            onClick={() => removeStep(step.id)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="space-y-2">
            <Label>Etapa {index + 1}</Label>
            <DebouncedInput
              value={step.title}
              onChange={(value) => updateStep(step.id, { title: value })}
              placeholder="Ex: Briefing e Planejamento"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <DebouncedTextarea
              value={step.description}
              onChange={(value) => updateStep(step.id, { description: value })}
              placeholder="O que acontece nesta etapa..."
              disabled={disabled}
              rows={2}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addStep} disabled={disabled} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Etapa
      </Button>
    </div>
  );
}

function LinksEditor({
  content,
  onChange,
  disabled,
}: {
  content: LinksContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const items = content.items || [];

  const addItem = () => {
    onChange({
      items: [...items, { id: crypto.randomUUID(), label: '', url: '' }],
    });
  };

  const updateItem = (id: string, updates: Partial<LinkItem>) => {
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
          <div className="col-span-5">
            <Label className="mb-2 block">Texto do Link</Label>
            <DebouncedInput
              value={item.label}
              onChange={(value) => updateItem(item.id, { label: value })}
              placeholder="Ex: Baixar PDF"
              disabled={disabled}
            />
          </div>
          <div className="col-span-6">
            <Label className="mb-2 block">URL</Label>
            <DebouncedInput
              value={item.url}
              onChange={(value) => updateItem(item.id, { url: value })}
              placeholder="https://..."
              disabled={disabled}
            />
          </div>
          <div className="col-span-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => removeItem(item.id)}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Link
      </Button>
    </div>
  );
}
