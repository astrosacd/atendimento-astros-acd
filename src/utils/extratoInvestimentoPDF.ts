import jsPDF from 'jspdf';

// === Cores do layout Astros ===
const NAVY = '#0B1733';
const NAVY_2 = '#0F1E40';
const CARD = '#16244A';
const CARD_BORDER = '#22325C';
const GOLD = '#D4A84B';
const GOLD_SOFT = '#B98F39';
const WHITE = '#FFFFFF';
const LIGHT = '#C9D2E4';
const MUTED = '#8B97B5';

export interface ExtratoItem {
  nome: string;
  quantidade: number;
  valor_unitario: number;
  unidade_label?: string; // "un.", "núm."
  descricao?: string;
  bullets?: string[];
}

export interface ExtratoData {
  cliente_nome: string;
  referencia: string;
  qtd_numeros: number;
  itens_unicos: ExtratoItem[];
  itens_mensais: ExtratoItem[];
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function paintBg(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(NAVY);
  doc.rect(0, 0, w, h, 'F');
}

function header(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  // Branding
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

  // Badge "EXTRATO DE INVESTIMENTO"
  const badgeText = 'EXTRATO DE INVESTIMENTO';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const bw = doc.getTextWidth(badgeText) + 24;
  const bx = w - 40 - bw;
  doc.setFillColor(GOLD);
  doc.roundedRect(bx, 36, bw, 22, 3, 3, 'F');
  doc.setTextColor(NAVY);
  doc.text(badgeText, bx + bw / 2, 51, { align: 'center' });

  // Divider
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
  doc.text('ASTROS COMUNICAÇÃO DIGITAL  ·  Confidencial', 40, h - 24);
  doc.text(`${page} / ${total}`, w - 40, h - 24, { align: 'right' });
}

function sectionTitle(doc: jsPDF, y: number, label: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(GOLD);
  // letter-spacing manual
  const spaced = label.toUpperCase().split('').join(' ');
  doc.text(spaced, 40, y);
  doc.setDrawColor(CARD_BORDER);
  doc.setLineWidth(0.4);
  doc.line(40, y + 6, w - 40, y + 6);
}

function kpiCard(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, value: string, sub: string, highlight = false) {
  doc.setFillColor(CARD);
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  if (highlight) {
    doc.setDrawColor(GOLD);
    doc.setLineWidth(1);
  } else {
    doc.setDrawColor(CARD_BORDER);
    doc.setLineWidth(0.6);
  }
  doc.roundedRect(x, y, w, h, 6, 6, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text(title.toUpperCase().split('').join(' '), x + w / 2, y + 22, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(highlight ? GOLD : WHITE);
  doc.text(value, x + w / 2, y + 50, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(sub, x + w / 2, y + 68, { align: 'center' });
}

function tableHeader(doc: jsPDF, y: number, cols: { label: string; x: number; align?: 'left' | 'right' }[]) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  cols.forEach((c) => {
    doc.text(c.label.toUpperCase().split('').join(' '), c.x, y, { align: c.align ?? 'left' });
  });
  doc.setDrawColor(GOLD_SOFT);
  doc.setLineWidth(0.6);
  doc.line(40, y + 6, w - 40, y + 6);
}

function tableRow(doc: jsPDF, y: number, name: string, qtd: string, unit: string, total: string) {
  const w = doc.internal.pageSize.getWidth();
  // gold bar at left
  doc.setFillColor(GOLD);
  doc.rect(40, y - 10, 2, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(WHITE);
  doc.text(name, 50, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(qtd, w / 2 + 30, y, { align: 'right' });
  doc.text(unit, w / 2 + 150, y, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(GOLD);
  doc.text(total, w - 40, y, { align: 'right' });
}

function totalRow(doc: jsPDF, y: number, label: string, value: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(GOLD);
  doc.roundedRect(40, y - 14, w - 80, 22, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY);
  doc.text(label, 56, y);
  doc.text(value, w - 56, y, { align: 'right' });
}

export function gerarExtratoInvestimentoPDF(data: ExtratoData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // -------- PAGE 1 --------
  paintBg(doc);
  header(doc);

  // Greeting + cliente
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT);
  doc.text('Prezado(a),', 40, 110);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(WHITE);
  doc.text(data.cliente_nome || '—', 40, 142);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(
    `Emitido em ${fmtDate(new Date())}  ·  Referência: ${data.referencia || '—'}`,
    40,
    160,
  );

  // Section: RESUMO
  sectionTitle(doc, 200, 'Resumo do Investimento');

  const totalUnico = data.itens_unicos.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  const totalMensal = data.itens_mensais.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

  const cardW = (W - 80 - 24) / 3;
  const cardY = 218;
  const cardH = 90;
  kpiCard(doc, 40, cardY, cardW, cardH, 'Números Adquiridos', String(data.qtd_numeros || 0), 'unidades');
  kpiCard(doc, 40 + cardW + 12, cardY, cardW, cardH, 'Investimento Único', fmtBRL(totalUnico), 'pagamento realizado', true);
  kpiCard(doc, 40 + (cardW + 12) * 2, cardY, cardW, cardH, 'Recorrência Mensal', fmtBRL(totalMensal), 'cobrança mensal ativa');

  // Section: AQUISIÇÃO ÚNICA
  let y = cardY + cardH + 36;
  sectionTitle(doc, y, 'Aquisição Única — Pagamento Realizado');
  y += 28;
  tableHeader(doc, y, [
    { label: 'Produto / Serviço', x: 50 },
    { label: 'Qtd.', x: W / 2 + 30, align: 'right' },
    { label: 'Unit.', x: W / 2 + 150, align: 'right' },
    { label: 'Total', x: W - 40, align: 'right' },
  ]);
  y += 24;
  data.itens_unicos.forEach((it) => {
    tableRow(
      doc,
      y,
      it.nome,
      `${it.quantidade} ${it.unidade_label ?? 'un.'}`,
      `${fmtBRL(it.valor_unitario)}/${(it.unidade_label ?? 'un.').replace('.', '')}`,
      fmtBRL(it.quantidade * it.valor_unitario),
    );
    y += 22;
  });
  y += 4;
  totalRow(doc, y, 'Total Investido — Pagamento Único', fmtBRL(totalUnico));
  y += 30;

  // Section: MENSAIS
  sectionTitle(doc, y, 'Serviços Mensais Recorrentes');
  y += 28;
  tableHeader(doc, y, [
    { label: 'Serviço', x: 50 },
    { label: 'Qtd.', x: W / 2 + 30, align: 'right' },
    { label: 'Unit./Mês', x: W / 2 + 150, align: 'right' },
    { label: 'Total/Mês', x: W - 40, align: 'right' },
  ]);
  y += 24;
  data.itens_mensais.forEach((it) => {
    tableRow(
      doc,
      y,
      it.nome,
      `${it.quantidade} ${it.unidade_label ?? 'núm.'}`,
      `${fmtBRL(it.valor_unitario)}/${(it.unidade_label ?? 'núm.').replace('.', '')}`,
      `${fmtBRL(it.quantidade * it.valor_unitario)}/mês`,
    );
    y += 22;
  });
  y += 4;
  totalRow(doc, y, 'Total Mensal Recorrente', `${fmtBRL(totalMensal)}/mês`);

  // Bottom highlight (2 cards)
  y += 36;
  const bH = 70;
  const bW = (W - 80 - 12) / 2;
  doc.setFillColor(CARD);
  doc.roundedRect(40, y, bW, bH, 6, 6, 'F');
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1);
  doc.roundedRect(40, y, bW, bH, 6, 6, 'S');
  doc.setFillColor(CARD);
  doc.roundedRect(40 + bW + 12, y, bW, bH, 6, 6, 'F');
  doc.roundedRect(40 + bW + 12, y, bW, bH, 6, 6, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text('INVESTIMENTO ÚNICO REALIZADO'.split('').join(' '), 40 + bW / 2, y + 20, { align: 'center' });
  doc.text('RECORRÊNCIA MENSAL ATIVA'.split('').join(' '), 40 + bW + 12 + bW / 2, y + 20, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(GOLD);
  doc.text(fmtBRL(totalUnico), 40 + bW / 2, y + 44, { align: 'center' });
  doc.text(`${fmtBRL(totalMensal)}/mês`, 40 + bW + 12 + bW / 2, y + 44, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text('Números + Hospedagem', 40 + bW / 2, y + 60, { align: 'center' });
  doc.text('Seguro + Manutenção', 40 + bW + 12 + bW / 2, y + 60, { align: 'center' });

  // -------- PAGE 2 (detalhe) --------
  doc.addPage();
  paintBg(doc);
  header(doc);

  sectionTitle(doc, 110, 'O Que Você Adquiriu');

  let dy = 140;
  const all = [
    ...data.itens_unicos.map((i) => ({ ...i, recorrente: false })),
    ...data.itens_mensais.map((i) => ({ ...i, recorrente: true })),
  ];

  all.forEach((it, idx) => {
    if (dy > 720) {
      footer(doc, 2, 3);
      doc.addPage();
      paintBg(doc);
      header(doc);
      sectionTitle(doc, 110, 'O Que Você Adquiriu (continuação)');
      dy = 140;
    }

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(WHITE);
    const title = it.recorrente ? `${it.nome} — mensal` : it.nome;
    doc.text(title, 40, dy);

    // # index
    doc.setFontSize(8);
    doc.setTextColor(GOLD);
    doc.text(`#${String(idx + 1).padStart(2, '0')}`, W - 40, dy, { align: 'right' });

    dy += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(GOLD);
    const valStr = it.recorrente
      ? `${it.quantidade} ${it.unidade_label ?? 'núm.'} · ${fmtBRL(it.valor_unitario)}/${(it.unidade_label ?? 'núm.').replace('.', '')}/mês · Total: ${fmtBRL(it.quantidade * it.valor_unitario)}/mês`
      : `${it.quantidade} ${it.unidade_label ?? 'un.'} · ${fmtBRL(it.valor_unitario)}/${(it.unidade_label ?? 'un.').replace('.', '')} · Total: ${fmtBRL(it.quantidade * it.valor_unitario)}`;
    doc.text(valStr, 40, dy);

    dy += 14;
    // Description
    if (it.descricao) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(LIGHT);
      const lines = doc.splitTextToSize(it.descricao, W - 80);
      doc.text(lines, 40, dy);
      dy += lines.length * 12;
    }

    // Bullets
    if (it.bullets && it.bullets.length) {
      dy += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GOLD);
      const bx = [40, 40 + (W - 80) / 3, 40 + ((W - 80) / 3) * 2];
      it.bullets.slice(0, 3).forEach((b, i) => {
        doc.text(b, bx[i], dy);
      });
      dy += 14;
    }

    dy += 18;
    // Divider
    doc.setDrawColor(CARD_BORDER);
    doc.setLineWidth(0.3);
    doc.line(40, dy - 8, W - 40, dy - 8);
  });

  // Closing message
  dy += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT);
  doc.text('Ficou com alguma dúvida? Estamos à disposição.', 40, dy);
  dy += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text('www.astroscomunicacaodigital.com  ·  wa.me/message/2BTTLFPLWDDDE1', 40, dy);
  dy += 12;
  doc.setTextColor(GOLD_SOFT);
  doc.text('Desde 2020 gerando resultados reais para nossos clientes.', 40, dy);

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    footer(doc, p, totalPages);
  }

  return doc;
}
