import jsPDF from 'jspdf';

// === Cores Astros ===
const NAVY = '#0B1733';
const CARD = '#16244A';
const CARD_BORDER = '#22325C';
const GOLD = '#D4A84B';
const GOLD_SOFT = '#B98F39';
const WHITE = '#FFFFFF';
const LIGHT = '#C9D2E4';
const MUTED = '#8B97B5';
const SUCCESS = '#34D399';
const DANGER = '#F87171';
const WARN = '#FBBF24';

export type ProductType =
  | 'numeros'
  | 'hospedagem'
  | 'seguro_manutencao'
  | 'ferramenta_software'
  | 'social_media'
  | 'software_mensal'
  | 'outro';

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  numeros: 'Números (WhatsApp / Chips)',
  hospedagem: 'Hospedagem',
  seguro_manutencao: 'Seguro + Manutenção',
  ferramenta_software: 'Acesso a Ferramenta / Software',
  social_media: 'Serviço de Social Media',
  software_mensal: 'Software Mensal',
  outro: 'Outro',
};

const UNIT_BY_TYPE: Record<ProductType, string> = {
  numeros: 'núm.',
  hospedagem: 'un.',
  seguro_manutencao: 'un.',
  ferramenta_software: 'acesso',
  social_media: 'serviço',
  software_mensal: 'licença',
  outro: 'un.',
};

export const unidadeForType = (t: ProductType) => UNIT_BY_TYPE[t] ?? 'un.';

export type StatusRenovacao = 'em_dia' | 'proxima' | 'atrasada' | 'unico';

export interface ExtratoItemV2 {
  nome: string;
  product_type: ProductType;
  quantidade: number;
  valor_unitario: number;
  unidade_label?: string;
  data_compra?: string | null; // ISO yyyy-mm-dd
  data_renovacao?: string | null; // ISO
  status?: StatusRenovacao;
  ciclo_label?: string; // "mensal", "anual"
  descricao?: string;
}

