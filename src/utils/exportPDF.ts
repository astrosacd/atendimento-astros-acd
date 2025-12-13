import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BillingLog {
  id: string;
  cliente_nome: string;
  cliente_email?: string;
  cliente_numero?: string;
  channel: string;
  message_type: string;
  status: string;
  sent_at: string;
  error_message?: string;
}

interface Cliente {
  id: string;
  nome: string;
  email: string;
  numero: string;
  cpf: string;
  produto: string;
  plano?: string;
  valor: number;
  data_renovacao: string;
}

interface BillingStats {
  totalEnviados: number;
  totalErros: number;
  taxaSucesso: number;
  porCanal: { email: number; whatsapp: number };
  porTipo: Record<string, number>;
}

export const exportBillingReportPDF = (
  logs: BillingLog[],
  stats: BillingStats,
  period: { start: string; end: string }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Relatório de Cobrança', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Período: ${period.start} a ${period.end}`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 34, { align: 'center' });

  // Summary Stats
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text('Resumo', 14, 48);

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);

  const summaryData = [
    ['Total de Envios', stats.totalEnviados.toString()],
    ['Enviados com Sucesso', (stats.totalEnviados - stats.totalErros).toString()],
    ['Erros', stats.totalErros.toString()],
    ['Taxa de Sucesso', `${stats.taxaSucesso.toFixed(1)}%`],
    ['Envios por E-mail', stats.porCanal.email.toString()],
    ['Envios por WhatsApp', stats.porCanal.whatsapp.toString()],
  ];

  autoTable(doc, {
    startY: 52,
    head: [['Métrica', 'Valor']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [76, 175, 80] },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'right' },
    },
  });

  // Detailed logs
  const tableStartY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text('Detalhamento de Envios', 14, tableStartY);

  const logData = logs.slice(0, 50).map(log => [
    log.cliente_nome.substring(0, 20),
    log.channel === 'email' ? 'E-mail' : 'WhatsApp',
    formatMessageType(log.message_type),
    log.status === 'sent' ? 'Enviado' : 'Erro',
    new Date(log.sent_at).toLocaleDateString('pt-BR'),
  ]);

  autoTable(doc, {
    startY: tableStartY + 4,
    head: [['Cliente', 'Canal', 'Tipo', 'Status', 'Data']],
    body: logData,
    theme: 'striped',
    headStyles: { fillColor: [63, 81, 181] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 25 },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
      4: { cellWidth: 30 },
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount} - Sistema Astros CRM`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`relatorio-cobranca-${period.start}-${period.end}.pdf`);
};

export const exportClientesPDF = (clientes: Cliente[]) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Relatório de Clientes', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Total: ${clientes.length} clientes`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 34, { align: 'center' });

  // Calculate totals
  const totalValor = clientes.reduce((acc, c) => acc + c.valor, 0);

  doc.setFontSize(10);
  doc.text(`Valor Total: ${formatCurrency(totalValor)}`, 14, 45);

  const clienteData = clientes.map(c => [
    c.nome.substring(0, 25),
    c.email.substring(0, 25),
    formatPhone(c.numero),
    c.produto.substring(0, 15),
    c.plano || '-',
    formatCurrency(c.valor),
    new Date(c.data_renovacao).toLocaleDateString('pt-BR'),
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Nome', 'E-mail', 'Telefone', 'Produto', 'Plano', 'Valor', 'Renovação']],
    body: clienteData,
    theme: 'striped',
    headStyles: { fillColor: [76, 175, 80] },
    styles: { fontSize: 8 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount} - Sistema Astros CRM`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`clientes-${new Date().toISOString().split('T')[0]}.pdf`);
};

const formatMessageType = (type: string): string => {
  const types: Record<string, string> = {
    'd_menos_3': 'D-3',
    'd_zero': 'Vencimento',
    'd_mais_1': 'D+1',
    'd_mais_2': 'D+2',
    'd_mais_15': 'D+15',
    'd_mais_30': 'D+30',
  };
  return types[type] || type;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};
