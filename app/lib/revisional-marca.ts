// Marca do escritório (logo + cores) aplicada no link e no PDF da proposta revisional.
// A partir de duas cores monta as escalas usadas na página (Tailwind v4 lê as cores
// de variáveis CSS, então trocar as variáveis re-tinge a página inteira) e no PDF.

export type MarcaRevisional = { logo?: string; cor?: string; cor2?: string };
type RGB = [number, number, number];

const HEX = /^#[0-9a-f]{6}$/i;
export const temMarca = (m?: MarcaRevisional | null) => !!m && (HEX.test(m.cor || "") || !!m.logo);

export function rgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const hex = (c: RGB) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const BRANCO: RGB = [255, 255, 255], PRETO: RGB = [0, 0, 0];

/** Escala de 50 a 900: tons claros puxados da cor de destaque, escuros da principal. */
function escala(m: MarcaRevisional) {
  const p = rgb(HEX.test(m.cor || "") ? m.cor! : "#059669");
  const a = rgb(HEX.test(m.cor2 || "") ? m.cor2! : hex(mix(p, BRANCO, 0.45)));
  return {
    50: mix(a, BRANCO, 0.88), 100: mix(a, BRANCO, 0.76), 200: mix(a, BRANCO, 0.58), 300: mix(a, BRANCO, 0.32), 400: a,
    500: mix(p, BRANCO, 0.18), 600: p, 700: mix(p, PRETO, 0.12), 800: mix(p, PRETO, 0.26), 900: mix(p, PRETO, 0.42),
  } as Record<number, RGB>;
}

/** Variáveis CSS que trocam o verde (emerald/teal) da página pelas cores da marca. */
export function varsMarca(m?: MarcaRevisional | null): Record<string, string> {
  if (!m || !HEX.test(m.cor || "")) return {};
  const e = escala(m);
  const vars: Record<string, string> = {};
  for (const k of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
    vars[`--color-emerald-${k}`] = hex(e[k]);
    // teal fica um pouco mais escuro, para os degradês terem profundidade
    vars[`--color-teal-${k}`] = hex(k >= 500 ? mix(e[k], PRETO, 0.12) : e[k]);
  }
  return vars;
}

/** Paleta do PDF (substitui os verdes do modelo). */
export function paletaPdf(m?: MarcaRevisional | null): Partial<Record<string, RGB>> {
  if (!m || !HEX.test(m.cor || "")) return {};
  const e = escala(m);
  return {
    verde900: e[900], verde800: e[800], verde700: e[700], verde600: e[600], verde500: e[500],
    verde100: e[100], verde50: e[50], teal700: mix(e[700], PRETO, 0.1), teal500: e[400],
  };
}
