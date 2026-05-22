// Converte um valor monetário (number) para texto por extenso, em vários idiomas/moedas.
// Suporta valores até 999.999.999,99.

// ============ pt-BR / BRL ============
const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) parts.push(UNIDADES[resto]);
    else if (resto < 20) parts.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      parts.push(u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`);
    }
  }
  return parts.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (milhoes > 0) parts.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (milhares > 0) parts.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto > 0) parts.push(ate999(resto));
  return parts.join(" e ");
}

export function valorPorExtensoBRL(valor: number | string): string {
  const num = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return "";
  const inteiros = Math.floor(num);
  const centavos = Math.round((num - inteiros) * 100);
  const partes: string[] = [];
  if (inteiros > 0) {
    partes.push(`${inteiroPorExtenso(inteiros)} ${inteiros === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  if (partes.length === 0) return "zero real";
  return partes.join(" e ");
}

// ============ en-US (USD) ============
const EN_UNITS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const EN_TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enUnder1000(n: number): string {
  if (n === 0) return "";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h > 0) parts.push(`${EN_UNITS[h]} hundred`);
  if (r > 0) {
    if (r < 10) parts.push(EN_UNITS[r]);
    else if (r < 20) parts.push(EN_TEENS[r - 10]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u === 0 ? EN_TENS[d] : `${EN_TENS[d]}-${EN_UNITS[u]}`);
    }
  }
  return parts.join(" ");
}

function enInteger(n: number): string {
  if (n === 0) return "zero";
  const mi = Math.floor(n / 1_000_000);
  const th = Math.floor((n % 1_000_000) / 1000);
  const r = n % 1000;
  const parts: string[] = [];
  if (mi > 0) parts.push(`${enUnder1000(mi)} million`);
  if (th > 0) parts.push(`${enUnder1000(th)} thousand`);
  if (r > 0) parts.push(enUnder1000(r));
  return parts.join(" ");
}

export function valorPorExtensoUSD(valor: number | string): string {
  const num = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return "";
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);
  const parts: string[] = [];
  if (dollars > 0) parts.push(`${enInteger(dollars)} ${dollars === 1 ? "dollar" : "dollars"}`);
  if (cents > 0) parts.push(`${enInteger(cents)} ${cents === 1 ? "cent" : "cents"}`);
  if (parts.length === 0) return "zero dollars";
  return parts.join(" and ");
}

export function valorPorExtensoEUR(valor: number | string): string {
  const num = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return "";
  const eur = Math.floor(num);
  const cents = Math.round((num - eur) * 100);
  const parts: string[] = [];
  if (eur > 0) parts.push(`${enInteger(eur)} ${eur === 1 ? "euro" : "euros"}`);
  if (cents > 0) parts.push(`${enInteger(cents)} ${cents === 1 ? "cent" : "cents"}`);
  if (parts.length === 0) return "zero euros";
  return parts.join(" and ");
}

// ============ Dispatcher ============
export type MoedaExtenso = "BRL" | "USD" | "EUR";

export function valorPorExtenso(valor: number | string, moeda: MoedaExtenso = "BRL"): string {
  switch (moeda) {
    case "USD": return valorPorExtensoUSD(valor);
    case "EUR": return valorPorExtensoEUR(valor);
    default: return valorPorExtensoBRL(valor);
  }
}

// Formatação de moeda (numérico + símbolo) por moeda
export function formatMoeda(valor: number | string, moeda: MoedaExtenso = "BRL"): string {
  const num = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(num)) return String(valor ?? "");
  const locale = moeda === "BRL" ? "pt-BR" : "en-US";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: moeda }).format(num);
  } catch {
    const sym = moeda === "BRL" ? "R$" : moeda === "USD" ? "$" : "€";
    return `${sym} ${num.toFixed(2)}`;
  }
}
