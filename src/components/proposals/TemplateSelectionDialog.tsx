import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, Briefcase, Palette, Code, Megaphone, Check, Mic, Sparkles, Wand2 } from 'lucide-react';
import { proposalTemplates, type ProposalTemplate } from '@/data/proposalTemplates';
import { cn } from '@/lib/utils';
import { AudioRecorder } from './AudioRecorder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="h-8 w-8" />,
  Briefcase: <Briefcase className="h-8 w-8" />,
  Palette: <Palette className="h-8 w-8" />,
  Code: <Code className="h-8 w-8" />,
  Megaphone: <Megaphone className="h-8 w-8" />,
};

interface TemplateSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: ProposalTemplate) => void;
  isLoading?: boolean;
}

export function TemplateSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  isLoading = false,
}: TemplateSelectionDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    const template = proposalTemplates.find((t) => t.id === selectedId);
    if (template) {
      onSelect(template);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolha um Modelo</DialogTitle>
          <DialogDescription>
            Selecione um modelo para começar sua proposta com uma estrutura profissional
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
          {proposalTemplates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md relative',
                selectedId === template.id
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:border-primary/50'
              )}
              onClick={() => setSelectedId(template.id)}
            >
              {selectedId === template.id && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-3 text-primary">
                  {iconMap[template.icon] || <FileText className="h-8 w-8" />}
                </div>
                <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                {template.sections.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {template.sections.length} seções incluídas
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isLoading ? 'Criando...' : 'Criar Proposta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
