import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  permission?: string;
}

export function ProtectedRoute({ children, adminOnly = false, permission }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, isAdmin, isApproved, isLoading: isAuthLoading, isBlocked, blockedReason, signOut } = useAuth();
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions();
  
  const isLoading = isAuthLoading || isPermissionsLoading;

  // Allow bypass if a valid temporary token exists in localStorage
  const hasTempAccess = !!localStorage.getItem("temp_access_token");

  const isPrivateArea =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/usuarios') ||
    location.pathname === '/' ||
    location.pathname.startsWith('/dashboard') ||
    location.pathname === '/cadastrar' ||
    location.pathname === '/consultar' ||
    location.pathname === '/atualizar' ||
    location.pathname === '/excluir' ||
    location.pathname.startsWith('/perfil') ||
    location.pathname.startsWith('/tarefas') ||
    location.pathname.startsWith('/propostas') ||
    location.pathname.startsWith('/followups') ||
    location.pathname.startsWith('/despesas') ||
    location.pathname.startsWith('/kanban') ||
    location.pathname.startsWith('/lead-hunter') ||
    location.pathname.startsWith('/agenda') ||
    location.pathname.startsWith('/link-pagamento') ||
    location.pathname.startsWith('/grafo-clientes') ||
    location.pathname.startsWith('/central-ajuda') ||
      location.pathname.startsWith('/sala-agentes') ||
      location.pathname.startsWith('/instagram') ||
      location.pathname.startsWith('/ligacoes-ia');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  // If we have temporary access, only allow the exact target_path
  if (hasTempAccess) {
    const targetPath = localStorage.getItem("temp_access_target");
    if (targetPath && location.pathname !== targetPath) {
      return <Navigate to={targetPath} replace />;
    }
    return <>{children}</>;
  }

  // IMPORTANT: se alguém sem login tentar acessar área privada,
  // não mostramos a tela de login (pra não "entregar" o painel para clientes).
  if (!user && !isLoading) {
    if (isPrivateArea) {
      // Se tivermos o código de acesso na URL original, tentamos preservá-lo ao redirecionar para auth
      const searchParams = new URLSearchParams(window.location.search);
      const authPath = searchParams.has('codigo') ? `/auth${window.location.search}` : '/auth';
      return <Navigate to={authPath} replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  if (!isApproved) {
    if (isPrivateArea) {
      const searchParams = new URLSearchParams(window.location.search);
      const authPath = searchParams.has('codigo') ? `/auth${window.location.search}` : '/auth';
      return <Navigate to={authPath} replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  // Check if user is blocked
  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/50 bg-destructive/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive text-2xl">Conta Bloqueada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Sua conta foi bloqueada por um administrador.
            </p>
            {blockedReason && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-1">Motivo do bloqueio:</p>
                <p className="text-sm text-muted-foreground">{blockedReason}</p>
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              Entre em contato com o administrador para mais informações.
            </p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair da conta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check specific permission if provided
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/catalogo" replace />;
  }

  // Legacy adminOnly check
  if (adminOnly && !isAdmin) {
    return <Navigate to="/catalogo" replace />;
  }

  return <>{children}</>;
}
