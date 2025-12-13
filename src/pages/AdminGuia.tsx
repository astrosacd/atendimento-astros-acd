import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
  Info,
  Database,
  HelpCircle,
  Tag,
  DollarSign
} from "lucide-react";

interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
}

const AdminGuia = () => {
  const navigate = useNavigate();

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

  const guideCategories = [
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
      title: "Configuração da Evolution API",
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
      id: "webhooks",
      title: "Configuração de Webhooks",
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
      title: "Configuração de API Keys",
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
      id: "boas-vindas",
      title: "Mensagens de Boas-vindas",
      icon: Mail,
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
      id: "mercadopago",
      title: "Integração Mercado Pago",
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
3. Clique em **Exportar CSV**`
        },
        {
          title: "Backup automático",
          content: `O sistema mantém backup automático através do Lovable Cloud:
- Dados são replicados em múltiplas regiões
- Backups point-in-time disponíveis
- Retenção de dados por 30 dias

Para restauração, entre em contato com o suporte.`
        }
      ],
      tips: [
        "Faça exportações mensais como backup extra",
        "Mantenha os CSVs em local seguro",
        "Os logs de atividade servem como histórico completo"
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
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
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading">Guia de Configuração</h1>
                <p className="text-sm text-muted-foreground">
                  Aprenda a configurar todos os módulos do sistema
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Intro Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Info className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Bem-vindo ao Guia de Configuração</h3>
                <p className="text-muted-foreground">
                  Este guia irá ajudá-lo a configurar todos os módulos do sistema passo a passo. 
                  Clique em cada seção abaixo para ver instruções detalhadas de como obter e onde 
                  inserir as credenciais necessárias.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Status */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => document.getElementById('gmail')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-xs text-muted-foreground">Gmail</p>
                <p className="text-sm font-medium">Configurar →</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => document.getElementById('evolution')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardContent className="p-4 flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="text-sm font-medium">Configurar →</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => document.getElementById('webhooks')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardContent className="p-4 flex items-center gap-3">
              <Webhook className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-xs text-muted-foreground">Webhooks</p>
                <p className="text-sm font-medium">Configurar →</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => document.getElementById('api')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardContent className="p-4 flex items-center gap-3">
              <Key className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-xs text-muted-foreground">API Keys</p>
                <p className="text-sm font-medium">Configurar →</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => document.getElementById('tags')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardContent className="p-4 flex items-center gap-3">
              <Tag className="h-5 w-5 text-violet-400" />
              <div>
                <p className="text-xs text-muted-foreground">Tags</p>
                <p className="text-sm font-medium">Configurar →</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => document.getElementById('verificacao-pagamento')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs text-muted-foreground">Pagamentos</p>
                <p className="text-sm font-medium">Ver como →</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Guide Sections */}
        <div className="space-y-4">
          {guideCategories.map((category) => (
            <Card key={category.id} id={category.id} className="border-border/40 overflow-hidden">
              <Accordion type="single" collapsible>
                <AccordionItem value={category.id} className="border-none">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${category.bgColor}`}>
                        <category.icon className={`h-6 w-6 ${category.color}`} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-lg">{category.title}</h3>
                        <p className="text-sm text-muted-foreground font-normal">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-6 pt-4">
                      {category.steps.map((step, index) => (
                        <div key={index} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full">
                              Passo {index + 1}
                            </Badge>
                            <h4 className="font-medium">{step.title}</h4>
                          </div>
                          <div className="pl-4 border-l-2 border-border/60">
                            <div className="prose prose-sm prose-invert max-w-none">
                              <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg font-sans">
                                {step.content.trim()}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}

                      {category.tips && category.tips.length > 0 && (
                        <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="h-4 w-4 text-amber-400" />
                            <span className="font-medium text-amber-400">Dicas importantes</span>
                          </div>
                          <ul className="space-y-2">
                            {category.tips.map((tip, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>

        {/* Footer Help */}
        <Card className="border-border/40 bg-muted/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Todas as credenciais são armazenadas de forma segura e criptografada.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
              >
                Voltar ao Painel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminGuia;
