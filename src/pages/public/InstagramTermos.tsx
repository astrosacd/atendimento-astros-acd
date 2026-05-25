import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InstagramTermos() {
  const lastUpdate = "25 de maio de 2026";

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Termos de Uso — Módulo Instagram</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: {lastUpdate}</p>
          </CardHeader>
          <CardContent className="prose prose-neutral dark:prose-invert max-w-none space-y-4">
            <h2>1. Aceitação</h2>
            <p>
              Ao conectar uma conta do Instagram a este módulo, você declara ter lido e concordado
              com estes Termos e com a Política de Privacidade.
            </p>

            <h2>2. Elegibilidade</h2>
            <ul>
              <li>Você deve ter pelo menos 18 anos.</li>
              <li>A conta conectada deve ser do tipo Profissional (Business ou Creator).</li>
              <li>Você deve ser o titular legítimo ou ter autorização expressa do titular.</li>
            </ul>

            <h2>3. Uso permitido</h2>
            <ul>
              <li>Visualização de métricas e relatórios das suas próprias contas.</li>
              <li>Automação de respostas a comentários e DMs em conformidade com as Políticas da Plataforma Meta.</li>
              <li>Geração de conteúdo e análises com auxílio de IA.</li>
            </ul>

            <h2>4. Uso proibido</h2>
            <ul>
              <li>Envio de spam, mensagens em massa não solicitadas ou conteúdo enganoso.</li>
              <li>Coleta de dados de contas de terceiros sem autorização.</li>
              <li>Qualquer uso que viole as Políticas da Plataforma Meta, a LGPD ou leis aplicáveis.</li>
              <li>Tentativas de burlar limites técnicos ou de segurança.</li>
            </ul>

            <h2>5. Conta Meta e tokens</h2>
            <p>
              A conexão é feita exclusivamente via fluxo OAuth oficial da Meta. Você pode revogar o
              acesso a qualquer momento pelas Configurações do Instagram/Facebook. A revogação
              encerra imediatamente o funcionamento das automações.
            </p>

            <h2>6. Disponibilidade</h2>
            <p>
              O serviço é fornecido "como está". Podemos suspender ou modificar funcionalidades a
              qualquer momento, especialmente em resposta a mudanças nas APIs ou políticas da Meta.
            </p>

            <h2>7. Limitação de responsabilidade</h2>
            <p>
              Não nos responsabilizamos por bloqueios, restrições ou banimentos aplicados pela Meta
              à conta do usuário decorrentes de uso indevido, violação das políticas da plataforma
              ou de configurações de automação definidas pelo próprio usuário.
            </p>

            <h2>8. Encerramento</h2>
            <p>
              Você pode encerrar o uso a qualquer momento desconectando a conta. Podemos suspender o
              acesso em caso de violação destes Termos.
            </p>

            <h2>9. Alterações dos Termos</h2>
            <p>
              Estes Termos podem ser atualizados. A data no topo indica a última revisão. O uso
              continuado após mudanças implica aceitação.
            </p>

            <h2>10. Legislação aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil.
            </p>

            <h2>11. Contato</h2>
            <p>
              Para dúvidas sobre estes Termos, entre em contato pelo canal de suporte da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
