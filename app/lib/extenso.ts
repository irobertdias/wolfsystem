// Valor em reais por extenso (pt-BR), ex.: 1500.5 → "mil e quinhentos reais e cinquenta centavos".

const UN = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEM = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CEM[c]);
  if (r) {
    if (r < 20) partes.push(UN[r]);
    else { const d = Math.floor(r / 10), u = r % 10; partes.push(u ? `${DEZ[d]} e ${UN[u]}` : DEZ[d]); }
  }
  return partes.join(" e ");
}

function inteiro(n: number): string {
  if (n === 0) return "zero";
  const grupos: [number, string, string][] = [[1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"], [1e3, "mil", "mil"]];
  // cada grupo com o seu valor (para decidir o "e" de ligação)
  const partes: { txt: string; val: number }[] = [];
  let resto = n;
  for (const [base, sing, plur] of grupos) {
    const q = Math.floor(resto / base);
    if (q) {
      partes.push({ txt: base === 1e3 && q === 1 ? "mil" : `${ate999(q)} ${q === 1 ? sing : plur}`, val: q });
      resto %= base;
    }
  }
  if (resto) partes.push({ txt: ate999(resto), val: resto });
  // "e" antes de um grupo menor que 100 ou centena redonda (mil e quinhentos, dois milhões e quinhentos mil)
  return partes.map((p, i) => (i === 0 ? p.txt : (p.val < 100 || p.val % 100 === 0 ? ` e ${p.txt}` : ` ${p.txt}`))).join("");
}

export function reaisPorExtenso(valor: number): string {
  const v = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(v / 100), centavos = v % 100;
  const partes: string[] = [];
  if (reais > 0) {
    const t = inteiro(reais);
    const de = /(milhão|milhões|bilhão|bilhões)$/.test(t) ? " de" : "";
    partes.push(`${t}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) partes.push(`${inteiro(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero reais";
}
