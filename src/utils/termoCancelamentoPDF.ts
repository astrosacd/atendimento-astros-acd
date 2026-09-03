import jsPDF from 'jspdf';

// === Cores Astros (mesmo padrão do Extrato) ===
const NAVY = '#0B1733';
const CARD = '#16244A';
const CARD_BORDER = '#22325C';
const GOLD = '#D4A84B';
const GOLD_SOFT = '#B98F39';
const WHITE = '#FFFFFF';
const LIGHT = '#C9D2E4';
const MUTED = '#8B97B5';

export interface TermoServico {
  nome: string;
  valor?: number | null;
  data_contratacao?: string | null; // ISO yyyy-mm-dd
}

export interface TermoCancelamentoData {
  cliente_nome: string;
  cliente_documento?: string;
  cliente_email?: string;
  cliente_numero?: string;
  servicos: TermoServico[];
  data_cancelamento: string; // ISO yyyy-mm-dd
  motivo?: string;
  observacoes?: string;
  protocolo: string;
  quitado?: boolean;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d.length <= 10 ? `${d}T00:00:00` : d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateLong = (d: Date | string) => {
  const date = typeof d === 'string' ? new Date(d.length <= 10 ? `${d}T00:00:00` : d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

function paintBg(doc: jsPDF) {
  doc.setFillColor(NAVY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
}

function header(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(GOLD);
  doc.text('ASTROS', 40, 50);
  doc.setTextColor(WHITE);
  doc.text(' COMUNICAÇÃO DIGITAL', 40 + doc.getTextWidth('ASTROS') + 4, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text('www.astroscomunicacaodigital.com  ·  Marketing é Venda', 40, 64);

  const badgeText = 'TERMO DE CANCELAMENTO';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const bw = doc.getTextWidth(badgeText) + 24;
  const bx = w - 40 - bw;
  doc.setFillColor(GOLD);
  doc.roundedRect(bx, 36, bw, 22, 3, 3, 'F');
  doc.setTextColor(NAVY);
  doc.text(badgeText, bx + bw / 2, 51, { align: 'center' });

  doc.setDrawColor(CARD_BORDER);
  doc.setLineWidth(0.6);
  doc.line(40, 78, w - 40, 78);
}

function footer(doc: jsPDF, page: number, total: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(MUTED);
  doc.text('ASTROS COMUNICAÇÃO DIGITAL  ·  Documento gerado eletronicamente', 40, h - 24);
  doc.text(`${page} / ${total}`, w - 40, h - 24, { align: 'right' });
}

function sectionTitle(doc: jsPDF, y: number, label: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(GOLD);
  doc.text(label.toUpperCase().split('').join(' '), 40, y);
  doc.setDrawColor(CARD_BORDER);
  doc.setLineWidth(0.4);
  doc.line(40, y + 6, w - 40, y + 6);
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    paintBg(doc);
    header(doc);
    return 110;
  }
  return y;
}

export function gerarTermoCancelamentoPDF(data: TermoCancelamentoData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  paintBg(doc);
  header(doc);

  // Título
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT);
  doc.text('Termo de encerramento de serviço em nome de', 40, 110);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(WHITE);
  doc.text(doc.splitTextToSize(data.cliente_nome || '—', W - 80)[0], 40, 140);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(
    `Emitido em ${fmtDate(new Date())}  ·  Protocolo: ${data.protocolo || '—'}`,
    40,
    158,
  );

  let y = 190;

  // Dados do cliente
  sectionTitle(doc, y, 'Dados do Cliente');
  y += 16;
  const linhasCliente: string[] = [];
  if (data.cliente_documento?.trim()) linhasCliente.push(`CPF/CNPJ: ${data.cliente_documento.trim()}`);
  if (data.cliente_email?.trim()) linhasCliente.push(`E-mail: ${data.cliente_email.trim()}`);
  if (data.cliente_numero?.trim()) linhasCliente.push(`Telefone: ${data.cliente_numero.trim()}`);
  if (linhasCliente.length === 0) linhasCliente.push('—');

  const cardH = 20 + linhasCliente.length * 14;
  doc.setFillColor(CARD);
  doc.roundedRect(40, y, W - 80, cardH, 6, 6, 'F');
  doc.setDrawColor(CARD_BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(40, y, W - 80, cardH, 6, 6, 'S');
  doc.setFillColor(GOLD);
  doc.rect(40, y, 3, cardH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT);
  let cy = y + 20;
  linhasCliente.forEach((l) => { doc.text(l, 56, cy); cy += 14; });
  y += cardH + 22;

  // Serviços cancelados
  sectionTitle(doc, y, 'Serviço(s) Cancelado(s)');
  y += 18;
  (data.servicos.length ? data.servicos : [{ nome: '—' } as TermoServico]).forEach((s) => {
    y = ensureSpace(doc, y, 56);
    doc.setFillColor(CARD);
    doc.roundedRect(40, y, W - 80, 48, 6, 6, 'F');
    doc.setDrawColor(CARD_BORDER);
    doc.setLineWidth(0.5);
    doc.roundedRect(40, y, W - 80, 48, 6, 6, 'S');
    doc.setFillColor(GOLD);
    doc.rect(40, y, 3, 48, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(WHITE);
    doc.text(doc.splitTextToSize(s.nome || '—', W - 260)[0], 54, y + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    const partes: string[] = [];
    if (s.data_contratacao) partes.push(`Contratado em: ${fmtDate(s.data_contratacao)}`);
    partes.push(`Cancelado em: ${fmtDate(data.data_cancelamento)}`);
    doc.text(partes.join('  ·  '), 54, y + 38);

    if (s.valor != null && Number(s.valor) > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(GOLD);
      doc.text(fmtBRL(Number(s.valor)), W - 54, y + 22, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.text('valor anterior', W - 54, y + 34, { align: 'right' });
    }
    y += 56;
  });

  y += 8;

  // Declaração
  y = ensureSpace(doc, y, 140);
  sectionTitle(doc, y, 'Declaração');
  y += 20;
  const nomeCliente = data.cliente_nome || 'o cliente';
  const declaracao =
    `A ASTROS COMUNICAÇÃO DIGITAL declara, para os devidos fins, que o(s) serviço(s) acima relacionado(s), ` +
    `contratado(s) por ${nomeCliente}, foi(ram) oficialmente CANCELADO(S) em ${fmtDateLong(data.data_cancelamento)}. ` +
    `A partir desta data cessam a prestação do(s) serviço(s), as respectivas cobranças recorrentes e o acesso às ` +
    `entregas vinculadas ao contrato.` +
    (data.quitado
      ? ` Declaramos ainda que não há pendências financeiras entre as partes referentes ao(s) serviço(s) cancelado(s).`
      : '');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(LIGHT);
  doc.splitTextToSize(declaracao, W - 80).forEach((line: string) => {
    y = ensureSpace(doc, y, 20);
    doc.text(line, 40, y);
    y += 14;
  });

  // Motivo
  if (data.motivo?.trim()) {
    y += 12;
    y = ensureSpace(doc, y, 50);
    sectionTitle(doc, y, 'Motivo do Cancelamento');
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(LIGHT);
    doc.splitTextToSize(data.motivo.trim(), W - 80).forEach((line: string) => {
      y = ensureSpace(doc, y, 20);
      doc.text(line, 40, y);
      y += 14;
    });
  }

  // Observações
  if (data.observacoes?.trim()) {
    y += 12;
    y = ensureSpace(doc, y, 50);
    sectionTitle(doc, y, 'Observações');
    y += 20;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(LIGHT);
    doc.splitTextToSize(data.observacoes.trim(), W - 80).forEach((line: string) => {
      y = ensureSpace(doc, y, 20);
      doc.text(line, 40, y);
      y += 13;
    });
  }

  // Assinatura
  y += 32;
  y = ensureSpace(doc, y, 90);
  doc.setDrawColor(MUTED);
  doc.setLineWidth(0.6);
  doc.line(40, y, 260, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(WHITE);
  doc.text('ASTROS COMUNICAÇÃO DIGITAL', 40, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text('Responsável pela emissão do termo', 40, y + 26);

  doc.setDrawColor(MUTED);
  doc.line(W - 260, y, W - 40, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(WHITE);
  doc.text(doc.splitTextToSize(data.cliente_nome || '—', 220)[0], W - 260, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text('Cliente', W - 260, y + 26);

  y += 52;
  doc.setFontSize(7.5);
  doc.setTextColor(GOLD_SOFT);
  doc.text(
    `Documento gerado eletronicamente em ${fmtDate(new Date())} · Protocolo ${data.protocolo}. Validade comprobatória sem necessidade de assinatura física.`,
    40,
    y,
  );

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    footer(doc, p, totalPages);
  }

  return doc;
}
