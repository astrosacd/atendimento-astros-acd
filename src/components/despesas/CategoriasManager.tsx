import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Loader2, Tag } from 'lucide-react';
import { DespesaCategoria } from '@/hooks/useDespesas';

interface CategoriasManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categorias: DespesaCategoria[];
  onCreate: (nome: string, cor?: string, descricao?: string) => Promise<boolean>;
  onUpdate: (id: string, nome: string, cor?: string, descricao?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function CategoriasManager({
  isOpen,
  onClose,
  categorias,
  onCreate,
  onUpdate,
  onDelete,
}: CategoriasManagerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#6366f1');
  const [descricao, setDescricao] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setIsSubmitting(true);
    
    let success: boolean;
    if (editingId) {
      success = await onUpdate(editingId, nome, cor, descricao);
    } else {
      success = await onCreate(nome, cor, descricao);
    }

    setIsSubmitting(false);
    if (success) {
      resetForm();
    }
  };

  const handleEdit = (categoria: DespesaCategoria) => {
    setEditingId(categoria.id);
    setNome(categoria.nome);
    setCor(categoria.cor || '#6366f1');
    setDescricao(categoria.descricao || '');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsSubmitting(true);
    await onDelete(deleteId);
    setIsSubmitting(false);
    setDeleteId(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setCor('#6366f1');
    setDescricao('');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gerenciar Categorias
            </DialogTitle>
          </DialogHeader>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pb-4 border-b">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  placeholder="Nome da categoria"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cor">Cor</Label>
                <div className="flex gap-2">
                  <Input
                    id="cor"
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={isSubmitting || !nome.trim()}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    'Salvar'
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Criar
                    </>
                  )}
                </Button>
              </div>
            </div>
            {editingId && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={resetForm}
                className="text-muted-foreground"
              >
                Cancelar edição
              </Button>
            )}
          </form>

          {/* List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {categorias.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma categoria cadastrada.
              </p>
            ) : (
              categorias.map((cat) => (
                <Card key={cat.id} className="group">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: cat.cor || '#6366f1' }}
                      />
                      <div>
                        <p className="font-medium text-sm">{cat.nome}</p>
                        {cat.descricao && (
                          <p className="text-xs text-muted-foreground">{cat.descricao}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEdit(cat)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(cat.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta categoria? As despesas vinculadas ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
