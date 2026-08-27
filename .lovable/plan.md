# Estabilizar abertura do CRM e automações matinais

## Objetivo
Eliminar a tela infinita de “Carregando...” quando o backend/auth estiver lento e reduzir a disputa entre jobs automáticos, preservando cobranças, follow-ups, ligações e demais disparos.

## Execução
1. **Bootstrap de autenticação resiliente**
   - Aplicar limite de tempo à recuperação inicial da sessão e às consultas de perfil/perfil de acesso.
   - Liberar a interface de login quando o backend não responder, em vez de manter o aplicativo bloqueado indefinidamente.
   - Ignorar eventos redundantes de renovação da mesma sessão sem refazer consultas.

2. **Tela de carregamento com recuperação**
   - Substituir o carregamento infinito por estado explícito de demora, com ação de tentar novamente.
   - Preservar o código de acesso existente na URL.

3. **Escalonamento dos jobs automáticos**
   - Consultar os agendamentos ativos e execuções recentes no banco.
   - Deslocar jobs concorrentes para minutos diferentes, mantendo a frequência funcional configurada.
   - Não excluir nem desativar cobrança, follow-up, ligações, SMS, lembretes ou sincronizações.

4. **Validação operacional**
   - Verificar build e fluxo autenticado/desautenticado.
   - Confirmar no banco que os jobs estão ativos, escalonados e sem novo `job startup timeout` no intervalo observado.
   - Revisar logs de autenticação e funções após a alteração.

## Impacto e riscos
- **Impacto:** autenticação inicial, proteção de rotas e agenda interna dos crons.
- **Risco controlado:** um job periódico pode executar alguns minutos depois dentro do mesmo ciclo; nenhum disparo será removido.
- **Sem alteração:** regras comerciais, conteúdo das mensagens, filas e dados existentes.
