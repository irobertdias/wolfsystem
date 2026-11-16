// ═══════════════════════════════════════════════════════════════════════
// Orçamento/pedido das lojas (Informática, Vendas, Roupas): dados da empresa,
// link público de aceite e PDF. O pedido continua na tabela `proposta`
// (dados_customizados.pedido); o link usa pedido.link_token.
// ═══════════════════════════════════════════════════════════════════════

export type EmpresaLoja = {
  nome?: string;          // razão social / nome fantasia
  cnpj?: string;
  ie?: string;            // inscrição estadual
  endereco?: string;
  cidade?: string;        // "Goiânia/GO"
  cep?: string;
  telefone?: string;
  email?: string;
  site?: string;
  logo?: string;          // data URL (redimensionada no navegador)
  condicoes?: string;     // texto padrão impresso no rodapé do orçamento
  cor?: string;           // cor principal da marca (#hex) — PDF e link
  cor2?: string;          // cor de destaque da marca (#hex)
};

/** Frete das lojas: fixo (taxa única) ou calculado pelo CEP (Correios com contrato ou tabela padrão Sedex/PAC). */
export type FreteConfig = {
  modo?: "fixo" | "calculado";
  cep_origem?: string;
  peso_padrao_kg?: number;                // por unidade de produto sem peso cadastrado
  embalagem?: { comprimento: number; largura: number; altura: number }; // cm
  servicos?: ("SEDEX" | "PAC")[];
  adicional?: number;                     // manuseio/embalagem somado ao frete
  gratis_acima?: number;                  // frete grátis a partir deste subtotal
  tabela?: { local: number; estadual: number; regional: number; nacional: number; kg_adicional: number };
  correios?: { usuario?: string; codigo_acesso?: string; cartao?: string; contrato?: string; dr?: string };
};
export type OpcaoFrete = { servico: string; valor: number; prazo?: string; fonte: "correios" | "tabela" | "fixo" };
export const TABELA_SEDEX_PADRAO = { local: 18, estadual: 26, regional: 38, nacional: 55, kg_adicional: 6 };

/** "#1d6fa5" → [29,111,165] */
export function hexRgb(hex?: string, padrao: [number, number, number] = [15, 23, 42]): [number, number, number] {
  const h = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) return padrao;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const rgbHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
/** Mistura a cor com branco (k = 0..1 de branco) para fundos claros. */
export const clarear = (c: [number, number, number], k: number): [number, number, number] => c.map((x) => x + (255 - x) * k) as any;

/** As duas cores mais marcantes da logo (ignora branco, preto e cinzas). */
export function coresDaLogo(dataUrl: string): Promise<{ cor?: string; cor2?: string }> {
  return new Promise((ok) => {
    const img = new Image();
    img.onerror = () => ok({});
    img.onload = () => {
      const k = Math.min(1, 120 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, c.width, c.height);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const baldes = new Map<string, { n: number; w: number; r: number; g: number; b: number; h: number }>();
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        if (a < 200) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510, s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
        if (s < 0.35 || l < 0.12 || l > 0.88) continue;
        let h = 0; const d = max - min;
        if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
        const chave = String(Math.round(h / 20));
        // pesa mais os pixels fortes (saturados e de luz média): evita tom lavado das bordas
        const w = s ** 2 * Math.max(0, 1 - Math.abs(l - 0.35) * 2) ** 3;
        const x = baldes.get(chave) || { n: 0, w: 0, r: 0, g: 0, b: 0, h };
        x.n++; x.w += w; x.r += r * w; x.g += g * w; x.b += b * w; baldes.set(chave, x);
      }
      const ord = [...baldes.values()].filter((x) => x.n > 8).sort((a, b) => b.n - a.n);
      const cor = (x?: typeof ord[0]) => (x && x.w > 0 ? rgbHex(x.r / x.w, x.g / x.w, x.b / x.w) : undefined);
      const segundo = ord.slice(1).find((x) => Math.min(Math.abs(x.h - ord[0].h), 360 - Math.abs(x.h - ord[0].h)) > 40);
      ok({ cor: cor(ord[0]), cor2: cor(segundo) });
    };
    img.src = dataUrl;
  });
}

