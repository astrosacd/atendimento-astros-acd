import { useState, useRef, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  ArrowLeft, 
  BookOpen, 
  Mail, 
  MessageSquare, 
  Webhook, 
  Key, 
  Users, 
  CreditCard,
  Bot,
  Shield,
  CheckCircle2,
  AlertCircle,
  Tag,
  DollarSign,
  History,
  RotateCcw,
  Bell,
  BarChart3,
  Lock,
  FileBox,
  Database,
  HelpCircle,
  ChevronRight,
  Sparkles,
  Settings,
  Zap,
  FileText,
  LucideIcon,
  Megaphone,
  Share2,
  Send,
  Clock,
  Smartphone,
  ShoppingCart,
  Store,
  Package,
  PercentCircle,
  Receipt,
  Timer,
  BarChart,
  Ticket,
  ClipboardList,
  FileSignature,
  CalendarClock,
  Crosshair,
  Calendar,
  Link,
  Columns,
  Cog,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
}

interface GuideStep {
  title: string;
  content: string;
}

interface GuideCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description: string;
  steps: GuideStep[];
  tips: string[];
  permissionKey?: string; // Maps to permission for access control
}

interface GuideGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  categories: string[];
  permissionKey: string; // Permission required to see this group
}

// Mapping guide categories to permission keys
const categoryToPermission: Record<string, string> = {
  'gmail': 'view_guia_comunicacao',
  'evolution': 'view_guia_comunicacao',
  'boas-vindas': 'view_guia_comunicacao',
  'webhooks': 'view_guia_integracoes',
  'api': 'view_guia_integracoes',
  'mercadopago': 'view_guia_integracoes',
  'usuarios': 'view_guia_usuarios',
  'permissoes': 'view_guia_usuarios',
  'cobranca': 'view_guia_cobranca',
  'verificacao-pagamento': 'view_guia_cobranca',
  'tags': 'view_guia_clientes',
  'clientes-registro': 'view_guia_clientes',
  'restauracao': 'view_guia_clientes',
  'divulgador': 'view_guia_divulgador',
  'status-numeros': 'view_guia_numeros',
  'consulta-numeros': 'view_guia_numeros',
  'gateway-visao-geral': 'view_guia_gateway',
  'gateway-produtos': 'view_guia_gateway',
  'gateway-order-bumps': 'view_guia_gateway',
  'gateway-cupons': 'view_guia_gateway',
  'gateway-checkout': 'view_guia_gateway',
  'gateway-pedidos': 'view_guia_gateway',
  'gateway-config': 'view_guia_gateway',
  'chat': 'view_guia_avancado',
  'dashboard': 'view_guia_avancado',
  'logs-atividade': 'view_guia_avancado',
  'notificacoes': 'view_guia_avancado',
  'backup': 'view_guia_avancado',
  'troubleshooting': 'view_guia_avancado',
  'chamados-visao-geral': 'view_guia_chamados',
  'chamados-api': 'view_guia_chamados',
  'chamados-webhooks': 'view_guia_chamados',
  'chamados-config': 'view_guia_chamados',
  'relatorios-visao-geral': 'view_guia_relatorios',
  'relatorios-metricas': 'view_guia_relatorios',
  'relatorios-ia': 'view_guia_relatorios',
  'tarefas': 'view_guia_tarefas',
  'propostas-visao-geral': 'view_guia_propostas',
  'propostas-editor': 'view_guia_propostas',
  'propostas-envio': 'view_guia_propostas',
  'propostas-config': 'view_guia_propostas',
  'followups-visao-geral': 'view_guia_followups',
  'followups-config': 'view_guia_followups',
  'despesas-visao-geral': 'view_guia_despesas',
  'despesas-recorrencia': 'view_guia_despesas',
  'revendedor-visao-geral': 'view_guia_revendedor',
  'pipeline-visao-geral': 'view_guia_pipeline',
  'pipeline-automacoes': 'view_guia_pipeline',
  'lead-hunter-visao-geral': 'view_guia_lead_hunter',
  'lead-hunter-campanhas': 'view_guia_lead_hunter',
  'lead-hunter-busca': 'view_guia_lead_hunter',
  'agenda-visao-geral': 'view_guia_agenda',
  'agenda-config': 'view_guia_agenda',
  'link-pagamento-visao-geral': 'view_guia_link_pagamento',
  'social-media': 'view_social_credentials',
  'servidores-credenciais': 'view_guia_servidores',
  'servidores-ferramentas': 'view_guia_servidores',
  'servidores-compartilhamento': 'view_guia_servidores',
  'aprovacoes-visao-geral': 'view_guia_aprovacoes',
  'automacoes-visao-geral': 'view_guia_automacoes',
  'instagram': 'view_guia_instagram',
};

