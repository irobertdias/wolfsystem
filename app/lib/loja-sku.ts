// SKU automático dos produtos das lojas: prefixo da categoria + sequência.
// Ex.: Periféricos → PER-0007; Vestidos → VES-0012. Variantes de roupa: VES-0012-M-PRE.

const limpa = (s?: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export function prefixoSku(categoria?: string) {
  const p = limpa(categoria).slice(0, 3);
  return p.length >= 2 ? p : "PRD";
}

/** Próximo SKU livre da categoria, olhando os SKUs já cadastrados. */
export function gerarSku(categoria: string | undefined, produtos: { sku?: string }[]) {
  const pre = prefixoSku(categoria);
  const re = new RegExp(`^${pre}-(\\d+)$`);
  const maior = produtos.reduce((m, p) => { const x = String(p.sku || "").match(re); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `${pre}-${String(maior + 1).padStart(4, "0")}`;
}

export const skuVariante = (sku: string, tamanho?: string, cor?: string) => [sku, limpa(tamanho), limpa(cor).slice(0, 3)].filter(Boolean).join("-");
