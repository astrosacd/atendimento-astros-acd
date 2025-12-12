import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { 
  ArrowLeft, Shield, Eye, UserPlus, Users, Check, X, 
  Search, Edit, Trash2, CreditCard, Webhook, Key, FileText, Settings, MessageCircle
} from 'lucide-react';

type Permission = {
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  admin: boolean;
  operador: boolean;
  gerente: boolean;
  visualizador: boolean;
  description?: string;
};

const permissions: Permission[] = [
  // Client Operations
  { action: 'Visualizar Dashboard', icon: Eye, admin: true, operador: true, gerente: true, visualizador: true },
  { action: 'Consultar Clientes', icon: Search, admin: true, operador: true, gerente: true, visualizador: true, description: 'Gerentes veem apenas seus próprios clientes' },
  { action: 'Cadastrar Clientes', icon: UserPlus, admin: true, operador: true, gerente: true, visualizador: false },
  { action: 'Atualizar Clientes', icon: Edit, admin: true, operador: true, gerente: true, visualizador: false, description: 'Gerentes atualizam apenas seus próprios clientes' },
  { action: 'Excluir Clientes', icon: Trash2, admin: true, operador: false, gerente: true, visualizador: false, description: 'Gerentes excluem apenas seus próprios clientes' },
  { action: 'Exportar Dados (CSV)', icon: FileText, admin: true, operador: true, gerente: true, visualizador: true },
  { action: 'Ver Histórico de Alterações', icon: FileText, admin: true, operador: false, gerente: false, visualizador: false },
  
  // Admin Operations
  { action: 'Gerenciar Usuários', icon: Users, admin: true, operador: false, gerente: false, visualizador: false },
  { action: 'Aprovar/Rejeitar Usuários', icon: Shield, admin: true, operador: false, gerente: false, visualizador: false },
  { action: 'Configurar Cobrança', icon: CreditCard, admin: true, operador: false, gerente: false, visualizador: false },
  { action: 'Gerenciar Webhooks', icon: Webhook, admin: true, operador: false, gerente: false, visualizador: false },
  { action: 'Gerenciar API Keys', icon: Key, admin: true, operador: false, gerente: false, visualizador: false },
  { action: 'Visualizar Logs de Auditoria', icon: FileText, admin: true, operador: false, gerente: false, visualizador: false },
  { action: 'Configurações do Sistema', icon: Settings, admin: true, operador: false, gerente: false, visualizador: false },
  { action: 'Configurar Chat/IA', icon: MessageCircle, admin: true, operador: false, gerente: false, visualizador: false },
];

const roleInfo = [
  {
    role: 'Administrador',
    icon: Shield,
    color: 'bg-primary/10 text-primary border-primary',
    iconColor: 'text-primary',
    description: 'Acesso completo ao sistema. Pode gerenciar usuários, configurações, webhooks, API e todos os clientes.',
  },
  {
    role: 'Operador',
    icon: UserPlus,
    color: 'bg-orange-500/10 text-orange-500 border-orange-500',
    iconColor: 'text-orange-500',
    description: 'Pode cadastrar e atualizar clientes, mas não pode excluir. Não tem acesso às configurações administrativas.',
  },
  {
    role: 'Gerente',
    icon: Shield,
    color: 'bg-purple-500/10 text-purple-500 border-purple-500',
    iconColor: 'text-purple-500',
    description: 'Gerencia apenas os clientes que ele mesmo cadastrou. Tem controle total sobre seus próprios clientes.',
  },
  {
    role: 'Visualizador',
    icon: Eye,
    color: 'bg-muted text-muted-foreground border-border',
    iconColor: 'text-muted-foreground',
    description: 'Acesso somente leitura. Pode consultar clientes e exportar dados, mas não pode criar ou modificar.',
  },
];

export default function AdminPermissoes() {
  const navigate = useNavigate();

  const PermissionIcon = ({ allowed }: { allowed: boolean }) => (
    allowed ? (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
        <Check className="h-4 w-4 text-primary" />
      </div>
    ) : (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10">
        <X className="h-4 w-4 text-destructive" />
      </div>
    )
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin')}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">
              Permissões do Sistema
            </h1>
            <p className="text-muted-foreground">
              Visão detalhada das permissões de cada tipo de usuário
            </p>
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roleInfo.map((role) => (
            <Card key={role.role} className={`border-2 ${role.color.split(' ')[2]}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${role.color.split(' ').slice(0, 2).join(' ')}`}>
                    <role.icon className={`h-5 w-5 ${role.iconColor}`} />
                  </div>
                  <CardTitle className="text-lg">{role.role}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Permissions Matrix */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-display">Matriz de Permissões</CardTitle>
            <CardDescription>
              Comparativo detalhado das permissões por tipo de usuário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-3 text-sm font-medium text-muted-foreground">
                      Ação
                    </th>
                    <th className="text-center py-4 px-3">
                      <Badge className="bg-primary/10 text-primary border-primary">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    </th>
                    <th className="text-center py-4 px-3">
                      <Badge className="bg-orange-500/10 text-orange-500 border-orange-500">
                        <UserPlus className="h-3 w-3 mr-1" />
                        Operador
                      </Badge>
                    </th>
                    <th className="text-center py-4 px-3">
                      <Badge className="bg-purple-500/10 text-purple-500 border-purple-500">
                        <Shield className="h-3 w-3 mr-1" />
                        Gerente
                      </Badge>
                    </th>
                    <th className="text-center py-4 px-3">
                      <Badge variant="outline" className="text-muted-foreground">
                        <Eye className="h-3 w-3 mr-1" />
                        Visualizador
                      </Badge>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm, index) => (
                    <tr 
                      key={perm.action} 
                      className={`border-b border-border/50 ${index % 2 === 0 ? 'bg-muted/20' : ''}`}
                    >
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-3">
                          <perm.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-foreground">{perm.action}</span>
                            {perm.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex justify-center">
                          <PermissionIcon allowed={perm.admin} />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex justify-center">
                          <PermissionIcon allowed={perm.operador} />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex justify-center">
                          <PermissionIcon allowed={perm.gerente} />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex justify-center">
                          <PermissionIcon allowed={perm.visualizador} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="border-border bg-muted/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-muted-foreground">Permitido</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10">
                  <X className="h-3 w-3 text-destructive" />
                </div>
                <span className="text-muted-foreground">Não Permitido</span>
              </div>
              <div className="text-muted-foreground/70 text-xs ml-auto">
                * Gerentes têm permissões restritas aos clientes que eles mesmos cadastraram
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
