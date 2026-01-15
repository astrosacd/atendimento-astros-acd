import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}

export function CollapsibleSection({ 
  title, 
  icon: Icon, 
  iconColor, 
  children, 
  defaultOpen = true,
  badge 
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-card/50 hover:bg-card border border-border/50 hover:border-border transition-all group mb-3"
      >
        <div className="flex items-center gap-3">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", iconColor)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-foreground font-display">
            {title}
          </h3>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isOpen ? 'Recolher' : 'Expandir'}
          </span>
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </div>
      </button>
      
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}