export interface ExtratoDataV2 {
  cliente_nome: string;
  referencia: string;
  itens_unicos: ExtratoItemV2[];
  itens_mensais: ExtratoItemV2[];
  total_investido_historico?: number; // somatório consolidado já pago
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d.length <= 10 ? `${d}T00:00:00` : d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusInfo = (s?: StatusRenovacao) => {
  switch (s) {
    case 'atrasada': return { label: 'Atrasada', color: DANGER };
    case 'proxima': return { label: 'Renova em breve', color: WARN };
    case 'em_dia': return { label: 'Em dia', color: SUCCESS };
    case 'unico': return { label: 'Pagamento único', color: GOLD };
    default: return { label: '—', color: MUTED };
  }
};

function paintBg(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(NAVY);
  doc.rect(0, 0, w, h, 'F');
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

  const badgeText = 'EXTRATO DE INVESTIMENTO';
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
  doc.text('ASTROS COMUNICAÇÃO DIGITAL  ·  Confidencial', 40, h - 24);
  doc.text(`${page} / ${total}`, w - 40, h - 24, { align: 'right' });
}

function sectionTitle(doc: jsPDF, y: number, label: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(GOLD);
  const spaced = label.toUpperCase().split('').join(' ');
  doc.text(spaced, 40, y);
  doc.setDrawColor(CARD_BORDER);
  doc.setLineWidth(0.4);
  doc.line(40, y + 6, w - 40, y + 6);
}

function kpiCard(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, value: string, sub: string, highlight = false) {
  doc.setFillColor(CARD);
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setDrawColor(highlight ? GOLD : CARD_BORDER);
  doc.setLineWidth(highlight ? 1 : 0.6);
  doc.roundedRect(x, y, w, h, 6, 6, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text(title.toUpperCase().split('').join(' '), x + w / 2, y + 22, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(highlight ? GOLD : WHITE);
  doc.text(value, x + w / 2, y + 48, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(sub, x + w / 2, y + 66, { align: 'center' });
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + need > h - 60) {
    doc.addPage();
    paintBg(doc);
    header(doc);
    return 110;
  }
  return y;
}

function drawItemBlock(doc: jsPDF, y: number, it: ExtratoItemV2, recorrente: boolean): number {
  const W = doc.internal.pageSize.getWidth();

  // Descrição (observação para o cliente) — pode ocupar várias linhas
  const descLines = it.descricao && it.descricao.trim()
    ? doc.splitTextToSize(it.descricao.trim(), W - 120)
    : [];
  const descHeight = descLines.length > 0 ? 10 + descLines.length * 10 : 0;
  const cardHeight = 70 + descHeight;

  y = ensureSpace(doc, y, cardHeight + 8);

  // card
  doc.setFillColor(CARD);
  doc.roundedRect(40, y, W - 80, cardHeight, 6, 6, 'F');
  doc.setDrawColor(CARD_BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(40, y, W - 80, cardHeight, 6, 6, 'S');

  // gold accent bar
  doc.setFillColor(GOLD);
  doc.rect(40, y, 3, cardHeight, 'F');

  // tipo badge
  const typeLabel = PRODUCT_TYPE_LABEL[it.product_type] ?? 'Outro';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(GOLD);
  doc.text(typeLabel.toUpperCase(), 54, y + 16);

  // nome
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(WHITE);
  const nomeStr = doc.splitTextToSize(it.nome || '(sem nome)', W - 280)[0];
  doc.text(nomeStr, 54, y + 32);

  // unit info
  const unidade = it.unidade_label || unidadeForType(it.product_type);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT);
  const linhaQtd = `${it.quantidade} ${unidade}  ·  ${fmtBRL(it.valor_unitario)}/${unidade.replace('.', '')}${recorrente ? '/mês' : ''}`;
  doc.text(linhaQtd, 54, y + 48);

  // datas / status
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  const parts: string[] = [];
  if (it.data_compra) parts.push(`Compra: ${fmtDate(it.data_compra)}`);
  if (recorrente && it.data_renovacao) parts.push(`Próx. renovação: ${fmtDate(it.data_renovacao)}`);
  if (recorrente && it.ciclo_label) parts.push(`Ciclo: ${it.ciclo_label}`);
  if (!recorrente) parts.push('Tipo: Pagamento único');
  if (parts.length) doc.text(parts.join('  ·  '), 54, y + 62);

  // descrição (observação para cliente) — abaixo do bloco principal
  if (descLines.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(LIGHT);
    let dy = y + 80;
    descLines.forEach((line: string) => {
      doc.text(line, 54, dy);
      dy += 10;
    });
  }

  // total à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(GOLD);
  const total = it.quantidade * it.valor_unitario;
  doc.text(`${fmtBRL(total)}${recorrente ? '/mês' : ''}`, W - 54, y + 32, { align: 'right' });

  // status pill
  const st = statusInfo(it.status ?? (recorrente ? 'em_dia' : 'unico'));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const stw = doc.getTextWidth(st.label) + 16;
  doc.setFillColor(st.color);
  doc.roundedRect(W - 54 - stw, y + 46, stw, 14, 3, 3, 'F');
  doc.setTextColor(NAVY);
  doc.text(st.label.toUpperCase(), W - 54 - stw / 2, y + 56, { align: 'center' });

  return y + cardHeight + 8;
}

function totalRow(doc: jsPDF, y: number, label: string, value: string) {
  const W = doc.internal.pageSize.getWidth();
  y = ensureSpace(doc, y, 30);
  doc.setFillColor(GOLD);
  doc.roundedRect(40, y - 14, W - 80, 22, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY);
  doc.text(label, 56, y);
  doc.text(value, W - 56, y, { align: 'right' });
  return y + 18;
}

export function gerarExtratoInvestimentoPDF(data: ExtratoDataV2): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  paintBg(doc);
  header(doc);

  // Greeting
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT);
  doc.text('Prezado(a),', 40, 110);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(WHITE);
  doc.text(data.cliente_nome || '—', 40, 140);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`Emitido em ${fmtDate(new Date())}  ·  Referência: ${data.referencia || '—'}`, 40, 158);

