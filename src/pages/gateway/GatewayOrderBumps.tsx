import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGatewayOrderBumps, GatewayOrderBump } from '@/hooks/useGateway';
import { Plus, Pencil, Trash2, Image } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function GatewayOrderBumps() {
  const { orderBumps, isLoading, createOrderBump, updateOrderBump, deleteOrderBump, isCreating, isUpdating } = useGatewayOrderBumps();
  const [isOpen, setIsOpen] = useState(false);
  const [editingOrderBump, setEditingOrderBump] = useState<GatewayOrderBump | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    image_url: '',
    price_brl: 0,
    price_usd: 0,
    status: 'active' as 'active' | 'inactive',
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      description: '',
      image_url: '',
      price_brl: 0,
      price_usd: 0,
      status: 'active',
    });
    setEditingOrderBump(null);
  };

  const handleEdit = (orderBump: GatewayOrderBump) => {
    setEditingOrderBump(orderBump);
    setFormData({
      name: orderBump.name,
      title: orderBump.title,
      description: orderBump.description || '',
      image_url: orderBump.image_url || '',
      price_brl: orderBump.price_brl,
      price_usd: orderBump.price_usd,
      status: orderBump.status,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingOrderBump) {
      updateOrderBump({ id: editingOrderBump.id, ...formData }, {
        onSuccess: () => handleOpenChange(false)
      });
    } else {
      createOrderBump(formData, {
        onSuccess: () => handleOpenChange(false)
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este order bump?')) {
      deleteOrderBump(id);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `order-bumps/${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('gateway-products')
      .upload(fileName, file);

    if (error) {
      toast.error('Erro ao fazer upload: ' + error.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gateway-products')
      .getPublicUrl(fileName);

    setFormData(prev => ({ ...prev, image_url: publicUrl }));
    setUploading(false);
    toast.success('Imagem enviada com sucesso');
  };

  const formatCurrency = (value: number, currency: 'BRL' | 'USD' = 'BRL') => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Order Bumps ({orderBumps.length})</h2>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Order Bump</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingOrderBump ? 'Editar Order Bump' : 'Novo Order Bump'}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Interno *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="Identificação interna"
                  />
                </div>
                <div>
                  <Label htmlFor="title">Título (exibido no checkout) *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                    placeholder="Adicione também..."
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Descrição do order bump"
                  />
                </div>
                <div>
                  <Label>Imagem</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      disabled={uploading}
                      className="flex-1"
                    />
                    {formData.image_url && (
                      <img src={formData.image_url} alt="Preview" className="h-10 w-10 object-cover rounded" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price_brl">Preço BRL *</Label>
                    <Input
                      id="price_brl"
                      type="number"
                      step="0.01"
                      value={formData.price_brl}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_brl: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="price_usd">Preço USD</Label>
                    <Input
                      id="price_usd"
                      type="number"
                      step="0.01"
                      value={formData.price_usd}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_usd: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: 'active' | 'inactive') => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isCreating || isUpdating}>
                    {editingOrderBump ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Bump</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Preço BRL</TableHead>
                <TableHead>Preço USD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderBumps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum order bump cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                orderBumps.map((ob) => (
                  <TableRow key={ob.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {ob.image_url ? (
                          <img src={ob.image_url} alt="" className="h-10 w-10 object-cover rounded" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{ob.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ob.title}</TableCell>
                    <TableCell>{formatCurrency(ob.price_brl)}</TableCell>
                    <TableCell>{formatCurrency(ob.price_usd, 'USD')}</TableCell>
                    <TableCell>
                      <Badge variant={ob.status === 'active' ? 'default' : 'secondary'}>
                        {ob.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(ob)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(ob.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
