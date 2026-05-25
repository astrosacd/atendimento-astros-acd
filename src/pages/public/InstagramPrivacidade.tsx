import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InstagramPrivacidade() {
  const lastUpdate = "25 de maio de 2026";

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Política de Privacidade — Módulo Instagram</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: {lastUpdate}</p>
          </CardHeader>
          <CardContent className="prose prose-neutral dark:prose-invert max-w-none space-y-4">
            <h2>1. Quem somos</h2>
            <p>
              Este módulo é parte de uma plataforma interna de CRM e gestão. Ele integra com a
              Instagram Graph API (Meta Platforms) exclusivamente para que usuários autenticados
              gerenciem suas próprias contas profissionais do Instagram.
            </p>

            <h2>2. Dados que coletamos via Instagram</h2>
            <ul>
              <li>Perfil público (nome, foto, username, ID).</li>
              <li>Mídias publicadas (posts, reels, stories) e suas métricas.</li>
              <li>Comentários e mensagens diretas (DMs) das contas conectadas.</li>
              <li>Insights agregados (alcance, impressões, engajamento).</li>
              <li>Tokens de acesso fornecidos pelo usuário via OAuth oficial da Meta.</li>
            </ul>

            <h2>3. Como usamos esses dados</h2>
            <ul>
              <li>Exibir métricas e relatórios dentro da plataforma para o próprio dono da conta.</li>
              <li>Executar automações de resposta a comentários e DMs configuradas pelo próprio usuário.</li>
              <li>Gerar análises de performance solicitadas pelo usuário.</li>
            </ul>
            <p>
              Não vendemos, alugamos ou compartilhamos dados do Instagram com terceiros para fins de
              marketing.
            </p>

            <h2>4. Armazenamento e segurança</h2>
            <p>
              Os dados ficam armazenados em infraestrutura de nuvem da Supabase Inc. (Estados Unidos),
              com criptografia em trânsito (TLS) e em repouso. Tokens de acesso são guardados em
              colunas protegidas com Row Level Security, acessíveis apenas ao dono da conta e
              processos internos autorizados.
            </p>

            <h2>5. Retenção</h2>
            <p>
              Mantemos os dados enquanto a conta do Instagram permanecer conectada. Ao desconectar a
              conta ou solicitar exclusão, os dados associados são removidos em até 30 dias.
            </p>

            <h2>6. Direitos do usuário</h2>
            <ul>
              <li>Solicitar acesso, correção ou exclusão dos seus dados a qualquer momento.</li>
              <li>Revogar o acesso do app diretamente nas configurações do Instagram/Facebook.</li>
              <li>Solicitar exclusão completa enviando e-mail para o contato abaixo.</li>
            </ul>

            <h2>7. Exclusão de dados (Data Deletion)</h2>
            <p>
              Para solicitar a remoção completa dos dados, envie um e-mail para o contato indicado
              abaixo com o assunto "Exclusão de dados Instagram" e o ID/username da conta. A remoção
              é confirmada em até 30 dias.
            </p>

            <h2>8. Operadores de dados</h2>
            <ul>
              <li>Supabase Inc. — armazenamento e banco de dados.</li>
              <li>Meta Platforms — origem dos dados (Instagram Graph API).</li>
              <li>Provedores de IA (quando habilitados pelo usuário) — processamento de texto sob demanda.</li>
            </ul>

            <h2>9. Alterações</h2>
            <p>
              Esta política pode ser atualizada. A data no topo indica a última revisão. Mudanças
              relevantes serão comunicadas aos usuários ativos.
            </p>

            <h2>10. Contato</h2>
            <p>
              Dúvidas, solicitações de acesso ou exclusão de dados: entre em contato pelo canal de
              suporte da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
