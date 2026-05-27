# Sistema de Controle de Escaneamento de QR Code

## Entendimento confirmado

- **Números auto-hospedados** = números internos que vocês hospedam nos servidores (ex: Fernando, 10 números)
- **Não mexer no Baserow** nem na sincronização existente
- **Flag manual** no cadastro do número (dentro do sistema, não no Baserow) marca como "auto-hospedado"
- Quando flagado → aparece automaticamente na nova aba "QR Scans"
- **Limite:** 4 QR grátis/mês **por número**, reset à meia-noite, 1 por dia
- **A partir do 5º:** R$ 14,97 — pagamento via link MP/Stripe **OU manual** (Pix, saldo, etc)
- **Operador interno** clica "Registrar Escaneamento" no CRM
- Escaneamento **só é consumido após confirmação do pagamento** (automática ou manual)

---

## 1. Banco de dados

### Nova coluna em `consulta_numeros_cache`
- `auto_hospedado` (boolean, default false) — flag manual do operador
- `auto_hospedado_observacao` (text, nullable) — observação livre
- `auto_hospedado_marcado_em` (timestamptz)
- `auto_hospedado_marcado_por` (uuid)

> Não toca em `row_data` (vem do Baserow). Flag fica em colunas próprias do cache.

### Nova tabela `qr_scan_config` (singleton)
- `qtd_gratis_por_mes` (int, default 4)
- `qtd_max_por_dia` (int, default 1)
- `valor_excedente` (numeric, default 14.97)
- `payment_provider_default` ('mercadopago' | 'stripe')
- `ativo` (bool)

### Nova tabela `qr_scan_history`
- `baserow_row_id` (bigint) — referência ao número no cache
- `numero` (text) — denormalizado p/ histórico
- `cliente_nome` (text) — denormalizado
- `scan_date` (date) — pra validar "1 por dia"
- `tipo` ('gratis' | 'pago')
- `valor_cobrado` (numeric, nullable)
- `payment_status` ('nao_aplica' | 'pendente' | 'pago' | 'cancelado')
- `payment_method` ('link_mp' | 'link_stripe' | 'manual_pix' | 'manual_saldo' | 'manual_outro' | null)
- `payment_link_id` (uuid → payment_links, nullable)
- `payment_manual_observacao` (text, nullable)
- `payment_comprovante_url` (text, nullable) — upload do comprovante
- `paid_at` (timestamptz, nullable)
- `confirmed_by` (uuid) — operador que confirmou
- `operador_user_id` (uuid)
- `observacao` (text)

### Nova tabela `qr_scan_monthly_counter` (cache)
- `baserow_row_id`, `ano`, `mes`, `qtd_gratis_usados`, `qtd_pagos`
- UNIQUE(baserow_row_id, ano, mes)

### Nova permissão
- `manage_qr_scans` — registrar/confirmar escaneamentos
- `manage_qr_scans_config` — admin only (configurar valores e flags)

---

## 2. Edge Functions

### `qr-scan-register`
Input: `baserow_row_id`, `payment_method` (opcional), `force_paid` (bool)

Lógica:
1. Valida limite diário (já tem scan hoje? → bloqueia)
2. Conta scans grátis do mês corrente p/ esse número
3. Se `qtd_gratis < limite` → cria registro `tipo=gratis`, `payment_status=nao_aplica`, retorna sucesso
4. Se já passou dos 4:
   - Sem `payment_method` → retorna `needs_payment` com valor R$ 14,97 e opções (gerar link MP, link Stripe, marcar manual)
   - Com `payment_method=link_mp|link_stripe` → chama módulo Payment Links, cria `qr_scan_history` com `payment_status=pendente`
   - Com `payment_method=manual_*` → cria `qr_scan_history` com `payment_status=pendente` esperando confirmação

### `qr-scan-confirm-payment`
Input: `qr_scan_id`, `comprovante_url` (opcional), `observacao`
- Marca como `pago`, atualiza `paid_at`, incrementa contador mensal
- Só então o escaneamento "vale" (operador pode escanear o QR de fato)

### `qr-scan-payment-webhook` (auto via Payment Links)
- Quando MP/Stripe confirmam → marca scan correspondente como pago

---

## 3. Frontend

### Coluna na tabela existente de números (`/admin/consulta-numeros`)
- Novo checkbox/toggle **"Auto-hospedado"** por linha (só quem tem `manage_qr_scans`)
- Tooltip explicando: "Marque se este número está hospedado nos nossos servidores"

### Nova aba **"QR Scans"** em `/admin/consulta-numeros`
- **Card config** (admin) — limite grátis, limite diário, valor excedente, provider padrão
- **Tabela de números auto-hospedados** — filtra `auto_hospedado=true`
  - Colunas: número, cliente, grátis usados no mês (ex: 2/4), último scan, próximo disponível, botão **"📲 Registrar Escaneamento"**
- **Histórico** — todos os scans (grátis e pagos) com filtros por cliente/data/status
- **Pendentes de confirmação** — lista de scans aguardando pagamento manual com botão "Confirmar pagamento" (upload de comprovante opcional)

### Dialog `RegistrarScanDialog`
Fluxo:
1. Verifica limites → mostra "Você tem 2/4 grátis este mês" ou "Excedeu o limite — R$ 14,97"
2. Se cobrança:
   - Opções: 🔗 Gerar link Mercado Pago / 🔗 Gerar link Stripe / 💰 Pagamento manual (Pix, saldo, outro)
3. Se manual → campo observação + upload comprovante (opcional)
4. Confirma → cria registro pendente
5. Mostra QR pendente até confirmar pagamento

---

## 4. Ordem de execução

1. Migration: colunas em `consulta_numeros_cache` + 3 tabelas novas + permissões
2. Edge function `qr-scan-register`
3. Edge function `qr-scan-confirm-payment`
4. Webhook MP/Stripe (estender `payment-link-webhook`)
5. Hook `useQrScan` (lista, registra, confirma)
6. Toggle "Auto-hospedado" na tabela de números
7. Nova aba "QR Scans" com sub-componentes
8. Dialog de registro
9. Documentação no guia

---

## ⚠️ Pontos de atenção

- **Não toca em estrutura Baserow** — flag é só no cache local
- Sync do Baserow continua igual; ao sobrescrever `row_data` o flag `auto_hospedado` é preservado (coluna separada)
- Pagamento manual = confiança no operador; logamos quem confirmou
- Reset à meia-noite usa timezone Brasília

Posso prosseguir com a migration?