  // KPIs
  const totalUnico = data.itens_unicos.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  const totalMensal = data.itens_mensais.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  const renovAtivas = data.itens_mensais.length;
  const pendencias = data.itens_mensais.filter(i => i.status === 'atrasada').length;
  const proximas = data.itens_mensais.filter(i => i.status === 'proxima').length;
  const totalInvestido = data.total_investido_historico ?? totalUnico;

  sectionTitle(doc, 195, 'Resumo Consolidado');
  const cardY = 215;
  const cardH = 88;
  const cardW = (W - 80 - 36) / 4;
  kpiCard(doc, 40, cardY, cardW, cardH, 'Total Investido', fmtBRL(totalInvestido), 'pagamento realizado', true);
  kpiCard(doc, 40 + (cardW + 12) * 1, cardY, cardW, cardH, 'Recorrência Mensal', `${fmtBRL(totalMensal)}/mês`, `${renovAtivas} ativa(s)`);
  kpiCard(doc, 40 + (cardW + 12) * 2, cardY, cardW, cardH, 'Pendências', String(pendencias), 'atrasadas');
  kpiCard(doc, 40 + (cardW + 12) * 3, cardY, cardW, cardH, 'Próx. Renovações', String(proximas), 'em até 7 dias');

  let y = cardY + cardH + 32;

  // Únicos
  if (data.itens_unicos.length) {
    sectionTitle(doc, y, 'Aquisição Única — Pagamento Realizado');
    y += 18;
    data.itens_unicos.forEach((it) => { y = drawItemBlock(doc, y, it, false); });
    y += 4;
    y = totalRow(doc, y, 'Total Pagamento Único', fmtBRL(totalUnico));
    y += 16;
  }

  // Mensais
  if (data.itens_mensais.length) {
    y = ensureSpace(doc, y, 40);
    sectionTitle(doc, y, 'Serviços Recorrentes Mensais');
    y += 18;
    data.itens_mensais.forEach((it) => { y = drawItemBlock(doc, y, it, true); });
    y += 4;
    y = totalRow(doc, y, 'Total Mensal Recorrente', `${fmtBRL(totalMensal)}/mês`);
    y += 16;
  }

  // Próximas renovações (lista simples)
  const futuras = data.itens_mensais
    .filter(i => i.data_renovacao)
    .sort((a, b) => (a.data_renovacao! < b.data_renovacao! ? -1 : 1))
    .slice(0, 6);

  if (futuras.length) {
    y = ensureSpace(doc, y, 60 + futuras.length * 18);
    sectionTitle(doc, y, 'Próximas Renovações');
    y += 22;
    futuras.forEach((it) => {
      const st = statusInfo(it.status);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(WHITE);
      doc.text(it.nome, 40, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(LIGHT);
      doc.text(fmtDate(it.data_renovacao), W / 2, y, { align: 'center' });
      doc.setTextColor(st.color);
      doc.text(st.label, W - 40, y, { align: 'right' });
      doc.setDrawColor(CARD_BORDER);
      doc.setLineWidth(0.2);
      doc.line(40, y + 4, W - 40, y + 4);
      y += 18;
    });
  }

  // Closing
  y = ensureSpace(doc, y, 80);
  y += 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT);
  doc.text('Ficou com alguma dúvida? Estamos à disposição.', 40, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text('www.astroscomunicacaodigital.com  ·  wa.me/message/2BTTLFPLWDDDE1', 40, y);
  y += 12;
  doc.setTextColor(GOLD_SOFT);
  doc.text('Desde 2020 gerando resultados reais para nossos clientes.', 40, y);

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    footer(doc, p, totalPages);
  }

  return doc;
}

// Compat: tipo antigo
export type ExtratoItem = ExtratoItemV2;
