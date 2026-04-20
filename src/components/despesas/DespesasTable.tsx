import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  MoreHorizontal, Edit, Trash2, CheckCircle, Calendar, 
  RefreshCw, Loader2, Receipt
} from 'lucide-react';
import { Despesa } from '@/hooks/useDespesas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DespesasTableProps {
  despesas: Despesa[];
  isLoading: boolean;
  onEdit: (despesa: Despesa) => void;
  onDelete: (id: string) => Promise<boolean>;
  onMarkAsPaid: (id: string) => Promise<boolean>;
}

export function DespesasTable({ 
  despesas, 
  isLoading, 
  onEdit, 
  onDelete, 
  onMarkAsPaid 
}: DespesasTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCurrency = (value: number, moeda: string = 'BRL') => {
    return new Intl.NumberFormat(moeda === 'USD' ? 'en-US' : 'pt-BR', {
      style: 'currency',
      currency: moeda,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Pago</Badge>;
      case 'pendente':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Pendente</Badge>;
      case 'atrasado':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Atrasado</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo === 'fixa') {
      return (
        <Badge variant="outline" className="text-info border-info/30">
          <RefreshCw className="h-3 w-3 mr-1" />
          Fixa
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Receipt className="h-3 w-3 mr-1" />
        Avulsa
      </Badge>
    );
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await onDelete(deleteId);
    setIsDeleting(false);
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (despesas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma despesa encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.map((despesa) => (
                  <TableRow key={despesa.id}>
                    <TableCell className="font-medium">{despesa.descricao}</TableCell>
                    <TableCell>
                      {despesa.categoria ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: despesa.categoria.cor || '#6366f1' }}
                          />
                          <span className="text-sm">{despesa.categoria.nome}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(despesa.valor, despesa.moeda)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(despesa.data_vencimento)}
                      </div>
                    </TableCell>
                    <TableCell>{getTipoBadge(despesa.tipo)}</TableCell>
                    <TableCell>{getStatusBadge(despesa.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {despesa.status !== 'pago' && despesa.status !== 'cancelado' && (
                            <DropdownMenuItem onClick={() => onMarkAsPaid(despesa.id)}>
                              <CheckCircle className="h-4 w-4 mr-2 text-primary" />
                              Marcar como Pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onEdit(despesa)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteId(despesa.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