const AdminGuia = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { hasPermission, canViewGuia } = usePermissions();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll suave ao topo quando a categoria muda
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [activeCategory]);

  // Helper function to check if user can view a category
  const canViewCategory = (catId: string): boolean => {
    if (isAdmin) return true;
    if (!canViewGuia()) return false;
    
    const permissionKey = categoryToPermission[catId];
    if (!permissionKey) return true;
    
    return hasPermission(permissionKey);
  };

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles-guia'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('id, name, display_name, description')
        .order('name');
      if (error) throw error;
      return data as CustomRole[];
    },
  });

  const getRolesContent = () => {
    if (customRoles.length === 0) {
      return `- **Admin**: Acesso total ao sistema
- **Gerente**: CRUD de clientes próprios, sem acesso admin
- **Operador**: Cadastra e atualiza clientes, não exclui
- **Financeiro**: Acesso apenas ao módulo de Cobrança
- **Visualizador**: Apenas consulta clientes (read-only)`;
    }
    
    return customRoles.map(role => 
      `- **${role.display_name}**: ${role.description || 'Sem descrição'}`
    ).join('\n');
  };

  const guideGroups: GuideGroup[] = [
    {
      id: "comunicacao",
      title: "Comunicação",
      icon: MessageSquare,
      color: "text-green-400",
      categories: ["gmail", "evolution", "boas-vindas"],
      permissionKey: "view_guia_comunicacao"
    },
    {
      id: "integracao",
      title: "Integrações",
      icon: Zap,
      color: "text-purple-400",
      categories: ["webhooks", "api", "mercadopago"],
      permissionKey: "view_guia_integracoes"
    },
    {
      id: "usuarios-permissoes",
      title: "Usuários",
      icon: Users,
      color: "text-blue-400",
      categories: ["usuarios", "permissoes"],
      permissionKey: "view_guia_usuarios"
    },
    {
      id: "chamados",
      title: "Chamados",
      icon: Ticket,
      color: "text-orange-400",
      categories: ["chamados-visao-geral", "chamados-api", "chamados-webhooks", "chamados-config"],
      permissionKey: "view_guia_chamados"
    },
    {
      id: "financeiro",
      title: "Financeiro",
      icon: DollarSign,
      color: "text-emerald-400",
      categories: ["cobranca", "verificacao-pagamento"],
      permissionKey: "view_guia_cobranca"
    },
    {
      id: "clientes",
      title: "Clientes",
      icon: FileText,
      color: "text-amber-400",
      categories: ["tags", "clientes-registro", "tarefas"],
      permissionKey: "view_guia_clientes"
    },
    {
      id: "propostas",
      title: "Propostas",
      icon: FileSignature,
      color: "text-emerald-400",
      categories: ["propostas-visao-geral", "propostas-editor", "propostas-envio", "propostas-config"],
      permissionKey: "view_guia_propostas"
    },
    {
      id: "followups",
      title: "Follow-ups",
      icon: CalendarClock,
      color: "text-violet-400",
      categories: ["followups-visao-geral", "followups-config"],
      permissionKey: "view_guia_followups"
    },
    {
      id: "despesas-grupo",
      title: "Despesas",
      icon: Receipt,
      color: "text-orange-400",
      categories: ["despesas-visao-geral", "despesas-recorrencia"],
      permissionKey: "view_guia_despesas"
    },
    {
      id: "divulgacao",
      title: "Divulgação",
      icon: Megaphone,
      color: "text-orange-400",
      categories: ["divulgador"],
      permissionKey: "view_guia_divulgador"
    },
    {
      id: "numeros",
      title: "Números",
      icon: Smartphone,
      color: "text-lime-400",
      categories: ["status-numeros", "consulta-numeros"],
      permissionKey: "view_guia_numeros"
    },
    {
      id: "social-media",
      title: "Social Media",
      icon: Share2,
      color: "text-pink-400",
      categories: ["social-media"],
      permissionKey: "view_social_credentials"
    },
    {
      id: "servidores",
      title: "Servidores e Ferramentas",
      icon: Database,
      color: "text-blue-400",
      categories: ["servidores-credenciais", "servidores-ferramentas", "servidores-compartilhamento"],
      permissionKey: "view_guia_servidores"
    },
    {
      id: "gateway",
      title: "Gateway",
      icon: Store,
      color: "text-pink-400",
      categories: ["gateway-visao-geral", "gateway-produtos", "gateway-order-bumps", "gateway-cupons", "gateway-checkout", "gateway-pedidos", "gateway-config"],
      permissionKey: "view_guia_gateway"
    },
    {
      id: "revendedor",
      title: "Revendedor",
      icon: Store,
      color: "text-sky-400",
      categories: ["revendedor-visao-geral"],
      permissionKey: "view_guia_revendedor"
    },
    {
      id: "pipeline",
      title: "Pipeline",
      icon: Columns,
      color: "text-indigo-400",
      categories: ["pipeline-visao-geral", "pipeline-automacoes"],
      permissionKey: "view_guia_pipeline"
    },
    {
      id: "lead-hunter",
      title: "Lead Hunter",
      icon: Crosshair,
      color: "text-orange-400",
      categories: ["lead-hunter-visao-geral", "lead-hunter-campanhas", "lead-hunter-busca"],
      permissionKey: "view_guia_lead_hunter"
    },
    {
      id: "agenda-grupo",
      title: "Agenda",
      icon: Calendar,
      color: "text-blue-400",
      categories: ["agenda-visao-geral", "agenda-config"],
      permissionKey: "view_guia_agenda"
    },
    {
      id: "link-pagamento",
      title: "Link de Pagamento",
      icon: Link,
      color: "text-emerald-400",
      categories: ["link-pagamento-visao-geral"],
      permissionKey: "view_guia_link_pagamento"
    },
    {
      id: "relatorios",
      title: "Relatórios",
      icon: BarChart3,
      color: "text-cyan-400",
      categories: ["relatorios-visao-geral", "relatorios-metricas", "relatorios-ia"],
      permissionKey: "view_guia_relatorios"
    },
    {
      id: "sistema",
      title: "Sistema",
      icon: Settings,
      color: "text-slate-400",
      categories: ["chat", "dashboard", "logs-atividade", "restauracao", "notificacoes", "backup", "troubleshooting"],
      permissionKey: "view_guia_avancado"
    },
    {
      id: "aprovacoes-grupo",
      title: "Aprovações",
      icon: CheckCircle2,
      color: "text-emerald-400",
      categories: ["aprovacoes-visao-geral"],
      permissionKey: "view_guia_aprovacoes"
    },
    {
      id: "automacoes-grupo",
      title: "Automações",
      icon: Zap,
      color: "text-teal-400",
      categories: ["automacoes-visao-geral"],
      permissionKey: "view_guia_automacoes"
    },
    {
      id: "instagram-grupo",
      title: "Instagram",
      icon: Instagram,
      color: "text-pink-400",
      categories: ["instagram"],
      permissionKey: "view_guia_instagram"
    },
    {
      id: "seguros-grupo",
      title: "Seguro de Números",
      icon: Shield,
      color: "text-emerald-400",
      categories: ["seguros-visao-geral", "seguros-marcar"],
      permissionKey: "view_seguros"
    }
  ];

  const guideCategories: GuideCategory[] = [
    {
      id: "gmail",
      title: "Configuração do Gmail",
      icon: Mail,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      description: "Configure o envio de e-mails para recuperação de senha e cobranças",
      steps: [
        {
          title: "Criar Senha de App no Google",
          content: `1. Acesse sua conta Google em **myaccount.google.com**
2. Vá em **Segurança** → **Verificação em duas etapas** (ative se ainda não tiver)
3. Após ativar, volte em **Segurança** e procure por **Senhas de app**
4. Selecione "Outro (nome personalizado)" e digite "CRM Cobranca"
5. Clique em **Gerar** e copie a senha de 16 caracteres`
        },
        {
          title: "Onde configurar no sistema",
          content: `**Para Recuperação de Senha:**
- Acesse **Painel Administrativo** → **Recuperação de Senha**
- Na aba **Configurações**, preencha:
  - **E-mail Gmail**: seu e-mail completo (ex: seuemail@gmail.com)
  - **Senha de App**: a senha de 16 caracteres gerada

**Para Cobrança Automática:**
- Acesse **Painel Administrativo** → **Cobrança**
- Na aba **Canais**, seção **Gmail**, preencha os mesmos dados`
        }
      ],
      tips: [
        "Use uma conta Gmail dedicada para o sistema",
        "A senha de app é diferente da sua senha normal do Gmail",
        "Guarde a senha de app em local seguro, ela só é exibida uma vez"
      ]
    },
    {
      id: "evolution",
      title: "Evolution API (WhatsApp)",
      icon: MessageSquare,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      description: "Configure o WhatsApp para envio de mensagens automáticas",
      steps: [
        {
          title: "Obter credenciais da Evolution API",
          content: `1. Acesse seu painel da **Evolution API**
2. Crie ou selecione uma **instância** do WhatsApp
3. Conecte o WhatsApp escaneando o QR Code
4. Copie as seguintes informações:
   - **API URL**: URL base da sua Evolution (ex: https://api.evolution.com.br)
   - **API Key**: Chave de autenticação da instância
   - **Nome da Instância**: Nome que você deu à instância`
        },
        {
          title: "Onde configurar no sistema",
          content: `**Para Recuperação de Senha via WhatsApp:**
- Acesse **Painel Administrativo** → **Recuperação de Senha**
- Na aba **Instâncias WhatsApp**, clique em **Adicionar Instância**
- Preencha: Nome, URL da API e Chave API

**Para Cobrança via WhatsApp:**
- Acesse **Painel Administrativo** → **Cobrança**
- Na aba **Canais**, seção **WhatsApp**, adicione suas instâncias
- Você pode adicionar múltiplas instâncias para rotação automática`
        }
      ],
      tips: [
        "Mantenha o WhatsApp conectado 24/7 para não perder mensagens",
        "Use números dedicados para cobrança e recuperação separadamente",
        "O sistema faz rotação automática entre múltiplas instâncias"
      ]
    },
    {
      id: "boas-vindas",
      title: "Mensagens de Boas-vindas",
      icon: Sparkles,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Configure o envio automático de credenciais para novos usuários",
      steps: [
        {
          title: "Configurar boas-vindas",
          content: `1. Acesse **Painel Administrativo** → **Mensagens de Boas-vindas**
2. Ative **E-mail de Boas-vindas** e/ou **WhatsApp de Boas-vindas**
3. Personalize os templates de mensagem

Quando um admin criar um usuário em **Gerenciar Usuários**, 
o sistema enviará automaticamente as credenciais.`
        },
        {
          title: "Variáveis disponíveis",
          content: `Use estas variáveis nos templates:

- \`{nome}\` - Nome do usuário
- \`{email}\` - E-mail do usuário
- \`{senha}\` - Senha inicial definida
- \`{url}\` - Link de acesso ao sistema

Exemplo:
"Olá {nome}, sua conta foi criada! Acesse {url} com e-mail {email} e senha {senha}"`
        },
        {
          title: "Pré-requisitos",
          content: `**Para E-mail funcionar:**
- Configure Gmail em **Recuperação de Senha**

**Para WhatsApp funcionar:**
- Configure instâncias Evolution API em **Recuperação de Senha**
- Informe o WhatsApp do usuário ao criar`
        }
      ],
      tips: [
        "Use emojis no WhatsApp para mensagens mais amigáveis",
        "Sempre oriente o usuário a trocar a senha inicial",
        "O WhatsApp só é enviado se o telefone for informado"
      ]
    },
    {
      id: "webhooks",
      title: "Webhooks",
      icon: Webhook,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      description: "Integre com sistemas externos como n8n para automações",
      steps: [
        {
          title: "Criar um Webhook",
          content: `1. Acesse **Painel Administrativo** → **Webhooks**
2. Clique em **Criar Webhook**
3. Preencha:
   - **Nome**: Identificação do webhook (ex: "Notificação n8n")
   - **URL**: Endpoint que receberá os dados (ex: URL do n8n)
   - **Eventos**: Selecione quais ações disparam o webhook
   - **Chave Secreta** (opcional): Para validar autenticidade`
        },
        {
          title: "Eventos disponíveis",
          content: `- **cliente.created**: Disparado quando um cliente é cadastrado
- **cliente.updated**: Disparado quando um cliente é atualizado
- **cliente.deleted**: Disparado quando um cliente é excluído

O payload enviado inclui todos os dados do cliente e informações do usuário que realizou a ação.`
        }
      ],
      tips: [
        "Use a chave secreta para validar que as requisições vêm do CRM",
        "Teste o webhook com uma ferramenta como Webhook.site antes de conectar ao n8n",
        "Webhooks inativos não disparam eventos"
      ]
    },
    {
      id: "api",
      title: "API Keys",
      icon: Key,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      description: "Permita que sistemas externos acessem os dados do CRM",
      steps: [
        {
          title: "Criar uma API Key",
          content: `1. Acesse **Painel Administrativo** → **API Keys**
2. Clique em **Criar API Key**
3. Preencha:
   - **Nome**: Identificação da chave (ex: "Integração n8n")
   - **Descrição**: Para que será usada
4. Copie a chave gerada (ela só é exibida uma vez!)`
        },
        {
          title: "Como usar a API",
          content: `Endpoint base: \`/functions/v1/api-clientes\`

**Autenticação**: Envie o header \`x-api-key\` com sua chave

**Operações disponíveis:**
- \`GET /api-clientes\` - Lista todos os clientes
- \`GET /api-clientes?id=xxx\` - Busca cliente específico
- \`POST /api-clientes\` - Cria novo cliente
- \`PUT /api-clientes?id=xxx\` - Atualiza cliente
- \`DELETE /api-clientes?id=xxx\` - Remove cliente`
        }
      ],
      tips: [
        "Nunca compartilhe API Keys publicamente",
        "Crie chaves separadas para cada integração",
        "Desative chaves que não estão mais em uso"
      ]
    },
    {
      id: "mercadopago",
      title: "Mercado Pago",
      icon: CreditCard,
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      description: "Configure pagamentos automáticos via Mercado Pago",
      steps: [
        {
          title: "Obter credenciais do Mercado Pago",
          content: `1. Acesse **mercadopago.com.br/developers/panel**
2. Vá em **Suas integrações** ou crie uma nova aplicação
3. Em **Credenciais de produção**, copie:
   - **Access Token**: Token de acesso (começa com APP_USR-)
   - **Public Key** (opcional): Chave pública

⚠️ **Importante**: Use credenciais de **PRODUÇÃO**, não de teste!`
        },
        {
          title: "Configurar no sistema",
          content: `1. Acesse **Painel Administrativo** → **Cobrança**
2. Clique na aba **Pagamentos**
3. Preencha:
   - **Access Token**: Cole o token do Mercado Pago
   - **Taxa Cartão (%)**: Taxa administrativa (ex: 4.99%)
   - **Taxa Boleto (R$)**: Taxa fixa (ex: R$ 1.99)
   
4. Configure os dados do **PIX**:
   - **Chave PIX**: CNPJ, CPF, email, telefone ou aleatória
   - **Tipo da Chave**: Selecione o tipo correspondente
   - **Nome do Beneficiário**: Nome que aparece no PIX
   
5. Ative as opções desejadas:
   - ✓ Habilitar geração de Link de Pagamento
   - ✓ Habilitar geração de Boleto`
        },
        {
          title: "Requisitos para geração de Boleto",
          content: `Para gerar boletos, o cliente precisa ter:

1. **CPF ou CNPJ válido** cadastrado
   - CPF: 11 dígitos com dígitos verificadores corretos
   - CNPJ: 14 dígitos com dígitos verificadores corretos
   
2. **Valor mínimo**: R$ 2,01 (restrição do Mercado Pago)

Se algum requisito não for atendido, o boleto não será gerado e o motivo aparecerá nos **Logs de Cobrança**.`
        },
        {
          title: "O que é enviado automaticamente",
          content: `No dia da cobrança (D-0 em diante), o sistema envia:

**PIX** (sempre, se configurado):
- Chave PIX
- Nome do beneficiário
- Banco (informativo)

**Link de Pagamento** (cartão de crédito):
- Link do checkout do Mercado Pago
- Valor com taxa administrativa aplicada

**Boleto** (se CPF/CNPJ válido e valor ≥ R$ 2,01):
- Link para PDF do boleto
- Valor com taxa administrativa aplicada`
        }
      ],
      tips: [
        "O boleto só é gerado se o cliente tiver CPF ou CNPJ válido",
        "Valor mínimo para boleto no Mercado Pago é R$ 2,01",
        "Links de pagamento expiram em 24 horas",
        "Verifique os Logs de Cobrança para ver quais pagamentos foram gerados",
        "Se o CPF/CNPJ estiver errado, aparece o motivo nos logs"
      ]
    },
    {
      id: "usuarios",
      title: "Gerenciamento de Usuários",
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Gerencie usuários e suas permissões no sistema",
      steps: [
        {
          title: "Fluxo de aprovação",
          content: `1. Usuário se cadastra na tela de login
2. Aguarda aprovação do administrador
3. Admin acessa **Gerenciar Usuários** e vê pendentes
4. Admin aprova e **seleciona a role** do usuário
5. Usuário recebe acesso conforme permissões da role`
        },
        {
          title: "Criar usuário manualmente",
          content: `O admin pode criar usuários diretamente:

1. Acesse **Gerenciar Usuários**
2. Preencha: Nome, E-mail, WhatsApp (opcional), Senha e Tipo
3. Clique em **Criar Usuário**

O usuário é criado já aprovado automaticamente!
Se configurado, recebe email/WhatsApp de boas-vindas.`
        },
        {
          title: "Roles disponíveis",
          content: getRolesContent()
        }
      ],
      tips: [
        "Crie roles customizadas em Permissões se precisar de controle granular",
        "Usuários rejeitados podem enviar justificativa para reconsideração",
        "O histórico de aprovações fica registrado para auditoria"
      ]
    },
    {
      id: "permissoes",
      title: "Permissões e Roles",
      icon: Lock,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      description: "Crie roles personalizadas e configure permissões granulares",
      steps: [
        {
          title: "Entendendo o sistema de permissões",
          content: `O sistema usa controle de acesso baseado em **roles** (funções):

- Cada usuário tem **uma role** atribuída
- Cada role tem **múltiplas permissões**
- Permissões controlam o que o usuário pode fazer

**Roles padrão:**
- **Admin**: Acesso total ao sistema
- **Gerente**: CRUD de clientes próprios
- **Operador**: Cadastra e atualiza clientes
- **Financeiro**: Acesso apenas ao módulo de Cobrança
- **Visualizador**: Apenas consulta clientes`
        },
        {
          title: "Criar role customizada",
          content: `1. Acesse **Painel Administrativo** → **Permissões**
2. Na aba **Roles**, clique em **Criar Role**
3. Preencha:
   - **Nome interno**: identificador único (ex: "suporte")
   - **Nome de exibição**: nome amigável (ex: "Suporte Técnico")
   - **Cor**: cor do badge da role
   - **Descrição**: o que essa role faz
4. Clique em **Criar**`
        },
        {
          title: "Configurar permissões da role",
          content: `Após criar a role, configure suas permissões:

1. Na aba **Matriz de Permissões**
2. Encontre a role na lista
3. Marque/desmarque as permissões desejadas:
   - **view_dashboard**: Ver dashboard e métricas
   - **view_clients**: Consultar clientes
   - **create_clients**: Cadastrar clientes
   - **update_clients**: Atualizar clientes
   - **delete_clients**: Excluir clientes
   - **export_clients**: Exportar clientes
   - **manage_billing**: Acessar módulo de cobrança
   - **manage_users**: Gerenciar usuários
   - **view_logs**: Ver logs de atividade
   - E outras...`
        },
        {
          title: "Atribuir role a usuário",
          content: `1. Acesse **Gerenciar Usuários**
2. Encontre o usuário na lista
3. Clique no dropdown de role
4. Selecione a nova role
5. As permissões são aplicadas imediatamente!`
        }
      ],
      tips: [
        "Sempre teste uma nova role com um usuário de teste antes de usar em produção",
        "Roles de sistema (Admin, etc.) não podem ser excluídas",
        "Você pode criar roles específicas por departamento (Financeiro, Suporte, etc.)",
        "Alterações de permissão são aplicadas em tempo real"
      ]
    },
    {
      id: "cobranca",
      title: "Sistema de Cobrança",
      icon: CreditCard,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Configure o envio automático de cobranças",
      steps: [
        {
          title: "Configurar horário de execução",
          content: `1. Acesse **Painel Administrativo** → **Cobrança**
2. Na aba **Geral**, defina:
   - **Horário de Execução**: Quando o cron roda diariamente
   - **Status**: Ative/desative o sistema de cobrança`
        },
        {
          title: "Configurar mensagens",
          content: `Na aba **Mensagens**, personalize os templates para cada momento:
- **D-3**: 3 dias antes do vencimento (lembrete)
- **D**: Dia do vencimento (cobrança)
- **D+1 e D+2**: Dias após vencimento (follow-up)
- **D+15 e D+30**: Cobranças de atraso

Use variáveis como \`{nome}\`, \`{valor}\`, \`{data}\` nos templates.`
        },
        {
          title: "WhatsApp Oficial da Meta",
          content: `Na aba **Canais**, ao usar **Oficial (Meta)**:

1. Preencha **Access Token**, **Phone Number ID** e **WABA ID**
2. Clique em **Sincronizar Templates**
3. Se nenhum template real for retornado, os seletores mostram **Sincronize primeiro**
4. No **Mapeamento de Templates**, associe cada evento de cobrança ao template aprovado
5. No **Mapeamento de Variáveis**, escolha quais dados preencherão cada variável da Meta

**Variáveis de botão:** se o template tiver botão com URL dinâmica, selecione o destino **Botão 1** ou **Botão 2** e escolha o campo que deve preencher o link.`
        },
        {
          title: "IA para mensagens (opcional)",
          content: `Na aba **IA**, você pode:
- Selecionar um modelo de IA (Gemini ou GPT)
- Definir um prompt de contexto
- O sistema gerará mensagens personalizadas automaticamente`
        },
        {
          title: "Filtros do Histórico de Envios",
          content: `Na aba **Histórico**, você pode filtrar os registros de cobrança:

**Filtro por Status:**
- 🟢 **Sucesso (sent)**: Mensagem enviada com sucesso
- 🔴 **Erro (error)**: Falha no envio da mensagem
- 🟡 **Pendente (pending)**: Aguardando processamento
- 🔵 **Info**: Logs informativos (ex: "Nenhum cliente encontrado")
- 🟠 **Pulado (skipped)**: Envio pulado por falta de dados (CPF, email inválido, etc.)

**Filtro por Canal:**
- 📧 **Email**: Mensagens enviadas por email
- 📱 **WhatsApp**: Mensagens enviadas por WhatsApp
- ⚙️ **Sistema**: Logs do sistema (execuções sem clientes, etc.)

**Filtro por Tipo de Mensagem:**
- **D-3**: Lembrete 3 dias antes
- **D**: Cobrança no dia do vencimento
- **D+1, D+2**: Follow-ups após vencimento
- **D+15, D+30**: Cobranças de atraso prolongado

**Filtro por Período:**
- Hoje, últimos 7/30/90 dias ou todos os registros`
        },
        {
          title: "Configurar CRON Secret (Agendamento Automático)",
          content: `Para que a cobrança automática funcione diariamente, você precisa configurar o **CRON Secret**:

**O que é o CRON Secret?**
É uma chave de segurança que autentica a execução automática do sistema de cobrança.

**Como configurar (apenas no painel):**
1. Vá em **Cobrança** → aba **Geral**
2. Role até encontrar **"Autenticação do Cron"**
3. Digite uma senha segura (ex: \`MinhaSenhaSegura123!\`)
4. Clique em **"Salvar Configurações"**

✅ **Pronto!** O sistema sincroniza automaticamente - você só precisa configurar no painel.

**Como criar um bom secret:**
- Use uma string longa (mínimo 16 caracteres)
- Inclua letras maiúsculas, minúsculas, números e símbolos
- Exemplo: \`Cobranca@Automatica2024!\`
- Nunca compartilhe ou exponha publicamente

**Horário de Execução:**
O sistema executa diariamente no horário configurado (padrão: 10h - horário de Brasília).

**Se precisar alterar o secret:**
Basta atualizar o valor no painel e salvar. A mudança é aplicada imediatamente.`
        },
        {
          title: "Notificações de Erro por Email",
          content: `O sistema pode enviar alertas por email quando houver falhas nas cobranças:

**Como ativar:**
1. Na aba **Geral** do módulo de Cobrança
2. Ative **"Notificações de Erro"**
3. Informe o **email para receber alertas**
4. Salve as configurações

**Quando você recebe alerta:**
- ❌ Falha no envio de email ou WhatsApp
- ❌ Erro ao gerar link de pagamento ou boleto
- ❌ CPF/CNPJ inválido impedindo geração de boleto
- ❌ Qualquer erro durante o processamento da cobrança

**O email inclui:**
- Quantidade de erros ocorridos
- Detalhes de cada falha (cliente, motivo)
- Timestamp da execução

Isso permite agir rapidamente quando algo dá errado!`
        },
        {
          title: "Monitoramento do Cron (Última/Próxima Execução)",
          content: `O painel de cobrança mostra informações em tempo real sobre o agendamento:

**Última Execução:**
- Data e hora da última vez que o cron executou
- Quantidade de envios realizados
- Quantos foram sucesso ✓ e quantos erraram ✗

**Próxima Execução:**
- Data e hora prevista para próxima execução
- Calculada automaticamente com base no horário configurado

**Alerta de Cron Perdido:**
Se o sistema detectar que o cron não executou no horário previsto:
- ⚠️ Aparece um alerta vermelho no painel
- Verifique se o CRON Secret está correto
- Use o botão **"Executar Agora"** para rodar manualmente

**Sincronização com Banco:**
- O horário configurado no painel é comparado com o banco
- ✓ Verde = sincronizado
- ⚠️ Vermelho = divergente (salve para sincronizar)`
        }
      ],
      tips: [
        "Configure Gmail E WhatsApp para maior alcance",
        "Monitore a aba Relatórios para ver taxas de sucesso",
        "Use a cobrança manual para casos urgentes",
        "Use o filtro 'Info' para ver quando não havia clientes para cobrar",
        "O CRON Secret só precisa ser configurado no painel (sincroniza automaticamente)",
        "Ative as notificações de erro para ser alertado quando cobranças falharem",
        "Se o cron não executar, use 'Executar Agora' e verifique o CRON Secret",
        "Templates da Meta só aparecem depois da sincronização retornar templates reais aprovados"
      ]
    },
    {
      id: "verificacao-pagamento",
      title: "Verificação de Pagamentos",
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Entenda como funciona a verificação de status de pagamentos",
      steps: [
        {
          title: "Verificação automática (Mercado Pago)",
          content: `O sistema verifica automaticamente pagamentos feitos via **Mercado Pago**:

- Link de pagamento (cartão de crédito)
- Boleto bancário
- PIX do Mercado Pago

Quando o cliente paga por esses meios, o sistema atualiza o status automaticamente.`
        },
        {
          title: "Pagamentos fora do Mercado Pago",
          content: `Se o cliente pagar por **outra forma** (PIX de outro banco, transferência, etc.):

❌ O sistema **NÃO detecta automaticamente**

✅ Você pode **marcar manualmente como pago**:
1. Vá em **Cobrança** → aba **Pagamentos**
2. Encontre o pagamento na lista de pendentes
3. Clique no botão **"Pago"** (verde)
4. Confirme no modal que aparece
5. O status é atualizado e a **data de renovação avança 1 mês**!

Isso mantém o controle mesmo para pagamentos externos.`
        },
        {
          title: "Gerenciamento de Pagamentos",
          content: `Na aba **Pagamentos** do módulo de Cobrança, você encontra:

**Estatísticas gerais:**
- Total de pagamentos
- Pagamentos pagos (com valor total)
- Pagamentos pendentes (com valor total)
- Pagamentos rejeitados/cancelados

**Lista de pagamentos:**
- Pagamentos pendentes aparecem destacados em amarelo
- Botão **"Pago"**: marca como pago e avança renovação
- Botão **"X"**: cancela o pagamento
- Histórico completo de todos os pagamentos`
        },
        {
          title: "Histórico por Cliente",
          content: `Você pode ver o histórico de pagamentos de um cliente específico:

1. Acesse **Consultar Clientes**
2. Busque o cliente desejado
3. Clique no **ícone de cartão (💳)** ao lado do nome
4. Veja todos os pagamentos daquele cliente:
   - Total de pagamentos
   - Quantos foram pagos/pendentes
   - Valor total pago
   - Ações para marcar como pago ou cancelar`
        },
        {
          title: "Atualização Automática de Renovação",
          content: `Quando um pagamento é confirmado (manual ou automático):

1. ✅ O status muda para **"Pago"**
2. ✅ A **data de renovação** do cliente avança **1 mês**
3. ✅ As datas de cobrança são recalculadas:
   - D-3 (3 dias antes)
   - D+1, D+2 (dias após)
   - D+15, D+30 (follow-up)

Isso acontece automaticamente, sem precisar editar o cliente manualmente!`
        },
        {
          title: "Status de pagamento",
          content: `Os pagamentos podem ter os seguintes status:

- 🟡 **Pendente**: Aguardando pagamento
- 🟢 **Pago**: Pagamento confirmado (automático ou manual)
- 🔴 **Cancelado**: Pagamento foi cancelado
- 🔴 **Rejeitado**: Pagamento recusado pelo banco/cartão

Você pode ver todos os pagamentos na aba **Pagamentos** do módulo de Cobrança.`
        }
      ],
      tips: [
        "A verificação automática funciona APENAS para Mercado Pago",
        "PIX de outros bancos requer marcação manual",
        "Ao marcar como pago, a renovação avança 1 mês automaticamente",
        "Use o botão 'Verificar Status Agora' para atualizar pagamentos do Mercado Pago",
        "O histórico por cliente está disponível na página de Consulta"
      ]
    },
    {
      id: "tags",
      title: "Gerenciamento de Tags",
      icon: Tag,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
      description: "Organize e segmente seus clientes com tags personalizadas",
      steps: [
        {
          title: "O que são tags?",
          content: `Tags são etiquetas que você pode adicionar aos clientes para organizá-los:

- **VIP**: Clientes premium
- **Inadimplente**: Clientes com pagamentos atrasados
- **Novo**: Clientes recém-cadastrados
- **Ativo**: Clientes com assinatura ativa

Você pode criar quantas tags quiser!`
        },
        {
          title: "Adicionar tags a clientes",
          content: `1. Ao **Cadastrar** ou **Atualizar** um cliente
2. Use o campo **Tags** para adicionar etiquetas
3. Digite o nome e pressione Enter
4. Você pode adicionar múltiplas tags

As tags são salvas automaticamente com o cliente.`
        },
        {
          title: "Gerenciar tags existentes",
          content: `1. Acesse **Painel Administrativo** → **Tags**
2. Veja todas as tags em uso e quantos clientes usam cada uma
3. **Renomear**: Clique no ícone de edição, altere e pressione Enter
4. **Excluir**: Remove a tag de TODOS os clientes

⚠️ Excluir uma tag remove ela de todos os clientes automaticamente!`
        },
        {
          title: "Filtrar por tags",
          content: `Na página **Consultar Clientes**:

1. Use o campo de filtro por tags
2. Selecione uma ou mais tags
3. O sistema mostra apenas clientes com essas tags

Útil para ações direcionadas como campanhas ou cobranças específicas.`
        }
      ],
      tips: [
        "Use tags para segmentar clientes em campanhas de cobrança",
        "Crie tags padronizadas (evite variações como 'vip' e 'VIP')",
        "Renomear é melhor que excluir e recriar",
        "Tags aparecem como badges coloridos na consulta de clientes"
      ]
    },
    {
      id: "clientes-registro",
      title: "Clientes Registro",
      icon: FileBox,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      description: "Gerencie clientes sem cobrança recorrente (compras avulsas, entregas pendentes)",
      steps: [
        {
          title: "O que são Clientes Registro?",
          content: `Clientes **Registro** são cadastros sem cobrança mensal automática, úteis para:

- **Compras avulsas**: Produtos vendidos sem assinatura mensal
- **Entregas pendentes**: Controle de produtos comprados mas não entregues
- **Acesso vitalício**: Produtos com pagamento único (ex: licenças permanentes)
- **Histórico de compras**: Registro de transações sem necessidade de cobrança

Esses clientes **não recebem** cobranças automáticas do sistema.`
        },
        {
          title: "Como cadastrar",
          content: `1. Acesse **Cadastrar Cliente**
2. Na tela inicial, escolha **"Registro"** (ícone de infinito amarelo)
3. Preencha os dados básicos:
   - Nome, WhatsApp, CPF/CNPJ, Email
   - Produto adquirido
4. Adicione **Observações** detalhando:
   - O que foi comprado
   - Quantidades pendentes de entrega
   - Datas importantes
5. **Anexe arquivos** (comprovantes, contratos, etc.)
6. Confirme o cadastro`
        },
        {
          title: "PixPague: Pagamento com Pix no Cadastro",
          content: `Tanto clientes **Mensal** quanto **Registro** podem ter seu primeiro pagamento registrado via Pix já no momento do cadastro:

1. No formulário de cadastro, localize a seção **Meio de Pagamento**
2. Selecione **"Pix (Análise Automática)"**
3. Faça o **upload do comprovante** (Obrigatório para Pix)
4. O sistema criará o cliente e enviará o comprovante para análise

**O que acontece após o cadastro?**
- O pagamento fica com status **"Pendente de Aprovação"**
- A **IA (OCR)** lê o valor e ID da transação automaticamente
- O sistema verifica se o comprovante é duplicado (prevenção de fraude)
- O consultor deve aprovar o pagamento no módulo **Segurança de Pagamento**
- **Nenhuma notificação** é enviada ao cliente nesta fase inicial.`
        },
        {
          title: "Gerenciamento de Arquivos",
          content: `Clientes Registro podem ter arquivos anexados:

**No Cadastro:**
- Arraste ou selecione arquivos (imagens, PDFs, documentos)
- Arquivos são enviados ao criar o cliente

**Na Atualização:**
- Veja arquivos existentes
- Adicione novos arquivos
- Baixe ou visualize arquivos
- Exclua arquivos não necessários

**Na Consulta:**
- Clique no ícone de **arquivo (📁)** ao lado do nome
- Visualize, baixe ou gerencie os anexos`
        },
        {
          title: "Diferenças do Cliente Mensal",
          content: `| Característica | Cliente Mensal | Cliente Registro |
|----------------|----------------|------------------|
| Cobrança automática | ✅ Sim | ❌ Não |
| Data de renovação | ✅ Editável | ❌ Oculta |
| Valor mensal | ✅ Definido | ❌ Não aplicável |
| Histórico pagamentos | ✅ Disponível | ✅ Disponível* |
| Anexo de arquivos | ❌ Não | ✅ Sim |
| Badge visual | 🔵 Azul | 🟡 Amarelo "Registro" |

\* *O histórico de pagamentos em Clientes Registro é usado principalmente para registrar o Pix inicial via PixPague.*`
        },
        {
          title: "Filtrar por tipo de cliente",
          content: `Na página **Consultar Clientes**:

1. Clique no ícone de **Filtro** no canto superior direito
2. Em **Tipo de Cliente**, selecione:
   - **Todos**: Mostra todos os clientes
   - **Mensal**: Apenas clientes com cobrança
   - **Registro**: Apenas clientes sem cobrança
3. Clique em **Aplicar Filtros**

Isso facilita encontrar clientes específicos por categoria.`
        }
      ],
      tips: [
        "Use Registro para produtos vendidos sem assinatura (licenças vitalícias, etc.)",
        "Documente nas Observações o que foi comprado e pendências de entrega",
        "Anexe comprovantes de pagamento e contratos para referência futura",
        "Clientes Registro não aparecem nos relatórios de cobrança",
        "Você pode converter um cliente Registro para Mensal editando manualmente no banco"
      ]
    },
    {
      id: "tarefas",
      title: "Tarefas de Clientes",
      icon: ClipboardList,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      description: "Gerencie tarefas e pendências vinculadas a cada cliente",
      steps: [
        {
          title: "O que são Tarefas de Clientes?",
          content: `O módulo de **Tarefas** permite criar e gerenciar pendências vinculadas a clientes específicos:

- **Acompanhamento**: Crie tarefas para follow-up com clientes
- **Priorização**: Defina prioridades (baixa, média, alta, urgente)
- **Prazos**: Estabeleça datas de vencimento
- **Atribuição**: Delegue tarefas para membros da equipe
- **Status**: Acompanhe o progresso (pendente, em andamento, concluída)

As tarefas ajudam a organizar o trabalho e garantir que nenhuma pendência seja esquecida.`
        },
        {
          title: "Como criar uma tarefa",
          content: `1. Acesse **Consultar Clientes** e encontre o cliente desejado
2. Clique no botão de **editar** do cliente
3. Na tela de edição, role até a seção **Tarefas**
4. Clique em **Nova Tarefa**
5. Preencha:
   - **Título**: Descrição resumida da tarefa
   - **Descrição**: Detalhes adicionais (opcional)
   - **Prioridade**: Baixa, Média, Alta ou Urgente
   - **Data de Vencimento**: Prazo para conclusão
   - **Responsável**: Membro da equipe (opcional)
6. Clique em **Criar Tarefa**`
        },
        {
          title: "Gerenciando tarefas",
          content: `**Na página do cliente:**
- Veja todas as tarefas vinculadas ao cliente
- Filtre por status: Todas, Pendentes, Em Andamento, Concluídas
- Altere o status clicando nos botões de ação

**Ações disponíveis:**
- ✅ **Concluir**: Marca a tarefa como finalizada
- 🔄 **Em Andamento**: Indica que você está trabalhando nela
- ✏️ **Editar**: Modifica os dados da tarefa
- 🗑️ **Excluir**: Remove a tarefa permanentemente`
        },
        {
          title: "Página de Tarefas Geral",
          content: `Acesse **Tarefas** no menu lateral para ver TODAS as tarefas do sistema:

**Filtros disponíveis:**
- **Status**: Pendente, Em Andamento, Concluída
- **Prioridade**: Baixa, Média, Alta, Urgente
- **Responsável**: Filtrar por membro da equipe
- **Cliente**: Buscar tarefas de um cliente específico

**Cards de resumo:**
- Total de tarefas
- Pendentes / Em andamento
- Concluídas
- Atrasadas (vencidas e não concluídas)`
        },
        {
          title: "Tarefas no Dashboard",
          content: `O **Dashboard** exibe um resumo das tarefas:

- **Card de Tarefas Urgentes**: Mostra tarefas atrasadas ou com vencimento próximo
- **Estatísticas**: Total, pendentes, em andamento, concluídas e atrasadas

Isso permite uma visão rápida das pendências mais críticas.`
        }
      ],
      tips: [
        "Use prioridade 'Urgente' para tarefas críticas que precisam de atenção imediata",
        "Defina prazos realistas para evitar acúmulo de tarefas atrasadas",
        "Atribua tarefas a responsáveis específicos para melhor organização",
        "Verifique o Dashboard diariamente para acompanhar tarefas urgentes",
        "Use a descrição para adicionar contexto e instruções detalhadas"
      ]
    },
    {
      id: "chat",
      title: "Chat Lyra (Assistente IA)",
      icon: Bot,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Configure o assistente virtual para ajudar usuários",
      steps: [
        {
          title: "Personalizar o chat",
          content: `1. Acesse **Painel Administrativo** → **Chat Lyra**
2. Na aba **Geral**, configure:
   - **Nome do Chat**: Como o assistente se apresenta
   - **Mensagem de Boas-vindas**: Primeira mensagem exibida
   - **Placeholder**: Texto do campo de input
   - **Cor do Tema**: Cor principal do chat
3. Configure **Horário de Funcionamento** se desejar limitar atendimento`
        },
        {
          title: "Configurar Provedor de IA",
          content: `Na aba **IA**, você pode escolher entre 3 provedores:

**Lovable AI (Gratuito):**
- Não requer API Key
- Modelos: Gemini 2.5 Flash/Pro, GPT-5
- Uso gratuito mensal incluído

**OpenAI:**
- Requer sua API Key da OpenAI
- Modelos: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo
- Custos diretos na sua conta OpenAI

**Groq:**
- Requer API Key da Groq
- Modelos: Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B
- Alta velocidade e custo reduzido`
        },
        {
          title: "Configurar Permissões por Role",
          content: `Na aba **Permissões**, você controla o que cada cargo pode perguntar à IA:

1. **Ativar Restrições**: Ligue o switch para habilitar controle por role
2. **Mensagem de Negação**: Configure a resposta quando acesso é negado
3. **Tópicos por Role**: Marque quais assuntos cada cargo pode consultar

**Exemplo prático:**
- Role "Financeiro" → Apenas tópicos de Cobrança
- Role "Operador" → Clientes e Dashboard
- Admin sempre tem acesso total

**Importante:** Os tópicos são sincronizados automaticamente com as categorias de Permissões do Sistema.`
        },
        {
          title: "Respostas Automáticas",
          content: `Na aba **Respostas**, configure atalhos para perguntas frequentes:

1. Clique em **Adicionar Resposta**
2. Configure o **Gatilho** (palavra-chave que ativa)
3. Configure a **Resposta** automática

**Dica:** Use para perguntas simples como horário de atendimento, contatos, etc.`
        }
      ],
      tips: [
        "Configure horário de funcionamento se não quiser atendimento 24/7",
        "Use Lovable AI para começar sem custos adicionais",
        "Restrinja tópicos sensíveis por cargo para maior segurança",
        "O histórico de conversas fica salvo por usuário",
        "Novas permissões criadas aparecem automaticamente nos tópicos"
      ]
    },
    {
      id: "dashboard",
      title: "Dashboard e Métricas",
      icon: BarChart3,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Entenda as métricas e gráficos do painel principal",
      steps: [
        {
          title: "Visão geral do Dashboard",
          content: `O Dashboard é a página inicial do sistema e mostra:

**Cards de estatísticas:**
- Total de clientes cadastrados
- Próximas renovações (7 dias)
- Valor total em contratos
- Taxa de inadimplência
- Novos clientes (30 dias)

**Gráficos:**
- Cadastros por mês (tendência)
- Distribuição por plano
- Cobranças dos últimos 30 dias`
        },
        {
          title: "Métricas de clientes",
          content: `**Total de Clientes:**
Número total de clientes ativos na base.

**Próximas Renovações:**
Clientes com renovação nos próximos 7 dias.
Útil para preparar cobranças manuais.

**Valor Total:**
Soma do valor (mensalidade) de todos os clientes.
Representa o faturamento potencial mensal.

**Novos Clientes (30 dias):**
Quantos clientes foram cadastrados no último mês.`
        },
        {
          title: "Métricas de cobrança",
          content: `**Taxa de Inadimplência:**
Percentual de clientes com data de renovação vencida.
Calculada automaticamente.

**Taxa de Sucesso de Cobranças:**
Percentual de mensagens enviadas com sucesso.
Considera email e WhatsApp.

**Previsão de Receita:**
Valor total dos pagamentos pendentes.
Representa quanto pode entrar no caixa.`
        },
        {
          title: "Gráficos",
          content: `**Cadastros por Mês (Área):**
Mostra a tendência de novos cadastros nos últimos 6 meses.
Útil para avaliar crescimento.

**Clientes por Plano (Pizza):**
Distribuição percentual dos clientes por tipo de plano.
Identifica planos mais populares.

**Cobranças 30 Dias (Barras):**
Volume de cobranças enviadas por dia.
Mostra sucesso vs erro de envio.`
        },
        {
          title: "Ações rápidas",
          content: `O Dashboard oferece atalhos para as principais funções:

- **Cadastrar Cliente**: Ir direto para cadastro
- **Consultar Clientes**: Buscar na base
- **Cobrança**: Acessar módulo de cobrança
- **Backup**: Fazer backup completo
- **Notificações**: Ativar/desativar alertas`
        }
      ],
      tips: [
        "O Dashboard atualiza automaticamente ao abrir",
        "Use o Dashboard para ter visão geral rápida do negócio",
        "Métricas de cobrança ajudam a identificar problemas no envio",
        "Gráficos mostram tendências - use para tomar decisões"
      ]
    },
    {
      id: "logs-atividade",
      title: "Logs de Atividade",
      icon: History,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      description: "Acompanhe todas as ações realizadas no sistema",
      steps: [
        {
          title: "O que é registrado",
          content: `O sistema registra automaticamente todas as ações de clientes:

- **Cadastro**: Quando um cliente é criado
- **Atualização**: Quando dados são alterados (mostra antes/depois)
- **Exclusão**: Quando um cliente é removido
- **Restauração**: Quando um cliente excluído é restaurado

Cada log inclui:
- Quem fez a ação (nome e email)
- Quando foi feito (data e hora)
- O que mudou (campos alterados)`
        },
        {
          title: "Acessar logs de atividade",
          content: `1. Acesse **Painel Administrativo** → **Logs de Atividade**
2. Veja as estatísticas no topo:
   - Total de registros
   - Cadastros
   - Atualizações
   - Exclusões
   - Restaurações
3. Use os filtros para encontrar ações específicas`
        },
        {
          title: "Filtrar logs",
          content: `**Filtros disponíveis:**

- **Por tipo de ação**: Cadastro, Atualização, Exclusão, Restauração
- **Por período**: Data inicial e final
- **Por cliente**: Busca por nome do cliente

**Exportar:**
Clique em **Exportar PDF** para gerar relatório com os logs filtrados.`
        },
        {
          title: "Ver detalhes de uma ação",
          content: `Para ver detalhes completos de uma ação:

1. Clique no ícone de **olho** na linha do log
2. Veja o modal com:
   - Dados anteriores (em atualizações/exclusões)
   - Dados novos (em cadastros/atualizações)
   - Campos que foram alterados (destacados)
   - Informações do usuário que fez a ação`
        }
      ],
      tips: [
        "Logs não podem ser editados ou excluídos (auditoria)",
        "Use os logs para identificar quem fez alterações indevidas",
        "Exportações PDF são úteis para compliance e auditoria",
        "Os logs de API são separados em outra página"
      ]
    },
    {
      id: "restauracao",
      title: "Restauração de Clientes",
      icon: RotateCcw,
      color: "text-teal-400",
      bgColor: "bg-teal-500/10",
      description: "Recupere clientes excluídos acidentalmente",
      steps: [
        {
          title: "Quando usar a restauração",
          content: `A restauração é útil quando:

- Um cliente foi excluído por engano
- Precisa recuperar dados de um cliente antigo
- Houve exclusão indevida por outro usuário

⚠️ **Importante**: Apenas clientes excluídos recentemente podem ser restaurados (enquanto o log existir).`
        },
        {
          title: "Como restaurar um cliente",
          content: `1. Acesse **Painel Administrativo** → **Logs de Atividade**
2. Filtre por **Tipo de Ação**: "Exclusão"
3. Encontre o cliente que deseja restaurar
4. Clique no botão **Restaurar** (ícone de refresh)
5. Confirme a restauração no modal
6. O cliente volta à base com todos os dados!`
        },
        {
          title: "O que acontece na restauração",
          content: `Quando um cliente é restaurado:

1. ✅ Todos os dados originais são recuperados
2. ✅ Uma observação é adicionada automaticamente:
   "[Cliente restaurado em DD/MM/AAAA às HH:mm]"
3. ✅ Um novo log de "Restauração" é criado
4. ✅ O cliente pode ser consultado e editado normalmente

A data de restauração é sempre atualizada para o momento atual.`
        },
        {
          title: "Limitações",
          content: `**Não é possível restaurar quando:**

- O log de exclusão foi removido (muito antigo)
- Já existe outro cliente com mesmo CPF
- Já existe outro cliente com mesmo email

Nestes casos, será necessário cadastrar o cliente novamente manualmente.`
        }
      ],
      tips: [
        "A observação de restauração é atualizada a cada nova restauração",
        "O histórico mostra quantas vezes um cliente foi restaurado",
        "Restaurações aparecem com badge especial nos logs",
        "Use a restauração com responsabilidade - ela recria o cliente completo"
      ]
    },
    {
      id: "notificacoes",
      title: "Notificações Push",
      icon: Bell,
      color: "text-rose-400",
      bgColor: "bg-rose-500/10",
      description: "Receba alertas do navegador para eventos importantes",
      steps: [
        {
          title: "O que são notificações push",
          content: `Notificações push são alertas do navegador que aparecem mesmo quando você não está olhando para a página:

**Eventos notificados:**
- 📋 Novo usuário aguardando aprovação
- ❌ Erro no envio de cobrança

Isso permite que você seja alertado sobre eventos importantes em tempo real!`
        },
        {
          title: "Habilitar notificações",
          content: `1. Acesse o **Dashboard** principal
2. Procure o card **"Notificações"** ou ícone de sino
3. Clique em **"Ativar Notificações"**
4. O navegador perguntará se permite notificações
5. Clique em **"Permitir"**
6. Pronto! Você receberá alertas automaticamente.`
        },
        {
          title: "Requisitos",
          content: `Para receber notificações:

- ✅ Use um navegador moderno (Chrome, Firefox, Edge)
- ✅ Permita notificações quando o navegador solicitar
- ✅ Mantenha pelo menos uma aba do CRM aberta
- ✅ Seja um usuário com role **Admin**

⚠️ Notificações só funcionam para administradores.`
        },
        {
          title: "Gerenciar notificações",
          content: `**Desativar notificações:**
Clique no botão de notificações no Dashboard para desativar.

**Revogar permissão do navegador:**
1. Clique no ícone de cadeado na barra de endereços
2. Encontre "Notificações"
3. Mude para "Bloquear"

**Não está recebendo?**
- Verifique se permitiu no navegador
- Verifique se não está em modo "Não Perturbe"`
        }
      ],
      tips: [
        "Notificações funcionam mesmo com a aba minimizada",
        "Apenas admins recebem notificações (para evitar spam)",
        "Teste criando um usuário e veja se a notificação aparece",
        "Em dispositivos móveis, notificações web podem ter limitações"
      ]
    },
    {
      id: "backup",
      title: "Backup de Dados",
      icon: Database,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      description: "Entenda como proteger seus dados",
      steps: [
        {
          title: "Exportação manual",
          content: `**Exportar Clientes:**
1. Acesse **Consultar Clientes**
2. Use os filtros para selecionar os dados desejados
3. Clique em **Exportar CSV**

**Exportar Logs:**
1. Acesse **Logs de Atividade** ou **Logs de API**
2. Aplique os filtros de período
3. Clique em **Exportar CSV** ou **Exportar PDF**`
        },
        {
          title: "Backup automático",
          content: `O sistema mantém backup automático através do Lovable Cloud:
- Dados são replicados em múltiplas regiões
- Backups point-in-time disponíveis
- Retenção de dados por 30 dias

Para restauração, entre em contato com o suporte.`
        },
        {
          title: "Backup completo (Dashboard)",
          content: `Para um backup completo do sistema:

1. Acesse o **Dashboard**
2. Clique no botão **Backup**
3. O sistema gera um arquivo JSON com:
   - Todos os clientes
   - Configurações do sistema
   - Roles e permissões
   - Webhooks e API keys

Guarde este arquivo em local seguro!`
        }
      ],
      tips: [
        "Faça exportações mensais como backup extra",
        "Mantenha os arquivos em local seguro",
        "Os logs de atividade servem como histórico completo",
        "O backup do Dashboard inclui TODAS as configurações"
      ]
    },
    {
      id: "troubleshooting",
      title: "Solução de Problemas",
      icon: HelpCircle,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Resolva problemas comuns do sistema",
      steps: [
        {
          title: "E-mails não chegam",
          content: `**Verificações:**
1. Confirme se a senha de app do Gmail está correta
2. Verifique se a verificação em 2 etapas está ativa
3. Cheque a aba de spam do destinatário
4. Verifique os logs em **Cobrança** → **Histórico**

**Solução comum:**
Regenere a senha de app e atualize no sistema.`
        },
        {
          title: "WhatsApp não envia",
          content: `**Verificações:**
1. Confirme se a instância Evolution está conectada
2. Verifique se o QR Code foi escaneado recentemente
3. Cheque se a API URL e Key estão corretas
4. Verifique os logs de erro em **Cobrança** → **Histórico**

**Solução comum:**
Reconecte a instância escaneando o QR Code novamente.`
        },
        {
          title: "Usuário não consegue acessar",
          content: `**Verificações:**
1. O usuário foi aprovado? (Cheque em Gerenciar Usuários)
2. A role atribuída tem as permissões necessárias?
3. O usuário está tentando acessar área restrita?

**Solução:**
Verifique as permissões em **Permissões** e ajuste conforme necessário.`
        },
        {
          title: "Webhook não dispara",
          content: `**Verificações:**
1. O webhook está ativo?
2. Os eventos corretos estão selecionados?
3. A URL de destino está acessível?
4. Verifique os logs em **Logs de API**

**Solução:**
Teste com Webhook.site primeiro para validar que os eventos estão sendo enviados.`
        },
        {
          title: "Pagamento não atualiza automaticamente",
          content: `**Verificações:**
1. O pagamento foi feito via **Mercado Pago**?
2. O Access Token está configurado corretamente?
3. Clique em **"Verificar Pagamentos"** para forçar atualização

**Se for PIX de outro banco:**
A verificação automática NÃO funciona. Marque manualmente como pago.`
        }
      ],
      tips: [
        "Sempre verifique os logs primeiro",
        "Problemas de conexão geralmente são credenciais incorretas",
        "Recarregue a página após fazer alterações de configuração"
      ]
    },
    {
      id: "divulgador",
      title: "Divulgador Interno",
      icon: Megaphone,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Gerencie grupos de WhatsApp e campanhas em massa",
      steps: [
        {
          title: "O que é o Divulgador Interno?",
          content: `O **Divulgador Interno** é um módulo completo para gerenciamento de grupos de WhatsApp:

- **Criação manual de grupos**: Crie grupos via API Evolution com foto, descrição e configurações
- **Edição de grupos**: Altere nome, foto, descrição e permissões de grupos existentes
- **Campanhas em massa**: Envie mensagens para múltiplos grupos
- **Envio rápido**: Envie mensagem direta para um grupo específico com menção todos
- **Link de convite**: Gere e copie links de convite dos grupos
- **Menções inteligentes**: Mencione todos os participantes automaticamente
- **Mensagens automáticas**: Mensagens privadas para entrada e saída de participantes
- **Controle de participantes**: Remoção automática ou manual
- **Logs de operações**: Histórico completo de ações

O módulo possui sua **própria instância do WhatsApp**, independente dos outros módulos (cobrança, boas-vindas de usuários, etc.).`
        },
        {
          title: "Configurar Instância WhatsApp",
          content: `**Passo a passo:**

1. Acesse o **Divulgador** (menu lateral)
2. Na aba **WhatsApp**, clique em **"+ Nova Instância"**
3. Preencha:
   - **Nome da Instância**: Identificador no painel Evolution
   - **URL da API Evolution**: URL completa (ex: http://api.evolution.com.br)
   - **API Key**: Chave de autenticação da instância
4. Clique em **"Salvar"**
5. Ative o switch **"Ativo"** na tabela de instâncias
6. Clique no ícone de **atualizar (🔄)** para testar conexão

✅ Se aparecer **"Conectado"** (badge verde), a instância está pronta!

**Participante Padrão (opcional mas recomendado):**
- Configure um **número de telefone padrão** no campo "Participante Padrão"
- Este número será usado automaticamente ao criar novos grupos
- Útil para incluir administradores fixos em todos os grupos

**Gerenciar instâncias:**
- **Editar**: Clique no ícone de lápis para alterar dados
- **Excluir**: Clique no ícone de lixeira (confirme no modal)
- **Testar conexão**: Clique no ícone de refresh a qualquer momento
- **Verificar webhook**: Clique no ícone de escudo para diagnosticar webhook

⚠️ **Importante**: Esta instância é **exclusiva** para o Divulgador - não compartilhada com cobrança ou boas-vindas de usuários.`
        },
        {
          title: "Configurar Webhook (Mensagens Automáticas)",
          content: `Para que as **mensagens automáticas** de entrada/saída funcionem, o webhook precisa estar configurado corretamente na sua instância Evolution API.

**Diagnóstico de Webhook:**

1. Na aba **WhatsApp**, clique no ícone **🛡️ (escudo)** na coluna Ações da instância
2. O sistema verifica automaticamente:
   - ✅ URL atual configurada
   - ✅ URL esperada pelo sistema
   - ✅ Eventos configurados
   - ✅ Evento GROUP_PARTICIPANTS_UPDATE

**Se o webhook NÃO estiver configurado:**

1. **Copie a URL Esperada** clicando no botão de copiar ao lado dela
2. Acesse o painel da **Evolution API** (onde você gerencia suas instâncias)
3. Vá em **Configurações da Instância** → **Webhook**
4. Cole a **URL** que você copiou
5. Marque o evento: **GROUP_PARTICIPANTS_UPDATE**
6. Salve as configurações

**URL Esperada (formato):**
\`https://[projeto].supabase.co/functions/v1/divulgador-welcome\`

**Evento obrigatório:**
- **GROUP_PARTICIPANTS_UPDATE**: Dispara quando alguém entra ou sai de um grupo

**Configuração automática (alternativa):**
- Clique no botão **"Configurar/Reconfigurar"** no modal de diagnóstico
- O sistema tenta configurar automaticamente via API Evolution
- Nem todas as versões da Evolution suportam configuração remota

**Após configurar:**
- Aguarde alguns segundos
- Teste tendo alguém entrando/saindo de um grupo
- Verifique nos **Logs** se o evento foi recebido`
        },
        {
          title: "Sincronizar Grupos",
          content: `**Fluxo de sincronização (ordem obrigatória):**

1. **Primeiro**: Conecte a instância WhatsApp (aba WhatsApp → ícone atualizar)
2. **Segundo**: Na aba **Grupos**, clique em **"Sincronizar do WhatsApp"**

**O que acontece:**
- O sistema busca TODOS os grupos onde a instância é administradora
- Grupos que não existem mais no WhatsApp são **removidos** do banco
- Novos grupos são **adicionados** automaticamente

**Na tabela de grupos você verá:**
- **Foto do grupo** (miniatura)
- Nome do grupo
- **Instância**: Nome da instância WhatsApp vinculada
- **Status Admin**: Badge verde "Admin" ou vermelho "Membro" indicando se a instância é administradora do grupo
- Quantidade de participantes
- **Permissões**: Badges indicando quem pode enviar mensagens e editar o grupo
- Link de convite (botão copiar)
- Status (Ativo/Inativo)
- **Ações**: Editar, Enviar mensagem, Gerar link

**Status Admin - O que significa:**
- 🟢 **Admin**: A instância é administradora do grupo, pode editar configurações, foto, permissões e gerenciar participantes
- 🔴 **Membro**: A instância é apenas participante, NÃO pode editar o grupo pelo painel (ações de edição serão bloqueadas pela API)

**Comunidades:**
- Comunidades do WhatsApp aparecem na sincronização mas **NÃO podem ser editadas** pelo painel
- Ao tentar editar uma comunidade, aparece um aviso explicando a limitação
- Isso ocorre porque comunidades têm estrutura diferente de grupos normais
- Você ainda pode enviar mensagens para comunidades se for admin nela

**Importante:** Os grupos podem ser importados do WhatsApp ou criados manualmente no sistema.`
        },
        {
          title: "Criar Grupos Manualmente",
          content: `**Criar grupo com configurações avançadas:**

1. Na aba **Grupos**, clique em **"Criar Grupo"**
2. **Selecione a instância** onde o grupo será criado (obrigatório)
3. Preencha:
   - **Nome do Grupo**: Nome que aparecerá no WhatsApp
   - **Participante Inicial**: Número do primeiro membro (obrigatório)
   - **Foto do Grupo**: Faça upload de uma imagem (opcional)
   - **Descrição**: Texto que aparece na info do grupo (opcional)
   - **Apenas Admins enviam**: Restringe mensagens aos administradores

**Sobre o Participante Inicial:**
- Se você configurou um **Participante Padrão** na aba WhatsApp, o campo já vem preenchido e **bloqueado**
- Se não configurou, preencha manualmente (formato: 5511999999999)
- É obrigatório ter pelo menos 1 participante para criar o grupo

**Após criar:**
- O grupo aparece automaticamente na tabela
- Link de convite é gerado
- Você pode editar todas as configurações depois`
        },
        {
          title: "Editar Grupos e Permissões",
          content: `**Editar configurações de um grupo:**

1. Na aba **Grupos**, encontre o grupo desejado
2. Clique no botão **"Editar"** (ícone de lápis) na coluna Ações
3. O sistema busca automaticamente as **configurações atuais** do WhatsApp

⚠️ **Tipo de Grupo (Comunidade ou Grupo):**
- O sistema identifica automaticamente se é um **grupo comum** ou uma **comunidade/canal** do WhatsApp
- **🟣 "Comunidade"** (roxo): Canais e comunidades do WhatsApp (têm restrições de edição)
- **🔵 "Grupo"** (azul): Grupos comuns do WhatsApp
- Passe o mouse sobre o badge para ver detalhes

**Importante sobre Comunidades:**
- Comunidades/canais têm restrições de edição pela própria API do WhatsApp
- Se tentar editar uma comunidade, a API pode retornar erro
- Grupos comuns podem ser editados normalmente se você for admin

**No modal de edição você pode alterar:**
- **Nome do Grupo**: Atualiza o nome no WhatsApp em tempo real
- **Descrição**: Texto da info do grupo
- **Foto do Grupo**: Exibe a foto atual (se existir) e permite upload de nova imagem

**Foto do Grupo:**
- O sistema busca a foto atual do grupo via API automaticamente
- Durante o carregamento, aparece um spinner no lugar da foto
- Se o grupo tem foto, ela é exibida no modal
- Para alterar, clique em "Alterar foto" e faça upload de uma nova imagem

**Permissões do Grupo (configuráveis pelo painel):**

1. **Enviar Mensagens**:
   - **Todos**: Qualquer membro pode enviar mensagens
   - **Admins**: Apenas administradores podem enviar (modo anúncio)

2. **Editar Informações**:
   - **Todos**: Qualquer membro pode alterar nome/descrição/foto
   - **Admins**: Apenas administradores podem editar o grupo

**Indicadores visuais na tabela de grupos:**
- **Badge de Instância**: Mostra qual instância (número) está associada ao grupo
- **Badge Tipo**: Indica se é Comunidade (roxo) ou Grupo comum (azul)

**Sincronização automática:**
- Ao abrir o modal de edição, as configurações (incluindo foto) são buscadas do WhatsApp
- Um spinner indica enquanto carrega as configurações reais

**Dicas:**
- Mudanças são aplicadas diretamente no WhatsApp via API
- Todas as alterações são registradas nos logs
- Se a instância desconectar, as edições falharão`
        },
        {
          title: "Gerar Link de Convite",
          content: `**Obter link de convite do grupo:**

1. Na aba **Grupos**, encontre o grupo desejado
2. Clique no botão **"Link"** (ícone de corrente) na coluna Ações
3. O sistema busca o link via API Evolution
4. O link é **copiado automaticamente** para sua área de transferência
5. Uma notificação confirma a cópia

**Onde usar o link:**
- Divulgação em redes sociais
- Convites por email ou WhatsApp
- Sites e landing pages
- QR Codes

**Atualização:**
- O link é buscado em tempo real da API
- Se o link mudar no WhatsApp, clique novamente para obter o novo
- Links expiram quando o grupo é configurado para tal`
        },
        {
          title: "Envio Rápido com Mídia",
          content: `**Enviar mensagem direta para um grupo específico:**

1. Na aba **Grupos**, encontre o grupo desejado
2. Clique no botão **"Enviar"** (ícone de avião) na coluna Ações
3. No modal de envio rápido:
   - Escreva a **mensagem** no campo de texto
   - Selecione o **tipo de mídia** (texto, imagem, vídeo, áudio, documento)
   - Faça **upload do arquivo** se necessário
   - Ative **"Mencionar Todos"** se quiser marcar todos os participantes
4. Clique em **"Enviar Mensagem"**

**Tipos de mídia suportados:**
- ✅ **Texto**: Mensagem simples
- ✅ **Imagem**: JPG, PNG, GIF
- ✅ **Vídeo**: MP4, MOV
- ✅ **Áudio**: MP3, OGG, M4A
- ✅ **Documento**: PDF, DOC, XLS, etc.

**Upload de mídia:**
- Clique em "Selecionar arquivo" ou arraste
- Arquivo é enviado para storage do sistema
- URL é gerada automaticamente

**Diferença do agendamento:**
- **Envio Rápido**: Envia IMEDIATAMENTE, sem agendar
- **Mensagem Agendada**: Define data/hora futura para envio

**Quando usar:**
- Comunicados urgentes com anexos
- Envio de comprovantes ou documentos
- Mídia promocional
- Avisos pontuais com imagens`
        },
        {
          title: "Criar Campanhas",
          content: `Campanhas organizam seus grupos por objetivo:

1. Acesse **Divulgador** → aba **Campanhas**
2. Clique em **"Nova Campanha"**
3. Preencha:
   - **Nome**: Identificação da campanha
   - **Descrição**: Objetivo da campanha
   - **Instância**: WhatsApp vinculado (opcional)
   - **Min grupos vazios**: Quantidade mínima para auto-criação
   - **Máx. participantes/grupo**: Limite antes de criar novo grupo
   - **Auto-criar grupos**: Liga/desliga criação automática

**Editar/Excluir:**
- Clique nos ícones de lápis ou lixeira na campanha

Exemplo: Campanha "Black Friday" com grupos temáticos de vendas.`
        },
        {
          title: "Agendar Mensagens",
          content: `**Criar mensagem agendada:**

1. Acesse **Divulgador** → aba **Mensagens**
2. Clique em **"+ Nova Mensagem"**
3. Selecione o **grupo de destino** (ou todos os ativos)
4. Escreva o **conteúdo** da mensagem
5. Adicione mídia (opcional): faça **upload direto** ou cole URL
6. Defina **data e horário** de envio
7. Configure o **delay entre grupos** (recomendado: 2-5 seg)
8. Ative **"Mencionar Todos"** se desejar
9. Clique em **"Salvar"**

**Tipos de mídia suportados:**
- ✅ Imagem (upload ou URL direta)
- ✅ Vídeo (upload ou URL direta)
- ✅ Áudio (upload ou URL direta)
- ✅ Documento/Arquivo (upload ou URL direta)

**Upload de mídia:**
- Clique em "Selecionar arquivo" ou arraste o arquivo
- Arquivo é enviado para o storage e URL é gerada automaticamente
- Elimina necessidade de hospedar arquivos externamente

**Status das mensagens:**
- 🟡 **Pendente**: Aguardando horário de envio
- 🟢 **Enviada**: Entregue com sucesso
- 🔴 **Erro**: Falha no envio (veja logs)`
        },
        {
          title: "CRON de Envio Automático",
          content: `O Divulgador possui um **CRON** para envio automático de mensagens agendadas:

**Configurar CRON (aba WhatsApp):**
1. Role até a seção **"Envio Automático (CRON)"**
2. Ative o switch **"Ativar Envio Automático"**
3. Defina o **intervalo** no dropdown (1 a 60 minutos)
4. Clique em **"Salvar Configuração"**

**Status do CRON:**
- Um badge mostra o status atual (ex: "Ativo: */5 * * * *")
- O CRON é salvo automaticamente no banco ao clicar em salvar
- Alterações têm efeito imediato

**Como funciona:**
- O sistema verifica mensagens pendentes a cada X minutos
- Mensagens com \`scheduled_at <= agora\` são enviadas
- Após envio, status muda para "sent" ou "error"

**Dica:** Use intervalos de 5-10 minutos para equilíbrio entre velocidade e carga na API.`
        },
        {
          title: "Mensagens Automáticas (Entrada/Saída)",
          content: `Configure mensagens privadas para participantes que entram ou saem:

1. Acesse **Divulgador** → aba **Mensagens Automáticas**
2. Selecione o **Tipo de Evento**:
   - **Entrada (Boas-vindas)**: Quando alguém entra no grupo
   - **Saída (Despedida)**: Quando alguém sai do grupo
3. Selecione o **grupo** específico
4. Escreva a **mensagem** apropriada
5. Defina o **delay** em segundos (recomendado: 5-10 seg)
6. Ative a configuração
7. Clique em **"Salvar"**

**Variáveis disponíveis:**
- \`{nome}\` - Nome do participante
- \`{numero}\` - Número do WhatsApp
- \`{grupo}\` - Nome do grupo

**Funcionamento:**
- **Entrada**: Quando alguém entra no grupo, recebe mensagem privada automática
- **Saída**: Quando alguém sai do grupo, recebe mensagem privada de despedida

**Indicadores visuais:**
- Templates de **Entrada** aparecem com badge verde
- Templates de **Saída** aparecem com badge vermelho

**Importante:** Cada configuração é **vinculada a um grupo específico**, permitindo mensagens diferentes por grupo e por tipo de evento.`
        },
        {
          title: "Gerenciar Participantes",
          content: `**Aba Participantes** tem duas seções:

**1. Todos os Participantes:**

*Fluxo de sincronização:*
- **Passo 1**: Clique em "Sincronizar Grupos" (importa grupos do WhatsApp)
- **Passo 2**: Clique em "Sincronizar Participantes" (busca membros)

*Filtros e ações:*
- Selecione um grupo específico ou "Todos os grupos"
- Busque por número, nome ou grupo
- Exporte para **CSV** com todos os dados

*Informações exibidas:*
- Número do WhatsApp
- Nome (se disponível)
- Grupo ao qual pertence
- Data de entrada
- Última mensagem
- Status (Admin, Membro, Inativo)

**2. Inativos:**
- Configure critérios de inatividade (dias sem mensagem)
- Visualize participantes que não interagem
- Remova inativos em lote de grupos específicos

⚠️ **Importante:** Sempre sincronize GRUPOS antes de PARTICIPANTES!`
        },
        {
          title: "Logs de Operações",
          content: `Na aba **Logs**, acompanhe todas as operações do módulo:

**O que é registrado:**
- ✅ Sincronização de grupos (início/fim)
- ✅ Testes de conexão (sucesso/falha)
- ✅ Configuração de webhook
- ✅ Envio de mensagens (agendadas e rápidas)
- ✅ Criação e edição de grupos
- ✅ Geração de links de convite
- ✅ Erros e avisos

**Informações em cada log:**
- Data e hora
- Tipo de operação
- Status (sucesso/erro/aviso)
- Mensagem descritiva
- Metadados (quando aplicável)

**Filtros:**
Os logs são ordenados do mais recente ao mais antigo, limitados aos últimos 100 registros.

**Dica:** Use os logs para **debugar problemas** de conexão ou envio.`
        },
        {
          title: "Relatórios e Métricas",
          content: `Na aba **Relatórios**, acompanhe métricas do módulo:

**Estatísticas gerais:**
- Total de grupos sincronizados
- Total de participantes
- Mensagens enviadas
- Taxa de sucesso/erro

**Logs de envio:**
- Histórico de mensagens enviadas
- Status de cada envio (sucesso/erro)
- Grupo de destino
- Data e hora

**Exportação:**
Exporte participantes em CSV para análise externa ou importação em outras ferramentas.`
        }
      ],
      tips: [
        "Use uma instância WhatsApp DEDICADA para o Divulgador",
        "Configure um Participante Padrão para agilizar criação de grupos",
        "Sempre sincronize GRUPOS antes de PARTICIPANTES",
        "Use Envio Rápido para comunicados urgentes com ou sem mídia",
        "Edite grupos para manter informações e permissões atualizadas",
        "Gere links de convite para facilitar a divulgação",
        "O webhook é configurado automaticamente ao salvar/testar instância",
        "Menções aumentam engajamento mas use com moderação",
        "Agende mensagens em horários comerciais para melhor resultado",
        "Configure o CRON com intervalos de 5-10 minutos",
        "Use mensagens automáticas diferentes para cada grupo",
        "Monitore os logs para identificar problemas de conexão",
        "Exporte participantes regularmente para backup",
        "Use modo Admins para grupos de comunicados oficiais",
        "A coluna Permissões mostra o status atual de cada grupo",
        "As permissões são sincronizadas do WhatsApp ao abrir edição"
      ]
    },
    {
      id: "status-numeros",
      title: "Status de Números",
      icon: Smartphone,
      color: "text-lime-400",
      bgColor: "bg-lime-500/10",
      description: "Gerencie números aquecidos com histórico completo, webhooks e API REST",
      steps: [
        {
          title: "O que é o Status de Números?",
          content: `O módulo **Status de Números** permite gerenciar números de telefone (chips) aquecidos:

- **Cadastro completo**: Número, modelo do aparelho, status e observações
- **Status dinâmicos**: Crie e personalize status (Ativo, Em Aquecimento, Bloqueado, Vendido)
- **Modelos de aparelho**: Catalogue os modelos utilizados
- **Histórico completo**: Auditoria de todas as alterações
- **Webhooks nativos**: Notifique sistemas externos sobre eventos
- **API REST**: Integração completa para automações

O módulo é **totalmente independente** dos outros módulos do sistema.`
        },
        {
          title: "Cadastrar Números",
          content: `**Passo a passo:**

1. Acesse **Status de Números** no menu lateral
2. Clique no botão **"+ Novo Número"**
3. Preencha:
   - **Número**: Formato completo com DDD (ex: 5511999999999)
   - **Modelo do Aparelho**: Selecione da lista de modelos
   - **Status**: Selecione o status inicial
   - **Observações**: Notas adicionais (opcional)
4. Clique em **"Cadastrar"**

**Última Atividade:**
O sistema registra automaticamente o tipo de ação e a data:
- \`cadastro - DD/MM/YYYY\`: Número recém cadastrado
- \`st - DD/MM/YYYY\`: Status foi alterado
- \`obs - DD/MM/YYYY\`: Observações foram alteradas
- \`st + obs - DD/MM/YYYY\`: Status E observações alterados juntos`
        },
        {
          title: "Gerenciar Status (Tags)",
          content: `**Acessar gerenciamento de status:**

1. Na aba **Configurações** do módulo
2. Seção **"Gerenciar Status"** à esquerda

**Criar novo status:**
- Clique em **"+ Novo Status"**
- Defina o **nome** (ex: "Em Verificação")
- Escolha a **cor** do badge
- Adicione descrição (opcional)

**Editar/Excluir:**
- Clique nos ícones de lápis ou lixeira

**Cores disponíveis:**
- 🟢 Verde: Para números ativos
- 🟡 Âmbar: Para aquecimento
- 🔴 Vermelho: Para bloqueados
- 🔵 Azul: Para vendidos
- ⚫ Cinza: Para outros status`
        },
        {
          title: "Gerenciar Modelos de Aparelho",
          content: `**Acessar gerenciamento de modelos:**

1. Na aba **Configurações** do módulo
2. Seção **"Gerenciar Modelos"** à direita

**Criar novo modelo:**
- Clique em **"+ Novo Modelo"**
- Informe o **nome** (ex: "iPhone 14 Pro")
- Adicione a **marca** (ex: "Apple")
- Descrição opcional

**Editar/Excluir:**
- Clique nos ícones de lápis ou lixeira

**Dica:** Crie modelos padronizados para facilitar relatórios e análises.`
        },
        {
          title: "Filtros e Exportação",
          content: `**Filtrar números:**

Na aba **Números**, use os campos de filtro:
- **Busca**: Por número ou observações
- **Status**: Filtre por status específico
- **Modelo**: Filtre por modelo de aparelho

**Exportar CSV:**
1. Aplique os filtros desejados
2. Clique em **"Exportar CSV"**
3. O arquivo inclui:
   - Número
   - Modelo
   - Status
   - Última Atividade
   - Observações
   - Data de criação

**Permissão necessária:** \`export_numeros\``
        },
        {
          title: "Histórico e Auditoria",
          content: `**Acessar histórico:**

1. Na aba **Histórico** do módulo
2. Veja todas as ações registradas

**Informações registradas:**
- **Ação**: Cadastro, Edição ou Exclusão
- **Número**: Qual número foi afetado
- **Usuário**: Quem realizou a ação
- **Data/Hora**: Quando aconteceu
- **Alterações**: Dados anteriores e novos

**Detalhes da ação:**
Clique no ícone de **olho** para ver:
- Dados anteriores (em edições/exclusões)
- Dados novos (em cadastros/edições)
- Campos específicos que mudaram

**Permissão necessária:** \`view_numeros_history\``
        },
        {
          title: "Configurar Webhooks",
          content: `**Acessar webhooks:**

1. Na aba **Webhooks** do módulo
2. Clique em **"+ Novo Webhook"**

**Configurar webhook:**
- **Nome**: Identificação (ex: "Notificar n8n")
- **URL**: Endpoint que receberá os dados
- **Eventos**: Selecione quais eventos disparam:
  - \`numero.created\`: Número cadastrado
  - \`numero.updated\`: Número atualizado
  - \`numero.status_updated\`: Status alterado
  - \`numero.obs_updated\`: Observações alteradas
  - \`numero.deleted\`: Número excluído
- **Chave Secreta**: Para validar autenticidade (opcional)

**Payload enviado:**
\`\`\`json
{
  "event": "numero.created",
  "data": { ... dados do número ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
\`\`\`

**Permissão necessária:** \`manage_numeros_webhooks\``
        },
        {
          title: "API REST - Visão Geral",
          content: `**Acessar configuração da API:**

1. Na aba **API REST** do módulo
2. Gerencie suas API Keys

**Criar API Key:**
- Clique em **"+ Nova API Key"**
- Defina o **nome** (ex: "Integração Automação")
- A chave é gerada automaticamente
- ⚠️ **Copie imediatamente!** A chave só é exibida uma vez

**Autenticação:**
Envie o header \`x-api-key\` com sua chave em todas as requisições.

**URL Base:**
\`/functions/v1/api-numeros-aquecimento\`

**Permissão necessária:** \`manage_numeros_api\``
        },
        {
          title: "API REST - Endpoints",
          content: `**Listar números:**
\`\`\`bash
curl -X GET "/functions/v1/api-numeros-aquecimento" \\
  -H "x-api-key: sua_chave"
\`\`\`

**Buscar número específico:**
\`\`\`bash
curl -X GET "/functions/v1/api-numeros-aquecimento?id=uuid" \\
  -H "x-api-key: sua_chave"
\`\`\`

**Criar número:**
\`\`\`bash
curl -X POST "/functions/v1/api-numeros-aquecimento" \\
  -H "x-api-key: sua_chave" \\
  -H "Content-Type: application/json" \\
  -d '{"numero": "5511999999999", "status_id": "uuid", "modelo_id": "uuid"}'
\`\`\`

**Atualizar número:**
\`\`\`bash
curl -X PUT "/functions/v1/api-numeros-aquecimento?id=uuid" \\
  -H "x-api-key: sua_chave" \\
  -d '{"status_id": "novo_status_uuid", "observacoes": "Nova obs"}'
\`\`\`

**Excluir número (observação obrigatória):**
\`\`\`bash
curl -X DELETE "/functions/v1/api-numeros-aquecimento/UUID" \\
  -H "x-api-key: sua_chave" \\
  -H "Content-Type: application/json" \\
  -d '{"observacao": "Motivo da exclusão"}'
\`\`\`
`
        },
        {
          title: "API REST - Recursos Auxiliares",
          content: `**Listar status disponíveis:**
\`\`\`bash
curl -X GET "/functions/v1/api-numeros-aquecimento/status" \\
  -H "x-api-key: sua_chave"
\`\`\`

**Listar modelos disponíveis:**
\`\`\`bash
curl -X GET "/functions/v1/api-numeros-aquecimento/modelos" \\
  -H "x-api-key: sua_chave"
\`\`\`

**Consultar histórico:**
\`\`\`bash
curl -X GET "/functions/v1/api-numeros-aquecimento/history/UUID" \\
  -H "x-api-key: sua_chave"
\`\`\`

**Resposta de erro:**
\`\`\`json
{
  "error": "Descrição do erro",
  "code": "INVALID_API_KEY"
}
\`\`\`

**Códigos de erro comuns:**
- \`INVALID_API_KEY\`: Chave inválida ou inativa
- \`NOT_FOUND\`: Recurso não encontrado
- \`VALIDATION_ERROR\`: Dados inválidos`
        }
      ],
      tips: [
        "Use status padronizados para facilitar relatórios",
        "A 'Última Atividade' é atualizada automaticamente",
        "Histórico não pode ser editado (auditoria)",
        "Webhooks disparam apenas quando ativos",
        "Crie API Keys separadas para cada integração",
        "Exporte CSV regularmente como backup",
        "Use filtros para encontrar números rapidamente",
        "Observações são úteis para anotações de manutenção"
      ]
    },
    {
      id: "consulta-numeros",
      title: "Consulta de Números (Baserow)",
      icon: Database,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      description: "Consulte e atualize registros de números armazenados no Baserow com API, webhooks e lembretes automáticos",
      steps: [
        {
          title: "O que é a Consulta de Números?",
          content: `O módulo **Consulta de Números** permite gerenciar registros no **Baserow** (banco de dados no-code):

- **Consulta rápida**: Busque números por texto parcial ou completo
- **Filtros por status**: Filtre por status do Baserow
- **Atualização em tempo real**: Altere status e observações direto no Baserow
- **Histórico completo**: Auditoria de todas as ações
- **API REST**: Integração externa com autenticação por API Key
- **Webhooks**: Notifique sistemas externos sobre eventos
- **Lembretes automáticos**: Alertas via WhatsApp e/ou E-mail

📖 **Documentação completa disponível no módulo!**`
        },
        {
          title: "Acessar a documentação completa",
          content: `Para ver a documentação detalhada com:

- **Configuração do Baserow** (passo a passo)
- **API REST completa** com exemplos cURL
- **Webhooks** e eventos disponíveis
- **Lembretes automáticos** (WhatsApp e Gmail)
- **Permissões** do módulo

**Acesse:**
1. Vá em **Consulta de Números** no menu lateral
2. Clique na aba **Guia** ou no botão **📖 Guia**

Ou acesse diretamente: **/admin/consulta-numeros/guia**`
        },
        {
          title: "Recursos principais",
          content: `**Consulta:**
- Busca por número (parcial ou completo)
- Filtro por status do Baserow
- Visualização de todos os campos mapeados

**Atualização:**
- Alterar status diretamente
- Adicionar/editar observações
- Sincronização automática com Baserow

**Lembretes Automáticos:**
- Monitorar números por status específicos
- Enviar alertas via WhatsApp (Evolution API)
- Enviar alertas via E-mail (Gmail)
- Cron configurável (horários e dias)
- Histórico de envios

**Integrações:**
- API REST com autenticação por API Key
- Webhooks para eventos (consulta, atualização)
- Histórico completo de ações`
        }
      ],
      tips: [
        "A documentação completa está no próprio módulo Consulta de Números",
        "Configure o Baserow antes de usar o módulo",
        "Use lembretes para monitorar números com status críticos",
        "Crie API Keys separadas para cada integração",
        "O histórico registra todas as ações para auditoria"
      ]
    },
    {
      id: "social-media",
      title: "Social Media e Credenciais",
      icon: Share2,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Gerencie credenciais de redes sociais e logos dos clientes.",
      steps: [
        {
          title: "O que é o módulo Social Media?",
          content: `O módulo **Social Media** permite centralizar o armazenamento de credenciais e logos dos clientes:
          
- **Credenciais Seguras**: Armazene logins e senhas de Instagram, Facebook, TikTok, etc.
- **Logos**: Faça upload e gerencie os arquivos de marca dos clientes.
- **Compartilhamento**: Gere links temporários para que parceiros ou clientes acessem as credenciais sem precisar de login no sistema.`
        },
        {
          title: "Como gerenciar credenciais",
          content: `Para gerenciar as credenciais de um cliente:
          
1. Vá em **Clientes** -> **Consultar**.
2. Clique no ícone de cadeado (Credenciais) na linha do cliente.
3. Clique em **Nova Credencial** para adicionar dados de uma nova plataforma.
4. Você pode visualizar, editar ou excluir credenciais existentes.`
        },
        {
          title: "Compartilhando acessos",
          content: `Você pode gerar um link de acesso temporário:
          
1. No modal de credenciais, clique em **Gerar Link**.
2. Escolha o tempo de expiração do link (ex: 24 horas).
3. Copie o link gerado e envie para quem precisar acessar os dados.`
        }
      ],
      tips: [
        "Sempre defina um tempo de expiração curto para links compartilhados por segurança.",
        "As senhas são armazenadas de forma criptografada na base de dados.",
        "Você pode fazer o download das logos diretamente pela aba 'Logos' no modal."
      ]
    },
    {
      id: "servidores-credenciais",
      title: "Credenciais de Servidores e Ferramentas",
      icon: Database,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Cofre dedicado para acessos de servidores e ferramentas técnicas do cliente (Evolution, Chatwoot, n8n, VPS, Portainer, etc.).",
      steps: [
        {
          title: "O que é o módulo de Servidores e Ferramentas?",
          content: `O módulo **Ferramentas / Servidores do cliente** é um cofre **separado** das credenciais de Social Media, focado em **infraestrutura técnica**:

- **Acessos de ferramentas**: Evolution API, Chatwoot, n8n, Portainer, Coolify, etc.
- **Servidores e VPS**: Acessos SSH/painéis administrativos.
- **URL opcional**: Cada credencial pode ter uma URL de acesso (painel/login).
- **Notas**: Campo livre para observações técnicas (porta, comandos, contexto).
- **Ícone Server azul**: Localizado ao lado do ícone de Social Media na linha do cliente em **Clientes → Consultar**.

> Diferente do Social Media, este módulo **não exige logos** — é puramente para credenciais técnicas reutilizáveis pela equipe.`
        },
        {
          title: "Como cadastrar uma credencial",
          content: `1. Vá em **Clientes → Consultar**.
2. Clique no ícone **Server (azul)** ao lado do cliente.
3. Clique em **+ Nova Credencial**.
4. Selecione o **Tipo de Ferramenta** (Evolution, Chatwoot, n8n, ou um tipo personalizado).
5. Preencha **Login**, **Senha**, **URL** (opcional) e **Notas**.
6. Salve.

Cada credencial é exibida com seu **ícone correspondente** (Bot, Workflow, Server, Database, etc.) para identificação visual rápida.`
        }
      ],
      tips: [
        "Use o campo URL para acessar o painel da ferramenta diretamente da página de credenciais.",
        "O botão de **copiar** funciona tanto no app standalone quanto dentro do Chatwoot (iframe).",
        "Senhas ficam ocultas por padrão — clique no ícone de olho para revelar."
      ]
    },
    {
      id: "servidores-ferramentas",
      title: "Gerenciar Tipos de Ferramentas",
      icon: Cog,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Cadastre tipos reutilizáveis de ferramentas para não precisar repetir manualmente em cada cliente.",
      steps: [
        {
          title: "Por que cadastrar tipos de ferramentas?",
          content: `Em vez de digitar manualmente "Portainer", "Coolify" ou outras ferramentas para cada cliente, você cadastra o **tipo** **uma única vez** e ele aparece automaticamente como opção em **todos os clientes**.

O sistema já vem com tipos padrão como **Evolution API**, **Chatwoot** e **n8n**.`
        },
        {
          title: "Como cadastrar um novo tipo",
          content: `1. Abra o modal de **Ferramentas / Servidores** de qualquer cliente.
2. Clique no botão **Ferramentas** (ícone de engrenagem).
3. Clique em **+ Novo Tipo**.
4. Preencha:
   - **Identificador** (ex: \`portainer\`) — usado internamente.
   - **Rótulo** (ex: \`Portainer\`) — exibido na interface.
   - **Ícone** — escolha entre Bot, Workflow, Server, Cog, Database, Cloud, Globe, Settings.
5. Salve.

A nova ferramenta passa a aparecer no dropdown de **todos os clientes** instantaneamente.`
        },
        {
          title: "Removendo tipos personalizados",
          content: `Você pode **excluir tipos personalizados** que criou. Tipos do **sistema** (Evolution, Chatwoot, n8n) não podem ser removidos.

Excluir um tipo **não apaga** as credenciais já cadastradas com ele — apenas remove a opção do dropdown para novos cadastros.`
        }
      ],
      tips: [
        "Padronize os identificadores em minúsculas e sem espaços (ex: \`portainer\`, \`coolify\`).",
        "Use o ícone Database para bancos de dados, Cloud para serviços cloud, Server para VPS/servidores.",
        "Você precisa da permissão **Gerenciar Tipos de Ferramentas** para acessar esta seção."
      ]
    },
    {
      id: "servidores-compartilhamento",
      title: "Compartilhar Credenciais de Servidores",
      icon: Link,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Gere links temporários para compartilhar credenciais técnicas com terceiros sem precisar de login no sistema.",
      steps: [
        {
          title: "Como gerar um link de compartilhamento",
          content: `1. Abra o modal de **Ferramentas / Servidores** do cliente.
2. Clique em **Gerar Link**.
3. Defina o **tempo de expiração** (1h, 6h, 24h, 7 dias).
4. Clique em **Gerar** e depois no botão de **copiar** (funciona dentro do Chatwoot também).
5. Envie o link para quem precisa do acesso.

A página pública mostra **todas as credenciais técnicas** do cliente (login, URL e senha mascarada com botão de revelar/copiar).`
        },
        {
          title: "Segurança e expiração",
          content: `- Cada link tem um **token único** e **expira automaticamente** no tempo definido.
- Após expirar, qualquer tentativa de acesso retorna **"Link inválido ou expirado"**.
- O link **não exige autenticação** — qualquer pessoa com a URL e dentro do prazo pode ver as credenciais.
- Use sempre o **menor tempo possível** de expiração para reduzir risco.

> Tipos personalizados de ferramentas (ex: Portainer) aparecem com **nome e ícone corretos** na página pública.`
        }
      ],
      tips: [
        "Para compartilhar com clientes, prefira expiração de 24h. Para parceiros recorrentes, 7 dias.",
        "Você precisa da permissão **Compartilhar Credenciais de Servidores** para gerar links.",
        "O link sempre usa HTTPS e os botões de copiar funcionam em qualquer iframe (Chatwoot, etc.)."
      ]
    },
    {
      id: "gateway-visao-geral",
      title: "Gateway de Pagamentos",
      icon: Store,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Sistema completo de vendas com múltiplos gateways de pagamento",
      steps: [
        {
          title: "O que é o Gateway de Pagamentos?",
          content: `O **Gateway de Pagamentos** é um módulo completo para vendas online:

- **Múltiplos gateways**: Stripe (internacional) e Mercado Pago (BRL)
- **Catálogo de produtos**: Gerencie produtos com preços em BRL e USD
- **Order Bumps**: Ofertas complementares no checkout
- **Cupons de desconto**: Fixos ou percentuais
- **Checkout público**: Páginas de pagamento personalizadas
- **Contador de urgência**: Aumente conversões com escassez
- **Carrinho abandonado**: Recupere vendas automaticamente
- **Relatórios**: Acompanhe vendas e métricas

O módulo é **totalmente independente** e pode ser usado como uma loja virtual completa.`
        },
        {
          title: "Estrutura do módulo",
          content: `**Páginas administrativas (menu Gateway):**

- **Dashboard**: Métricas de vendas, gráficos e resumo financeiro
- **Produtos**: Cadastro e gerenciamento de produtos
- **Order Bumps**: Ofertas complementares para o checkout
- **Cupons**: Códigos de desconto
- **Pedidos**: Lista de todos os pedidos realizados
- **Configurações**: Gateways, email e carrinho abandonado
- **Relatórios**: Análises detalhadas de vendas

**Páginas públicas:**
- **/p/{slug}**: Checkout público do produto
- **/sucesso**: Confirmação de pagamento`
        },
        {
          title: "Fluxo de venda",
          content: `**Como funciona uma venda:**

1. Cliente acessa **/p/{slug-do-produto}**
2. Visualiza produto, order bumps e contador (se ativo)
3. Aplica cupom de desconto (opcional)
4. Preenche dados: Nome, Email, WhatsApp e CPF
5. Escolhe o gateway: Mercado Pago ou Stripe
6. Clica em **"Pagar"** e é redirecionado ao gateway
7. Após pagamento, volta para **/sucesso**

**Status do pedido:**
- 🟡 **Pendente**: Aguardando pagamento
- 🟢 **Pago**: Pagamento confirmado
- 🔴 **Cancelado**: Pedido cancelado`
        }
      ],
      tips: [
        "Configure pelo menos um gateway antes de publicar produtos",
        "O Mercado Pago aceita PIX, cartão e boleto",
        "Stripe é ideal para pagamentos internacionais em USD",
        "Use o contador de urgência para aumentar conversões",
        "Order Bumps podem aumentar o ticket médio em até 30%"
      ]
    },
    {
      id: "gateway-produtos",
      title: "Produtos",
      icon: Package,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Cadastre e gerencie seus produtos para venda",
      steps: [
        {
          title: "Cadastrar produto",
          content: `**Passo a passo:**

1. Acesse **Gateway** → **Produtos**
2. Clique em **"+ Novo Produto"**
3. Preencha os dados:
   - **Nome**: Nome do produto
   - **Descrição**: Detalhes do produto (Markdown suportado)
   - **Preço BRL**: Valor em reais
   - **Preço USD**: Valor em dólares
   - **Imagem**: URL da imagem do produto ou faça upload
   - **Categoria**: Classificação do produto
   - **Status**: Ativo/Inativo
   - **Order Bumps**: Selecione ofertas complementares
4. Clique em **"Salvar"**

**Slug público:**
O sistema gera automaticamente um slug único para o produto (ex: \`produto-incrivel-abc123\`).
A URL de checkout será: \`/p/{slug}\``
        },
        {
          title: "Conversão de Moeda (Obrigatório)",
          content: `**IMPORTANTE:** Para salvar um produto, os preços BRL e USD devem estar sincronizados!

**Como funciona:**
1. Digite o valor em **BRL** ou **USD**
2. Clique no botão de **conversão (🔄)** ao lado do campo
3. O sistema busca a cotação atual do dólar e converte automaticamente
4. Uma mensagem confirma a conversão: "Convertido: $X.XX (cotação: R$X.XX)"

**Indicadores visuais:**
- 🟢 **Borda verde** + "(sincronizado)": Preços convertidos corretamente
- 🟡 **Borda amarela** + "(não sincronizado)": Preços foram alterados manualmente

**Regras:**
- Não é permitido salvar com preços zerados
- Não é permitido salvar sem usar o botão de conversão
- Se editar o preço manualmente após converter, precisa converter novamente

**Dica:** Use a conversão BRL → USD ou USD → BRL dependendo de qual valor você conhece.`
        },
        {
          title: "Vincular Order Bumps",
          content: `Ao criar ou editar o produto, vincule order bumps:

1. Na seção **"Order Bumps Vinculados"** do formulário
2. Marque os checkboxes dos order bumps desejados
3. Salve o produto

**Dica:** Order bumps aparecem no checkout como ofertas complementares que o cliente pode adicionar com um clique.`
        },
        {
          title: "Copiar link do checkout",
          content: `Para compartilhar o link de checkout:

1. Na lista de produtos, encontre o produto desejado
2. Clique no ícone de **link (🔗)**
3. O link é copiado para a área de transferência

**Pré-requisito:**
Configure a URL do site em **Gateway** → **Configurações** para gerar links completos.

**Formato do link:**
\`https://seusite.com/p/{slug-do-produto}\`

Use este link em:
- Redes sociais
- Email marketing
- Landing pages
- Anúncios`
        },
        {
          title: "Gerenciar categorias",
          content: `Categorias ajudam a organizar produtos:

1. Acesse **Gateway** → **Categorias**
2. Clique em **"+ Nova Categoria"**
3. Preencha:
   - **Nome**: Nome da categoria
   - **Slug**: URL amigável (gerado automaticamente)
   - **Descrição**: Descrição opcional
   - **Status**: Ativo/Inativo
4. Salve a categoria

**Uso:**
Categorias podem ser usadas para filtrar produtos e organizar a loja.`
        }
      ],
      tips: [
        "Use imagens de alta qualidade para melhor conversão",
        "Sempre use o botão de conversão para sincronizar BRL/USD",
        "Borda verde = preços sincronizados, borda amarela = não sincronizado",
        "Produtos inativos não aparecem no checkout público",
        "Configure a URL do site para copiar links completos"
      ]
    },
    {
      id: "gateway-order-bumps",
      title: "Order Bumps",
      icon: ShoppingCart,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Configure ofertas complementares para aumentar o ticket médio",
      steps: [
        {
          title: "O que são Order Bumps?",
          content: `**Order Bumps** são ofertas complementares exibidas no checkout:

- Aparecem como checkbox que o cliente pode marcar
- Adicionam valor ao pedido com um clique
- Aumentam o ticket médio significativamente

**Exemplos de uso:**
- Produto: Curso Online → Bump: Certificado Impresso
- Produto: E-book → Bump: Audiobook
- Produto: Assinatura → Bump: Acesso Vitalício`
        },
        {
          title: "Criar Order Bump",
          content: `**Passo a passo:**

1. Acesse **Gateway** → **Order Bumps**
2. Clique em **"+ Novo Order Bump"**
3. Preencha:
   - **Nome Interno**: Identificação no painel
   - **Título**: Texto exibido no checkout
   - **Descrição**: Detalhes da oferta
   - **Preço BRL**: Valor adicional em reais
   - **Preço USD**: Valor adicional em dólares
   - **Imagem**: Faça upload ou deixe vazio
   - **Permite cupom**: Se cupons podem ser aplicados
   - **Status**: Ativo/Inativo
4. Clique em **"Salvar"**

⚠️ **Conversão obrigatória:** Use o botão de conversão (🔄) para sincronizar BRL/USD antes de salvar!`
        },
        {
          title: "Conversão de Moeda",
          content: `Assim como em produtos, order bumps exigem preços sincronizados:

**Indicadores visuais:**
- 🟢 **Borda verde** + "(sincronizado)": Preços convertidos
- 🟡 **Borda amarela** + "(não sincronizado)": Precisa converter

**Como usar:**
1. Digite o valor em BRL ou USD
2. Clique no botão **🔄** ao lado do campo
3. O outro valor é preenchido automaticamente com a cotação atual
4. Campos ficam com borda verde

**Regras:**
- Não salva com preços zerados
- Não salva sem sincronização`
        },
        {
          title: "Vincular a produtos",
          content: `Vincule order bumps diretamente no cadastro/edição do produto:

1. Acesse **Gateway** → **Produtos**
2. Crie ou edite um produto
3. Na seção **"Order Bumps Vinculados"**, marque os desejados
4. Salve o produto

**Múltiplos bumps:**
Um produto pode ter vários order bumps vinculados.`
        },
        {
          title: "Filtrar Order Bumps",
          content: `Na lista de order bumps, use o filtro de cupom:

- **Todos**: Exibe todos os order bumps
- **Permite cupom**: Apenas os que aceitam desconto
- **Não permite cupom**: Apenas os bloqueados

Útil para revisar quais ofertas estão perdendo margem com cupons.`
        },
        {
          title: "Exibição no checkout",
          content: `**Como aparece para o cliente:**

No checkout público, os order bumps aparecem como:

✅ **[Checkbox]** Adicionar {Título} por mais R$ {Preço}
   {Descrição}

O cliente pode:
- Marcar o checkbox para adicionar ao pedido
- Ver o valor atualizado em tempo real
- Adicionar múltiplos bumps se disponíveis

**Cálculo:**
Subtotal = Produto + Order Bumps selecionados
Desconto = Cupom (se aplicável e permitido)
Total = Subtotal - Desconto`
        }
      ],
      tips: [
        "Sempre sincronize os preços com o botão de conversão",
        "Borda verde = OK, borda amarela = precisa converter",
        "Order bumps com bom desconto convertem mais",
        "Use títulos atrativos como 'Adicione por apenas R$X'",
        "Configure 'Permite cupom' com cuidado para não perder margem"
      ]
    },
    {
      id: "gateway-cupons",
      title: "Cupons de Desconto",
      icon: PercentCircle,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Crie códigos de desconto para suas vendas",
      steps: [
        {
          title: "Criar cupom",
          content: `**Passo a passo:**

1. Acesse **Gateway** → **Cupons**
2. Clique em **"+ Novo Cupom"**
3. Preencha:
   - **Código**: Código único (ex: DESCONTO10)
   - **Tipo**: Percentual ou Valor Fixo
   - **Valor do desconto**: Percentual ou valor em reais
   - **Moeda**: BRL ou USD
   - **Limite de uso global**: Quantas vezes pode ser usado no total
   - **Limite por pedido**: Máximo de uso por pedido
   - **Data início**: Quando começa a valer
   - **Data expiração**: Quando expira
   - **Status**: Ativo/Inativo
4. Clique em **"Salvar"**`
        },
        {
          title: "Tipos de desconto",
          content: `**Desconto Percentual:**
- Aplica % sobre o subtotal
- Ex: Cupom 20% → R$ 100 vira R$ 80

**Desconto Fixo:**
- Aplica valor absoluto
- Ex: Cupom R$ 30 → R$ 100 vira R$ 70

**Moeda:**
- BRL: Aplica apenas em compras em reais
- USD: Aplica apenas em compras em dólares

**Interação com Order Bumps:**
Se o order bump tem "Permite cupom = Sim", o desconto é aplicado sobre ele também.`
        },
        {
          title: "Limites e validade",
          content: `**Limite de uso global:**
Quantas vezes o cupom pode ser usado no total.
- Exemplo: Limite 100 → Após 100 usos, cupom expira automaticamente

**Limite por pedido:**
Quantas unidades do desconto aplicar por pedido.
- Geralmente 1 para evitar stacking

**Período de validade:**
- **Data início**: Cupom só funciona a partir desta data
- **Data expiração**: Cupom para de funcionar após esta data

Cupons expirados ou esgotados retornam erro ao cliente.`
        },
        {
          title: "Métricas de cupons",
          content: `Na lista de cupons você vê:

- **Usos**: Quantas vezes foi utilizado
- **Desconto total dado**: Soma de todos os descontos aplicados
- **Taxa de uso**: Percentual do limite utilizado

**Relatórios:**
No módulo de Relatórios, veja:
- Cupons mais utilizados
- Desconto total por período
- Impacto na conversão`
        }
      ],
      tips: [
        "Códigos em MAIÚSCULAS são mais fáceis de lembrar",
        "Use datas de expiração para criar urgência",
        "Limites de uso evitam abuso de cupons",
        "Monitore descontos dados vs receita gerada"
      ]
    },
    {
      id: "gateway-checkout",
      title: "Checkout e Conversão",
      icon: Timer,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Configure o checkout para maximizar conversões",
      steps: [
        {
          title: "Página de checkout",
          content: `**URL do checkout:**
Cada produto tem sua página de checkout em:
\`/p/{slug-do-produto}\`

**Elementos do checkout:**
1. **Imagem do produto** (se configurada)
2. **Nome e descrição** do produto
3. **Preço** (BRL ou USD conforme detecção automática)
4. **Contador regressivo** (se ativo)
5. **Order Bumps** (se vinculados)
6. **Campo de cupom**
7. **Formulário**: Nome, Email, WhatsApp, CPF
8. **Seletor de gateway** (Mercado Pago / Stripe)
9. **Botão de pagamento** (fixo no rodapé mobile)

**Responsivo:**
O checkout é totalmente responsivo e otimizado para mobile.`
        },
        {
          title: "Contador de urgência",
          content: `**Configurar contador:**

1. Acesse **Gateway** → **Configurações** → aba **Checkout**
2. Ative **"Habilitar contador"**
3. Defina o **tempo em minutos** (1-60)
4. Personalize a **mensagem do contador**
5. Salve as configurações

**Como funciona:**
- Contador inicia quando cliente acessa o checkout
- Baseado na sessão (localStorage)
- Ao zerar, exibe mensagem de urgência
- Aumenta significativamente a conversão

**Exemplo de mensagem:**
"⏰ Oferta expira em 09:45 - Complete sua compra agora!"`
        },
        {
          title: "Detecção automática de moeda",
          content: `O checkout detecta automaticamente a moeda:

**Como funciona:**
- Sistema verifica geolocalização do IP
- Brasil → Exibe preço em BRL, habilita Mercado Pago
- Outros países → Exibe preço em USD, habilita Stripe

**Comportamento:**
- Mercado Pago só aparece para compras em BRL
- Stripe só aparece para compras em USD
- Se ambos estiverem desabilitados, exibe alerta

**Dica:** Configure ambos os gateways para maximizar alcance.`
        },
        {
          title: "Página de sucesso",
          content: `Após pagamento confirmado, cliente é redirecionado para:
\`/sucesso?order_id={id}&status=success\`

**Elementos da página:**
- Mensagem de confirmação
- Número do pedido
- Resumo da compra
- Botão para continuar navegando

**Personalização:**
A página pode ser customizada editando \`src/pages/public/Sucesso.tsx\`.`
        }
      ],
      tips: [
        "Contador de 10 minutos é ideal para maioria dos produtos",
        "Use mensagens de urgência sem ser agressivo",
        "O botão fixo no mobile melhora a conversão",
        "Teste diferentes tempos de contador para otimizar"
      ]
    },
    {
      id: "gateway-pedidos",
      title: "Gerenciamento de Pedidos",
      icon: Receipt,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Acompanhe e gerencie todos os pedidos realizados",
      steps: [
        {
          title: "Lista de pedidos",
          content: `**Acessar pedidos:**

1. Acesse **Gateway** → **Pedidos**
2. Veja a lista completa de pedidos

**Informações exibidas:**
- **ID do pedido**: Identificador único
- **Cliente**: Nome e email
- **Produto**: Nome do produto comprado
- **Order Bump**: Se foi adicionado
- **Cupom**: Se foi aplicado
- **Subtotal / Desconto / Total**: Valores financeiros
- **Gateway**: Mercado Pago ou Stripe
- **Status**: Pendente, Pago, Cancelado
- **Data**: Quando foi criado

**Filtros:**
- Por status (Pendente, Pago, Cancelado)
- Por período
- Por produto
- Por gateway`
        },
        {
          title: "Status dos pedidos",
          content: `**Pendente (pending):**
- Pedido criado mas pagamento não confirmado
- Cliente pode ter abandonado o checkout
- Aguardando confirmação do gateway

**Pago (paid):**
- Pagamento confirmado pelo gateway
- Webhook processado com sucesso
- Cliente redirecionado para /sucesso

**Cancelado (cancelled):**
- Pagamento falhou ou foi cancelado
- Pedido não será processado
- Pode ter expirado ou sido rejeitado

**Atualização automática:**
Os webhooks do Mercado Pago e Stripe atualizam automaticamente o status.`
        },
        {
          title: "Detalhes do pedido",
          content: `Clique em um pedido para ver detalhes:

**Dados do cliente:**
- Nome completo
- Email
- WhatsApp (se informado)
- CPF

**Dados financeiros:**
- Subtotal (produto + order bumps)
- Desconto do cupom
- Total pago
- Moeda (BRL/USD)

**Rastreamento:**
- ID do pagamento no gateway
- Data de criação
- Data de atualização
- Eventos relacionados`
        },
        {
          title: "Carrinho abandonado",
          content: `Pedidos **pendentes** após X horas são considerados abandonados:

**Configurar recuperação:**
1. Acesse **Gateway** → **Configurações** → aba **Carrinho Abandonado**
2. Ative **"Habilitar emails de recuperação"**
3. Defina o **tempo de espera** (minutos)
4. Configure o **assunto** do email
5. Personalize o **template** HTML
6. Salve

**Variáveis do template:**
- \`{{nome}}\`: Nome do cliente
- \`{{produto}}\`: Nome do produto
- \`{{link}}\`: Link para retomar a compra

**Execução automática:**
Um cron verifica pedidos abandonados e envia emails automaticamente.`
        }
      ],
      tips: [
        "Monitore pedidos pendentes para identificar problemas no checkout",
        "Configure carrinho abandonado para recuperar vendas perdidas",
        "Use os relatórios para análise de conversão",
        "Webhooks garantem atualização automática de status"
      ]
    },
    {
      id: "gateway-config",
      title: "Configurações do Gateway",
      icon: Settings,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Configure gateways de pagamento, email e funcionalidades",
      steps: [
        {
          title: "Configurar Stripe",
          content: `**Obter credenciais:**

1. Acesse **dashboard.stripe.com**
2. Vá em **Developers** → **API Keys**
3. Copie:
   - **Publishable key**: pk_live_... ou pk_test_...
   - **Secret key**: sk_live_... ou sk_test_...

**Configurar no sistema:**
1. Acesse **Gateway** → **Configurações** → aba **Gateways**
2. Seção **Stripe**:
   - Ative **"Habilitar Stripe"**
   - Cole a **Publishable Key**
   - Cole a **Secret Key**
3. Clique em **"Salvar Stripe"**

**Ambiente:**
- Use chaves **test** para desenvolvimento
- Use chaves **live** para produção

⚠️ Stripe só aparece no checkout para pagamentos em **USD**.`
        },
        {
          title: "Configurar Mercado Pago",
          content: `**Obter credenciais:**

1. Acesse **mercadopago.com.br/developers/panel**
2. Vá em **Suas integrações** ou crie uma nova
3. Em **Credenciais**, copie o **Access Token**

**Configurar no sistema:**
1. Acesse **Gateway** → **Configurações** → aba **Gateways**
2. Seção **Mercado Pago**:
   - Ative **"Habilitar Mercado Pago"**
   - Cole o **Access Token**
3. Clique em **"Salvar Mercado Pago"**

**Ambiente:**
- Token que começa com **TEST-**: Ambiente sandbox
- Token que começa com **APP_USR-**: Ambiente produção

⚠️ Mercado Pago só aparece no checkout para pagamentos em **BRL**.

**Webhook de pagamento:**
O sistema configura automaticamente o endpoint:
\`/functions/v1/gateway-payment-webhook\`

Este endpoint recebe notificações de pagamentos confirmados/cancelados.`
        },
        {
          title: "Links do Site",
          content: `**Configurar URLs e acessos:**

1. Acesse **Gateway** → **Configurações**
2. Na seção **Links do Site**, configure:

**URL do Site:**
- Informe a URL completa do seu site (ex: https://seusite.com)
- Necessário para que os links copiados funcionem corretamente

**Slug do Catálogo (opcional):**
- Personalize a URL do catálogo (ex: /loja/minha-loja)
- Deixe vazio para usar /catalogo padrão

**Código de Acesso ao Painel:**
- Defina um código secreto para acessar a página de login
- A URL será: /auth?codigo=SEU_CODIGO

**Links gerados:**
- **Link do Catálogo**: Copie para compartilhar sua loja
- **Link de Acesso ao Painel**: Copie para dar acesso aos operadores`
        },
        {
          title: "Aba Checkout",
          content: `**Contador de urgência:**

1. Acesse **Gateway** → **Configurações** → aba **Checkout**
2. Configure:
   - **Habilitar contador**: Ativa/desativa
   - **Tempo em minutos**: Duração do contador (1-60)
   - **Mensagem**: Texto exibido junto ao contador
3. Clique em **"Salvar Configuração"**

**Como funciona:**
- Contador inicia quando cliente acessa checkout
- Baseado em sessionStorage (persiste na sessão)
- Exibe minutos:segundos regressivos
- Ao zerar, mostra mensagem de urgência

**Dica:** Tempo entre 5-15 minutos funciona melhor para criar urgência.`
        },
        {
          title: "Aba Sucesso",
          content: `**Página de sucesso após pagamento:**

1. Acesse **Gateway** → **Configurações** → aba **Sucesso**
2. Configure:
   - **Título**: Mensagem principal (ex: "Compra Realizada!")
   - **Mensagem**: Texto de confirmação
   - **Instruções**: Como acessar o produto
   - **Texto do Botão**: Ação principal
   - **Destino do Botão**: Caminho de redirecionamento

**Botão de Suporte WhatsApp (opcional):**
- Ative para mostrar botão de contato
- Configure número do WhatsApp (DDI+DDD+número)
- Personalize texto do botão e mensagem automática

**Variáveis disponíveis:**
- \`{nome}\`, \`{email}\`, \`{produto}\`, \`{valor}\`, \`{telefone}\`, \`{pedido}\``
        },
        {
          title: "Aba Compras Aprovadas",
          content: `**Notificações de pagamento aprovado:**

1. Acesse **Gateway** → **Configurações** → aba **Compras Aprovadas**

**WhatsApp (Evolution API):**
- Ative **"Habilitar notificação WhatsApp"**
- Configure: Nome da Instância, URL da API, API Key
- Personalize o template da mensagem

**Email (Gmail):**
- Ative **"Habilitar notificação por Email"**
- Configure: Email do Gmail, Senha de App
- Personalize assunto e template

**Variáveis disponíveis:**
- \`{nome}\`, \`{email}\`, \`{produto}\`, \`{valor}\`, \`{telefone}\`

**Dica:** Configure ambos para garantir que o cliente receba a confirmação.`
        },
        {
          title: "Aba Carrinho Abandonado",
          content: `**Recuperação automática de carrinhos:**

1. Acesse **Gateway** → **Configurações** → aba **Carrinho Abandonado**

**Configurações Gerais:**
- **Habilitar**: Ativa/desativa o envio automático
- **Tempo de espera (minutos)**: Após este tempo, o pedido é considerado abandonado
- **Intervalo do Cron (minutos)**: A cada quantos minutos verificar carrinhos (1-60)
- **Delay entre envios (segundos)**: Intervalo entre cada envio para evitar bloqueios

**Notificação via Email (Gmail):**
- **Email do Gmail**: seuemail@gmail.com
- **Senha de App**: Gere em myaccount.google.com/apppasswords
- **Assunto do Email**: Título da mensagem
- **Mensagem do Email**: Template com variáveis

**Notificação via WhatsApp (Evolution):**
- Ative **"Habilitar WhatsApp"**
- Configure: Nome da Instância, URL da API, API Key
- Personalize a mensagem

**Variáveis disponíveis:**
- \`{{nome}}\`, \`{{produto}}\`, \`{{valor}}\`, \`{{link}}\`

**Dica:** Configure Email E WhatsApp para máxima recuperação.`
        }
      ],
      tips: [
        "Configure ambos os gateways (Stripe e Mercado Pago) para máximo alcance",
        "Use ambiente sandbox/test do Stripe para desenvolvimento",
        "Configure notificações via WhatsApp E Email para garantir entrega",
        "O contador de checkout pode aumentar conversões em 20-30%",
        "Para Gmail, sempre use Senha de App (não a senha normal)",
        "Teste as configurações de carrinho abandonado antes de ativar em produção"
      ]
    },
    {
      id: "chamados-visao-geral",
      title: "Sistema de Chamados",
      icon: Ticket,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Gerencie o sistema de abertura e acompanhamento de chamados",
      steps: [
        {
          title: "O que é o Sistema de Chamados?",
          content: `O **Sistema de Chamados** permite que clientes abram e acompanhem chamados de suporte:

- **Abertura de chamados**: Clientes podem abrir chamados via URL pública
- **Código único**: Cada chamado recebe um código ACD-AAAAMMDDHHMMSS
- **Acompanhamento**: Clientes consultam status usando código ou email
- **Comentários**: Interação entre cliente e técnico
- **Histórico completo**: Todas as ações são registradas
- **API REST**: Integração com sistemas externos
- **Webhooks**: Notificações automáticas de eventos

**URL Pública para Clientes:**
\`https://seusite.com/chamados\`

Os clientes podem:
- Abrir novo chamado
- Consultar chamado por código
- Consultar chamados por email (com verificação)`
        },
        {
          title: "Acessar o Módulo",
          content: `**Para acessar:**

1. No menu lateral, clique em **Chamados** (abaixo de Usuários)
2. Você verá todos os chamados abertos

**Funcionalidades do painel:**

- **Buscar**: Filtre por nome, código ou email
- **Filtrar por status**: Aberto, Em Andamento, Aguardando, Resolvido, Fechado
- **Estatísticas**: Cards com contagem por status
- **Detalhes**: Clique em um chamado para ver detalhes e comentários
- **Atualizar status**: Altere o status do chamado
- **Adicionar comentário**: Registre interações com o cliente

**Status disponíveis:**
- 🟡 **Aberto**: Chamado recém-criado
- 🔵 **Em Andamento**: Técnico trabalhando
- 🟠 **Aguardando Cliente**: Esperando resposta do cliente
- 🟢 **Resolvido**: Problema solucionado
- ⚫ **Fechado**: Chamado encerrado`
        },
        {
          title: "URL Pública do Cliente",
          content: `**Onde os clientes acessam:**

\`https://seusite.com/chamados\`

**Na página pública, o cliente pode:**

1. **Abrir Chamado**:
   - Preencher nome, email, contato e motivo
   - Recebe código único (ex: ACD-20251222153045)
   - Recebe link de acompanhamento

2. **Consultar por Código**:
   - Digitar código do chamado (ACD-...)
   - Ver status, comentários e histórico

3. **Consultar por Email**:
   - Digitar email usado na abertura
   - Receber código de 6 dígitos por email
   - Verificar código e ver todos os chamados

**Código de Verificação:**
- Enviado automaticamente para o email
- Expira conforme configuração (padrão: 5 minutos)
- Protege acesso aos chamados do cliente`
        }
      ],
      tips: [
        "O código do chamado usa horário de Brasília (America/Sao_Paulo)",
        "Clientes podem adicionar comentários para fornecer mais informações",
        "Configure o Gmail para envio de códigos de verificação"
      ]
    },
    {
      id: "chamados-api",
      title: "API REST de Chamados",
      icon: Key,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      description: "Integre o sistema de chamados com aplicações externas",
      steps: [
        {
          title: "Gerar Chave de API",
          content: `**Criar chave de acesso:**

1. Acesse **Chamados** → botão **API REST** no cabeçalho
2. Clique em **"Nova Chave API"**
3. Preencha:
   - **Nome**: Identificação da chave
   - **Descrição**: Para que será usada
   - **Permissões**: Selecione as operações permitidas
4. Clique em **"Criar"**
5. **Copie a chave** - ela só é exibida uma vez!

**Permissões disponíveis:**
- **read**: Listar e consultar chamados
- **create**: Abrir novos chamados
- **update**: Atualizar status e dados
- **delete**: Excluir chamados`
        },
        {
          title: "Endpoints Disponíveis",
          content: `**Base URL:**
\`https://[projeto].supabase.co/functions/v1/api-chamados\`

**Autenticação:**
Header: \`Authorization: Bearer SUA_API_KEY\`

---

**Listar todos os chamados:**
\`GET /api-chamados\`

**Buscar por ID:**
\`GET /api-chamados?id=UUID\`

**Buscar por código:**
\`GET /api-chamados?codigo=ACD-20251222153045\`

**Buscar por email:**
\`GET /api-chamados?email=cliente@email.com\`

---

**Criar chamado:**
\`POST /api-chamados\`

{
  "nome": "João Silva",
  "email": "joao@email.com",
  "contato": "11999999999",
  "motivo": "Descrição do problema"
}

---

**Atualizar chamado:**
\`PUT /api-chamados?id=UUID\`

{
  "status": "em_andamento",
  "prioridade": "alta"
}

---

**Deletar chamado:**
\`DELETE /api-chamados?id=UUID\``
        },
        {
          title: "Exemplos de Uso",
          content: `**cURL - Listar chamados:**

curl -X GET \\
  "https://[projeto].supabase.co/functions/v1/api-chamados" \\
  -H "Authorization: Bearer SUA_API_KEY"

**cURL - Criar chamado:**

curl -X POST \\
  "https://[projeto].supabase.co/functions/v1/api-chamados" \\
  -H "Authorization: Bearer SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"nome":"João","email":"joao@email.com","contato":"11999","motivo":"Problema X"}'`
        }
      ],
      tips: [
        "Guarde a chave de API em local seguro - ela só é exibida uma vez",
        "Use permissões mínimas necessárias para cada integração",
        "Teste a API com ferramentas como Postman ou cURL antes de integrar"
      ]
    },
    {
      id: "chamados-webhooks",
      title: "Webhooks de Chamados",
      icon: Webhook,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      description: "Receba notificações automáticas de eventos de chamados",
      steps: [
        {
          title: "Criar Webhook",
          content: `**Configurar webhook:**

1. Acesse **Chamados** → botão **Webhooks** no cabeçalho
2. Clique em **"Novo Webhook"**
3. Preencha:
   - **Nome**: Identificação do webhook
   - **URL**: Endpoint que receberá os eventos
   - **Chave Secreta** (opcional): Para validar autenticidade
   - **Eventos**: Selecione quais eventos disparam o webhook
4. Clique em **"Criar"**

**Eventos disponíveis:**
- **chamado.criado**: Novo chamado aberto
- **chamado.atualizado**: Status ou dados alterados
- **chamado.fechado**: Chamado encerrado
- **chamado.comentario**: Novo comentário adicionado`
        },
        {
          title: "Payload dos Eventos",
          content: `**Estrutura do payload:**

{
  "evento": "chamado.criado",
  "timestamp": "2025-12-22T15:30:45.000Z",
  "chamado": {
    "id": "uuid",
    "codigo": "ACD-20251222153045",
    "nome": "João Silva",
    "email": "joao@email.com",
    "status": "aberto",
    "prioridade": "media"
  }
}

**Headers enviados:**
- Content-Type: application/json
- X-Webhook-Secret: sua_chave_secreta (se configurada)
- X-Webhook-Event: chamado.criado`
        },
        {
          title: "Integração com n8n",
          content: `**Configurar no n8n:**

1. Crie um workflow no n8n
2. Adicione um nó **Webhook** como trigger
3. Copie a URL gerada pelo n8n
4. No sistema, crie um webhook com essa URL
5. Selecione os eventos desejados

**Exemplo de uso:**
- Chamado criado → Notificar equipe no Slack
- Chamado fechado → Atualizar CRM externo
- Comentário adicionado → Enviar email ao cliente`
        }
      ],
      tips: [
        "Use a chave secreta para validar que as requisições vêm do sistema",
        "Teste com Webhook.site antes de conectar ao seu sistema",
        "Verifique os logs de webhook para diagnosticar falhas"
      ]
    },
    {
      id: "chamados-config",
      title: "Configurações de Chamados",
      icon: Settings,
      color: "text-slate-400",
      bgColor: "bg-slate-500/10",
      description: "Configure o sistema de chamados",
      steps: [
        {
          title: "Configurações Gerais",
          content: `**Acessar configurações:**

1. Acesse **Chamados** → botão **Configurações** no cabeçalho

**Tempo de expiração do código de verificação:**
- Mínimo: 1 minuto
- Máximo: 60 minutos
- Padrão: 5 minutos

Este código é enviado quando o cliente consulta chamados por email.`
        },
        {
          title: "Configurar Gmail (SMTP)",
          content: `**Para envio de códigos de verificação:**

1. Na aba **Gmail**, configure:
   - **Nome do remetente**: Nome que aparece no email
   - **Email Gmail**: Seu endereço Gmail
   - **Senha de App**: Senha de 16 caracteres do Google

**Gerar Senha de App:**
1. Acesse **myaccount.google.com**
2. Vá em **Segurança** → **Verificação em 2 etapas** (ative se necessário)
3. Depois, vá em **Senhas de app**
4. Selecione "Outro" e digite "Chamados CRM"
5. Copie a senha de 16 caracteres`
        },
        {
          title: "Permissões de Chamados",
          content: `**Configurar em Permissões do Sistema:**

Acesse **Painel Administrativo** → **Permissões do Sistema**

**Permissões disponíveis:**
- **view_chamados**: Visualizar chamados
- **manage_chamados**: Gerenciar (atualizar status, comentar)
- **manage_chamados_config**: Alterar configurações
- **manage_chamados_webhooks**: Gerenciar webhooks
- **manage_chamados_api**: Gerenciar chaves de API

**Recomendações por role:**
- **Admin**: Todas as permissões
- **Técnico/Suporte**: view_chamados + manage_chamados
- **Gerente**: Todas exceto API e webhooks`
        }
      ],
      tips: [
        "Use uma conta Gmail dedicada para o sistema",
        "Guarde a senha de app em local seguro",
        "Configure permissões adequadas para cada tipo de usuário"
      ]
    },
    {
      id: "relatorios-visao-geral",
      title: "Relatórios Avançados",
      icon: BarChart3,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      description: "Métricas de conversão, churn e LTV do seu negócio",
      steps: [
        {
          title: "O que são Relatórios Avançados?",
          content: `Os **Relatórios Avançados** fornecem métricas essenciais para acompanhar a saúde financeira do seu negócio:

**Métricas disponíveis:**
- **Conversão**: Taxa de visitantes que se tornam clientes
- **Churn**: Taxa de cancelamentos mensais
- **LTV**: Valor do tempo de vida do cliente
- **MRR**: Receita Recorrente Mensal

**Características:**
- Dados 100% automáticos (atualizados em tempo real)
- Separação por moeda (BRL e USD)
- Gráficos interativos
- Período personalizável (3, 6 ou 12 meses)

**Acessar:**
Menu lateral → **Relatórios** ou Painel Admin → **Relatórios Avançados**`
        },
        {
          title: "Fontes de Dados",
          content: `Os relatórios são alimentados automaticamente por:

**Clientes (tabela \`clientes\`):**
- MRR: Soma dos valores mensalizados
- Churn: Baseado na data de renovação
- LTV: Ticket médio × Tempo de permanência
- Novos clientes: Data de criação

**Gateway (tabela \`gateway_orders\`):**
- Pedidos: Total de vendas
- Conversão: Taxa de conclusão

**Eventos (tabela \`gateway_events\`):**
- Visualizações de página
- Checkouts iniciados
- Abandono de carrinho

**Importante:** Tudo é calculado automaticamente. Não precisa fazer nada manual!`
        }
      ],
      tips: [
        "Acesse regularmente para acompanhar a saúde do negócio",
        "Compare períodos diferentes para identificar tendências",
        "Use os dados para tomar decisões informadas"
      ]
    },
    {
      id: "relatorios-metricas",
      title: "Entendendo as Métricas",
      icon: BarChart,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      description: "Como interpretar cada métrica e benchmark ideal",
      steps: [
        {
          title: "Taxa de Conversão",
          content: `**O que é:**
Porcentagem de visitantes que se tornam clientes pagantes.

**Cálculo:**
\`(Pedidos Pagos ÷ Visualizações de Página) × 100\`

**Benchmarks:**
- 🟢 **Excelente**: > 3%
- 🟡 **Bom**: 1-3%
- 🔴 **Precisa melhorar**: < 1%

**Como melhorar:**
- Otimize a página de checkout
- Use depoimentos e prova social
- Ofereça múltiplas formas de pagamento
- Adicione contador de urgência`
        },
        {
          title: "Churn Rate (Taxa de Cancelamento)",
          content: `**O que é:**
Porcentagem de clientes que não renovam por mês.

**Cálculo:**
\`(Clientes Perdidos ÷ Clientes Ativos no Início) × 100\`

**Benchmarks (SaaS):**
- 🟢 **Excelente**: < 3%
- 🟡 **Aceitável**: 3-5%
- 🔴 **Crítico**: > 5%

**Como reduzir:**
- Melhore o onboarding
- Ofereça suporte proativo
- Crie programa de fidelidade
- Analise motivos de cancelamento`
        },
        {
          title: "LTV (Lifetime Value)",
          content: `**O que é:**
Quanto um cliente gasta em média durante todo o relacionamento.

**Cálculo:**
\`Ticket Médio Mensal × Tempo Médio de Permanência (meses)\`

**Exemplo:**
- Ticket: R$ 100/mês
- Permanência média: 8 meses
- LTV = R$ 800

**Por que importa:**
- Define quanto você pode investir para adquirir clientes
- LTV > Custo de Aquisição = Negócio saudável
- LTV < Custo de Aquisição = Prejuízo

**Como aumentar:**
- Aumente o ticket médio (upsell)
- Reduza o churn (retenção)
- Crie planos anuais com desconto`
        },
        {
          title: "MRR (Receita Recorrente Mensal)",
          content: `**O que é:**
Soma de todas as receitas mensais recorrentes de clientes ativos.

**Cálculo:**
Para cada cliente: \`Valor ÷ Meses do Ciclo\`
Exemplo: R$ 600 anual = R$ 50/mês

**Componentes do MRR:**
- **Novo MRR**: Novos clientes
- **Expansão MRR**: Upgrades de plano
- **Churn MRR**: Cancelamentos

**MRR Separado por Moeda:**
O sistema mostra:
- **MRR BRL**: Clientes em Real
- **MRR USD**: Clientes em Dólar

Isso evita confusão ao somar moedas diferentes.

**Crescimento saudável:**
- MRR deve crescer mês a mês
- Novo MRR deve superar Churn MRR`
        }
      ],
      tips: [
        "Churn < 5% é considerado saudável para SaaS",
        "LTV deve ser pelo menos 3x o custo de aquisição",
        "Acompanhe o MRR semanalmente para detectar tendências",
        "Compare com meses anteriores para ver evolução"
      ]
    },
    {
      id: "relatorios-ia",
      title: "Análise com IA",
      icon: Bot,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      description: "Use IA para interpretar métricas e receber recomendações estratégicas",
      steps: [
        {
          title: "O que é a Análise com IA?",
          content: `A **Análise com IA** interpreta automaticamente suas métricas de negócio (Churn, MRR, LTV) e gera recomendações práticas:

- **Clientes em risco**: Identifica clientes com renovação próxima ou atrasada
- **Recomendações**: Ações específicas para reduzir churn e aumentar receita
- **Múltiplos provedores**: Lovable AI (padrão), OpenAI e Grok (xAI)
- **Prompt visível**: Veja exatamente o prompt usado na análise

**Acessar:** Relatórios → aba **Análise IA**`
        },
        {
          title: "Agendamento Automático",
          content: `Configure análises automáticas com notificações:

- **Frequência**: Diária (08:00) ou Semanal (Segunda 08:00)
- **WhatsApp**: Adicione números para receber o relatório
- **E-mail**: Configure destinatários para receber por e-mail
- **Histórico**: Todas as análises ficam salvas no histórico

**Configurar:** Relatórios → Análise IA → aba **Agendamento**`
        }
      ],
      tips: [
        "Use Lovable AI como padrão — não precisa de API key",
        "Compare análises de diferentes provedores para insights variados",
        "Configure o agendamento diário para acompanhar a saúde do negócio",
        "Clique no ícone de olho para ver o prompt utilizado"
      ]
    },
    {
      id: "propostas-visao-geral",
      title: "Sistema de Propostas",
      icon: FileSignature,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Crie, personalize e envie propostas comerciais profissionais",
      steps: [
        {
          title: "O que é o Sistema de Propostas?",
          content: `O **Sistema de Propostas** permite criar documentos comerciais profissionais para enviar a clientes:

- **Editor visual**: Crie propostas com seções personalizáveis (texto, imagens, galeria, equipe, depoimentos)
- **Templates**: Use modelos prontos como ponto de partida
- **Branding**: Configure logotipo, cores e identidade visual
- **Envio automatizado**: Envie por WhatsApp e/ou Email
- **Acompanhamento**: Veja quando o cliente visualizou a proposta
- **Aceite/Recusa**: O cliente pode aceitar ou recusar diretamente pela URL pública
- **Assinatura digital**: Captura de assinatura no aceite
- **Remarketing**: Reenvie propostas não respondidas automaticamente

**Acessar:**
Menu lateral → **Propostas**`
        },
        {
          title: "Criar nova proposta",
          content: `1. Acesse **Propostas** → clique em **"Nova Proposta"**
2. Escolha um **template** ou comece do zero
3. Preencha os dados básicos:
   - **Título**: Nome da proposta
   - **Cliente**: Vincule a um cliente existente ou preencha manualmente
   - **Valor**: Valor da proposta
   - **Validade**: Data de expiração
4. Edite as **seções** no editor visual
5. Clique em **"Salvar"**

**Templates disponíveis:**
O sistema oferece templates pré-configurados para diferentes tipos de negócio (serviços, produtos digitais, consultoria, etc.).`
        },
        {
          title: "Status das propostas",
          content: `As propostas podem ter os seguintes status:

- 🟡 **Rascunho**: Em edição, não enviada
- 🔵 **Enviada**: Enviada ao cliente
- 🟣 **Agendada**: Envio programado para data futura
- 👁️ **Visualizada**: Cliente abriu o link da proposta
- 🟢 **Aceita**: Cliente aceitou a proposta
- 🔴 **Recusada**: Cliente recusou (com motivo opcional)
- ⚫ **Expirada**: Passou da data de validade

**Filtros:**
Na listagem, filtre por status, cliente ou período para encontrar propostas específicas.`
        }
      ],
      tips: [
        "Use templates para criar propostas mais rapidamente",
        "Configure o branding antes de enviar a primeira proposta",
        "Propostas expiradas podem ser reenviadas com nova data",
        "Acompanhe visualizações para saber o interesse do cliente"
      ]
    },
    {
      id: "propostas-editor",
      title: "Editor de Propostas",
      icon: FileText,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Personalize o conteúdo e layout das suas propostas",
      steps: [
        {
          title: "Seções disponíveis",
          content: `O editor permite adicionar diferentes tipos de seções:

- **Texto**: Conteúdo em Markdown (negrito, itálico, listas, links)
- **Imagem**: Upload de imagens com legenda
- **Galeria**: Carrossel de imagens para portfólio
- **Equipe**: Apresente membros da equipe com foto e cargo
- **Depoimentos**: Adicione testemunhos de clientes satisfeitos
- **Preços/Planos**: Tabela comparativa de planos

**Reorganizar seções:**
Arraste e solte as seções para alterar a ordem de exibição.`
        },
        {
          title: "Markdown no editor",
          content: `Use formatação Markdown nos campos de texto:

- **Negrito**: \`**texto**\`
- *Itálico*: \`*texto*\`
- Listas: \`- item\`
- Links: \`[texto](url)\`
- Títulos: \`## Título\`

O preview mostra exatamente como o cliente verá a proposta.`
        },
        {
          title: "IA para propostas",
          content: `O editor integra **IA generativa** para auxiliar na criação de conteúdo:

1. Clique no ícone de **IA** em qualquer seção de texto
2. Descreva o que deseja (ex: "Crie uma introdução para proposta de marketing digital")
3. A IA gera o conteúdo automaticamente
4. Edite conforme necessário

**Modelos disponíveis:**
O sistema usa modelos de IA integrados (Gemini, GPT) sem necessidade de API key externa.`
        }
      ],
      tips: [
        "Use o preview para ver como a proposta ficará para o cliente",
        "Seções podem ser duplicadas para agilizar a criação",
        "A IA ajuda a criar conteúdo mais profissional rapidamente",
        "Imagens de alta qualidade fazem diferença na apresentação"
      ]
    },
    {
      id: "propostas-envio",
      title: "Envio e Acompanhamento",
      icon: Send,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Envie propostas e acompanhe visualizações e respostas",
      steps: [
        {
          title: "Enviar proposta",
          content: `**Envio direto:**

1. Na listagem de propostas, clique no ícone de **enviar**
2. Selecione os canais:
   - ✉️ **Email**: Envia link da proposta por email
   - 📱 **WhatsApp**: Envia link via Evolution API
3. Personalize a mensagem (opcional)
4. Clique em **"Enviar"**

**Agendamento:**
- Clique em **"Agendar Envio"** para definir data/hora futura
- A proposta ficará com status **"Agendada"** até o momento do envio
- O sistema processa envios agendados automaticamente`
        },
        {
          title: "Remarketing automático",
          content: `O remarketing reenvia propostas não respondidas:

**Remarketing Manual:**
1. Na proposta, clique em **"Remarketing"**
2. Configure os canais (WhatsApp/Email)
3. Defina o delay entre envios
4. Envie imediatamente

**Remarketing Automático:**
1. Na listagem, configure **automação de remarketing**
2. Defina o **intervalo** (ex: reenviar após 3 dias)
3. Defina o **número máximo de tentativas**
4. O sistema reenvia automaticamente propostas sem resposta

**Horários configuráveis:**
Os envios de remarketing respeitam horários comerciais configuráveis.`
        },
        {
          title: "Acompanhamento de visualizações",
          content: `Monitore quando e quantas vezes o cliente acessou a proposta:

**Na listagem:**
- Ícone de **olho** mostra contagem de visualizações
- Clique para ver o **histórico detalhado**

**Histórico inclui:**
- Data e hora de cada visualização
- IP do visitante
- Dispositivo utilizado
- Tempo na página

**Notificações de gestores:**
Configure para notificar gestores (WhatsApp/Email) quando:
- Cliente aceitar a proposta
- Cliente recusar a proposta
- Suporta múltiplos números de gestores com delay entre mensagens`
        }
      ],
      tips: [
        "Envie por WhatsApp e Email para maximizar visualizações",
        "Remarketing após 3-5 dias é ideal para propostas",
        "Monitore visualizações para fazer follow-up no momento certo",
        "Configure notificações de aceite/recusa para gestores"
      ]
    },
    {
      id: "propostas-config",
      title: "Configurações de Propostas",
      icon: Settings,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Configure branding, templates e notificações",
      steps: [
        {
          title: "Branding",
          content: `**Personalizar identidade visual:**

1. Acesse **Propostas** → **Configurações** (ícone de engrenagem)
2. Na aba **Branding**, configure:
   - **Logotipo**: Upload da logo da empresa
   - **Cor primária**: Cor principal do tema
   - **Cor secundária**: Cor de apoio
   - **Nome da empresa**: Aparece no rodapé

Essas configurações são aplicadas a **todas** as propostas.`
        },
        {
          title: "Notificações de aceite/recusa",
          content: `**Configurar notificações para gestores:**

1. Acesse **Propostas** → **Configurações**
2. Na seção de **Notificações**:
   - Ative notificação por **WhatsApp** e/ou **Email**
   - Configure instância Evolution (nome, URL, API key)
   - Adicione **números de gestores** para receber alertas
   - Defina **delay entre mensagens** para múltiplos gestores
   - Configure Gmail para notificação por email

**Eventos notificados:**
- ✅ Proposta **aceita** pelo cliente
- ❌ Proposta **recusada** pelo cliente (inclui motivo)`
        },
        {
          title: "Permissões de Propostas",
          content: `**Configurar em Permissões do Sistema:**

Acesse **Painel Administrativo** → **Permissões**

**Permissões disponíveis:**
- **view_proposals**: Visualizar propostas
- **manage_proposals**: Criar, editar e enviar propostas
- **manage_proposals_config**: Alterar configurações e branding

**Recomendações:**
- **Vendedor**: view_proposals + manage_proposals
- **Admin**: Todas as permissões
- **Visualizador**: Apenas view_proposals`
        }
      ],
      tips: [
        "Configure o branding antes de criar a primeira proposta",
        "Use cores consistentes com a identidade da sua marca",
        "Notificações ajudam a agir rapidamente em aceites e recusas",
        "Configure múltiplos gestores para cobrir diferentes horários"
      ]
    },
    {
      id: "followups-visao-geral",
      title: "Sistema de Follow-ups",
      icon: CalendarClock,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
      description: "Agende lembretes e acompanhamentos automáticos para clientes",
      steps: [
        {
          title: "O que são Follow-ups?",
          content: `O **Sistema de Follow-ups** permite agendar acompanhamentos automáticos para clientes:

- **Agendamento**: Defina data e hora para envio de lembretes
- **Múltiplos canais**: Envie por WhatsApp ou Email
- **Recorrência**: Configure envios recorrentes (a cada X dias)
- **Múltiplas tentativas**: Defina quantas vezes reenviar
- **Conversão**: Marque quando o cliente respondeu/converteu
- **Vinculação**: Vincule a um cliente existente ou use dados manuais

**Acessar:**
Menu lateral → **Follow-ups**`
        },
        {
          title: "Criar novo follow-up",
          content: `1. Acesse **Follow-ups** → clique em **"Novo Follow-up"**
2. Preencha os dados:
   - **Cliente**: Selecione um cliente existente ou preencha manualmente
   - **Nome, Email, WhatsApp**: Dados de contato (preenchidos automaticamente se vinculado)
   - **Produto**: Sobre qual produto/serviço é o follow-up
   - **Canal**: WhatsApp ou Email
   - **Mensagem personalizada**: Texto do lembrete
   - **Data/Hora de envio**: Quando enviar
3. Opções avançadas:
   - **Recorrente**: Ativar envios periódicos
   - **Intervalo**: A cada quantos dias reenviar
   - **Máx tentativas**: Limite de reenvios
4. Clique em **"Salvar"**

**Seletor de país (DDI):**
O campo WhatsApp usa seletor de país com bandeira, suportando 80+ países. Busque por nome do país ou DDI.`
        },
        {
          title: "Status dos follow-ups",
          content: `Os follow-ups podem ter os seguintes status:

- 🟡 **Pendente**: Aguardando data de envio
- 🟢 **Enviado**: Mensagem entregue com sucesso
- 🔴 **Erro**: Falha no envio
- ✅ **Convertido**: Cliente respondeu/comprou
- ⏸️ **Pausado**: Temporariamente pausado
- ⚫ **Cancelado**: Follow-up cancelado

**Conversão:**
Quando o cliente responde ou compra, marque como **"Convertido"** com nota explicativa para registrar o resultado.`
        },
        {
          title: "Gráficos e métricas",
          content: `O painel de follow-ups inclui gráficos interativos:

- **Por status**: Distribuição dos follow-ups (pendente, enviado, convertido, etc.)
- **Por canal**: WhatsApp vs Email
- **Taxa de conversão**: % de follow-ups que resultaram em conversão
- **Timeline**: Histórico de envios ao longo do tempo

Use essas métricas para ajustar sua estratégia de acompanhamento.`
        }
      ],
      tips: [
        "Follow-ups recorrentes são ideais para nutrição de leads",
        "Use mensagens personalizadas para cada etapa do funil",
        "Acompanhe a taxa de conversão para medir eficácia",
        "Configure follow-ups logo após o primeiro contato com o cliente",
        "O seletor de país suporta busca por DDI (ex: 351 para Portugal)"
      ]
    },
    {
      id: "followups-config",
      title: "Configurações de Follow-ups",
      icon: Settings,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
      description: "Configure canais de envio e automações de follow-up",
      steps: [
        {
          title: "Pré-requisitos",
          content: `**Para envio por WhatsApp:**
- Configure uma instância Evolution API
- A mesma instância configurada em outros módulos pode ser usada

**Para envio por Email:**
- Configure Gmail com Senha de App
- A mesma configuração de outros módulos pode ser usada

**Processamento automático:**
O sistema processa follow-ups pendentes automaticamente via cron, verificando mensagens com data de envio passada e enviando-as.`
        },
        {
          title: "Permissões de Follow-ups",
          content: `**Configurar em Permissões do Sistema:**

Acesse **Painel Administrativo** → **Permissões**

**Permissões disponíveis:**
- **view_followups**: Visualizar follow-ups
- **manage_followups**: Criar, editar e gerenciar follow-ups

**Recomendações:**
- **Vendedor**: view_followups + manage_followups
- **Admin**: Todas as permissões
- **Visualizador**: Apenas view_followups`
        }
      ],
      tips: [
        "Configure WhatsApp e Email para ter múltiplos canais de follow-up",
        "O cron processa automaticamente - não precisa enviar manualmente",
        "Follow-ups com falha podem ser reenviados individualmente"
      ]
    },
    {
      id: "despesas-visao-geral",
      title: "Controle de Despesas",
      icon: Receipt,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Registre e controle gastos financeiros do negócio",
      steps: [
        {
          title: "O que é o módulo de Despesas?",
          content: `O **módulo de Despesas** permite o controle financeiro completo:

- **Registro de gastos**: Valor, categoria, descrição e vencimento
- **Categorias personalizadas**: Crie categorias como "Marketing", "Infraestrutura", "Pessoal", etc.
- **Status automáticos**: Pendente, Atrasada ou Paga
- **Recorrência**: Marque despesas como fixas para geração automática mensal
- **Resumo financeiro**: Cards com totais (pago, pendente, atrasado)
- **Dashboard integrado**: Resumo de despesas aparece no Dashboard principal

**Acessar:**
Menu lateral → **Despesas**`
        },
        {
          title: "Cadastrar despesa",
          content: `1. Acesse **Despesas** → clique em **"Nova Despesa"**
2. Preencha:
   - **Descrição**: O que é a despesa
   - **Valor**: Montante
   - **Categoria**: Selecione ou crie nova categoria
   - **Data de Vencimento**: Quando vence
   - **Despesa Fixa (modelo)**: Marque se é recorrente
3. Clique em **"Salvar"**

**Status automáticos:**
- 🟡 **Pendente**: Vencimento no futuro
- 🔴 **Atrasada**: Vencimento já passou e não foi paga
- 🟢 **Paga**: Marcada como paga manualmente`
        },
        {
          title: "Marcar como paga",
          content: `Para registrar o pagamento de uma despesa:

1. Na lista de despesas, encontre a despesa
2. Clique no botão **"Pagar"** (ícone de check)
3. Confirme o pagamento

O status muda para **"Paga"** e a data de pagamento é registrada.

**Resumo financeiro (cards no topo):**
- **Total Pago**: Soma de todas as despesas pagas
- **Total Pendente**: Despesas que ainda não venceram
- **Total Atrasado**: Despesas com vencimento passado e não pagas
- **Lucro/Prejuízo**: Comparação com receitas (MRR)`
        }
      ],
      tips: [
        "Use categorias para organizar despesas por tipo",
        "Marque despesas fixas como modelo para automação mensal",
        "Acompanhe o resumo financeiro no Dashboard",
        "Despesas atrasadas são destacadas em vermelho para fácil identificação"
      ]
    },
    {
      id: "despesas-recorrencia",
      title: "Despesas Recorrentes (CRON)",
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Automatize a geração mensal de despesas fixas",
      steps: [
        {
          title: "Como funciona a recorrência?",
          content: `Despesas marcadas como **"Despesa Fixa (modelo)"** são usadas para gerar faturas automaticamente:

**Funcionamento:**
- Todo dia **1º do mês às 08:00 UTC**, o cron executa
- Busca todas as despesas marcadas como fixas/modelo
- Gera uma nova fatura para o mês atual com status "Pendente"
- A despesa original (modelo) permanece inalterada

**Exemplo:**
- Despesa modelo: "Aluguel" - R$ 2.000
- No dia 1º de cada mês, gera automaticamente uma despesa "Aluguel" de R$ 2.000 com vencimento no mês atual`
        },
        {
          title: "Configurar recorrência",
          content: `**Ao criar ou editar uma despesa:**

1. Marque o checkbox **"Despesa Fixa (modelo)"**
2. Salve a despesa

**Essa despesa servirá como template mensal.**

**Monitoramento do CRON:**
No painel de Despesas, você pode ver:
- Status do cron (ativo/inativo)
- Data da última execução
- Próxima execução prevista
- Quantidade de faturas geradas`
        },
        {
          title: "Permissões de Despesas",
          content: `**Configurar em Permissões do Sistema:**

Acesse **Painel Administrativo** → **Permissões**

**Permissões disponíveis:**
- **view_despesas**: Visualizar despesas e resumo financeiro
- **manage_despesas**: Criar, editar, pagar e excluir despesas
- **manage_despesas_cron**: Configurar e gerenciar o cron de recorrência

**Recomendações:**
- **Financeiro**: Todas as permissões de despesas
- **Gerente**: view_despesas + manage_despesas
- **Visualizador**: Apenas view_despesas`
        }
      ],
      tips: [
        "Use modelos de despesa fixa para automatizar gastos mensais",
        "O cron roda no dia 1º de cada mês automaticamente",
        "Verifique o status do cron periodicamente para garantir que está funcionando",
        "Despesas geradas pelo cron podem ser editadas individualmente"
      ]
    },
    {
      id: "revendedor-visao-geral",
      title: "Planos Revendedor",
      icon: Store,
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      description: "Gerencie planos e configurações de revendedor",
      steps: [
        {
          title: "O que são Planos Revendedor?",
          content: `O módulo de **Planos Revendedor** permite gerenciar planos de revenda:

- **Cadastro de planos**: Nome, descrição, preço e recursos incluídos
- **Gerenciamento**: Ative, desative ou edite planos existentes
- **Vinculação**: Associe planos a clientes ou revendedores

**Acessar:**
Menu lateral → **Revendedor** (ícone de loja)`
        },
        {
          title: "Gerenciar planos",
          content: `**Criar novo plano:**

1. Acesse **Revendedor** no menu lateral
2. Clique em **"Novo Plano"**
3. Preencha os dados do plano:
   - **Nome**: Identificação do plano
   - **Descrição**: Detalhes dos recursos
   - **Preço**: Valor do plano
   - **Status**: Ativo ou Inativo
4. Salve o plano

**Editar/Excluir:**
- Clique nos botões de ação ao lado de cada plano para editar ou excluir`
        },
        {
          title: "Permissões",
          content: `**Configurar em Permissões do Sistema:**

Acesse **Painel Administrativo** → **Permissões**

**Permissão necessária:**
- **view_revendedor**: Acesso ao módulo de Revendedor

**Recomendações:**
- **Admin**: Acesso total
- **Gerente comercial**: view_revendedor para gerenciar planos`
        }
      ],
      tips: [
        "Organize planos por nível de recursos para facilitar upsell",
        "Mantenha planos inativos para referência histórica",
        "Descreva claramente os recursos de cada plano para evitar dúvidas"
      ]
    },
    {
      id: "pipeline-visao-geral",
      title: "Pipeline de Clientes (Kanban)",
      icon: Columns,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      description: "Gerencie clientes e leads em um quadro Kanban com etapas personalizáveis",
      steps: [
        {
          title: "O que é o Pipeline?",
          content: `O **Pipeline** é um quadro Kanban para visualizar o funil de vendas:

- **Etapas personalizáveis**: Crie colunas como "Prospecção", "Negociação", "Fechado"
- **Leads e Clientes**: Arraste leads entre as etapas conforme avançam no funil
- **Conversão**: Converta leads em clientes cadastrados com um clique
- **Automações**: Crie regras automáticas para mover leads entre etapas
- **Notas**: Adicione observações e acompanhamentos em cada card

**Acessar:**
Menu lateral → **Pipeline**`
        },
        {
          title: "Gerenciar Etapas",
          content: `**Criar e organizar etapas do funil:**

1. Acesse **Pipeline** → clique em **"Gerenciar Etapas"**
2. Clique em **"Nova Etapa"**
3. Preencha:
   - **Nome**: Identificação da etapa (ex: "Qualificação")
   - **Cor**: Cor do cabeçalho da coluna
   - **Ordem**: Posição no quadro
4. Salve a etapa

**Dica:** Ordene as etapas da esquerda para direita seguindo o fluxo natural de vendas.`
        },
        {
          title: "Adicionar Leads",
          content: `**Criar novo lead no Pipeline:**

1. No quadro Kanban, clique em **"+ Novo Lead"**
2. Preencha os dados:
   - **Nome**: Nome do lead
   - **Email**: Email de contato
   - **Telefone**: WhatsApp
   - **Produto**: Interesse do lead
   - **Notas**: Observações iniciais
3. O lead aparece na primeira etapa do funil

**Mover entre etapas:**
Arraste e solte o card entre as colunas para avançar o lead no funil.`
        },
        {
          title: "Converter Lead em Cliente",
          content: `Quando um lead fecha negócio:

1. No card do lead, clique em **"Converter"**
2. Os dados são preenchidos automaticamente
3. Complete os dados obrigatórios (CPF, valor, etc.)
4. O lead é convertido em **cliente cadastrado** no CRM
5. O card mostra badge "Convertido" no Pipeline

**Importante:** A conversão cria um registro completo em Clientes.`
        }
      ],
      tips: [
        "Use etapas claras que reflitam seu processo de vendas real",
        "Mova leads rapidamente entre etapas para manter o funil atualizado",
        "Adicione notas em cada interação com o lead",
        "Revise leads parados em uma etapa por muito tempo",
        "Configure automações para agilizar movimentos repetitivos"
      ]
    },
    {
      id: "pipeline-automacoes",
      title: "Automações do Pipeline",
      icon: Zap,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      description: "Configure regras automáticas para o Pipeline",
      steps: [
        {
          title: "Criar regras de automação",
          content: `**Automatize ações no Pipeline:**

1. Acesse **Pipeline** → aba **"Automações"**
2. Clique em **"Nova Regra"**
3. Configure:
   - **Nome**: Identificação da regra
   - **Gatilho**: Quando a regra dispara (ex: lead entra em etapa X)
   - **Ação**: O que acontece (ex: enviar WhatsApp, mover para outra etapa)
   - **Condições**: Filtros adicionais

**Exemplos de automações:**
- Lead entra em "Negociação" → Enviar mensagem de boas-vindas
- Lead fica 7 dias em "Proposta Enviada" → Mover para "Follow-up"
- Lead é convertido → Notificar gerente por WhatsApp`
        },
        {
          title: "Permissões do Pipeline",
          content: `**Configurar em Permissões do Sistema:**

**Permissões disponíveis:**
- **view_pipeline**: Visualizar o quadro Kanban
- **manage_pipeline_stages**: Criar e editar etapas
- **manage_pipeline_automations**: Configurar regras de automação

**Recomendações:**
- **Vendedor**: view_pipeline + manage_pipeline_stages
- **Admin**: Todas as permissões
- **Visualizador**: Apenas view_pipeline`
        }
      ],
      tips: [
        "Comece com automações simples e vá adicionando complexidade",
        "Teste regras com um lead de teste antes de ativar para todos",
        "Monitore os logs de automação para verificar se as regras estão funcionando"
      ]
    },
    {
      id: "lead-hunter-visao-geral",
      title: "Lead Hunter - Visão Geral",
      icon: Crosshair,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Prospecção automatizada via Google Maps + WhatsApp com IA",
      steps: [
        {
          title: "O que é o Lead Hunter?",
          content: `O **Lead Hunter** é uma ferramenta de prospecção automatizada:

- **Busca SERP**: Encontre empresas via Google usando palavras-chave
- **Scraping inteligente**: O sistema acessa os sites encontrados via Jina Reader para extrair informações
- **IA para mensagens**: Gere mensagens personalizadas com base no conteúdo do site do lead
- **Campanhas**: Organize leads em campanhas para envio em massa via WhatsApp
- **Status de sites**: Veja se o site está acessível, bloqueado ou apenas tracking
- **Integração Baserow**: Sincronize leads com o Baserow automaticamente

**Acessar:**
Menu lateral → **Lead Hunter**`
        },
        {
          title: "Gerenciar Leads",
          content: `Na aba **Leads**, você encontra todos os leads prospectados:

**Informações exibidas:**
- Nome / Empresa (agrupados)
- Telefone
- Email
- Site (com status: Permitido, Bloqueado, Tracking)
- Status do lead

**Ações disponíveis:**
- 📋 **Copiar dados**: Copie informações do lead
- ✏️ **Editar**: Atualize dados do lead
- 🗑️ **Excluir**: Remova o lead
- 📎 **Vincular a campanha**: Associe a uma campanha existente

**Importação:**
Importe leads de CSV ou adicione manualmente.`
        },
        {
          title: "Status dos sites",
          content: `Ao vincular leads a campanhas, o sistema mostra o status do site:

- 🟢 **Permitido**: Site acessível, scraping funcionará normalmente
- 🔴 **Bloqueado**: Site bloqueia acesso do Jina Reader
- 🟡 **Tracking**: Site tem rastreadores que podem identificar o acesso
- ⚪ **Sem site**: Lead não possui site cadastrado

**Por que isso importa:**
A IA usa o conteúdo do site para gerar mensagens personalizadas. Sites bloqueados resultarão em mensagens genéricas.`
        }
      ],
      tips: [
        "Priorize leads com sites permitidos para melhor personalização por IA",
        "Mantenha leads organizados em campanhas por segmento",
        "O status do site é verificado automaticamente ao vincular leads",
        "Use a busca SERP para encontrar leads segmentados por localização e nicho"
      ]
    },
    {
      id: "lead-hunter-campanhas",
      title: "Campanhas de Prospecção",
      icon: Megaphone,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Organize leads em campanhas e envie mensagens em massa",
      steps: [
        {
          title: "Criar uma campanha",
          content: `1. Acesse **Lead Hunter** → aba **Campanhas**
2. Clique em **"Nova Campanha"**
3. Preencha:
   - **Nome**: Identificação (ex: "Prospecção Restaurantes SP")
   - **Descrição**: Objetivo da campanha
   - **Instância WhatsApp**: Para envio das mensagens
   - **Modelo de mensagem**: Template de mensagem com IA
4. Salve a campanha`
        },
        {
          title: "Vincular leads à campanha",
          content: `**Adicionar leads disponíveis:**

1. Na campanha, clique em **"Vincular Leads"**
2. Veja a lista de leads disponíveis com:
   - Nome / Empresa
   - Telefone
   - Status do site (Permitido / Bloqueado / Tracking)
3. Selecione os leads desejados
4. Clique em **"Vincular"**

**Dica:** O status do site ajuda a priorizar quais leads terão melhor personalização pela IA.`
        },
        {
          title: "Disparar campanha",
          content: `**Enviar mensagens:**

1. Na campanha, clique em **"Disparar"**
2. O sistema processa cada lead:
   - Acessa o site via Jina Reader (se permitido)
   - Gera mensagem personalizada com IA
   - Envia via WhatsApp
3. Acompanhe o progresso em tempo real

**Indicadores durante o disparo:**
- ✅ Enviado com sucesso
- ⏳ Processando (acessando site + gerando mensagem)
- ❌ Erro (site bloqueado, número inválido, etc.)

**Delay entre envios:**
Configure um intervalo entre mensagens para evitar bloqueios do WhatsApp.`
        }
      ],
      tips: [
        "Configure delay de 30-60 segundos entre envios para evitar bloqueios",
        "Verifique o status dos sites antes de disparar a campanha",
        "Use mensagens diferentes para cada segmento de leads",
        "Acompanhe o histórico para ver taxas de entrega"
      ]
    },
    {
      id: "lead-hunter-busca",
      title: "Busca SERP",
      icon: Database,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      description: "Encontre leads automaticamente via pesquisa Google",
      steps: [
        {
          title: "O que é a Busca SERP?",
          content: `A **Busca SERP** (Search Engine Results Page) permite encontrar empresas via Google:

1. Acesse **Lead Hunter** → aba **Busca SERP**
2. Configure a busca:
   - **Palavra-chave**: O que buscar (ex: "restaurante italiano")
   - **Localização**: Cidade ou região (ex: "São Paulo")
   - **Quantidade**: Quantos resultados trazer
3. Clique em **"Buscar"**

**O sistema:**
- Faz a pesquisa via API de busca
- Extrai dados das empresas encontradas
- Adiciona automaticamente como leads
- Verifica o status dos sites encontrados`
        },
        {
          title: "Configurações do Lead Hunter",
          content: `Na aba **Configurações**, configure:

- **API de Busca**: Credenciais para busca SERP
- **Instância WhatsApp**: Para envio de mensagens
- **Modelo de IA**: Qual modelo usar para gerar mensagens
- **Prompt base**: Contexto para a IA ao gerar mensagens
- **Integração Baserow**: Sincronização de leads
- **WhatsApp Oficial (Meta)**: Access Token, Phone Number ID, WABA ID, sincronização de templates e mapeamento de variáveis

**Templates da Meta:**
- Clique em **Sincronizar Templates** para carregar os templates aprovados
- Se não houver template real sincronizado, o seletor mostra **Sincronize primeiro**
- Use **Vazio (Nenhum)** para não enviar conteúdo em uma variável
- Para botões com URL dinâmica, selecione o destino **Botão 1** ou **Botão 2**

**Permissões disponíveis:**
- **view_lead_hunter**: Visualizar leads e campanhas
- **manage_lead_hunter_leads**: Gerenciar leads
- **manage_lead_hunter_campanhas**: Gerenciar campanhas
- **manage_lead_hunter_config**: Alterar configurações
- **manage_lead_hunter_meta_templates**: Gerenciar credenciais, templates e variáveis da Meta
- **manage_lead_hunter_busca**: Usar busca SERP
- **view_lead_hunter_historico**: Ver histórico de envios`
        }
      ],
      tips: [
        "Use termos específicos para encontrar leads mais qualificados",
        "Combine busca com localização para prospecção local",
        "Verifique os resultados antes de adicionar à campanha",
        "A busca consome créditos da API - use com sabedoria"
      ]
    },
    {
      id: "agenda-visao-geral",
      title: "Agenda de Eventos",
      icon: Calendar,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Gerencie eventos, reuniões e compromissos com visão de calendário",
      steps: [
        {
          title: "O que é a Agenda?",
          content: `O módulo de **Agenda** permite gerenciar compromissos e reuniões:

- **Calendário visual**: Visualize eventos em formato mensal, semanal ou diário
- **Criação rápida**: Clique em um horário para criar um evento
- **Dados do cliente**: Vincule eventos a clientes (nome, email, telefone)
- **Google Meet**: Gere links de reunião automaticamente
- **Notificações**: Alertas por WhatsApp e/ou Email antes do evento
- **Status**: Acompanhe se o evento foi confirmado, cancelado ou realizado

**Acessar:**
Menu lateral → **Agenda**`
        },
        {
          title: "Criar um evento",
          content: `1. Acesse **Agenda** e clique em **"Novo Evento"** ou clique diretamente no calendário
2. Preencha:
   - **Título**: Nome do evento (ex: "Reunião com cliente X")
   - **Data e hora início**: Quando começa
   - **Data e hora fim**: Quando termina
   - **Descrição**: Detalhes da reunião
   - **Local**: Onde será (presencial ou link)
   - **Cliente**: Nome, email e telefone do participante
3. Opções adicionais:
   - **Gerar Meet**: Criar link do Google Meet automaticamente
   - **Notas internas**: Anotações visíveis apenas para a equipe
4. Clique em **"Salvar"**`
        },
        {
          title: "Visualizações do calendário",
          content: `A Agenda oferece diferentes formas de visualização:

- **Mês**: Visão geral do mês com todos os eventos
- **Semana**: Detalhamento da semana com horários
- **Dia**: Visão detalhada de um dia específico
- **Lista**: Eventos em formato de lista cronológica

**Cores por status:**
- 🟢 **Confirmado**: Evento confirmado
- 🟡 **Pendente**: Aguardando confirmação
- 🔴 **Cancelado**: Evento cancelado
- 🔵 **Realizado**: Evento já aconteceu`
        },
        {
          title: "Gerenciar eventos",
          content: `**Ações disponíveis:**

- ✏️ **Editar**: Modifique dados do evento
- 🗑️ **Excluir**: Remova o evento
- ✅ **Confirmar**: Marque como confirmado
- ❌ **Cancelar**: Marque como cancelado
- 📋 **Copiar Meet**: Copie o link da reunião

**Arrastar e soltar:**
Arraste eventos entre datas para reagendá-los rapidamente.`
        }
      ],
      tips: [
        "Use a visão semanal para planejar seus dias de trabalho",
        "Gere links de Meet para reuniões online automaticamente",
        "Vincule o email do cliente para enviar convites",
        "Verifique a agenda diariamente para não perder compromissos",
        "Use notas internas para preparação de reuniões"
      ]
    },
    {
      id: "agenda-config",
      title: "Configurações da Agenda",
      icon: Settings,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Configure notificações e integrações da Agenda",
      steps: [
        {
          title: "Notificações de eventos",
          content: `**Configure alertas automáticos:**

1. Na Agenda, acesse **Configurações**
2. Configure notificações:
   - **WhatsApp**: Envie lembrete ao cliente via Evolution API
   - **Email**: Envie lembrete por email via Gmail
   - **Antecedência**: Quantos minutos/horas antes notificar
3. Salve as configurações

**Variáveis nas mensagens:**
- \`{titulo}\`: Nome do evento
- \`{data}\`: Data do evento
- \`{hora}\`: Horário do evento
- \`{local}\`: Local ou link da reunião
- \`{cliente_nome}\`: Nome do cliente`
        },
        {
          title: "Permissões da Agenda",
          content: `**Configurar em Permissões do Sistema:**

**Permissões disponíveis:**
- **view_agenda**: Visualizar calendário e eventos
- **create_agenda_events**: Criar novos eventos
- **edit_agenda_events**: Editar eventos existentes
- **delete_agenda_events**: Excluir eventos
- **manage_agenda_config**: Alterar configurações da agenda

**Recomendações:**
- **Vendedor**: view + create + edit
- **Admin**: Todas as permissões
- **Visualizador**: Apenas view_agenda`
        }
      ],
      tips: [
        "Configure notificações por WhatsApp para lembrar clientes sobre reuniões",
        "Use antecedência de 30-60 minutos para notificações",
        "A integração com Google Meet facilita reuniões online"
      ]
    },
    {
      id: "link-pagamento-visao-geral",
      title: "Gerador de Link de Pagamento",
      icon: Link,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Gere links de pagamento personalizados para enviar a clientes",
      steps: [
        {
          title: "O que é o Gerador de Link de Pagamento?",
          content: `O **Gerador de Link de Pagamento** permite criar links de pagamento únicos para enviar a clientes:

- **Link personalizado**: Gere links com valor, descrição e dados do cliente
- **Múltiplos métodos**: PIX, Cartão de Crédito e Boleto
- **Envio direto**: Copie o link ou envie por WhatsApp
- **Rastreamento**: Acompanhe se o pagamento foi realizado
- **Validade configurável**: Defina quando o link expira

**Acessar:**
Menu lateral → **Link de Pagamento**`
        },
        {
          title: "Gerar um link de pagamento",
          content: `1. Acesse **Link de Pagamento**
2. Preencha os dados:
   - **Cliente**: Selecione um cliente existente ou preencha manualmente
   - **Nome**: Nome do pagador
   - **Email**: Email do pagador
   - **CPF/CNPJ**: Documento do pagador
   - **Valor**: Quantia a ser cobrada
   - **Descrição**: Detalhes da cobrança
3. Clique em **"Gerar Link"**
4. O link é gerado e pode ser:
   - 📋 **Copiado** para área de transferência
   - 📱 **Enviado via WhatsApp** diretamente ao cliente

**O cliente acessa o link e vê:**
- Dados da cobrança
- Opções de pagamento (PIX, cartão, boleto)
- Formulário seguro de pagamento`
        },
        {
          title: "Acompanhar pagamentos",
          content: `Após gerar o link:

- O status do pagamento é atualizado automaticamente
- **Pendente**: Aguardando pagamento do cliente
- **Pago**: Pagamento confirmado
- **Expirado**: Link passou da validade

**Pré-requisitos:**
- Configure o **Mercado Pago** em Cobrança → Pagamentos
- O Access Token deve estar configurado corretamente`
        },
        {
          title: "Permissões",
          content: `**Permissões disponíveis:**
- **view_payment_links**: Acessar o módulo
- **generate_payment_links**: Gerar novos links
- **share_payment_links**: Compartilhar links gerados

**Recomendações:**
- **Financeiro**: Todas as permissões
- **Vendedor**: generate + share
- **Visualizador**: Apenas view`
        }
      ],
      tips: [
        "Configure o Mercado Pago antes de usar este módulo",
        "Envie o link por WhatsApp para maior taxa de conversão",
        "Use descrições claras para o cliente saber do que se trata",
        "Links de pagamento são independentes do sistema de cobrança automática",
        "CPF/CNPJ válido é necessário para geração de boleto"
      ]
    },
    {
      id: "aprovacoes-visao-geral",
      title: "Sistema de Aprovações",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Gerencie o fluxo de aprovação de solicitações críticas",
      steps: [
        {
          title: "Como funciona o módulo",
          content: `O módulo de **Aprovações** centraliza solicitações que precisam de autorização:
          
1. Usuários solicitam ações específicas
2. Administradores visualizam solicitações pendentes
3. Ações são aprovadas ou rejeitadas com justificativa
4. O histórico completo fica registrado para auditoria`
        },
        {
          title: "Acessar Aprovações",
          content: `Acesse **Aprovações** no menu lateral:
          
- **Pendentes**: Solicitações aguardando decisão
- **Histórico**: Registro de todas as decisões tomadas
- **Filtros**: Por tipo de solicitação, usuário ou data`
        }
      ],
      tips: [
        "Apenas administradores podem aprovar solicitações",
        "Sempre adicione uma observação ao rejeitar uma solicitação",
        "O sistema gera logs automáticos para cada decisão"
      ]
    },
    {
      id: "automacoes-visao-geral",
      title: "Regras de Automação",
      icon: Zap,
      color: "text-teal-400",
      bgColor: "bg-teal-500/10",
      description: "Crie regras para automatizar processos repetitivos",
      steps: [
        {
          title: "O que são Automações?",
          content: `As **Automações** permitem disparar ações baseadas em gatilhos:
          
- **Gatilho**: O que inicia a automação (ex: novo cliente, mudança de etapa no pipeline)
- **Condição**: Filtros para a regra (ex: apenas se o valor for > 1000)
- **Ação**: O que o sistema deve fazer (ex: enviar WhatsApp, criar tarefa)`
        },
        {
          title: "Configurar uma regra",
          content: `1. Acesse **Automações** no menu lateral
2. Clique em **Nova Regra**
3. Defina o nome e descrição
4. Selecione o **Gatilho**
5. Configure as **Ações**
6. Ative a regra`
        }
      ],
      tips: [
        "Teste suas regras com clientes de teste antes de ativar",
        "Monitore os logs de execução para garantir que tudo funciona",
        "Evite criar regras conflitantes para o mesmo gatilho"
      ]
    },
    {
      id: "instagram",
      title: "Configuração do Instagram",
      icon: Instagram,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      description: "Aprenda a configurar e usar o módulo de agendamento do Instagram",
      steps: [
        {
          title: "Configuração da API Meta",
          content: `1. Acesse **developers.facebook.com** e crie um App Business.
2. No módulo Instagram do CRM, vá em **Configurações**.
3. Preencha o **App ID** e **App Secret** da sua aplicação Meta.
4. Gere um token de acesso de longa duração e salve.
5. O sistema validará automaticamente e mostrará a data de expiração.`
        },
        {
          title: "Renovação de Token",
          content: `O token do Instagram expira a cada 60 dias. 
1. O sistema monitora a validade e exibe alertas coloridos (Verde, Amarelo, Vermelho).
2. Se você preencher o **App ID** e **App Secret**, poderá clicar em **"Renovar Token"** nas configurações.
3. Isso obterá um novo token de 60 dias automaticamente via API da Meta.`
        },
        {
          title: "Agendamento de Posts",
          content: `1. Na aba **Criar Post**, faça o upload de imagem ou vídeo.
2. Escreva sua legenda.
3. Selecione o tipo de post (Feed, Reels ou Stories).
4. Clique em **Publicar Agora** ou aguarde a automação de agendamento.`
        },
        {
          title: "Acesso Provisório para Assistentes",
          content: `Se você tem um assistente que cuidará apenas do Instagram:
1. Clique no botão **Acesso Provisório** no topo do módulo.
2. Defina o tempo de validade (ex: 4 horas ou 7 dias).
3. Copie o link e envie para o assistente.
4. Ele poderá acessar o módulo sem precisar de login completo.`
        }
      ],
      tips: [
        "Sempre verifique a validade do token nas configurações",
        "Vídeos de Reels devem ter formato vertical (9:16)",
        "Você pode revogar links de acesso provisório a qualquer momento"
      ]
    }
  ];

  // Get visible categories based on permissions
  const visibleCategories = useMemo(() => {
    return guideCategories.filter(c => canViewCategory(c.id));
  }, [guideCategories, isAdmin]);

  // Set initial active category to first visible one
  useEffect(() => {
    if (activeCategory === null && visibleCategories.length > 0) {
      setActiveCategory(visibleCategories[0].id);
    }
  }, [activeCategory, visibleCategories]);

  const activeGuide = guideCategories.find(c => c.id === activeCategory);

  // SECURITY: Escape HTML to prevent XSS before applying markdown formatting
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const renderMarkdown = (text: string) => {
    // SECURITY: First escape HTML, then apply markdown formatting
    // This prevents XSS if guide content ever becomes user-editable
    const escaped = escapeHtml(text);
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary">$1</code>')
      .replace(/^- /gm, '• ')
      .replace(/^\d+\. /gm, (match, offset, string) => {
        const lines = string.substring(0, offset).split('\n');
        const num = match.trim().replace('.', '');
        return `<span class="text-primary font-semibold">${num}.</span> `;
      });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  {t('guide.title')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('guide.subtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar Navigation */}
        <div className="w-72 border-r border-border/40 bg-card/30 hidden lg:block">
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-4 space-y-6">
              {guideGroups.map((group) => {
                // Filter categories based on permissions
                const visibleCategories = group.categories.filter(catId => canViewCategory(catId));
                
                if (visibleCategories.length === 0) return null;
                
                return (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 px-3 py-2 mb-2">
                      <group.icon className={cn("h-4 w-4", group.color)} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.title}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {visibleCategories.map((catId) => {
                        const category = guideCategories.find(c => c.id === catId);
                        if (!category) return null;
                      const isActive = activeCategory === catId;
                      return (
                        <button
                          key={catId}
                          onClick={() => setActiveCategory(catId)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
                            isActive 
                              ? "bg-primary/10 text-primary border border-primary/20" 
                              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <category.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? category.color : "")} />
                          <span className="text-sm font-medium truncate">{category.title}</span>
                          {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          </ScrollArea>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden border-b border-border/40 bg-card/30 overflow-x-auto">
          <div className="flex gap-2 p-3">
            {guideCategories.filter(category => canViewCategory(category.id)).map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm transition-all",
                  activeCategory === category.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <category.icon className="h-4 w-4" />
                {category.title}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-80px)]" ref={contentRef}>
            <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-8">
              {activeGuide && (
                <>
                  {/* Category Header */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-4 rounded-2xl", activeGuide.bgColor)}>
                        <activeGuide.icon className={cn("h-8 w-8", activeGuide.color)} />
                      </div>
                      <div className="flex-1 pt-1">
                        <h2 className="text-2xl font-bold font-heading">{activeGuide.title}</h2>
                        <p className="text-muted-foreground mt-1">{activeGuide.description}</p>
                      </div>
                    </div>
                    <Separator className="bg-border/40" />
                  </div>

                  {/* Steps */}
                  <div className="space-y-6">
                    {activeGuide.steps.map((step, index) => (
                      <Card key={index} className="border-border/40 overflow-hidden hover:border-border/60 transition-colors">
                        <CardHeader className="bg-muted/20 border-b border-border/40 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                              activeGuide.bgColor,
                              activeGuide.color
                            )}>
                              {index + 1}
                            </div>
                            <CardTitle className="text-lg font-semibold">{step.title}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="p-5">
                          <div 
                            className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(step.content.trim())) }}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Tips */}
                  {activeGuide.tips && activeGuide.tips.length > 0 && (
                    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-400" />
                          <CardTitle className="text-base font-semibold text-amber-400">
                            {t('guide.importantTips')}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-3">
                          {activeGuide.tips.map((tip, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <CheckCircle2 className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    {(() => {
                      const currentIndex = guideCategories.findIndex(c => c.id === activeCategory);
                      const prevCategory = currentIndex > 0 ? guideCategories[currentIndex - 1] : null;
                      const nextCategory = currentIndex < guideCategories.length - 1 ? guideCategories[currentIndex + 1] : null;
                      
                      return (
                        <>
                          {prevCategory ? (
                            <Button 
                              variant="ghost" 
                              onClick={() => setActiveCategory(prevCategory.id)}
                              className="gap-2"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              {prevCategory.title}
                            </Button>
                          ) : <div />}
                          
                          {nextCategory && (
                            <Button 
                              variant="ghost" 
                              onClick={() => setActiveCategory(nextCategory.id)}
                              className="gap-2"
                            >
                              {nextCategory.title}
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/40 bg-card/30 py-4 px-6">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>{t('guide.securityNote')}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
            {t('guide.backToPanel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminGuia;