export type ItemDoc = { nome: string; qtd: number; preco: number; detalhe?: string };
export type DocPedido = {
  empresa: EmpresaLoja;
  tipo: "orcamento" | "pedido";
  numero: string;
  data: string;           // ISO
  validade?: string;      // ISO (orçamento)
  cliente: { nome: string; documento?: string; telefone?: string; email?: string; endereco?: string };
  itens: ItemDoc[];
  desconto?: number;
  frete?: number;
  entrega?: string;
  pagamento?: string;
  observacoes?: string;
  link?: string;
};

/** Monta o documento (PDF) a partir do formulário de pedido/orçamento das lojas. */
export function docDoFormulario(form: { nome: string; telefone1: string; cpf?: string; email?: string; endereco?: string; cidade?: string; estado?: string; d: any }, atual: { id: number; created_at: string; data_proposta?: string | null } | null, emp: EmpresaLoja, link?: string): DocPedido {
  const d = form.d;
  const retirada = d.entrega !== "entrega";
  return {
    empresa: emp,
    tipo: d.tipo === "orcamento" ? "orcamento" : "pedido",
    numero: String(d.numero || atual?.id || "novo"),
    data: atual?.data_proposta || atual?.created_at || new Date().toISOString(),
    validade: d.tipo === "orcamento" ? d.validade : undefined,
    cliente: { nome: form.nome, documento: form.cpf, telefone: form.telefone1, email: form.email, endereco: [form.endereco, form.cidade, form.estado].filter(Boolean).join(" · ") },
    itens: (d.itens || []).map((i: any) => ({ nome: i.nome, qtd: n(i.qtd), preco: n(i.preco), detalhe: [i.tamanho, i.cor, i.serie ? `S/N ${i.serie}` : "", i.garantia_meses ? `garantia ${i.garantia_meses} meses` : ""].filter(Boolean).join(" · ") })),
    desconto: n(d.desconto), frete: retirada ? 0 : n(d.frete),
    entrega: d.entrega === "entrega" ? `Entrega no endereço${d.servico_frete ? ` (${d.servico_frete}${d.prazo_frete ? `, ${d.prazo_frete}` : ""})` : ""}` : "Retirada na loja",
    pagamento: d.pagamento, observacoes: d.observacoes, link,
  };
}

export const n = (v: any) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
export const brlDoc = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const subtotalDoc = (itens: ItemDoc[]) => itens.reduce((s, i) => s + n(i.qtd) * n(i.preco), 0);
export const totalDoc = (d: Pick<DocPedido, "itens" | "desconto" | "frete">) => Math.max(0, subtotalDoc(d.itens) - n(d.desconto) + n(d.frete));
export const cnpjFmt = (v?: string) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : String(v || ""); };
const dataBr = (iso?: string) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "");

/** Token aleatório do link público (48 caracteres, url-safe). */
export function novoToken() {
  const b = new Uint8Array(36); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const linkPublicoPedido = (token: string) => `${typeof window !== "undefined" ? window.location.origin : "https://app.wolfgyn.com.br"}/pedido/${token}`;

/** Reduz a logo enviada para caber na configuração (máx. 360px, PNG). */
export function reduzirLogo(arquivo: File, max = 360): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onerror = () => falha(new Error("Não foi possível ler a imagem"));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error("Imagem inválida"));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/png"));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(arquivo);
  });
}

