
# Plano: Espionagem e Rastreio funcionais

## Contexto atual

**Espionagem** (`/instagram/espionage`)
- Backend já usa **Business Discovery API** (correto pra concorrentes)
- Problema: depende de `instagram_settings.access_token` (token antigo) + `ig_user_id`. Tabela tem dados, mas token tá inválido (erro "cannot parse access token" que você viu).
- Solução: trocar a fonte do token pra usar **qualquer perfil OAuth conectado** em `social_media_client_profiles` (que renova automático). Fallback pro `instagram_settings` se nada estiver conectado.

**Rastreio de Clientes** (`/instagram` → Perfis Monitorados)
- Hoje: só dá pra conectar via OAuth se VOCÊ logar com o Facebook do cliente
- Você quer: gerar um **link público** pra mandar pro cliente no WhatsApp; cliente clica, autoriza no Facebook DELE, e o token cai direto no perfil cadastrado.

---

## O que vou implementar

### 1. Espionagem funcional
- **Edge function `instagram-spy-sync`**: trocar lógica de busca de token:
  1. Primeiro tenta qualquer perfil de `social_media_client_profiles` com `oauth_connected=true` e token válido
  2. Se não tiver, usa `instagram_settings` (legado)
  3. Se nenhum, retorna erro claro: "Conecte ao menos 1 perfil via OAuth pra usar Espionagem"
- **UI Espionagem**: adicionar banner explicativo quando não houver token disponível, com botão "Ir pra Perfis Monitorados → Conectar"
- **Botão "Sincronizar Agora"** já existe, vai funcionar assim que tiver token válido

### 2. Rastreio de Clientes — Link público de autorização

**Nova tabela** `instagram_oauth_invites`:
```
- id (uuid)
- profile_id (FK) — qual perfil será conectado
- token (uuid único) — vai na URL pública
- created_by (FK usuário) — quem gerou o convite
- created_at, expires_at (default 7 dias)
- used_at (timestamp quando autorizado)
- used_by_fb_user_id (texto, ID Facebook de quem autorizou)
- status: 'pending' | 'completed' | 'expired' | 'mismatch'
```

**Página pública nova** `/autorizar-instagram/:token`:
- Layout limpo (dark theme, mesma identidade do sistema)
- Mostra: foto + @username do perfil que será conectado
- Texto explicativo: "A agência X precisa de autorização pra gerar relatórios do seu Instagram"
- Lista clara do que será acessado (insights, posts, métricas) e o que NÃO será (mensagens, senha)
- Botão grande "Autorizar via Facebook" → abre OAuth no fluxo padrão (mesmo `instagram-oauth-start`)
- Tela de sucesso ao concluir

**Modificações no fluxo OAuth existente**:
- `instagram-oauth-start`: aceitar `inviteToken` no body; se vier, gera state com flag `publicInvite=true` e pula validação de admin
- `instagram-oauth-callback`: se state tem `publicInvite`, valida o token contra `instagram_oauth_invites` ao invés de exigir role admin; marca invite como `completed`

**UI em InstagramClientReports** (`/instagram`):
- Card de perfil ganha botão **"Gerar Link de Autorização"** (ao lado do "Reconectar")
- Modal mostra:
  - Link gerado (pré-formatado pra WhatsApp com texto sugerido)
  - Botão "Copiar Link"
  - Botão "Abrir WhatsApp" (deep link `wa.me`)
  - Status do convite (Pendente / Concluído / Expirado)
- Tab "Convites" com histórico: quem gerou, quando, status, link

### 3. Resposta sobre os scopes da Meta

`instagram_manage_insights` — **OBRIGATÓRIO** (métricas privadas: alcance, impressões, demografia)
`business_management` — **OBRIGATÓRIO** (acessar Business Manager e listar páginas)
`pages_read_engagement` — **OBRIGATÓRIO** (ler dados das Páginas Facebook vinculadas)
`instagram_basic` — **OBRIGATÓRIO** (info básica do perfil IG)

**Todos os 4 são necessários.** Sem `instagram_manage_insights` não pega insights privados; sem os outros 3 nem chega a listar a página/perfil. São o mínimo que a Meta exige pro fluxo Business Discovery + Insights privados.

Adicionalmente, pra **Espionagem** com Business Discovery, esses 4 já cobrem (não precisa de scope extra).

---

## Ordem de execução

1. Migration: tabela `instagram_oauth_invites` + RLS
2. Edge function `instagram-spy-sync`: trocar fonte de token
3. Edge functions OAuth (`start` + `callback`): suportar fluxo de invite público
4. Página pública `/autorizar-instagram/:token`
5. Rota pública no `App.tsx`
6. UI `InstagramClientReports`: botão "Gerar Link" + modal + tab convites
7. UI `InstagramEspionage`: banner de erro quando sem token + link pra conectar perfil
8. Testar fluxo completo

---

## Impacto e riscos

- **Não quebra nada existente**: OAuth interno continua funcionando, espionage só ganha fallback
- **Não apaga dados**: tabela `instagram_competitors` mantida intacta
- **Segurança**: invite tem expiração de 7 dias e token UUID; só atualiza o perfil correspondente; sinatura HMAC do state continua válida
- **Risco baixo**: mudanças cirúrgicas; principal complexidade é a página pública nova

---

## Estimativa
- 1 migration
- 4 edge functions modificadas
- 1 página nova
- 2 páginas modificadas
- Total: ~600 linhas de código

Confirma que posso executar tudo isso?
