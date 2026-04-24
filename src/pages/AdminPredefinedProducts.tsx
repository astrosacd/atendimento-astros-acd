import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Package, Plus, Edit, Trash2, Search, RefreshCw, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface PredefinedProduct {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function AdminPredefinedProducts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<PredefinedProduct | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setTagToDelete] = useState<PredefinedProduct | null>(null);

  const { data: products = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['predefined-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('predefined_products')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as PredefinedProduct[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: { id?: string; name: string; description: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('predefined_products')
          .update({ name: data.name, description: data.description })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('predefined_products')
          .insert([{ name: data.name, description: data.description }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predefined-products'] });
      toast({
        title: editingProduct ? "Produto atualizado" : "Produto criado",
        description: "A lista de produtos foi atualizada com sucesso.",
      });
      setCreateDialogOpen(false);
      setEditingProduct(null);
      setFormData({ name: "", description: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar produto",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('predefined_products')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predefined-products'] });
      toast({
        title: "Produto excluído",
        description: "O produto foi removido da lista predefinida.",
      });
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao excluir produto",
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (product: PredefinedProduct) => {
    setEditingProduct(product);
    setFormData({ name: product.name, description: product.description || "" });
    setCreateDialogOpen(true);
  };

  const handleDelete = (product: PredefinedProduct) => {
    setTagToDelete(product);
    setDeleteDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              className="hover:bg-primary/10 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display">Produtos Predefinidos</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie a lista padronizada de produtos para cadastros e IA.
                </p>
              </div>
            </div>
          </div>
          <Button onClick={() => {
            setEditingProduct(null);
            setFormData({ name: "", description: "" });
            setCreateDialogOpen(true);
          }} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="border-border"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || isFetching) ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* List Grid */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Produtos Cadastrados</CardTitle>
            <CardDescription>
              Os nomes abaixo aparecerão como opções nos formulários de cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>{search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado ainda"}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card hover:border-primary/30 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground truncate">{product.name}</p>
                      </div>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                        className="h-9 w-9"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product)}
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
              <DialogDescription>
                Este nome será usado para padronizar as métricas da IA.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Disparador Start"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição do produto"
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
              <Button 
                onClick={() => upsertMutation.mutate({ 
                  id: editingProduct?.id, 
                  name: formData.name, 
                  description: formData.description 
                })}
                disabled={!formData.name.trim() || upsertMutation.isPending}
              >
                {upsertMutation.isPending ? "Salvando..." : editingProduct ? "Atualizar" : "Criar Produto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso removerá "{productToDelete?.name}" da lista predefinida. 
                Os clientes já cadastrados com este produto não serão alterados, mas não será possível selecioná-lo em novos cadastros.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => productToDelete && deleteMutation.mutate(productToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