/** Gera o PDF (A4) do orçamento/pedido nas cores da empresa e baixa no navegador. */
export async function baixarPdfPedido(d: DocPedido, corForcada?: [number, number, number]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14;
  const cor = corForcada || hexRgb(d.empresa.cor, [15, 23, 42]);
  const cor2 = hexRgb(d.empresa.cor2, cor);
  const claro = clarear(cor, 0.9), clarinho = clarear(cor, 0.96);
  const cinza: [number, number, number] = [100, 116, 139];
  const tinta: [number, number, number] = [15, 23, 42];

  // faixa da marca no topo
  doc.setFillColor(...cor); doc.rect(0, 0, W, 7, "F");
  doc.setFillColor(...cor2); doc.rect(0, 7, W, 1.6, "F");
  let y = 18;

  // ── cabeçalho da empresa ──
  let xTexto = M;
  if (d.empresa.logo) {
    try {
      const p = doc.getImageProperties(d.empresa.logo);
      const h = 26, w = Math.min(52, (p.width / p.height) * h);
      doc.addImage(d.empresa.logo, "PNG", M, y - 4, w, h);
      xTexto = M + w + 6;
    } catch {}
  }
  doc.setTextColor(...cor); doc.setFont("helvetica", "bold"); doc.setFontSize(14.5);
  doc.text(doc.splitTextToSize(d.empresa.nome || "Empresa", 84) as string[], xTexto, y + 2);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor(...cinza);
  const linhasEmp = [
    [d.empresa.cnpj ? `CNPJ ${cnpjFmt(d.empresa.cnpj)}` : "", d.empresa.ie ? `IE ${d.empresa.ie}` : ""].filter(Boolean).join("  ·  "),
    ...(doc.splitTextToSize([d.empresa.endereco, d.empresa.cidade, d.empresa.cep ? `CEP ${d.empresa.cep}` : ""].filter(Boolean).join(" · "), 84) as string[]),
    [d.empresa.telefone, d.empresa.email].filter(Boolean).join("  ·  "),
    d.empresa.site || "",
  ].filter(Boolean);
  linhasEmp.forEach((l, i) => doc.text(l, xTexto, y + 8 + i * 4));

  // caixa com tipo e número
  doc.setFillColor(...cor); doc.roundedRect(W - M - 50, y - 4, 50, 27, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(d.tipo === "orcamento" ? "ORÇAMENTO" : "PEDIDO", W - M - 25, y + 2.5, { align: "center" });
  doc.setFontSize(15); doc.text(`Nº ${d.numero}`, W - M - 25, y + 10, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
  doc.text(`Emitido em ${dataBr(d.data)}`, W - M - 25, y + 15.5, { align: "center" });
  if (d.validade) { doc.setFont("helvetica", "bold"); doc.text(`Válido até ${dataBr(d.validade)}`, W - M - 25, y + 20, { align: "center" }); }
  y = Math.max(y + 8 + linhasEmp.length * 4, y + 25) + 6;

  // ── cliente ──
  doc.setFillColor(...clarinho); doc.roundedRect(M, y, W - 2 * M, 20, 2.5, 2.5, "F");
  doc.setFillColor(...cor); doc.rect(M, y, 1.4, 20, "F");
  doc.setTextColor(...cor); doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.text("CLIENTE", M + 5, y + 5.5);
  doc.setTextColor(...tinta); doc.setFontSize(11); doc.text(d.cliente.nome || "-", M + 5, y + 11);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor(...cinza);
  const linhaCli = [d.cliente.documento ? `CPF/CNPJ ${cnpjFmt(d.cliente.documento)}` : "", d.cliente.telefone, d.cliente.email, d.cliente.endereco].filter(Boolean).join("  ·  ");
  if (linhaCli) doc.text(doc.splitTextToSize(linhaCli, W - 2 * M - 10)[0], M + 5, y + 16);
  y += 29;

  // ── itens ──
  const cols = [M, M + 104, M + 124, M + 154];
  doc.setFillColor(...claro); doc.roundedRect(M, y - 5.5, W - 2 * M, 9, 1.5, 1.5, "F");
  doc.setTextColor(...cor); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("DESCRIÇÃO", cols[0] + 3, y); doc.text("QTD", cols[1] + 8, y, { align: "center" }); doc.text("UNITÁRIO", cols[2] + 26, y, { align: "right" }); doc.text("TOTAL", W - M - 3, y, { align: "right" });
  y += 8; doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  d.itens.forEach((it, k) => {
    const linhas = doc.splitTextToSize(it.nome, 98) as string[];
    const det = it.detalhe ? (doc.splitTextToSize(it.detalhe, 98) as string[]) : [];
    const alt = linhas.length * 4.4 + det.length * 3.8 + 3;
    if (y + alt > 255) { doc.addPage(); doc.setFillColor(...cor); doc.rect(0, 0, W, 4, "F"); y = 18; }
    if (k % 2 === 1) { doc.setFillColor(...clarinho); doc.rect(M, y - 4.6, W - 2 * M, alt, "F"); }
    doc.setTextColor(...tinta); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    doc.text(linhas, cols[0] + 3, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(n(it.qtd)), cols[1] + 8, y, { align: "center" });
    doc.text(brlDoc(n(it.preco)), cols[2] + 26, y, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.text(brlDoc(n(it.qtd) * n(it.preco)), W - M - 3, y, { align: "right" });
    if (det.length) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...cinza); doc.text(det, cols[0] + 3, y + linhas.length * 4.4); }
    y += alt;
  });

  // ── totais ──
  y += 4;
  if (y > 235) { doc.addPage(); y = 20; }
  const xT = W - M - 70;
  const tot = (rot: string, v: string) => { doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...cinza); doc.text(rot, xT + 3, y); doc.setTextColor(...tinta); doc.text(v, W - M - 3, y, { align: "right" }); y += 5.4; };
  tot("Subtotal", brlDoc(subtotalDoc(d.itens)));
  if (n(d.desconto)) tot("Desconto", "- " + brlDoc(n(d.desconto)));
  if (n(d.frete)) tot("Frete / entrega", brlDoc(n(d.frete)));
  doc.setFillColor(...cor); doc.roundedRect(xT, y - 3, 70, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("TOTAL", xT + 4, y + 4.6);
  doc.setFontSize(13.5); doc.text(brlDoc(totalDoc(d)), W - M - 4, y + 4.8, { align: "right" });
  y += 18;

  // ── condições ──
  const cond = [d.pagamento ? `Forma de pagamento: ${d.pagamento}` : "", d.entrega ? `Entrega: ${d.entrega}` : "", d.observacoes || "", d.empresa.condicoes || ""].filter(Boolean);
  if (cond.length) {
    if (y > 245) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...cor); doc.text("CONDIÇÕES", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...tinta);
    for (const c of cond) { const l = doc.splitTextToSize(c, W - 2 * M) as string[]; doc.text(l, M, y); y += l.length * 4.4 + 1.5; }
  }
  if (d.link) {
    y = Math.min(y + 4, 272);
    doc.setFillColor(...clarear(cor2, 0.88)); doc.roundedRect(M, y - 5, W - 2 * M, 10, 2, 2, "F");
    doc.setFontSize(9); doc.setTextColor(...cor2); doc.setFont("helvetica", "bold");
    doc.textWithLink("Aprovar este orçamento online: clique aqui", M + 4, y + 1.2, { url: d.link });
  }
  // rodapé da marca
  doc.setFillColor(...cor); doc.rect(0, H - 10, W, 10, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
  doc.text([d.empresa.nome || "", d.empresa.cnpj ? "CNPJ " + cnpjFmt(d.empresa.cnpj) : "", d.empresa.telefone || "", d.empresa.site || ""].filter(Boolean).join("  ·  "), W / 2, H - 4, { align: "center" });

  doc.save(`${d.tipo === "orcamento" ? "orcamento" : "pedido"}-${d.numero}.pdf`);
}