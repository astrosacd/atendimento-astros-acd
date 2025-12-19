import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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
import AdminActivityLogs from "./pages/AdminActivityLogs";
import AdminBoasVindas from "./pages/AdminBoasVindas";
import AdminTags from "./pages/AdminTags";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import AdminDivulgador from "./pages/AdminDivulgador";
import AdminNumerosAquecimento from "./pages/AdminNumerosAquecimento";
import ConsultaNumeros from "./pages/ConsultaNumeros";
import ConsultaNumerosHistorico from "./pages/ConsultaNumerosHistorico";
import ConsultaNumerosConfig from "./pages/ConsultaNumerosConfig";
import ConsultaNumerosApiKeys from "./pages/ConsultaNumerosApiKeys";
import ConsultaNumerosWebhooks from "./pages/ConsultaNumerosWebhooks";
import ConsultaNumerosGuia from "./pages/ConsultaNumerosGuia";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
    <Routes>
      <Route path="/auth" element={user && isApproved ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      
      {/* Dashboard - requires view_dashboard permission */}
      <Route path="/" element={<ProtectedRoute permission="view_dashboard"><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute permission="view_dashboard"><Dashboard /></ProtectedRoute>} />
      
      {/* Client Management - permission-based */}
      <Route path="/cadastrar" element={<ProtectedRoute permission="create_clients"><CadastrarCliente /></ProtectedRoute>} />
      <Route path="/consultar" element={<ProtectedRoute permission="view_clients"><ConsultarCliente /></ProtectedRoute>} />
      <Route path="/atualizar" element={<ProtectedRoute permission="update_clients"><AtualizarCliente /></ProtectedRoute>} />
      <Route path="/excluir" element={<ProtectedRoute permission="delete_clients"><ExcluirCliente /></ProtectedRoute>} />
      
      {/* Admin Routes - permission-based */}
      <Route path="/usuarios" element={<ProtectedRoute permission="manage_users"><GerenciarUsuarios /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute permission="manage_settings"><Admin /></ProtectedRoute>} />
      <Route path="/admin/recuperacao-senha" element={<ProtectedRoute permission="manage_settings"><AdminRecuperacaoSenha /></ProtectedRoute>} />
      <Route path="/admin/webhooks" element={<ProtectedRoute permission="manage_webhooks"><AdminWebhooks /></ProtectedRoute>} />
      <Route path="/admin/api" element={<ProtectedRoute permission="manage_api"><AdminApiKeys /></ProtectedRoute>} />
      <Route path="/admin/logs" element={<ProtectedRoute permission="view_logs"><AdminAuditLogs /></ProtectedRoute>} />
      <Route path="/admin/activity" element={<ProtectedRoute permission="view_logs"><AdminActivityLogs /></ProtectedRoute>} />
      <Route path="/admin/cobranca" element={<ProtectedRoute permission="manage_billing"><AdminCobranca /></ProtectedRoute>} />
      <Route path="/admin/chat" element={<ProtectedRoute permission="manage_settings"><AdminChatConfig /></ProtectedRoute>} />
      <Route path="/admin/permissoes" element={<ProtectedRoute permission="manage_permissions"><AdminPermissoes /></ProtectedRoute>} />
      <Route path="/admin/guia" element={<ProtectedRoute permission="manage_settings"><AdminGuia /></ProtectedRoute>} />
      <Route path="/admin/boas-vindas" element={<ProtectedRoute permission="manage_settings"><AdminBoasVindas /></ProtectedRoute>} />
      <Route path="/admin/tags" element={<ProtectedRoute permission="manage_settings"><AdminTags /></ProtectedRoute>} />
      <Route path="/admin/divulgador" element={<ProtectedRoute permission="view_divulgador"><AdminDivulgador /></ProtectedRoute>} />
      <Route path="/admin/numeros" element={<ProtectedRoute permission="view_numeros"><AdminNumerosAquecimento /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros" element={<ProtectedRoute permission="view_consulta_numeros"><ConsultaNumeros /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/historico" element={<ProtectedRoute permission="view_history_consulta_numeros"><ConsultaNumerosHistorico /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/config" element={<ProtectedRoute permission="manage_config_consulta_numeros"><ConsultaNumerosConfig /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/api" element={<ProtectedRoute permission="api_consulta_numeros"><ConsultaNumerosApiKeys /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/webhooks" element={<ProtectedRoute permission="manage_webhooks_consulta_numeros"><ConsultaNumerosWebhooks /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/guia" element={<ProtectedRoute permission="view_consulta_numeros"><ConsultaNumerosGuia /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
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
