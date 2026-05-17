# Fila de Ligações IA para Cobrança (Opção A)

## Conceito
Cron diário identifica clientes que entram em D's configurados e cria registros em `ligacoes_agendadas` (status `pendente`). Operador abre a tela, vê a fila do dia, clica "Iniciar fila" e o navegador disca uma de cada vez, esperando N minutos (configurável) entre cada chamada — independente do resultado. Se fechar a aba, ao reabrir mostra "faltam X ligações" e permite retomar.

## Banco de dados

**`cobranca_ligacao_config`** (1 linha global)
- `enabled` (bool), `roteiro_id` (FK), `delay_minutes` (int, padrão 5)
- `dias_disparo` (int[]) — ex: `[-3, 0, 5]` significa D-3, D+0, D+5
- `horario_inicio`, `horario_fim` (time) — janela permitida (ex: 09:00–18:00)
- `apenas_cobranca_ativa` (bool)

**`ligacoes_agendadas`**
- `cliente_id`, `roteiro_id`, `dia_alvo` (date — qual D), `tipo_d` (text, ex "D+5")
- `status` (`pendente`|`em_andamento`|`finalizada`|`falhou`|`cancelada`)
- `historico_id` (FK pra `ligacoes_ia_historico` quando rodar)
- `tentativas` (int), `processada_em` (timestamp), `erro` (text)
- Unique: `(cliente_id, dia_alvo, tipo_d)` — evita duplicar no mesmo dia

## Cron
Estende `billing-cron` (ou cria `cobranca-ligacoes-cron` rodando 1x/dia 07:00) que:
1. Lê `cobranca_ligacao_config`.
2. Para cada `dia_disparo`, busca clientes com `data_renovacao + dia = hoje` (e `cobranca_ativa` se filtro ativo).
3. Insere em `ligacoes_agendadas` com status `pendente` (ignora duplicatas).

## UI

**Configuração** — nova aba em `LigacoesIA.tsx` chamada "Cobrança automática":
- Toggle ligado/desligado
- Multi-select dos D's (D-3, D+0, D+5, etc — opções derivadas dos campos existentes em cobrança)
- Select de roteiro
- Slider de delay entre ligações (1–30 min)
- Inputs horário início/fim
- Checkbox "Apenas cobrança ativa"

**Fila** — nova aba "Fila do dia" em `LigacoesIA.tsx`:
- Card de resumo: "X pendentes, Y feitas, Z falharam"
- Botão grande "▶ Iniciar fila" (ou "Retomar fila" se houver registros já processados hoje)
- Lista das ligações: cliente, número, D, status, horário processado
- Quando iniciada: mostra timer "Próxima ligação em 4:23", ligação atual com estado, botão "⏸ Pausar"
- Ao terminar uma chamada (qualquer resultado), aguarda `delay_minutes` e passa pra próxima
- Estado vive em memória do React + atualiza `ligacoes_agendadas` a cada passo (assim, recarregar = retomar do banco)
- Se fechar a aba: pendentes ficam `pendente` no banco. Ao reabrir, banner "📞 Faltam 10 ligações agendadas — Retomar?"

**Dashboard** — card "📞 X ligações agendadas para hoje" com link pra fila (se permissão).

## Detalhes técnicos
- O motor da fila reusa `placeCallWithTTS` de `src/lib/wavoipCall.ts` (mesma injeção TTS via WebRTC).
- Cada ligação cria um `ligacoes_ia_historico` e atualiza `ligacoes_agendadas.historico_id`.
- Delay entre ligações: `setTimeout` no front, com countdown visível, cancelável via "Pausar".
- "Pausar" não cancela a próxima — só impede o disparo automático até "Retomar".
- Realtime opcional na tabela `ligacoes_agendadas` pra refletir mudanças se aberto em mais de uma aba (futuro).

## Permissões
- Nova permissão `ligacoes_cobranca_config` (admin) pra acessar config.
- Operador comum acessa só a aba "Fila do dia".

## Entregáveis
1. Migration: tabelas + RLS + índices.
2. Edge function `cobranca-ligacoes-enqueue` (chamada pelo cron).
3. Cron pg_cron 1x/dia.
4. UI: 2 novas abas em `LigacoesIA.tsx` + card no Dashboard.
5. Hook `useLigacoesFila` que orquestra a discagem sequencial com delay.
