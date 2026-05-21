# 📊 MVP — Relatórios de Social Media para Clientes

Módulo **separado** da Espionagem, focado em monitorar perfis dos **seus clientes** (não concorrentes), gerar relatório mensal automático com comparativo, entregar via PDF + link público, e enviar automaticamente por WhatsApp/Email no dia configurado.

---

## 🗂️ Estrutura geral

```
Instagram (módulo existente)
├── Criar
├── Histórico
├── Auto-resposta
├── Espionagem (concorrentes — já existe)
└── 🆕 Relatórios Clientes   ← NOVO
    ├── Perfis Monitorados (cadastro)
    ├── Relatórios Mensais (lista + visualização)
    └── Configurações (envio + credenciais + teste)
```

---

## 🗄️ Banco de dados (4 tabelas novas)

1. **`social_media_client_profiles`** — perfis dos clientes monitorados
   - `username`, `display_name`, `cliente_id` (opcional, link com `clientes`), `profile_picture_url`, `is_active`, `notify_whatsapp` (bool), `notify_email` (bool), `whatsapp_number`, `email`, `report_day` (1-28, dia do mês p/ envio)

2. **`social_media_daily_snapshots`** — snapshot diário (1 linha por perfil/dia)
   - `profile_id`, `snapshot_date`, `followers_count`, `media_count`, `following_count`

3. **`social_media_posts_collected`** — posts coletados (incremental)
   - `profile_id`, `ig_media_id` (unique), `media_type`, `caption`, `permalink`, `like_count`, `comments_count`, `views_count`, `posted_at`

4. **`social_media_monthly_reports`** — relatórios gerados
   - `profile_id`, `month` (YYYY-MM), `data` (jsonb com métricas calculadas), `share_token` (uuid p/ link público), `pdf_url` (storage), `sent_whatsapp_at`, `sent_email_at`, `generated_at`

5. **`social_media_report_config`** — config global
   - `evolution_instance_id`, `evolution_phone_number`, `email_from`, `email_smtp_*` (ou usar Gmail OAuth), `auto_send_enabled`, `send_hour`

**RLS:** admin + permissão nova `social_media_reports`.

---

## ⚙️ Edge Functions (5 novas)

1. **`social-media-sync-profiles`** — sync diário via Graph API `business_discovery` (reaproveita config IG existente). Grava snapshot + posts.
2. **`social-media-generate-report`** — calcula métricas do mês (comparativo vs mês anterior), gera PDF, salva em storage, retorna URL pública.
3. **`social-media-send-report`** — envia relatório via WhatsApp (Evolution API) + Email (Gmail).
4. **`social-media-test-credentials`** — botão TESTE: dispara mensagem WhatsApp + email de teste pro número/email configurado, retorna sucesso/erro detalhado de cada canal.
5. **`social-media-monthly-cron`** — cron mensal: roda dia X, gera relatório + envia automático pros perfis com `auto_send_enabled`.

**Cron jobs:**
- Diário 03:00 UTC → `social-media-sync-profiles`
- Diário 11:00 UTC → `social-media-monthly-cron` (verifica quais perfis batem `report_day` hoje)

---

## 📈 Métricas no relatório mensal

- Seguidores: início mês / fim mês / saldo / % crescimento
- Comparativo vs mês anterior (ganho/perda)
- Posts publicados: total + breakdown (REEL / IMAGE / CAROUSEL)
- Engajamento total: likes + comments
- Engajamento médio por post
- Post de maior engajamento (com thumb + link)
- Gráfico evolução diária seguidores (sparkline)
- Comparativo 3 últimos meses (barras)

---

## 🎨 Telas Frontend

### A) `/instagram/relatorios-clientes` (página principal, 3 tabs)

**Tab 1 — Perfis Monitorados**
- Tabela: avatar, @username, cliente vinculado, seguidores atual, último sync, status
- Botão "Adicionar perfil" → modal (username, link com cliente existente, configs de envio)
- Ações por linha: editar / sincronizar agora / excluir

**Tab 2 — Relatórios**
- Filtro por perfil + mês
- Lista de relatórios gerados (mês, perfil, data geração, status envio)
- Ações: Visualizar / Baixar PDF / Copiar link público / Reenviar
- Botão "Gerar relatório agora" (escolhe perfil + mês)

**Tab 3 — Configurações**
- Seção Evolution API (instância + número remetente) — usar instâncias já cadastradas do CRM
- Seção Gmail/Email (from, app password ou OAuth)
- Cron envio automático: ativo (on/off) + hora do dia
- **🧪 Botão TESTE** — testa WhatsApp + Email + Graph API e mostra resultado de cada um

### B) `/r/social/:shareToken` (público, sem auth)
- Página pública estilo proposta com a marca
- Cards de métricas + gráficos + posts destaque
- Botão "Baixar PDF"

---

## 📝 Geração do PDF

- Edge Function usa template HTML + `html-pdf` via API externa OU monta com pdf-lib
- Branding: reaproveita `proposal_branding` (logo, cores)
- Upload para Supabase Storage bucket `social-media-reports` (público com signed URL)

---

## 🔐 Permissões

- Nova permissão `social_media_reports` no `usePermissions` + `AdminPermissoes`
- Rota protegida por essa permissão
- Admin tem acesso automático (regra já implementada)

---

## 🔧 Integrações reutilizadas

- **Graph API IG**: pega `access_token` + `ig_user_id` da `instagram_settings` existente
- **Evolution API**: pega instância da config existente do CRM (não duplica)
- **Email**: usa config `communication-credentials` se já tem Gmail, senão pede SMTP
- **Storage**: bucket novo `social-media-reports` (PDFs)

---

## 📋 Ordem de execução

1. Migration: 5 tabelas + RLS + permissão + bucket storage
2. Edge functions: `sync-profiles`, `test-credentials`, `generate-report`, `send-report`, `monthly-cron`
3. Hook `useSocialMediaReports` + types
4. Página principal com 3 tabs
5. Página pública `/r/social/:token`
6. Cron jobs (sync diário + envio mensal)
7. Registrar rota + sidebar + permissão
8. Testes ponta-a-ponta com botão de teste

---

## ⚠️ Pontos de atenção

- **Perfil precisa ser Business/Creator público** (Graph API `business_discovery`) — não funciona em perfil pessoal
- **Primeiro relatório mensal sai só depois de 30+ dias** de coleta (sem dados históricos não tem comparativo)
- **Limite Graph API** ~200 req/h — para 100 perfis tranquilo
- **PDF**: vou usar geração server-side (HTML→PDF via Puppeteer/lovable não disponível em edge function Deno). Vou usar **`@react-pdf/renderer`** client-side OU **template HTML simples → conversão via service externo**. Decisão: geração client-side com `jspdf` + `html2canvas` (já tem no projeto via outras telas)
- **Storage**: PDFs ficam públicos via signed URL com expiração de 1 ano

---

## 💡 Sugestões DEV (fase 2)

- OAuth Instagram pro cliente conectar a conta dele (libera insights: alcance, impressões, stories, salvos)
- Comparativo entre múltiplos perfis (benchmark do portfólio)
- Sugestões de IA: "seu cliente postou 40% menos reels esse mês, posts caíram X%"
- Agendamento de envio em horário comercial específico por timezone

---

**Próximo passo:** se aprovar, começo pela migration (passo 1) e sigo a ordem acima. Estimativa: 4-5 iterações grandes pra MVP completo.