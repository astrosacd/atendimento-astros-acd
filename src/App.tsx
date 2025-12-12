import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CadastrarCliente from "./pages/CadastrarCliente";
import ConsultarCliente from "./pages/ConsultarCliente";
import AtualizarCliente from "./pages/AtualizarCliente";
import ExcluirCliente from "./pages/ExcluirCliente";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import Admin from "./pages/Admin";
import AdminRecuperacaoSenha from "./pages/AdminRecuperacaoSenha";
import AdminWebhooks from "./pages/AdminWebhooks";
import AdminApiKeys from "./pages/AdminApiKeys";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import AdminCobranca from "./pages/AdminCobranca";
import AdminChatConfig from "./pages/AdminChatConfig";
import AdminPermissoes from "./pages/AdminPermissoes";
import AdminGuia from "./pages/AdminGuia";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isAdmin, isApproved, isLoading } = useAuth();

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

  // If user is not approved, redirect to auth page to see the approval status
  if (!isApproved) {
    return <Navigate to="/auth" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, isApproved, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/auth" element={user && isApproved ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/cadastrar" element={<ProtectedRoute adminOnly><CadastrarCliente /></ProtectedRoute>} />
        <Route path="/consultar" element={<ProtectedRoute><ConsultarCliente /></ProtectedRoute>} />
        <Route path="/atualizar" element={<ProtectedRoute adminOnly><AtualizarCliente /></ProtectedRoute>} />
        <Route path="/excluir" element={<ProtectedRoute adminOnly><ExcluirCliente /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute adminOnly><GerenciarUsuarios /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
        <Route path="/admin/recuperacao-senha" element={<ProtectedRoute adminOnly><AdminRecuperacaoSenha /></ProtectedRoute>} />
        <Route path="/admin/webhooks" element={<ProtectedRoute adminOnly><AdminWebhooks /></ProtectedRoute>} />
        <Route path="/admin/api" element={<ProtectedRoute adminOnly><AdminApiKeys /></ProtectedRoute>} />
        <Route path="/admin/logs" element={<ProtectedRoute adminOnly><AdminAuditLogs /></ProtectedRoute>} />
        <Route path="/admin/cobranca" element={<ProtectedRoute adminOnly><AdminCobranca /></ProtectedRoute>} />
        <Route path="/admin/chat" element={<ProtectedRoute adminOnly><AdminChatConfig /></ProtectedRoute>} />
        <Route path="/admin/permissoes" element={<ProtectedRoute adminOnly><AdminPermissoes /></ProtectedRoute>} />
        <Route path="/admin/guia" element={<ProtectedRoute adminOnly><AdminGuia /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
