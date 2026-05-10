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
import { Loader2, FileText, Briefcase, Palette, Code, Megaphone, Check, Mic, Sparkles, Wand2, Plus } from 'lucide-react';
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
  onAISelect?: (audioData?: string, textRequest?: string) => void;
  isLoading?: boolean;
  isAILoading?: boolean;
}

export function TemplateSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  onAISelect,
  isLoading = false,
  isAILoading = false,
}: TemplateSelectionDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'ai'>('templates');

  const handleConfirm = () => {
    const template = proposalTemplates.find((t) => t.id === selectedId);
    if (template) {
      onSelect(template);
    }
  };

  const handleTextAI = () => {
    const prompt = window.prompt("Descreva o que deseja na proposta:");
    if (prompt && onAISelect) {
      onAISelect(undefined, prompt);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nova Proposta
          </DialogTitle>
          <DialogDescription>
            Escolha um modelo pronto ou use nossa IA para construir a proposta do zero.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Modelos Prontos
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Wand2 className="h-4 w-4" />
              Criar com IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-2">
              {proposalTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md relative h-full',
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
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedId || isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isLoading ? 'Criando...' : 'Criar Proposta'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <div className="space-y-6 py-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Wand2 className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Construção Mágica com IA</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Mande um áudio ou descreva em texto o que deseja na proposta. A IA criará o título e todas as seções necessárias (preços, cronograma, etc) automaticamente.
                  </p>
                </div>

                {isAILoading ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm font-medium animate-pulse text-primary">
                      A IA está desenhando sua proposta completa...
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto pt-4">
                    <div className="border rounded-lg bg-background p-4">
                      <AudioRecorder 
                        onRecordingComplete={(audio) => onAISelect?.(audio)} 
                        isProcessing={isAILoading} 
                      />
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Ou via texto</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="gap-2 h-12"
                      onClick={handleTextAI}
                      disabled={isAILoading}
                    >
                      <Sparkles className="h-4 w-4" />
                      Descrever Proposta
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
