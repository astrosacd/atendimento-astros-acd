import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  Plus, 
  Edit, 
  Send, 
  Eye, 
  CheckCircle, 
  XCircle,
  User,
  RefreshCcw,
} from 'lucide-react';
import { useProposalHistory, type ProposalHistoryEntry } from '@/hooks/useProposalHistory';

interface ProposalHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
}

const actionConfig: Record<ProposalHistoryEntry['action'] | 'remarketing_restarted', { label: string; icon: React.ReactNode; color: string }> = {
  created: { label: 'Criada', icon: <Plus className="h-4 w-4" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  updated: { label: 'Editada', icon: <Edit className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  sent: { label: 'Enviada', icon: <Send className="h-4 w-4" />, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  viewed: { label: 'Visualizada', icon: <Eye className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  accepted: { label: 'Aceita', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected: { label: 'Recusada', icon: <XCircle className="h-4 w-4" />, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  remarketing: { label: 'Remarketing', icon: <RefreshCcw className="h-4 w-4" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  remarketing_restarted: { label: 'Remarketing Reiniciado', icon: <RefreshCcw className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

export function ProposalHistoryDialog({
  open,
  onOpenChange,
  proposalId,
}: ProposalHistoryDialogProps) {
  const { history, isLoading } = useProposalHistory(proposalId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico da Proposta
          </DialogTitle>
          <DialogDescription>
            Registro de todas as ações realizadas nesta proposta
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum registro de histórico</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => {
                const config = actionConfig[entry.action];
                return (
                  <div
                    key={entry.id}
                    className="flex gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className={`p-2 rounded-full h-fit ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={config.color}>
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          {entry.user_name || entry.user_email || 'Sistema'}
                        </span>
                      </div>
                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">Alterações:</span>{' '}
                          {Object.keys(entry.changes as Record<string, unknown>).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
