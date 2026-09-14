# Terceiro tipo de cliente: Agendado

Hoje o cadastro só tem **Mensal** (cobrança recorrente) e **Registro** (venda única).
Falta o caso do cliente que **agendou um serviço e ainda não pegou** — ele entra como cliente,
some nos relatórios como se tivesse perdido, e não existe um caminho claro para virar Mensal ou Registro depois.

## O que vai ser criado

### 1. Novo tipo no cadastro: "Agendado"
Na tela de escolha (hoje Mensal / Registro) entra um terceiro card: **Agendado**.
Campos desse tipo:
- Nome, WhatsApp, e-mail, CPF (igual aos outros)
- **Serviço agendado** (texto/produto)
- **Data do agendamento**
- Valor previsto (opcional, pode ficar R$ 0)
- Observação

Não gera cobrança, não entra em nenhum fluxo de renovação, não recebe mensagem automática.

### 2. Botão "Converter cliente"
Na consulta/edição do cliente agendado aparece a ação **Converter**, com duas opções:

- **Virar Mensal** — pede ciclo de cobrança, valor, moeda e data da primeira renovação; liga a cobrança automática.
- **Virar Registro** — pede valor pago e data; fecha como venda única.

A conversão guarda no histórico do cliente: "Convertido de Agendado para Mensal em tal data".
O cadastro original é o mesmo (não duplica cliente).

### 3. Onde o Agendado aparece (e onde não aparece)

| Métrica | Agendado conta? |
|---|---|
| Total de clientes / MRR / ARR | Não |
| Churn | Não |
| Receita em Risco | Não |
| LTV / Receita / Vendas Únicas | Não |
| Card novo "Agendados" (quantidade + valor previsto) | Sim |

Na **Consulta de Cliente** entra o filtro por tipo: Mensal / Registro / Agendado.
Na lista, selo laranja "Agendado" com a data do agendamento.

### 4. Agendamento vencido
Agendado com data passada ganha um aviso visual ("Agendamento vencido há X dias") para você cobrar
ou descartar. Nada é excluído automaticamente.

### 5. Base atual
Os 6 registros do legado com R$ 0 e nenhum pagamento (Felipe Moraes, @renanbmx, "..", Gustavo, Otto, José Augusto)
passam para **Agendado**, saindo da Receita em Risco. Os outros 19 do legado (que têm valor) ficam como estão,
para você decidir depois.

## Detalhes técnicos

- Novas colunas em `clientes`: `status_cliente` (texto, padrão `ativo`), `servico_agendado` (texto), `data_agendamento` (data), `convertido_em` (timestamp), `convertido_de` (texto). Nada é removido — mudança aditiva.
- `CadastrarCliente.tsx`: novo `ClienteType = 'agendado'`, schema próprio sem exigir ciclo/renovação.
- `ConsultarCliente.tsx` / `AtualizarCliente.tsx`: filtro, selo e ação Converter.
- `AdminRelatorios.tsx` e `useDashboardStats.ts`: excluir `status_cliente = 'agendado'` de clientes ativos, MRR, churn e Receita em Risco; card próprio de Agendados.
- Cobrança (`useClientes`, cron de cobrança): agendado nunca entra na fila.
