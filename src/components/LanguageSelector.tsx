import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLanguage } from '@/hooks/useLanguage';
import { languages, LanguageCode } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  collapsed?: boolean;
}

export function LanguageSelector({ collapsed = false }: LanguageSelectorProps) {
  const { currentLanguage, changeLanguage } = useLanguage();
  const { t } = useTranslation();

  const currentLang = languages.find(l => l.code === currentLanguage) || languages[0];

  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        className={cn(
          "h-11 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
          collapsed ? "w-full justify-center px-0" : "w-full justify-start gap-3 px-3"
        )}
      >
        <Globe className="h-5 w-5 shrink-0 text-blue-500" />
        {!collapsed && (
          <span className="text-sm flex items-center gap-2">
            {t('sidebar.language')}
            <span className="text-xs text-muted-foreground">({currentLang.flag})</span>
          </span>
        )}
      </Button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            {trigger}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover border-border shadow-lg">
            {t('sidebar.language')}
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent 
        side={collapsed ? "right" : "top"} 
        align="start"
        className="w-40"
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code as LanguageCode)}
            className={cn(
              "cursor-pointer",
              currentLanguage === lang.code && "bg-primary/10 text-primary"
            )}
          >
            <span className="mr-2 text-lg">{lang.flag}</span>
            <span>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
