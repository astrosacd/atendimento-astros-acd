import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  permission?: string;
}

export function ProtectedRoute({ children, adminOnly = false, permission }: ProtectedRouteProps) {
  const { user, isAdmin, isApproved, isLoading } = useAuth();
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
