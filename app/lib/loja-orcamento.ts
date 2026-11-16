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
};

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

/** Gera o PDF (A4) do orçamento/pedido e baixa no navegador. */
export async function baixarPdfPedido(d: DocPedido, cor: [number, number, number] = [15, 23, 42]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14;
  const cinza: [number, number, number] = [100, 116, 139];
  const tinta: [number, number, number] = [15, 23, 42];
  let y = 14;

  // ── cabeçalho da empresa ──
  let xTexto = M;
  if (d.empresa.logo) {
    try {
      const p = doc.getImageProperties(d.empresa.logo);
      const h = 22, w = Math.min(50, (p.width / p.height) * h);
      doc.addImage(d.empresa.logo, "PNG", M, y - 2, w, h);
      xTexto = M + w + 6;
    } catch {}
  }
  doc.setTextColor(...tinta); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(d.empresa.nome || "Empresa", xTexto, y + 3);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...cinza);
  const linhasEmp = [
    [d.empresa.cnpj ? `CNPJ ${cnpjFmt(d.empresa.cnpj)}` : "", d.empresa.ie ? `IE ${d.empresa.ie}` : ""].filter(Boolean).join("  ·  "),
    [d.empresa.endereco, d.empresa.cidade, d.empresa.cep ? `CEP ${d.empresa.cep}` : ""].filter(Boolean).join(" · "),
    [d.empresa.telefone, d.empresa.email, d.empresa.site].filter(Boolean).join("  ·  "),
  ].filter(Boolean);
  linhasEmp.forEach((l, i) => doc.text(l, xTexto, y + 9 + i * 4.2));

  // caixa com tipo e número
  doc.setFillColor(...cor); doc.roundedRect(W - M - 52, y - 4, 52, 24, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(d.tipo === "orcamento" ? "ORÇAMENTO" : "PEDIDO", W - M - 26, y + 3, { align: "center" });
  doc.setFontSize(13); doc.text(`Nº ${d.numero}`, W - M - 26, y + 10, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Emitido em ${dataBr(d.data)}`, W - M - 26, y + 16, { align: "center" });
  y = Math.max(y + 9 + linhasEmp.length * 4.2, y + 24) + 6;
  doc.setDrawColor(226, 232, 240); doc.line(M, y, W - M, y); y += 7;

  // ── cliente ──
  doc.setTextColor(...cinza); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("CLIENTE", M, y);
  if (d.validade) doc.text("VALIDADE", W - M - 40, y);
  y += 5; doc.setTextColor(...tinta); doc.setFontSize(10.5); doc.text(d.cliente.nome || "-", M, y);
  if (d.validade) doc.text(dataBr(d.validade), W - M - 40, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...cinza);
  const linhasCli = [[d.cliente.documento ? `CPF/CNPJ ${cnpjFmt(d.cliente.documento)}` : "", d.cliente.telefone, d.cliente.email].filter(Boolean).join("  ·  "), d.cliente.endereco || ""].filter(Boolean);
  linhasCli.forEach((l) => { y += 4.5; doc.text(l, M, y); });
  y += 9;

  // ── itens ──
  const cols = [M, M + 104, M + 124, M + 154];
  doc.setFillColor(241, 245, 249); doc.rect(M, y - 5, W - 2 * M, 8, "F");
  doc.setTextColor(...cinza); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("DESCRIÇÃO", cols[0] + 2, y); doc.text("QTD", cols[1] + 8, y, { align: "center" }); doc.text("UNITÁRIO", cols[2] + 26, y, { align: "right" }); doc.text("TOTAL", W - M - 2, y, { align: "right" });
  y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  for (const it of d.itens) {
    const linhas = doc.splitTextToSize(it.nome + (it.detalhe ? ` (${it.detalhe})` : ""), 98) as string[];
    if (y + linhas.length * 4.6 > 262) { doc.addPage(); y = 20; }
    doc.setTextColor(...tinta);
    doc.text(linhas, cols[0] + 2, y);
    doc.text(String(n(it.qtd)), cols[1] + 8, y, { align: "center" });
    doc.text(brlDoc(n(it.preco)), cols[2] + 26, y, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.text(brlDoc(n(it.qtd) * n(it.preco)), W - M - 2, y, { align: "right" }); doc.setFont("helvetica", "normal");
    y += linhas.length * 4.6 + 2.4;
    doc.setDrawColor(241, 245, 249); doc.line(M, y - 3.2, W - M, y - 3.2);
  }

  // ── totais ──
  y += 3;
  const tot = (rot: string, v: string, forte = false) => {
    doc.setFont("helvetica", forte ? "bold" : "normal"); doc.setFontSize(forte ? 12 : 9.5); doc.setTextColor(...(forte ? tinta : cinza));
    doc.text(rot, W - M - 52, y); doc.text(v, W - M - 2, y, { align: "right" }); y += forte ? 7 : 5.2;
  };
  tot("Subtotal", brlDoc(subtotalDoc(d.itens)));
  if (n(d.desconto)) tot("Desconto", "- " + brlDoc(n(d.desconto)));
  if (n(d.frete)) tot("Frete / entrega", brlDoc(n(d.frete)));
  doc.setDrawColor(...cor); doc.line(W - M - 52, y - 3, W - M, y - 3); y += 2;
  tot("TOTAL", brlDoc(totalDoc(d)), true);

  // ── condições ──
  y += 4;
  const cond = [d.pagamento ? `Forma de pagamento: ${d.pagamento}` : "", d.entrega ? `Entrega: ${d.entrega}` : "", d.observacoes || "", d.empresa.condicoes || ""].filter(Boolean);
  if (cond.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...cinza); doc.text("CONDIÇÕES", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...tinta);
    for (const c of cond) { const l = doc.splitTextToSize(c, W - 2 * M) as string[]; doc.text(l, M, y); y += l.length * 4.4 + 1.5; }
  }
  if (d.link) {
    y += 3; doc.setFontSize(9); doc.setTextColor(...cor); doc.setFont("helvetica", "bold");
    doc.textWithLink("Aprovar este orçamento online: " + d.link, M, Math.min(y, 280), { url: d.link });
  }
  // rodapé
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...cinza);
  doc.text(`${d.empresa.nome || ""}${d.empresa.cnpj ? " · CNPJ " + cnpjFmt(d.empresa.cnpj) : ""}`, W / 2, 290, { align: "center" });

  doc.save(`${d.tipo === "orcamento" ? "orcamento" : "pedido"}-${d.numero}.pdf`);
}
