// Converte um valor monetário (number) para texto por extenso em pt-BR.
// Ex: 450 -> "quatrocentos e cinquenta reais"
//     1234.56 -> "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"
// Suporta valores até 999.999.999,99.

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
