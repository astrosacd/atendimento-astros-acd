import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ChatPopup from "@/components/ChatPopup";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CadastrarCliente from "./pages/CadastrarCliente";
import ConsultarCliente from "./pages/ConsultarCliente";
import AtualizarCliente from "./pages/AtualizarCliente";
import ExcluirCliente from "./pages/ExcluirCliente";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
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
        <Route path="/cadastrar" element={<ProtectedRoute adminOnly><CadastrarCliente /></ProtectedRoute>} />
        <Route path="/consultar" element={<ProtectedRoute><ConsultarCliente /></ProtectedRoute>} />
        <Route path="/atualizar" element={<ProtectedRoute adminOnly><AtualizarCliente /></ProtectedRoute>} />
        <Route path="/excluir" element={<ProtectedRoute adminOnly><ExcluirCliente /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute adminOnly><GerenciarUsuarios /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && isApproved && <ChatPopup />}
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
