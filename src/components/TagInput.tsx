import { useState } from 'react';
import { X, Plus, Tag, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  /** Se true, só permite selecionar tags das sugestões (não permite criar novas) */
  onlyFromSuggestions?: boolean;
}

const TAG_COLORS = [
  'bg-primary/20 text-primary border-primary/30',
  'bg-info/20 text-info border-info/30',
  'bg-update/20 text-update border-update/30',
  'bg-destructive/20 text-destructive border-destructive/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
];

export function TagInput({ tags, onTagsChange, suggestions = [], onlyFromSuggestions = false }: TagInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const getTagColor = (tag: string, index: number) => {
    return TAG_COLORS[index % TAG_COLORS.length];
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onTagsChange([...tags, trimmedTag]);
    }
    setShowDropdown(false);
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const availableSuggestions = suggestions.filter(
    suggestion => !tags.includes(suggestion.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-secondary border border-border rounded-md">
        {tags.map((tag, index) => (
          <Badge
            key={tag}
            variant="outline"
            className={`${getTagColor(tag, index)} flex items-center gap-1 px-2 py-1`}
          >
            <Tag className="w-3 h-3" />
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:opacity-70 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors h-8"
          >
            <Plus className="w-3 h-3" />
            Selecionar tag
            <ChevronDown className="w-3 h-3" />
          </button>
          {showDropdown && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[180px]">
              {availableSuggestions.length > 0 ? (
                availableSuggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => addTag(suggestion)}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-3 h-3 text-muted-foreground" />
                    {suggestion}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {suggestions.length === 0 
                    ? "Nenhuma tag disponível. Crie tags no Gerenciamento de Tags."
                    : "Todas as tags já foram adicionadas"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {onlyFromSuggestions 
          ? "Selecione tags criadas no Gerenciamento de Tags"
          : "Clique para selecionar uma tag"}
      </p>
      {/* Fecha o dropdown ao clicar fora */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
