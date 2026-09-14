# Auditoria e correção dos relatórios financeiros

## Objetivo
Garantir que Mensal/Recorrente, Apenas Registro/Venda Única e Agendado sejam classificados sem mistura, dupla contagem ou receita prevista tratada como faturamento.

## Correções
1. **Regra única de classificação**
   - Mensal: cobrança ativa e ciclo recorrente válido.
   - Registro: sem cobrança ativa e sem ciclo recorrente/vitalício.
   - Agendado: `status_cliente = agendado`, sempre isolado como previsão.
   - Dados incoerentes serão ignorados nas métricas incompatíveis, não reclassificados silenciosamente.

2. **Relatório semanal**
   - Usar pagamentos confirmados como única fonte de faturamento.
   - Manter mudanças de renovação apenas como informação operacional, sem somá-las novamente ao faturamento.
   - Separar pagamentos mensais e vendas únicas.
   - Excluir pagamentos cancelados, rejeitados ou pendentes.
   - Corrigir comparação em dólar e impedir agendados em pagamentos/renovações.

3. **Relatórios Avançados**
   - Corrigir histórico de MRR para considerar cancelamento real e estado no fechamento de cada mês.
   - Corrigir churn para usar clientes recorrentes existentes no início do mês.
   - Corrigir NRR/GRR para não apresentar aproximações enganosas como métricas exatas.
   - Separar aquisição recorrente de vendas únicas no CAC e nos gráficos.
   - Exibir agendados explicitamente como previsão não confirmada.
   - Não misturar BRL e USD em nenhum gráfico ou total.

4. **Análise de IA**
   - Enviar contexto separado por Mensal, Registro e Agendado.
   - Aplicar a mesma tolerância de 7 dias do MRR da tela.
   - Impedir vendas únicas e agendados de entrarem no MRR ou risco.

5. **Painel**
   - Alinhar contadores de Mensal e Registro à mesma regra oficial.
   - Garantir que previsão de renovação considere somente recorrentes ativos.

6. **Validação**
   - Criar testes determinísticos para classificação e totais semanais.
   - Conferir os resultados contra os dados reais atuais.
   - Gerar uma prévia real do relatório semanal e verificar compilação e funções.

## Impacto e riscos
- Nenhum cadastro ou pagamento será alterado.
- Totais incorretamente inflados podem diminuir após remover dupla contagem.
- Métricas históricas ficarão mais conservadoras quando o banco não tiver histórico suficiente para reconstrução exata; serão rotuladas como aproximação quando necessário.
