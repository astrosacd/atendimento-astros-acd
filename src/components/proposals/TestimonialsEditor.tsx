import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, X, Quote } from 'lucide-react';
import type { TestimonialsContent, Testimonial } from '@/types/proposals';

interface TestimonialsEditorProps {
  content: TestimonialsContent;
  onChange: (updates: Record<string, unknown>) => void;
  disabled: boolean;
}

export function TestimonialsEditor({ content, onChange, disabled }: TestimonialsEditorProps) {
  const items = content.items || [];

  const addItem = () => {
    onChange({
      items: [
        ...items,
        { id: crypto.randomUUID(), author: '', company: '', content: '' },
      ],
    });
  };

  const updateItem = (id: string, updates: Partial<Testimonial>) => {
    onChange({
      items: items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    });
  };

  const removeItem = (id: string) => {
    onChange({ items: items.filter((item) => item.id !== id) });
  };

  return (
    <div className="space-y-4">
      <Label>Depoimentos de Clientes</Label>

      {items.map((item, index) => (
        <div key={item.id} className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-start gap-3">
            <Quote className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
            <div className="flex-1 space-y-3">
              <Textarea
                value={item.content}
                onChange={(e) => updateItem(item.id, { content: e.target.value })}
                placeholder="O que o cliente disse..."
                rows={3}
                disabled={disabled}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  {index === 0 && <Label className="text-xs mb-1 block">Nome do Autor</Label>}
                  <Input
                    value={item.author}
                    onChange={(e) => updateItem(item.id, { author: e.target.value })}
                    placeholder="Nome do cliente"
                    disabled={disabled}
                  />
                </div>
                <div>
                  {index === 0 && <Label className="text-xs mb-1 block">Empresa (opcional)</Label>}
                  <Input
                    value={item.company || ''}
                    onChange={(e) => updateItem(item.id, { company: e.target.value })}
                    placeholder="Empresa do cliente"
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-8 w-8 flex-shrink-0"
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
          Adicionar Depoimento
        </Button>
      )}

      {items.length === 0 && (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-sm">Nenhum depoimento adicionado</p>
          <p className="text-xs mt-1">Adicione depoimentos de clientes satisfeitos</p>
        </div>
      )}
    </div>
  );
}
