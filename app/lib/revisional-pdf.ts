// PDF da proposta revisional (documento A4 em tabelas, para baixar e enviar).
// Gerado no navegador com jsPDF, a partir dos mesmos dados da página do cliente.

import { brl, pctBR } from "./revisional";

export type PropostaPdf = {
  numero: string;
  tipo: "imovel" | "veiculo";
  cliente_nome: string;
  cliente_documento: string;
  consultor_nome: string;
  dados: Record<string, any>;
  resultado: Record<string, any>;
  empresa: { nome?: string; cnpj?: string };
  expira_em: string;
  criada_em: string;
};

type RGB = [number, number, number];
const COR = {
  azul: [37, 99, 235] as RGB,
  roxo: [126, 34, 206] as RGB,
  teal: [13, 148, 136] as RGB,
  laranja: [234, 88, 12] as RGB,
  vermelho: [220, 38, 38] as RGB,
  verde: [5, 150, 105] as RGB,
  verdeEscuro: [4, 120, 87] as RGB,
  texto: [30, 41, 59] as RGB,
  cinza: [100, 116, 139] as RGB,
  claro: [241, 245, 249] as RGB,
  linha: [226, 232, 240] as RGB,
};

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export async function baixarPdfProposta(p: PropostaPdf) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 14, R = 196, W = R - L, ALT_PAG = 297, MARGEM_INF = 16;
  let y = 14;
  const d = p.dados, r = p.resultado;
  const imovel = p.tipo === "imovel";
  const empresa = p.empresa?.nome || "Wolf System";

  const cor = (c: RGB, tipo: "fill" | "text" | "draw") =>
    tipo === "fill" ? doc.setFillColor(...c) : tipo === "text" ? doc.setTextColor(...c) : doc.setDrawColor(...c);
  const espaco = (h: number) => { if (y + h > ALT_PAG - MARGEM_INF) { doc.addPage(); y = 16; } };

  /* ---- cabeçalho ---- */
  cor(COR.verde, "fill"); doc.roundedRect(L, y, 13, 13, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); cor([255, 255, 255], "text"); doc.text("W", L + 6.5, y + 8.9, { align: "center" });
  doc.setFontSize(15); cor(COR.texto, "text"); doc.text(empresa, L + 17, y + 6.2);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); cor(COR.cinza, "text");
  doc.text(imovel ? "Análise revisional de financiamento imobiliário" : "Análise revisional de financiamento de veículo", L + 17, y + 11);

  cor(COR.claro, "fill"); doc.roundedRect(R - 58, y - 2, 58, 24, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); cor(COR.cinza, "text"); doc.text("PROPOSTA", R - 29, y + 4, { align: "center" });
  doc.setFontSize(12.5); cor(COR.texto, "text"); doc.text(p.numero, R - 29, y + 10.5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); cor(COR.cinza, "text");
  doc.text(`Válida até ${dataHoraBR(p.expira_em)}`, R - 29, y + 16.5, { align: "center" });
  y += 28;

  if (p.empresa?.cnpj) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); cor(COR.texto, "text");
    doc.text(`${empresa} — CNPJ: ${p.empresa.cnpj}`, L, y); y += 5;
  }
  cor(COR.linha, "draw"); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 6;

  // cliente
  const colunas: [string, string][] = [["CLIENTE", p.cliente_nome], ["CPF/CNPJ", p.cliente_documento || "—"], ["CONSULTOR", p.consultor_nome || "—"], ["DATA", dataBR(p.criada_em)]];
  const xs = [L, L + 72, L + 115, R];
  colunas.forEach(([k, v], i) => {
    const alinhar = i === 3 ? "right" : "left";
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); cor(COR.cinza, "text"); doc.text(k, xs[i], y, { align: alinhar });
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); cor(COR.texto, "text");
    const largura = i === 0 ? 68 : i === 3 ? 30 : 40;
    const texto = doc.splitTextToSize(String(v).toUpperCase(), largura)[0];
    doc.text(texto, xs[i], y + 5, { align: alinhar });
  });
  y += 9; cor(COR.linha, "draw"); doc.line(L, y, R, y); y += 7;

  /* ---- destaque ---- */
  const total = Number(imovel ? r.diferenca_total : r.economia_total) || 0;
  espaco(22);
  cor(COR.verde, "fill"); doc.roundedRect(L, y, W, 20, 3, 3, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); cor([209, 250, 229], "text");
  doc.text(imovel ? "DIFERENÇA TOTAL IDENTIFICADA" : "ECONOMIA TOTAL IDENTIFICADA", L + 6, y + 7.5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); cor([255, 255, 255], "text");
  doc.text(`${imovel ? "Financiamento imobiliário" : "Financiamento de veículo"} — ${d.banco || ""}`, L + 6, y + 14);
  doc.setFontSize(20); doc.text(brl(total), R - 6, y + 13, { align: "right" });
  y += 27;

  /* ---- tabelas ---- */
  const secao = (titulo: string, c: RGB, linhas: [string, string][]) => {
    espaco(9 + Math.min(linhas.length, 3) * 7.2);
    cor(c, "fill"); doc.rect(L, y, W, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); cor([255, 255, 255], "text");
    doc.text(titulo, L + W / 2, y + 5.4, { align: "center" });
    y += 8;
    linhas.forEach(([k, v], i) => {
      espaco(7.2);
      if (i % 2 === 0) { cor([248, 250, 252], "fill"); doc.rect(L, y, W, 7.2, "F"); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.8); cor(COR.texto, "text"); doc.text(k, L + 3, y + 4.9);
      doc.setFont("helvetica", "normal"); cor([51, 65, 85], "text"); doc.text(v, L + 82, y + 4.9);
      y += 7.2;
    });
    y += 5;
  };

  const taxaCobrada: number | null = imovel ? r.taxa_contratada_mensal ?? null : r.taxa_contratada ?? null;
  const taxaMedia: number | null = r.taxa_media_mensal ?? null;
  const blocoTaxas: [string, string][] = taxaCobrada && taxaMedia
    ? [
        ["Juros cobrados no contrato", `${pctBR(taxaCobrada)} ao mês`],
        [`Média do mercado (BACEN${d.taxa_media_ref ? `, ${d.taxa_media_ref}` : ""})`, `${pctBR(taxaMedia)} ao mês`],
        ["Relação com a média", r.vezes_media != null ? `${Number(r.vezes_media).toLocaleString("pt-BR")} vezes a média` : "—"],
      ]
    : [];

  if (imovel) {
    secao("FINANCIAMENTO ATUAL", COR.azul, [
      ["Financeira", d.banco || "—"],
      ["Contrato sofreu pausa?", d.pausa ? "SIM" : "NÃO"],
      ["Modalidade de tabela", d.modalidade || "SAC"],
      ...(d.taxa_anual ? [["Taxa de juros do contrato", `${pctBR(d.taxa_anual)} ao ano`] as [string, string]] : []),
      ["Saldo devedor", brl(d.saldo_devedor)],
      ["Valor financiado", brl(d.valor_financiado)],
      ["Nº de meses", String(d.prazo)],
      ["Qtd. pagas", String(d.pagas)],
      ["Qtd. atrasadas", String(d.atrasadas || 0)],
    ]);
    secao("DETALHAMENTO DA PARCELA", COR.roxo, [
      ["Valor da parcela atual", brl(d.parcela_atual)],
      ["Parcela corrigida", brl(r.parcela_corrigida)],
      ["Juros", brl(d.juros)],
      ["Amortização", brl(d.amortizacao)],
      ["Tarifa administrativa", brl(d.tarifa_adm)],
      ["Seguros", brl(d.seguros)],
    ]);
    if (blocoTaxas.length) secao("JUROS DO CONTRATO × MÉDIA DO MERCADO", COR.teal, blocoTaxas);
    secao("DEMONSTRATIVO AMORTIZAÇÃO × JUROS", COR.laranja, [
      ["Parcelas amortização", brl(r.amortizacao_corrigida)],
      ["Parcelas juros", brl(r.juros_pagos)],
      ["Média total", brl(r.media_total)],
    ]);
    secao("RESULTADO", COR.vermelho, [
      ["Amortizado", brl(r.amortizado)],
      ["Amortização corrigida", brl(r.amortizacao_corrigida)],
      ["Diferença total da amortização", brl(r.diferenca_amortizacao)],
      ["Tarifas questionáveis", brl(r.tarifas_questionaveis)],
      ["Diferença total", brl(r.diferenca_total)],
    ]);
  } else {
    secao("FINANCIAMENTO ATUAL", COR.azul, [
      ["Financeira", d.banco || "—"],
      ["Veículo", `${d.modelo || "—"}${d.ano ? ` — ${d.ano}` : ""}`],
      ["Valor financiado", brl(d.valor_financiado)],
      ["Nº de parcelas", String(d.prazo)],
      ["Qtd. pagas", String(d.pagas)],
      ["Qtd. atrasadas", String(d.atrasadas || 0)],
    ]);
    secao("DETALHAMENTO DA PARCELA", COR.roxo, [
      ["Valor da parcela atual", brl(d.parcela_atual)],
      ["Parcela corrigida", brl(r.parcela_corrigida)],
      ["Juros abusivos por parcela", brl(r.reducao_parcela)],
    ]);
    if (blocoTaxas.length) secao("JUROS DO CONTRATO × MÉDIA DO MERCADO", COR.teal, blocoTaxas);
    secao("RESULTADO", COR.vermelho, [
      [`Redução nas ${r.restantes} parcelas restantes`, brl(r.reducao_total)],
      [`Estorno das ${d.pagas} parcelas pagas`, brl(r.estorno)],
      ["Economia total", brl(r.economia_total)],
    ]);
  }

  /* ---- totais em verde ---- */
  const finais: [string, string][] = imovel
    ? [["SALDO DEVEDOR ATUAL CORRETO", brl(r.saldo_correto)], ["DIFERENÇA POR PARCELA", brl(r.diferenca_parcela)], ["ECONOMIA MÉDIA TOTAL DO CONTRATO", brl(r.economia_total)]]
    : [["PARCELA CORRIGIDA", brl(r.parcela_corrigida)], ["REDUÇÃO POR PARCELA", brl(r.reducao_parcela)], ["ECONOMIA TOTAL DO CONTRATO", brl(r.economia_total)]];
  espaco(finais.length * 8.5 + 4);
  finais.forEach(([k, v]) => {
    cor(COR.verde, "fill"); doc.rect(L, y, W, 8.5, "F");
    cor(COR.verdeEscuro, "draw"); doc.setLineWidth(0.3); doc.rect(L, y, W, 8.5, "S"); doc.line(L + W * 0.62, y, L + W * 0.62, y + 8.5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); cor([255, 255, 255], "text");
    doc.text(k, L + 3, y + 5.7); doc.text(v, R - 3, y + 5.7, { align: "right" });
    y += 8.5;
  });
  y += 8;

  /* ---- base legal e rodapé ---- */
  espaco(26);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); cor(COR.texto, "text");
  doc.text("ARTIGOS 42, 43 E 51 DA LEI Nº 8.078 DE 11 DE SETEMBRO DE 1990", L, y); y += 4.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); cor(COR.cinza, "text");
  const legal = doc.splitTextToSize(
    "Art. 42 — Proibição de cobrança abusiva. Art. 43 — Direito de acesso e correção de dados. Art. 51 — Nulidade de cláusulas abusivas em contratos de consumo. " +
    "Valores estimados com base nos dados informados, sujeitos à análise do contrato." +
    (taxaMedia ? " Taxa média de mercado: Banco Central do Brasil (SGS)." : ""),
    W
  );
  doc.text(legal, L, y); y += legal.length * 3.6 + 5;
  doc.setFontSize(7); cor([148, 163, 184], "text");
  doc.text(`Consultor: ${p.consultor_nome || "—"} | ${empresa}${p.empresa?.cnpj ? ` — CNPJ: ${p.empresa.cnpj}` : ""} | Gerado em: ${dataHoraBR(new Date().toISOString())}`, L, y);

  // numeração de páginas
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i); doc.setFontSize(7); cor([148, 163, 184], "text");
    doc.text(`Proposta ${p.numero} — página ${i} de ${paginas}`, R, ALT_PAG - 8, { align: "right" });
  }

  const nome = `proposta-${p.numero}-${p.cliente_nome.split(/\s+/)[0] || "cliente"}`.toLowerCase().normalize("NFD").replace(/[^\w-]+/g, "");
  doc.save(`${nome}.pdf`);
}
