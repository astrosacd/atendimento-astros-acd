import { AlertTriangle, User } from 'lucide-react';
import { DuplicateMatch } from '@/hooks/useDuplicateCheck';

interface Props {
  matches: DuplicateMatch[];
  compact?: boolean;
}

const fieldLabel: Record<DuplicateMatch['matchedField'], string> = {
  cpf: 'CPF/CNPJ',
  email: 'E-mail',
  numero: 'WhatsApp',
};

const formatDate = (iso: string) => {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
};

export const DuplicateClientWarning = ({ matches, compact = false }: Props) => {
  if (!matches || matches.length === 0) return null;

  return (
    <div className={`rounded-lg border border-amber-500/40 bg-amber-500/10 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            {matches.length === 1
              ? 'Já existe um cliente com este dado:'
              : `Já existem ${matches.length} clientes com este dado:`}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {matches.map((m) => (
              <li
                key={`${m.id}-${m.matchedField}`}
                className="flex items-start gap-2 text-xs bg-background/50 rounded p-2 border border-border/50"
              >
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{m.nome}</div>
                  <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span>Produto: <span className="text-foreground">{m.produto || '—'}</span></span>
                    <span>Renovação: <span className="text-foreground">{formatDate(m.data_renovacao)}</span></span>
                    <span>
                      Coincidiu em:{' '}
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {fieldLabel[m.matchedField]}
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
