import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RolePermission {
  role_name: string;
  permission_key: string;
}

export function usePermissions() {
  const { userRole, isAdmin } = useAuth();

  const { data: permissions = [], isLoading: queryLoading } = useQuery({
    queryKey: ['user-permissions', userRole],
    queryFn: async () => {
      if (!userRole) return [];
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_name', userRole);
      
      if (error) throw error;
      return data.map((p: { permission_key: string }) => p.permission_key);
    },
    enabled: !!userRole,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent refetch on navigation
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Prevent flickering when switching tabs
  });

  const hasPermission = (permissionKey: string): boolean => {
    if (isAdmin) return true;
    return permissions.includes(permissionKey);
  };

  const canViewDashboard = () => hasPermission('view_dashboard');
  const canViewClients = () => hasPermission('view_clients');
  const canCreateClients = () => hasPermission('create_clients');
  const canUpdateClients = () => hasPermission('update_clients');
  const canDeleteClients = () => hasPermission('delete_clients');
  const canExportClients = () => hasPermission('export_clients');
  const canManageUsers = () => hasPermission('manage_users');
  const canManagePermissions = () => hasPermission('manage_permissions');
  const canManageBilling = () => hasPermission('manage_billing');
  const canManageWebhooks = () => hasPermission('manage_webhooks');
  const canManageApi = () => hasPermission('manage_api');
  const canViewLogs = () => hasPermission('view_logs');
  const canManageSettings = () => hasPermission('manage_settings');
  const canManageIntegrations = () => hasPermission('manage_integrations');
  const canViewDivulgador = () => hasPermission('view_divulgador');
  const canManageDivulgadorConfig = () => hasPermission('manage_divulgador_config');
  const canManageDivulgadorCampaigns = () => hasPermission('manage_divulgador_campaigns');
  const canManageDivulgadorGroups = () => hasPermission('manage_divulgador_groups');
  const canManageDivulgadorMessages = () => hasPermission('manage_divulgador_messages');
  const canManageDivulgadorParticipants = () => hasPermission('manage_divulgador_participants');
  const canViewDivulgadorReports = () => hasPermission('view_divulgador_reports');
  
  // Status de Números permissions
  const canViewNumeros = () => hasPermission('view_numeros');
  const canCreateNumeros = () => hasPermission('create_numeros');
  const canEditNumeros = () => hasPermission('edit_numeros');
  const canChangeNumerosStatus = () => hasPermission('change_numeros_status');
  const canChangeNumerosObs = () => hasPermission('change_numeros_obs');
  const canDeleteNumeros = () => hasPermission('delete_numeros');
  const canExportNumeros = () => hasPermission('export_numeros');
  const canViewNumerosHistory = () => hasPermission('view_numeros_history');
  const canManageNumerosWebhooks = () => hasPermission('manage_numeros_webhooks');
  const canManageNumerosApi = () => hasPermission('manage_numeros_api');
  const canRestoreNumeros = () => hasPermission('restore_numeros_aquecimento');
  const canReturnToStock = () => hasPermission('return_to_stock_numeros');
  const canDeleteSoldPermanent = () => hasPermission('delete_sold_numeros_permanent');

  // Consulta de Números permissions
  const canViewConsultaNumeros = () => hasPermission('view_consulta_numeros');
  const canViewValidacaoSms = () => hasPermission('view_validacao_sms');
  const canShareValidacaoSms = () => hasPermission('share_validacao_sms');
  const canManageConsultaNumerosReminders = () => hasPermission('manage_consulta_numeros_reminders');
  const canViewConsultaNumerosReminderLogs = () => hasPermission('view_consulta_numeros_reminder_logs');
  const canViewQuickNumberSearch = () => hasPermission('view_quick_number_search');

  // Chamados permissions
  const canViewChamados = () => hasPermission('view_chamados');
  const canManageChamados = () => hasPermission('manage_chamados');
  const canManageChamadosConfig = () => hasPermission('manage_chamados_config');
  const canManageChamadosWebhooks = () => hasPermission('manage_chamados_webhooks');
  const canManageChamadosApi = () => hasPermission('manage_chamados_api');
  const canCreateChamados = () => hasPermission('chamados.create') || hasPermission('create_chamados');

  // Guia permissions
  const canViewGuia = () => hasPermission('view_guia');
  const canViewGuiaComunicacao = () => hasPermission('view_guia_comunicacao');
  const canViewGuiaIntegracoes = () => hasPermission('view_guia_integracoes');
  const canViewGuiaUsuarios = () => hasPermission('view_guia_usuarios');
  const canViewGuiaCobranca = () => hasPermission('view_guia_cobranca');
  const canViewGuiaClientes = () => hasPermission('view_guia_clientes');
  const canViewGuiaDivulgador = () => hasPermission('view_guia_divulgador');
  const canViewGuiaNumeros = () => hasPermission('view_guia_numeros');
  const canViewGuiaAvancado = () => hasPermission('view_guia_avancado');
  const canViewGuiaChamados = () => hasPermission('view_guia_chamados');

  // Gateway permissions
  const canViewGateway = () => hasPermission('view_gateway');
  const canManageGatewayProducts = () => hasPermission('manage_gateway_products');
  const canManageGatewayOrders = () => hasPermission('manage_gateway_orders');
  const canManageGatewaySettings = () => hasPermission('manage_gateway_settings');
  const canViewGatewayReports = () => hasPermission('view_gateway_reports');
  const canViewGatewayEvents = () => hasPermission('view_gateway_events');
  const canViewGatewayCouponUsages = () => hasPermission('view_gateway_coupon_usages');

  // Cobrança permissions
  const canViewCobrancaMetricas = () => hasPermission('view_cobranca_metricas');
  const canViewCobrancaRecuperacao = () => hasPermission('view_cobranca_recuperacao');
  const canViewCobrancaConfig = () => hasPermission('view_cobranca_config');
  const canViewCobrancaPagamentos = () => hasPermission('view_cobranca_pagamentos');
  const canViewCobrancaIA = () => hasPermission('view_cobranca_ia');
  const canViewCobrancaCanais = () => hasPermission('view_cobranca_canais');
  const canViewCobrancaMensagens = () => hasPermission('view_cobranca_mensagens');
  const canViewCobrancaRecibo = () => hasPermission('view_cobranca_recibo');
  const canViewCobrancaRelatorios = () => hasPermission('view_cobranca_relatorios');
  const canViewCobrancaLogs = () => hasPermission('view_cobranca_logs');
  const canManageCobrancaMetaTemplates = () => hasPermission('manage_cobranca_meta_templates');
  const canManageCobrancaWebhooks = () => hasPermission('manage_cobranca_webhooks');
  const canCleanupCobrancaOrphanPayments = () => hasPermission('cleanup_cobranca_orphan_payments');


  // Revendedor permissions
  const canViewRevendedor = () => hasPermission('view_revendedor');
  const canManageRevendedorPlanos = () => hasPermission('manage_revendedor_planos');
  const canManageRevendedorConfig = () => hasPermission('manage_revendedor_config');

  // Tasks permission
  const canManageTasks = () => hasPermission('manage_tasks');

  // Social Media credentials
  const canViewSocialCredentials = () => hasPermission('view_social_credentials');
  const canManageSocialCredentials = () => hasPermission('manage_social_credentials');
  const canShareSocialCredentials = () => hasPermission('share_social_credentials');

  // Server / Tool credentials (Evolution, Chatwoot, n8n, VPS, etc.)
  const canViewServerCredentials = () => hasPermission('view_server_credentials');
  const canManageServerCredentials = () => hasPermission('manage_server_credentials');
  const canShareServerCredentials = () => hasPermission('share_server_credentials');
  const canManageServerToolTypes = () => hasPermission('manage_server_tool_types');

  // WhatsApp Groups
  const canCreateWhatsAppGroups = () => hasPermission('create_whatsapp_groups');
  const canFinalizeWhatsAppGroups = () => hasPermission('finalize_whatsapp_groups');

  // Reports permission
  const canViewReports = () => hasPermission('view_reports');
  const canViewReportsAI = () => hasPermission('view_reports_ai');
  const canManageReportsSchedule = () => hasPermission('manage_reports_schedule');

  // Client detail permissions
  const canViewClientTimeline = () => hasPermission('view_client_timeline');
  const canManageClientLogos = () => hasPermission('manage_client_logos');
  const canManageClientLicenses = () => hasPermission('manage_client_licenses');
  const canViewClientFiles = () => hasPermission('view_client_files');
  const canViewClientPurchases = () => hasPermission('view_client_purchases');
  const canViewClientPayments = () => hasPermission('view_client_payments');
  const canViewClientAI = () => hasPermission('view_client_ai');
  const canViewClientGraph = () => hasPermission('view_client_graph');

  // Agenda history
  const canViewAgendaHistory = () => hasPermission('view_agenda_history');

  // Despesas permissions
  const canViewDespesas = () => hasPermission('view_despesas');
  const canManageDespesas = () => hasPermission('manage_despesas');
  const canManageDespesasCron = () => hasPermission('manage_despesas_cron');

  // Propostas permissions
  const canViewProposals = () => hasPermission('view_proposals');
  const canCreateProposals = () => hasPermission('create_proposals');
  const canEditProposals = () => hasPermission('edit_proposals');
  const canDeleteProposals = () => hasPermission('delete_proposals');
  const canShareProposals = () => hasPermission('share_proposals');
  const canManageProposalTemplates = () => hasPermission('manage_proposal_templates');
  const canViewProposalHistory = () => hasPermission('view_proposal_history');
  const canViewProposalsDashboard = () => hasPermission('view_proposals_dashboard');

  // Follow-ups permissions
  const canViewFollowups = () => hasPermission('view_followups');
  const canCreateFollowups = () => hasPermission('create_followups');
  const canEditFollowups = () => hasPermission('edit_followups');
  const canDeleteFollowups = () => hasPermission('delete_followups');
  const canManageFollowupConfig = () => hasPermission('manage_followup_config');
  const canManageFollowupWebhooks = () => hasPermission('manage_followup_webhooks');

  // Pipeline permissions
  const canViewPipeline = () => hasPermission('view_pipeline');
  const canManagePipelineStages = () => hasPermission('manage_pipeline_stages');
  const canManagePipelineAutomations = () => hasPermission('manage_pipeline_automations');
  const canViewPipelineAI = () => hasPermission('view_pipeline_ai');
  const canManagePipelineAI = () => hasPermission('manage_pipeline_ai');
  const canManagePipelineChatwoot = () => hasPermission('manage_pipeline_chatwoot');
  const canSharePipeline = () => hasPermission('share_pipeline');

  // Lead Hunter permissions
  const canViewLeadHunter = () => hasPermission('view_lead_hunter');
  const canManageLeadHunterLeads = () => hasPermission('manage_lead_hunter_leads');
  const canManageLeadHunterCampanhas = () => hasPermission('manage_lead_hunter_campanhas');
  const canManageLeadHunterConfig = () => hasPermission('manage_lead_hunter_config');
  const canManageLeadHunterBaserow = () => hasPermission('manage_lead_hunter_baserow');
  const canViewLeadHunterHistorico = () => hasPermission('view_lead_hunter_historico');
  const canManageLeadHunterBusca = () => hasPermission('manage_lead_hunter_busca');
  const canManageLeadHunterMetaTemplates = () => hasPermission('manage_lead_hunter_meta_templates');

  // Agenda permissions
  const canViewAgenda = () => hasPermission('view_agenda');
  const canCreateAgendaEvents = () => hasPermission('create_agenda_events');
  const canEditAgendaEvents = () => hasPermission('edit_agenda_events');
  const canDeleteAgendaEvents = () => hasPermission('delete_agenda_events');
  const canManageAgendaConfig = () => hasPermission('manage_agenda_config');
  const canAccessAgendaMeetLinks = () => hasPermission('access_agenda_meet_links');

  // Payment Links permissions
  const canViewPaymentLinks = () => hasPermission('view_payment_links');
  const canGeneratePaymentLinks = () => hasPermission('generate_payment_links');
  const canSharePaymentLinks = () => hasPermission('share_payment_links');
  const canCheckPaymentLinkStatus = () => hasPermission('check_payment_link_status');
  const canManagePaymentLinkWebhook = () => hasPermission('manage_payment_link_webhook');

  // New modules
  const canViewApprovals = () => hasPermission('view_approvals');
  const canManageApprovals = () => hasPermission('manage_approvals');
  const canViewAutomations = () => hasPermission('view_automations');
  const canManageAutomations = () => hasPermission('manage_automations');
  const canViewAutomationLogs = () => hasPermission('view_automation_logs');
  const canViewChat = () => hasPermission('view_chat');
  const canManageChat = () => hasPermission('manage_chat');
  const canViewSalesForecast = () => hasPermission('view_sales_forecast');
  const canManageSalesForecast = () => hasPermission('manage_sales_forecast');
  const canViewWhatsappInstances = () => hasPermission('view_whatsapp_instances');
  const canManageWhatsappInstances = () => hasPermission('manage_whatsapp_instances');

  const canViewPaymentSecurity = () => hasPermission('view_payment_security');
  const canRegisterPixpaguePayment = () => hasPermission('register_pixpague_payment');

  // Central de Ajuda
  const canViewCentralAjuda = () => hasPermission('view_central_ajuda');

  // Gestão de Produtos Predefinidos
  const canManagePredefinedProducts = () => hasPermission('manage_predefined_products');

  // Instagram permissions
  const canViewInstagram = () => hasPermission('view_instagram');
  const canCreateInstagramPost = () => hasPermission('create_instagram_post');
  const canManageInstagramSettings = () => hasPermission('manage_instagram_settings');
  const canViewInstagramHistory = () => hasPermission('view_instagram_history');
  const canManageInstagramEspionage = () => hasPermission('manage_instagram_espionage');
  const canManageTemporaryAccess = () => hasPermission('manage_temporary_access');
  const canViewGuiaInstagram = () => hasPermission('view_guia_instagram');
  const canManageSystemHealth = () => hasPermission('manage_system_health');

  return {
    permissions,
    isLoading: queryLoading || (!!userRole && permissions.length === 0 && queryLoading),
    hasPermission,
    canViewDashboard,
    canViewClients,
    canCreateClients,
    canUpdateClients,
    canDeleteClients,
    canExportClients,
    canManageUsers,
    canManagePermissions,
    canManageBilling,
    canManageWebhooks,
    canManageApi,
    canViewLogs,
    canManageSettings,
    canManageIntegrations,
    canViewDivulgador,
    canManageDivulgadorConfig,
    canManageDivulgadorCampaigns,
    canManageDivulgadorGroups,
    canManageDivulgadorMessages,
    canManageDivulgadorParticipants,
    canViewDivulgadorReports,
    canViewNumeros,
    canCreateNumeros,
    canEditNumeros,
    canChangeNumerosStatus,
    canChangeNumerosObs,
    canDeleteNumeros,
    canExportNumeros,
    canViewNumerosHistory,
    canManageNumerosWebhooks,
    canManageNumerosApi,
    canRestoreNumeros,
    canReturnToStock,
    canDeleteSoldPermanent,
    canViewConsultaNumeros,
    canViewValidacaoSms,
    canShareValidacaoSms,
    canManageConsultaNumerosReminders,
    canViewConsultaNumerosReminderLogs,
    canViewQuickNumberSearch,
    canViewChamados,
    canManageChamados,
    canManageChamadosConfig,
    canManageChamadosWebhooks,
    canManageChamadosApi,
    canCreateChamados,
    canViewGuia,
    canViewGuiaComunicacao,
    canViewGuiaIntegracoes,
    canViewGuiaUsuarios,
    canViewGuiaCobranca,
    canViewGuiaClientes,
    canViewGuiaDivulgador,
    canViewGuiaNumeros,
    canViewGuiaAvancado,
    canViewGuiaChamados,
    canViewGuiaServidores: () => hasPermission('view_guia_servidores'),
    canViewGateway,
    canManageGatewayProducts,
    canManageGatewayOrders,
    canManageGatewaySettings,
    canViewGatewayReports,
    canViewGatewayEvents,
    canViewGatewayCouponUsages,
    // Cobrança
    canViewCobrancaMetricas,
    canViewCobrancaRecuperacao,
    canViewCobrancaConfig,
    canViewCobrancaPagamentos,
    canViewCobrancaIA,
    canViewCobrancaCanais,
    canViewCobrancaMensagens,
    canViewCobrancaRecibo,
    canViewCobrancaRelatorios,
    canViewCobrancaLogs,
    canManageCobrancaMetaTemplates,
    canManageCobrancaWebhooks,
    canCleanupCobrancaOrphanPayments,
    canViewRevendedor,
    canManageRevendedorPlanos,
    canManageRevendedorConfig,
    canManageTasks,
    canViewReports,
    canViewReportsAI,
    canManageReportsSchedule,
    canViewClientTimeline,
    canManageClientLogos,
    canManageClientLicenses,
    canViewClientFiles,
    canViewClientPurchases,
    canViewClientPayments,
    canViewClientAI,
    canViewClientGraph,
    canViewAgendaHistory,
    // Propostas
    canViewProposals,
    canCreateProposals,
    canEditProposals,
    canDeleteProposals,
    canShareProposals,
    canManageProposalTemplates,
    canViewProposalHistory,
    canViewProposalsDashboard,
    // Despesas
    canViewDespesas,
    canManageDespesas,
    canManageDespesasCron,
    // Follow-ups
    canViewFollowups,
    canCreateFollowups,
    canEditFollowups,
    canDeleteFollowups,
    canManageFollowupConfig,
    canManageFollowupWebhooks,
    // Pipeline
    canViewPipeline,
    canManagePipelineStages,
    canManagePipelineAutomations,
    canViewPipelineAI,
    canManagePipelineAI,
    canManagePipelineChatwoot,
    canSharePipeline,
    // Lead Hunter
    canViewLeadHunter,
    canManageLeadHunterLeads,
    canManageLeadHunterCampanhas,
    canManageLeadHunterConfig,
    canManageLeadHunterBaserow,
    canViewLeadHunterHistorico,
    canManageLeadHunterBusca,
    canManageLeadHunterMetaTemplates,
    // Social Media
    canViewSocialCredentials,
    canManageSocialCredentials,
    canShareSocialCredentials,
    // Server / Tool credentials
    canViewServerCredentials,
    canManageServerCredentials,
    canShareServerCredentials,
    canManageServerToolTypes,
    // WhatsApp Groups
    canCreateWhatsAppGroups,
    canFinalizeWhatsAppGroups,
    // Agenda
    canViewAgenda,
    canCreateAgendaEvents,
    canEditAgendaEvents,
    canDeleteAgendaEvents,
    canManageAgendaConfig,
    canAccessAgendaMeetLinks,
    // Payment Links
    canViewPaymentLinks,
    canGeneratePaymentLinks,
    canSharePaymentLinks,
    canCheckPaymentLinkStatus,
    canManagePaymentLinkWebhook,
    // New modules
    canViewApprovals,
    canManageApprovals,
    canViewAutomations,
    canManageAutomations,
    canViewAutomationLogs,
    canViewChat,
    canManageChat,
    canViewSalesForecast,
    canManageSalesForecast,
    canViewWhatsappInstances,
    canManageWhatsappInstances,
    canViewPaymentSecurity,
    canRegisterPixpaguePayment,
    // Central de Ajuda
    canViewCentralAjuda,
    canManagePredefinedProducts,
    canViewInstagram,
    canCreateInstagramPost,
    canManageInstagramSettings,
    canViewInstagramHistory,
    canManageInstagramEspionage,
    canManageTemporaryAccess,
    canViewGuiaInstagram,
    canViewInstagramReports: () => hasPermission('view_instagram_reports'),
    canManageSystemHealth,
  };
}
