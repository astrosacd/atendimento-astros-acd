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
  HelpCircle
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
