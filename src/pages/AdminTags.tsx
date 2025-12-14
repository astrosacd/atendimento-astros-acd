import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, Tag, Plus, Edit, Trash2, Search, RefreshCw } from "lucide-react";

interface TagData {
  name: string;
  count: number;
}

const AdminTags = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTagName, setCreateTagName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  // Fetch all unique tags from clientes table AND billing_config (registered tags)
  const { data: tags = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-tags'],
    queryFn: async () => {
      // Fetch tags from clients
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('tags');
      
      if (clientesError) throw clientesError;
      
      // Fetch registered tags from billing_config
      const { data: configData, error: configError } = await supabase
        .from('billing_config')
        .select('config_value')
        .like('config_key', 'tag_%');
      
      if (configError) throw configError;
      
      // Count occurrences of each tag from clients
      const tagCounts: Record<string, number> = {};
      clientesData?.forEach(cliente => {
        cliente.tags?.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      
      // Add registered tags that might not be used yet
      configData?.forEach(config => {
        const tagName = config.config_value;
        if (tagName && !tagCounts[tagName]) {
          tagCounts[tagName] = 0;
        }
      });
      
      return Object.entries(tagCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)) as TagData[];
    },
  });

  // Rename tag mutation
  const renameMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      // Get all clients with this tag
      const { data: clients, error: fetchError } = await supabase
        .from('clientes')
        .select('id, tags')
        .contains('tags', [oldName]);
      
      if (fetchError) throw fetchError;
      
      // Update each client's tags
      for (const client of clients || []) {
        const updatedTags = client.tags?.map((t: string) => 
          t === oldName ? newName : t
        ) || [];
        
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ tags: updatedTags })
          .eq('id', client.id);
        
        if (updateError) throw updateError;
      }
      
      return { oldName, newName, count: clients?.length || 0 };
    },
    onSuccess: ({ oldName, newName, count }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      toast({
        title: "Tag renomeada",
        description: `"${oldName}" → "${newName}" em ${count} cliente(s)`,
      });
      setEditingTag(null);
      setNewTagName("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao renomear tag",
        variant: "destructive",
      });
    },
  });

  // Delete tag mutation
  const deleteMutation = useMutation({
    mutationFn: async (tagName: string) => {
      // Get all clients with this tag
      const { data: clients, error: fetchError } = await supabase
        .from('clientes')
        .select('id, tags')
        .contains('tags', [tagName]);
      
      if (fetchError) throw fetchError;
      
      // Remove tag from each client
      for (const client of clients || []) {
        const updatedTags = client.tags?.filter((t: string) => t !== tagName) || [];
        
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ tags: updatedTags })
          .eq('id', client.id);
        
        if (updateError) throw updateError;
      }
      
      return { tagName, count: clients?.length || 0 };
    },
    onSuccess: ({ tagName, count }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      toast({
        title: "Tag excluída",
        description: `"${tagName}" removida de ${count} cliente(s)`,
      });
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir tag",
        variant: "destructive",
      });
    },
  });

  // Create tag mutation - stores in billing_config as a central registry
  const createMutation = useMutation({
    mutationFn: async (tagName: string) => {
      // Check if tag already exists in clients
      const exists = tags.some(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (exists) {
        throw new Error("Tag já existe");
      }
      
      // Store tag in billing_config for persistence (using 'tag_' prefix)
      const { error } = await supabase
        .from('billing_config')
        .upsert({
          config_key: `tag_${tagName.toLowerCase().replace(/\s+/g, '_')}`,
          config_value: tagName,
        }, { onConflict: 'config_key' });
      
      if (error) throw error;
      return tagName;
    },
    onSuccess: (tagName) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      toast({
        title: "Tag criada",
        description: `"${tagName}" disponível para uso.`,
      });
      setCreateDialogOpen(false);
      setCreateTagName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar tag",
        variant: "destructive",
      });
    },
  });

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRename = (oldName: string) => {
    if (!newTagName.trim() || newTagName === oldName) {
      setEditingTag(null);
      return;
    }
    renameMutation.mutate({ oldName, newName: newTagName.trim() });
  };

  const handleDelete = (tagName: string) => {
    setTagToDelete(tagName);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (tagToDelete) {
      deleteMutation.mutate(tagToDelete);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Tag className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading">Gerenciamento de Tags</h1>
                <p className="text-sm text-muted-foreground">
                  Crie, edite e exclua tags para organizar clientes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tag
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{tags.length}</p>
              <p className="text-sm text-muted-foreground">Tags únicas</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">
                {tags.reduce((sum, t) => sum + t.count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total de usos</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">
                {tags.length > 0 ? Math.max(...tags.map(t => t.count)) : 0}
              </p>
              <p className="text-sm text-muted-foreground">Mais usada</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{filteredTags.length}</p>
              <p className="text-sm text-muted-foreground">Filtradas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tags Grid */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>Tags Existentes</CardTitle>
            <CardDescription>
              Clique em editar para renomear ou excluir uma tag
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? "Nenhuma tag encontrada" : "Nenhuma tag cadastrada ainda"}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTags.map((tag) => (
                  <div
                    key={tag.name}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {editingTag === tag.name ? (
                        <Input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(tag.name);
                            if (e.key === 'Escape') {
                              setEditingTag(null);
                              setNewTagName("");
                            }
                          }}
                          onBlur={() => handleRename(tag.name)}
                          className="w-48"
                          autoFocus
                        />
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-sm">
                            {tag.name}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {tag.count} cliente{tag.count !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTag(tag.name);
                          setNewTagName(tag.name);
                        }}
                        disabled={editingTag === tag.name}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tag.name)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

        {/* Info Card */}
        <Card className="border-border/40 bg-muted/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Como funcionam as tags?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Tags são automaticamente coletadas dos clientes cadastrados</li>
                  <li>Renomear uma tag atualiza todos os clientes que a utilizam</li>
                  <li>Excluir uma tag remove ela de todos os clientes</li>
                  <li>Use tags para segmentar clientes na consulta</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Tag</DialogTitle>
            <DialogDescription>
              Digite o nome da nova tag. Ela ficará disponível para uso ao cadastrar ou atualizar clientes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Nome da Tag</Label>
              <Input
                id="tagName"
                placeholder="Ex: VIP, Inadimplente, Novo"
                value={createTagName}
                onChange={(e) => setCreateTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && createTagName.trim()) {
                    createMutation.mutate(createTagName.trim());
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate(createTagName.trim())}
              disabled={!createTagName.trim() || createMutation.isPending}
            >
              Criar Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tag "{tagToDelete}"? 
              Ela será removida de todos os clientes que a utilizam. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTags;
