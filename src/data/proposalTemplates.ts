import type { SectionType } from '@/hooks/useProposalSections';

export interface TemplateSection {
  type: SectionType;
  title: string;
  content: Record<string, unknown>;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  sections: TemplateSection[];
}

export const proposalTemplates: ProposalTemplate[] = [
  {
    id: 'blank',
    name: 'Em Branco',
    description: 'Comece do zero e monte sua proposta personalizada',
    icon: 'FileText',
    sections: [],
  },
  {
    id: 'consulting',
    name: 'Consultoria',
    description: 'Ideal para projetos de consultoria e assessoria',
    icon: 'Briefcase',
    sections: [
      {
        type: 'cover',
        title: 'Capa',
        content: {
          title: 'Proposta de Consultoria',
          subtitle: 'Transformando desafios em oportunidades',
          backgroundImage: '',
        },
      },
      {
        type: 'text',
        title: 'Sobre Nós',
        content: {
          content: `Somos uma empresa especializada em consultoria, com vasta experiência no mercado. 

Nossa missão é ajudar empresas a alcançarem seus objetivos através de estratégias personalizadas e soluções inovadoras.

Trabalhamos lado a lado com nossos clientes para entender suas necessidades e entregar resultados mensuráveis.`,
        },
      },
      {
        type: 'text',
        title: 'Escopo do Projeto',
        content: {
          content: `Este projeto contempla:

• Diagnóstico completo da situação atual
• Análise de oportunidades e pontos de melhoria
• Desenvolvimento de plano de ação estratégico
• Acompanhamento e suporte na implementação
• Relatórios de progresso e resultados`,
        },
      },
      {
        type: 'timeline',
        title: 'Cronograma',
        content: {
          items: [
            { id: crypto.randomUUID(), phase: 'Diagnóstico', duration: '2 semanas', description: 'Levantamento de informações e análise do cenário atual' },
            { id: crypto.randomUUID(), phase: 'Planejamento', duration: '2 semanas', description: 'Elaboração do plano estratégico e definição de metas' },
            { id: crypto.randomUUID(), phase: 'Implementação', duration: '4 semanas', description: 'Execução das ações planejadas com acompanhamento' },
            { id: crypto.randomUUID(), phase: 'Avaliação', duration: '2 semanas', description: 'Análise de resultados e ajustes finais' },
          ],
        },
      },
      {
        type: 'pricing',
        title: 'Investimento',
        content: {
          items: [
            { id: crypto.randomUUID(), description: 'Diagnóstico e Planejamento', quantity: 1, unitPrice: 5000 },
            { id: crypto.randomUUID(), description: 'Implementação e Acompanhamento', quantity: 1, unitPrice: 10000 },
            { id: crypto.randomUUID(), description: 'Suporte Pós-Projeto (1 mês)', quantity: 1, unitPrice: 2000 },
          ],
        },
      },
      {
        type: 'terms',
        title: 'Termos e Condições',
        content: {
          content: `1. FORMA DE PAGAMENTO
- 50% na aprovação da proposta
- 50% na entrega final do projeto

2. PRAZO DE VALIDADE
Esta proposta é válida por 15 dias a partir da data de envio.

3. CONFIDENCIALIDADE
Todas as informações compartilhadas durante o projeto serão tratadas com total confidencialidade.`,
        },
      },
      {
        type: 'signature',
        title: 'Assinatura',
        content: {
          signerName: '',
          signerRole: '',
          signerSignature: '',
        },
      },
    ],
  },
  {
    id: 'design',
    name: 'Design & Criação',
    description: 'Para projetos de design, branding e identidade visual',
    icon: 'Palette',
    sections: [
      {
        type: 'cover',
        title: 'Capa',
        content: {
          title: 'Proposta de Design',
          subtitle: 'Criatividade que conecta sua marca ao mundo',
          backgroundImage: '',
        },
      },
      {
        type: 'text',
        title: 'Nosso Trabalho',
        content: {
          content: `Criamos experiências visuais memoráveis que comunicam a essência da sua marca.

Nossa equipe combina criatividade, estratégia e técnica para entregar projetos que:
• Destacam sua marca no mercado
• Conectam emocionalmente com seu público
• Transmitem profissionalismo e credibilidade`,
        },
      },
      {
        type: 'gallery',
        title: 'Portfólio',
        content: {
          images: [],
        },
      },
      {
        type: 'text',
        title: 'O Projeto',
        content: {
          content: `Entregas incluídas:

✓ Pesquisa e análise de referências
✓ Desenvolvimento de conceitos visuais
✓ Apresentação de propostas criativas
✓ Refinamento baseado em feedback
✓ Entrega dos arquivos finais em múltiplos formatos`,
        },
      },
      {
        type: 'timeline',
        title: 'Etapas do Projeto',
        content: {
          items: [
            { id: crypto.randomUUID(), phase: 'Briefing', duration: '1 semana', description: 'Entendimento das necessidades e objetivos' },
            { id: crypto.randomUUID(), phase: 'Pesquisa', duration: '1 semana', description: 'Análise de mercado e referências visuais' },
            { id: crypto.randomUUID(), phase: 'Criação', duration: '2 semanas', description: 'Desenvolvimento das propostas criativas' },
            { id: crypto.randomUUID(), phase: 'Refinamento', duration: '1 semana', description: 'Ajustes e finalização' },
          ],
        },
      },
      {
        type: 'pricing',
        title: 'Investimento',
        content: {
          items: [
            { id: crypto.randomUUID(), description: 'Projeto de Design', quantity: 1, unitPrice: 3500 },
          ],
        },
      },
      {
        type: 'terms',
        title: 'Condições',
        content: {
          content: `PAGAMENTO
- 40% na aprovação
- 60% na entrega final

DIREITOS AUTORAIS
Todos os direitos sobre o material criado serão transferidos ao cliente após quitação total.

ALTERAÇÕES
Inclui até 3 rodadas de ajustes. Alterações adicionais serão cobradas à parte.`,
        },
      },
      {
        type: 'signature',
        title: 'Assinatura',
        content: {
          signerName: '',
          signerRole: '',
          signerSignature: '',
        },
      },
    ],
  },
  {
    id: 'development',
    name: 'Desenvolvimento',
    description: 'Para projetos de software, sites e aplicativos',
    icon: 'Code',
    sections: [
      {
        type: 'cover',
        title: 'Capa',
        content: {
          title: 'Proposta de Desenvolvimento',
          subtitle: 'Tecnologia sob medida para o seu negócio',
          backgroundImage: '',
        },
      },
      {
        type: 'text',
        title: 'Sobre a Solução',
        content: {
          content: `Desenvolvemos soluções tecnológicas robustas e escaláveis que impulsionam o crescimento do seu negócio.

Nossa equipe é especializada em:
• Desenvolvimento Web e Mobile
• Sistemas personalizados
• Integrações e APIs
• Soluções em nuvem`,
        },
      },
      {
        type: 'text',
        title: 'Escopo Técnico',
        content: {
          content: `FUNCIONALIDADES PRINCIPAIS

1. [Descreva a funcionalidade principal]
2. [Funcionalidade secundária]
3. [Outras funcionalidades]

TECNOLOGIAS
• Frontend: React / TypeScript
• Backend: Node.js / Supabase
• Infraestrutura: Cloud`,
        },
      },
      {
        type: 'team',
        title: 'Nossa Equipe',
        content: {
          members: [],
        },
      },
      {
        type: 'timeline',
        title: 'Cronograma de Desenvolvimento',
        content: {
          items: [
            { id: crypto.randomUUID(), phase: 'Discovery', duration: '1 semana', description: 'Levantamento de requisitos e arquitetura' },
            { id: crypto.randomUUID(), phase: 'Design UX/UI', duration: '2 semanas', description: 'Prototipagem e validação da interface' },
            { id: crypto.randomUUID(), phase: 'Desenvolvimento', duration: '6 semanas', description: 'Codificação e testes' },
            { id: crypto.randomUUID(), phase: 'Testes e QA', duration: '1 semana', description: 'Validação e correção de bugs' },
            { id: crypto.randomUUID(), phase: 'Deploy', duration: '1 semana', description: 'Lançamento e configuração em produção' },
          ],
        },
      },
      {
        type: 'pricing',
        title: 'Investimento',
        content: {
          items: [
            { id: crypto.randomUUID(), description: 'Discovery e Arquitetura', quantity: 1, unitPrice: 3000 },
            { id: crypto.randomUUID(), description: 'Design UX/UI', quantity: 1, unitPrice: 5000 },
            { id: crypto.randomUUID(), description: 'Desenvolvimento', quantity: 1, unitPrice: 25000 },
            { id: crypto.randomUUID(), description: 'Testes e Deploy', quantity: 1, unitPrice: 4000 },
          ],
        },
      },
      {
        type: 'terms',
        title: 'Termos do Projeto',
        content: {
          content: `FORMA DE PAGAMENTO
- 30% na aprovação da proposta
- 30% no meio do desenvolvimento  
- 40% na entrega final

SUPORTE
Inclui 30 dias de suporte técnico após o lançamento.

GARANTIA
90 dias de garantia para correção de bugs relacionados ao escopo contratado.

CÓDIGO FONTE
Todo código fonte será entregue ao cliente ao final do projeto.`,
        },
      },
      {
        type: 'signature',
        title: 'Assinatura',
        content: {
          signerName: '',
          signerRole: '',
          signerSignature: '',
        },
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Digital',
    description: 'Para campanhas e estratégias de marketing',
    icon: 'Megaphone',
    sections: [
      {
        type: 'cover',
        title: 'Capa',
        content: {
          title: 'Proposta de Marketing Digital',
          subtitle: 'Estratégias que geram resultados reais',
          backgroundImage: '',
        },
      },
      {
        type: 'text',
        title: 'Nossa Abordagem',
        content: {
          content: `Desenvolvemos estratégias de marketing digital orientadas por dados para maximizar seu retorno sobre investimento.

Nosso diferencial:
• Análise profunda do seu público-alvo
• Estratégias multicanal integradas
• Otimização contínua baseada em dados
• Relatórios transparentes e detalhados`,
        },
      },
      {
        type: 'text',
        title: 'Serviços Incluídos',
        content: {
          content: `GESTÃO DE REDES SOCIAIS
• Planejamento de conteúdo mensal
• Criação de posts e stories
• Gestão de comunidade
• Relatórios de performance

TRÁFEGO PAGO
• Campanhas no Google Ads
• Campanhas no Meta (Facebook/Instagram)
• Otimização e A/B testing

ANÁLISE E RELATÓRIOS
• Dashboard em tempo real
• Relatórios mensais detalhados
• Recomendações de melhoria`,
        },
      },
      {
        type: 'testimonials',
        title: 'Resultados de Clientes',
        content: {
          items: [],
        },
      },
      {
        type: 'pricing',
        title: 'Investimento Mensal',
        content: {
          items: [
            { id: crypto.randomUUID(), description: 'Gestão de Redes Sociais', quantity: 1, unitPrice: 2500 },
            { id: crypto.randomUUID(), description: 'Gestão de Tráfego Pago', quantity: 1, unitPrice: 1500 },
            { id: crypto.randomUUID(), description: 'Criação de Conteúdo (8 posts/mês)', quantity: 1, unitPrice: 1200 },
          ],
        },
      },
      {
        type: 'terms',
        title: 'Condições',
        content: {
          content: `CONTRATO
Contrato mínimo de 3 meses para otimização adequada das campanhas.

PAGAMENTO
Pagamento mensal até o dia 10 de cada mês.

VERBA DE MÍDIA
O valor de investimento em mídia (anúncios) não está incluso e será definido conforme estratégia aprovada.

CANCELAMENTO
Aviso prévio de 30 dias para cancelamento.`,
        },
      },
      {
        type: 'signature',
        title: 'Assinatura',
        content: {
          signerName: '',
          signerRole: '',
          signerSignature: '',
        },
      },
    ],
  },
];
