## Funcionalidade: Extrato de Investimento (PDF)

Substitui o processo manual de gerar PDF de investimentos. Consolida múltiplos cadastros do mesmo cliente (por nome + e-mail + telefone), permite revisar/desmarcar registros, e gera PDF idêntico ao modelo Astros (azul-marinho + dourado).

### 1. Onde acessar
- Adicionar botão **"Gerar Extrato de Investimento"** na página do cliente (`/clientes` → ação da linha) e/ou no detalhe do cliente.
- Também acessível por uma rota nova `/clientes/extrato-investimento` com busca por nome/email/telefone.

### 2. Agrupamento e busca
- Query consolida `clientes` + `client_purchases` + `client_payments` (pagos) usando fuzzy match:
  - Mesmo telefone (normalizado: só dígitos)
  - OU mesmo email (lowercase)
  - OU nome muito similar (`similarity()` do `pg_trgm`)
- Retorna todos os registros encontrados com origem (cadastro principal, compras avulsas, mensalidades).

### 3. Tela de seleção
- Modal/página lista todos os itens encontrados, agrupados em duas seções:
  - **Aquisição única** (compras de `client_purchases` + pagamentos únicos)
  - **Mensais recorrentes** (cadastros de `clientes` com `cobranca_ativa=true` e `ciclo_cobranca='mensal'`)
- Cada linha tem checkbox (marcado por padrão), quantidade editável, valor unitário e total calculado.
- Campos editáveis: **Referência do extrato** (subtítulo), **Nome do cliente** (pré-preenchido com o mais frequente).
- Botão **"Gerar PDF"** dispara a geração com a seleção final.

### 4. Geração do PDF
- Edge Function `gerar-extrato-investimento`:
  - Recebe `{ cliente_nome, referencia, itens_unicos[], itens_mensais[] }`.
  - Renderiza HTML idêntico ao layout Astros (cores `#0B1733` fundo, `#D4A84B` dourado, `#1B2E54` cards).
  - Converte para PDF via `puppeteer-core` + Chromium (ou via `@react-pdf/renderer` server-side se mais simples no Deno).
  - Página 1: header + 3 KPIs + tabela "Aquisição Única" + tabela "Mensais Recorrentes" + 2 totais.
  - Página 2: detalhamento de cada item com descrição (pega de `predefined_products` quando bate por nome, senão deixa descrição padrão).
  - Retorna o PDF base64 ou URL de bucket.
- Frontend faz download direto (`extrato_<nome>_<data>.pdf`).

### 5. Layout (fiel ao modelo)
- Fundo `#0B1733`, dourado `#D4A84B`, texto branco/cinza claro.
- Header: "ASTROS COMUNICAÇÃO DIGITAL" (dourado+branco) + badge "EXTRATO DE INVESTIMENTO".
- Tipografia: serif/sans similar ao modelo (usar Inter ou Manrope — bundled no Chromium).
- Cards com borda dourada no destaque "INVESTIMENTO ÚNICO".
- Linha total com fundo dourado sólido e texto azul-marinho escuro.
- Rodapé: "ASTROS COMUNICAÇÃO DIGITAL · Confidencial · página x/y".

### 6. Detalhes técnicos

**Banco**
- Migration: habilitar extensão `pg_trgm` (se ainda não tiver) para o fuzzy match.
- Criar função RPC `buscar_investimentos_cliente(p_nome text, p_email text, p_telefone text)` que retorna json consolidado (RLS-safe via `SECURITY DEFINER` + checagem `is_admin() OR auth.uid() IS NOT NULL`).

**Frontend**
- `src/pages/ExtratoInvestimento.tsx` — página com busca e tela de seleção.
- `src/components/extrato/SelecaoItensDialog.tsx` — modal de revisão.
- Botão na tabela de `/clientes` na lista de ações.

**Edge Function**
- `supabase/functions/gerar-extrato-investimento/index.ts`
  - Geração via **`@react-pdf/renderer`** (funciona em Deno via `npm:` e gera PDF nativamente sem Chromium) **ou** via HTML→PDF com a lib `npm:html-pdf-node`/`npm:pdf-lib`.
  - Vou usar HTML estático + `npm:@react-pdf/renderer` pela fidelidade ao layout.

### 7. Permissão
- Apenas usuários com `has_permission('clientes_view')` ou admins podem gerar.

### 8. Riscos / pontos de atenção
- Fuzzy match pode trazer falso-positivos → a tela de seleção é a salvaguarda (operador desmarca).
- Renderização PDF no Edge Function tem limite de memória; vou validar com cliente de 15+ serviços.
- Mapeamento de produto → descrição rica usa `predefined_products`; se não houver match, mostra só nome + valores.

### 9. Itens fora deste escopo (confirmar se quer incluir)
- Envio automático por WhatsApp/email após gerar.
- Histórico de extratos gerados por cliente (auditoria).
- Logo customizada do cliente/empresa.

### Confirmações necessárias antes de codar
1. **Origem dos itens "mensais"**: usar `clientes.valor` + `ciclo_cobranca='mensal'` como base, certo? Ou tem outra tabela de assinaturas?
2. **Descrição rica de cada produto** (texto + bullets na página 2): deve vir de `predefined_products.descricao` ou você vai cadastrar à parte? Se não houver, mostro só nome + valores.
3. **Histórico**: salvar cada PDF gerado em bucket + tabela `extratos_investimento_logs` para auditoria? (recomendo sim)
4. **Envio automático**: gerar só pra download, ou já adicionar botão "Enviar por WhatsApp" no fim?
