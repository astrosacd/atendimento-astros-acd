// App.tsx - Main application router
import InstagramModule from "./pages/InstagramModule";
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
import AdminRecaptcha from "./pages/AdminRecaptcha";
import AdminWebhooks from "./pages/AdminWebhooks";
import FormulariosAtomicat from "./pages/FormulariosAtomicat";
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
import AdminPlanosRevendedor from "./pages/AdminPlanosRevendedor";
import AdminPredefinedProducts from "./pages/AdminPredefinedProducts";
import ConsultaNumeros from "./pages/ConsultaNumeros";
import ConsultaNumerosHistorico from "./pages/ConsultaNumerosHistorico";
import ConsultaNumerosConfig from "./pages/ConsultaNumerosConfig";
import ConsultaNumerosApiKeys from "./pages/ConsultaNumerosApiKeys";
import ConsultaNumerosWebhooks from "./pages/ConsultaNumerosWebhooks";
import ConsultaNumerosGuia from "./pages/ConsultaNumerosGuia";
import AdminGateway from "./pages/AdminGateway";
import AdminChamados from "./pages/AdminChamados";
import AdminChamadosConfig from "./pages/AdminChamadosConfig";
import AdminChamadosWebhooks from "./pages/AdminChamadosWebhooks";
import AdminChamadosApiKeys from "./pages/AdminChamadosApiKeys";
import AdminChamadosGuia from "./pages/AdminChamadosGuia";
import AdminRelatorios from "./pages/AdminRelatorios";
import AdminIA from "./pages/AdminIA";
import AdminHealthDashboard from "./pages/AdminHealthDashboard";
import AdminSegurancaPagamento from "./pages/AdminSegurancaPagamento";
import Tarefas from "./pages/Tarefas";
import Propostas from "./pages/Propostas";
import PropostaEditor from "./pages/PropostaEditor";
import PropostasConfig from "./pages/PropostasConfig";
import Followups from "./pages/Followups";
import Despesas from "./pages/Despesas";
import KanbanClientes from "./pages/KanbanClientes";
import LeadHunter from "./pages/LeadHunter";
import Agenda from "./pages/Agenda";
import GeradorLinkPagamento from "./pages/GeradorLinkPagamento";
import GrafoClientes from "./pages/GrafoClientes";
import CentralAjuda from "./pages/CentralAjuda";
import ChamadosPublico from "./pages/public/ChamadosPublico";
import PropostaPublica from "./pages/public/PropostaPublica";
import Catalogo from "./pages/public/Catalogo";
import Checkout from "./pages/public/Checkout";
import Sucesso from "./pages/public/Sucesso";
import CredenciaisPublica from "./pages/public/CredenciaisPublica";
import LinkPagamentoPublico from "./pages/public/LinkPagamentoPublico";
import ValidacaoSmsPublica from "./pages/public/ValidacaoSmsPublica";
import ResultadoSmsPublico from "./pages/public/ResultadoSmsPublico";
import SharedKanban from "./pages/public/SharedKanban";
import SalaAgentesPublica from "./pages/public/SalaAgentesPublica";
import TemporaryAccessHandler from "./pages/public/TemporaryAccessHandler";
import SocialReportPublico from "./pages/public/SocialReportPublico";
import InstagramPrivacidade from "./pages/public/InstagramPrivacidade";
import InstagramTermos from "./pages/public/InstagramTermos";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import SalaAgentes from "./pages/SalaAgentes";
import InstagramCreate from "./pages/InstagramCreate";
import InstagramHistory from "./pages/InstagramHistory";
import InstagramSettings from "./pages/InstagramSettings";
import InstagramOAuthCallback from "./pages/InstagramOAuthCallback";
import AutorizarInstagram from "./pages/AutorizarInstagram";
import LigacoesIA from "./pages/LigacoesIA";
import CentralSMS from "./pages/CentralSMS";
import FilaExecutando from "./pages/FilaExecutando";
import FilaSMSExecutando from "./pages/FilaSMSExecutando";

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
      {/* Auth - redireciona para catalogo se não logado ou para dashboard se logado */}
      <Route path="/auth" element={user && isApproved ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      
      {/* Rota raiz - redireciona para catálogo (público) se não logado, ou dashboard se logado */}
      <Route path="/" element={
        user && isApproved 
          ? <ProtectedRoute permission="view_dashboard"><Dashboard /></ProtectedRoute>
          : <Navigate to="/auth" replace />
      } />
      <Route path="/dashboard" element={<ProtectedRoute permission="view_dashboard"><Dashboard /></ProtectedRoute>} />
      <Route path="/sala-agentes" element={<ProtectedRoute permission="view_sala_agentes"><SalaAgentes /></ProtectedRoute>} />
      
      {/* Client Management - permission-based */}
      <Route path="/cadastrar" element={<ProtectedRoute permission="create_clients"><CadastrarCliente /></ProtectedRoute>} />
      <Route path="/consultar" element={<ProtectedRoute permission="view_clients"><ConsultarCliente /></ProtectedRoute>} />
      <Route path="/atualizar" element={<ProtectedRoute permission="update_clients"><AtualizarCliente /></ProtectedRoute>} />
      <Route path="/excluir" element={<ProtectedRoute permission="delete_clients"><ExcluirCliente /></ProtectedRoute>} />
      
      {/* Admin Routes - permission-based */}
      <Route path="/usuarios" element={<ProtectedRoute permission="manage_users"><GerenciarUsuarios /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute permission="manage_settings"><Admin /></ProtectedRoute>} />
      <Route path="/admin/recuperacao-senha" element={<ProtectedRoute permission="manage_settings"><AdminRecuperacaoSenha /></ProtectedRoute>} />
      <Route path="/admin/recaptcha" element={<ProtectedRoute permission="manage_recaptcha"><AdminRecaptcha /></ProtectedRoute>} />
      <Route path="/admin/webhooks" element={<ProtectedRoute permission="manage_webhooks"><AdminWebhooks /></ProtectedRoute>} />
      <Route path="/admin/formularios-atomicat" element={<ProtectedRoute permission="manage_webhooks"><FormulariosAtomicat /></ProtectedRoute>} />
      <Route path="/admin/api" element={<ProtectedRoute permission="manage_api"><AdminApiKeys /></ProtectedRoute>} />
      <Route path="/admin/logs" element={<ProtectedRoute permission="view_logs"><AdminAuditLogs /></ProtectedRoute>} />
      <Route path="/admin/activity" element={<ProtectedRoute permission="view_logs"><AdminActivityLogs /></ProtectedRoute>} />
      <Route path="/admin/cobranca" element={<ProtectedRoute permission="manage_billing"><AdminCobranca /></ProtectedRoute>} />
      <Route path="/admin/seguranca-pagamento" element={<ProtectedRoute permission="view_payment_security"><AdminSegurancaPagamento /></ProtectedRoute>} />
      <Route path="/admin/chat" element={<ProtectedRoute permission="manage_settings"><AdminChatConfig /></ProtectedRoute>} />
      <Route path="/admin/permissoes" element={<ProtectedRoute permission="manage_permissions"><AdminPermissoes /></ProtectedRoute>} />
      <Route path="/admin/guia" element={<ProtectedRoute permission="view_guia"><AdminGuia /></ProtectedRoute>} />
      <Route path="/admin/boas-vindas" element={<ProtectedRoute permission="manage_settings"><AdminBoasVindas /></ProtectedRoute>} />
      <Route path="/admin/tags" element={<ProtectedRoute permission="manage_settings"><AdminTags /></ProtectedRoute>} />
      <Route path="/admin/produtos" element={<ProtectedRoute permission="manage_predefined_products"><AdminPredefinedProducts /></ProtectedRoute>} />
      <Route path="/admin/divulgador" element={<ProtectedRoute permission="view_divulgador"><AdminDivulgador /></ProtectedRoute>} />
      <Route path="/admin/numeros" element={<ProtectedRoute permission="view_numeros"><AdminNumerosAquecimento /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros" element={<ProtectedRoute permission="view_consulta_numeros"><ConsultaNumeros /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/historico" element={<ProtectedRoute permission="view_history_consulta_numeros"><ConsultaNumerosHistorico /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/config" element={<ProtectedRoute permission="manage_config_consulta_numeros"><ConsultaNumerosConfig /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/api" element={<ProtectedRoute permission="api_consulta_numeros"><ConsultaNumerosApiKeys /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/webhooks" element={<ProtectedRoute permission="manage_webhooks_consulta_numeros"><ConsultaNumerosWebhooks /></ProtectedRoute>} />
      <Route path="/admin/consulta-numeros/guia" element={<ProtectedRoute permission="view_consulta_numeros"><ConsultaNumerosGuia /></ProtectedRoute>} />
      
      {/* Gateway Route */}
      <Route path="/admin/gateway" element={<ProtectedRoute permission="view_gateway"><AdminGateway /></ProtectedRoute>} />
      
      {/* Revendedor Routes */}
      <Route path="/admin/revendedor" element={<ProtectedRoute permission="view_revendedor"><AdminPlanosRevendedor /></ProtectedRoute>} />
      
      {/* Chamados Routes */}
      <Route path="/admin/chamados" element={<ProtectedRoute permission="chamados.view"><AdminChamados /></ProtectedRoute>} />
      <Route path="/admin/chamados/config" element={<ProtectedRoute permission="chamados.config"><AdminChamadosConfig /></ProtectedRoute>} />
      <Route path="/admin/chamados/webhooks" element={<ProtectedRoute permission="chamados.webhooks"><AdminChamadosWebhooks /></ProtectedRoute>} />
      <Route path="/admin/chamados/api" element={<ProtectedRoute permission="chamados.api_keys"><AdminChamadosApiKeys /></ProtectedRoute>} />
      <Route path="/admin/chamados/guia" element={<ProtectedRoute permission="chamados.view"><AdminChamadosGuia /></ProtectedRoute>} />
      
      {/* Relatórios Route */}
      <Route path="/admin/relatorios" element={<ProtectedRoute permission="view_reports"><AdminRelatorios /></ProtectedRoute>} />
      
      {/* AI Intelligence Route */}
      <Route path="/admin/ia" element={<ProtectedRoute permission="view_sales_forecast"><AdminIA /></ProtectedRoute>} />
      <Route path="/admin/saude" element={<ProtectedRoute permission="manage_system_health"><AdminHealthDashboard /></ProtectedRoute>} />
      
      {/* Tarefas Route */}
      <Route path="/tarefas" element={<ProtectedRoute permission="manage_tasks"><Tarefas /></ProtectedRoute>} />
      
      {/* Propostas Routes */}
      <Route path="/propostas" element={<ProtectedRoute permission="view_proposals"><Propostas /></ProtectedRoute>} />
      <Route path="/propostas/config" element={<ProtectedRoute permission="configure_proposal_sending"><PropostasConfig /></ProtectedRoute>} />
      <Route path="/propostas/:id" element={<ProtectedRoute permission="view_proposals"><PropostaEditor /></ProtectedRoute>} />
      
      {/* Follow-ups Route */}
      <Route path="/followups" element={<ProtectedRoute permission="view_followups"><Followups /></ProtectedRoute>} />
      
      {/* Despesas Route */}
      <Route path="/despesas" element={<ProtectedRoute permission="view_despesas"><Despesas /></ProtectedRoute>} />
      <Route path="/kanban" element={<ProtectedRoute permission="view_pipeline"><KanbanClientes /></ProtectedRoute>} />
      <Route path="/lead-hunter" element={<ProtectedRoute permission="view_lead_hunter"><LeadHunter /></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute permission="view_agenda"><Agenda /></ProtectedRoute>} />
      <Route path="/link-pagamento" element={<ProtectedRoute permission="view_payment_links"><GeradorLinkPagamento /></ProtectedRoute>} />
      <Route path="/grafo-clientes" element={<ProtectedRoute permission="view_client_graph"><GrafoClientes /></ProtectedRoute>} />
      <Route path="/central-ajuda" element={<ProtectedRoute permission="view_central_ajuda"><CentralAjuda /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
      
      {/* Instagram Module */}
      <Route path="/instagram" element={<ProtectedRoute permission="view_instagram"><InstagramModule /></ProtectedRoute>} />
      {/* Callback OAuth do Instagram/Facebook: NÃO pode estar protegido — o Facebook abre direto e o state+edge function fazem a validação */}
      <Route path="/instagram/oauth-callback" element={<InstagramOAuthCallback />} />

      {/* Ligações IA */}
      <Route path="/ligacoes-ia" element={<ProtectedRoute permission="view_ligacoes_ia"><LigacoesIA /></ProtectedRoute>} />
      <Route path="/ligacoes-ia/fila-executando" element={<FilaExecutando />} />
      
      {/* Central de SMS */}
      <Route path="/central-sms" element={<ProtectedRoute permission="view_central_sms"><CentralSMS /></ProtectedRoute>} />
      <Route path="/central-sms/fila-executando" element={<FilaSMSExecutando />} />
      
      {/* Public Routes - NO AUTH */}
      <Route path="/chamados" element={<ChamadosPublico />} />
      <Route path="/chamados/*" element={<ChamadosPublico />} />
      <Route path="/proposta/:id" element={<PropostaPublica />} />
      <Route path="/catalogo" element={<Catalogo />} />
      <Route path="/loja/:customSlug" element={<Catalogo />} />
      <Route path="/p/:slug" element={<Checkout />} />
      <Route path="/sucesso" element={<Sucesso />} />
      <Route path="/credenciais/:token" element={<CredenciaisPublica />} />
      <Route path="/autorizar-instagram/:token" element={<AutorizarInstagram />} />
      <Route path="/link-pagamento/:token" element={<LinkPagamentoPublico />} />
      <Route path="/validacao-sms/:token" element={<ValidacaoSmsPublica />} />
      <Route path="/resultado-sms/:token" element={<ResultadoSmsPublico />} />
      <Route path="/public/pipeline/:token" element={<SharedKanban />} />
      <Route path="/access/:token" element={<TemporaryAccessHandler />} />
      <Route path="/public/sala-agentes" element={<SalaAgentesPublica />} />
      <Route path="/r/social/:token" element={<SocialReportPublico />} />
      <Route path="/instagram/privacidade" element={<InstagramPrivacidade />} />
      <Route path="/instagram/termos" element={<InstagramTermos />} />
      <Route path="/privacidade" element={<InstagramPrivacidade />} />
      <Route path="/termos" element={<InstagramTermos />} />
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
