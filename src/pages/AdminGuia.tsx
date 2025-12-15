import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
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
  LucideIcon
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
}

interface GuideGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  categories: string[];
}

const AdminGuia = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("gmail");

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
      categories: ["gmail", "evolution", "boas-vindas"]
    },
    {
      id: "integracao",
      title: "Integrações",
      icon: Zap,
      color: "text-purple-400",
      categories: ["webhooks", "api", "mercadopago"]
    },
    {
      id: "usuarios-permissoes",
      title: "Usuários",
      icon: Users,
      color: "text-blue-400",
      categories: ["usuarios", "permissoes"]
    },
    {
      id: "financeiro",
      title: "Financeiro",
      icon: DollarSign,
      color: "text-emerald-400",
      categories: ["cobranca", "verificacao-pagamento"]
    },
    {
      id: "clientes",
      title: "Clientes",
      icon: FileText,
      color: "text-amber-400",
      categories: ["tags", "clientes-registro"]
    },
    {
      id: "sistema",
      title: "Sistema",
      icon: Settings,
      color: "text-slate-400",
      categories: ["chat", "dashboard", "logs-atividade", "restauracao", "notificacoes", "backup", "troubleshooting"]
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
          title: "IA para mensagens (opcional)",
          content: `Na aba **IA**, você pode:
- Selecionar um modelo de IA (Gemini ou GPT)
- Definir um prompt de contexto
- O sistema gerará mensagens personalizadas automaticamente`
        }
      ],
      tips: [
        "Configure Gmail E WhatsApp para maior alcance",
        "Monitore a aba Relatórios para ver taxas de sucesso",
        "Use a cobrança manual para casos urgentes"
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
| Histórico pagamentos | ✅ Disponível | ❌ Não mostrado |
| Anexo de arquivos | ❌ Não | ✅ Sim |
| Badge visual | 🔵 Azul | 🟡 Amarelo "Registro" |`
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
2. Configure:
   - **Nome do Chat**: Como o assistente se apresenta
   - **Mensagem de Boas-vindas**: Primeira mensagem exibida
   - **Placeholder**: Texto do campo de input
   - **Cor do Tema**: Cor principal do chat`
        },
        {
          title: "Configurar IA",
          content: `- Selecione o **modelo de IA** (Gemini ou GPT)
- O chat usa o Lovable AI Gateway, sem necessidade de API key
- Você tem uso gratuito mensal incluído`
        }
      ],
      tips: [
        "Configure horário de funcionamento se não quiser 24/7",
        "Adicione respostas automáticas para perguntas frequentes",
        "O histórico de conversas fica salvo por usuário"
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
    }
  ];

  const activeGuide = guideCategories.find(c => c.id === activeCategory);

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering for bold text and code blocks
    return text
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
                  Guia de Configuração
                </h1>
                <p className="text-sm text-muted-foreground">
                  Aprenda a configurar todos os módulos do sistema
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
              {guideGroups.map((group) => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 px-3 py-2 mb-2">
                    <group.icon className={cn("h-4 w-4", group.color)} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.title}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.categories.map((catId) => {
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
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden border-b border-border/40 bg-card/30 overflow-x-auto">
          <div className="flex gap-2 p-3">
            {guideCategories.map((category) => (
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
        <div className="flex-1 overflow-auto">
          <ScrollArea className="h-[calc(100vh-80px)]">
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
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(step.content.trim()) }}
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
                            Dicas Importantes
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
            <span>Todas as credenciais são armazenadas de forma segura e criptografada.</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
            Voltar ao Painel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminGuia;
