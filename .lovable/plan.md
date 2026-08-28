# Remover integralmente o Pipeline IA

## Objetivo
Excluir toda a camada de IA ligada ao Pipeline, incluindo pontuação de leads e previsão de vendas, sem alterar o funcionamento do Kanban/Pipeline convencional, etapas, automações comuns, Chatwoot ou compartilhamento.

## Execução
1. **Remover a interface da IA**
   - Excluir as abas “Previsão IA” e “Config. IA” do Pipeline.
   - Remover scores, sugestões e ações de atualização por IA dos cards do Kanban.
   - Remover o card de previsão do módulo Cobrança.
   - Remover a página/rota/menu “Inteligência IA”, hoje dedicada a essas funções.

2. **Remover código exclusivo**
   - Excluir os componentes de configuração e previsão.
   - Excluir as funções de backend `update-lead-scores` e `sales-forecast`.
   - Remover hooks/permissões e referências exclusivas da IA.
   - Ajustar o grafo de clientes para continuar mostrando a etapa do Pipeline sem score.

3. **Remover estrutura e dados exclusivos no banco**
   - Desagendar o cron `update-lead-scores-job` caso exista.
   - Excluir a função `update_all_lead_scores()`.
   - Excluir as tabelas `pipeline_ai_config` e `sales_forecasts`, incluindo seus dados históricos.
   - Excluir as permissões `view_pipeline_ai`, `manage_pipeline_ai`, `view_sales_forecast` e `manage_sales_forecast` e seus vínculos.
   - Remover de `client_pipeline` somente as colunas exclusivas de IA: `lead_score`, `lead_score_reason`, `next_action_suggestion` e `last_ai_update`.

4. **Validação**
   - Confirmar que não restaram chamadas, rotas, permissões, funções, cron ou tabelas do Pipeline IA.
   - Validar build e abertura do Kanban e da Cobrança.
   - Verificar que o backend permanece saudável e que o Pipeline comum continua operacional.

## Impacto e riscos
- **Exclusão definitiva:** configurações, previsões históricas, scores e sugestões de IA serão apagados.
- **Preservado:** clientes/leads no Pipeline, etapas, movimentações, automações convencionais, Chatwoot e compartilhamento.
- **Risco controlado:** remoção das colunas exige ajustar todos os consumidores antes da migração para evitar consultas quebradas.
