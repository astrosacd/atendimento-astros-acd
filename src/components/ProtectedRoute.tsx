import { Navigate } from 'react-router-dom';
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
  const { user, isAdmin, isApproved, isLoading, isBlocked, blockedReason, signOut } = useAuth();
  const { hasPermission } = usePermissions();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isApproved) {
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
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => signOut()}
            >
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
    return <Navigate to="/" replace />;
  }

  // Legacy adminOnly check
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
