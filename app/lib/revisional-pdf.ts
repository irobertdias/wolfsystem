// PDF da proposta revisional — peça de apresentação em A4 (2 páginas).
// Página 1: capa com o valor identificado, parcela antes × depois, indicadores e juros × mercado.
// Página 2: composição da parcela, quadros do contrato, resultado e próximos passos.
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
const C = {
  verde900: [6, 78, 59] as RGB,
  verde800: [6, 95, 70] as RGB,
  verde700: [4, 120, 87] as RGB,
  verde600: [5, 150, 105] as RGB,
  verde500: [16, 185, 129] as RGB,
  verde100: [209, 250, 229] as RGB,
  verde50: [236, 253, 245] as RGB,
  teal700: [15, 118, 110] as RGB,
  teal500: [20, 184, 166] as RGB,
  vermelho600: [220, 38, 38] as RGB,
  vermelho500: [239, 68, 68] as RGB,
  vermelho50: [254, 242, 242] as RGB,
  vermelho100: [254, 226, 226] as RGB,
  ambar500: [245, 158, 11] as RGB,
  ambar100: [254, 243, 199] as RGB,
  ambar800: [146, 64, 14] as RGB,
  roxo500: [139, 92, 246] as RGB,
  azul600: [37, 99, 235] as RGB,
  laranja500: [249, 115, 22] as RGB,
  tinta: [15, 23, 42] as RGB,
  texto: [30, 41, 59] as RGB,
  suave: [71, 85, 105] as RGB,
  cinza: [100, 116, 139] as RGB,
  cinza300: [203, 213, 225] as RGB,
  linha: [226, 232, 240] as RGB,
  fundo: [248, 250, 252] as RGB,
  branco: [255, 255, 255] as RGB,
};

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
// jsPDF (fontes padrão) não tem o sinal de menos tipográfico nem espaço fino: troca por equivalentes.
const txt = (s: string) => String(s ?? "").replace(/\u2212/g, "-").replace(/[\u202f\u00a0]/g, " ");

export async function gerarPdfProposta(p: PropostaPdf) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PW = 210, PH = 297, M = 14, W = PW - 2 * M;
  const d = p.dados, r = p.resultado;
  const imovel = p.tipo === "imovel";
  const empresa = p.empresa?.nome || "Wolf System";
  const total = Number(imovel ? r.diferenca_total : r.economia_total) || 0;
  const parcelaAtual = Number(d.parcela_atual) || 0;
  const parcelaNova = Number(r.parcela_corrigida) || 0;
  const economiaParcela = Number(imovel ? r.diferenca_parcela : r.reducao_parcela) || 0;
  const reducaoPct = parcelaAtual > 0 ? Math.round((1 - parcelaNova / parcelaAtual) * 100) : 0;
  const taxaCobrada: number | null = imovel ? r.taxa_contratada_mensal ?? null : r.taxa_contratada ?? null;
  const taxaMedia: number | null = r.taxa_media_mensal ?? null;
  const vezes: number | null = r.vezes_media ?? null;

  /* ---------- utilitários de desenho ---------- */
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const fonte = (peso: "normal" | "bold", tam: number, c: RGB) => { doc.setFont("helvetica", peso); doc.setFontSize(tam); ink(c); };
  const texto = (s: string, x: number, y: number, o: { align?: "left" | "center" | "right"; maxWidth?: number } = {}) => doc.text(txt(s), x, y, o);
  const opacidade = (o: number) => { const G = (doc as any).GState; if (G) doc.setGState(new G({ opacity: o })); };
  const sombra = (x: number, y: number, w: number, h: number, raio: number) => {
    opacidade(0.06); fill(C.tinta);
    doc.roundedRect(x + 0.6, y + 1.4, w, h, raio, raio, "F");
    opacidade(1);
  };
  const cartao = (x: number, y: number, w: number, h: number, raio = 4, cor: RGB = C.branco, borda: RGB | null = C.linha) => {
    sombra(x, y, w, h, raio);
    fill(cor);
    if (borda) { stroke(borda); doc.setLineWidth(0.25); doc.roundedRect(x, y, w, h, raio, raio, "FD"); }
    else doc.roundedRect(x, y, w, h, raio, raio, "F");
  };
  const degrade = (x: number, y: number, w: number, h: number, de: RGB, ate: RGB, vertical = false, passos = 60) => {
    for (let i = 0; i < passos; i++) {
      fill(mix(de, ate, i / (passos - 1)));
      if (vertical) doc.rect(x, y + (h * i) / passos, w, h / passos + 0.3, "F");
      else doc.rect(x + (w * i) / passos, y, w / passos + 0.3, h, "F");
    }
  };
  const pilula = (s: string, x: number, y: number, bg: RGB, cor: RGB, tam = 8, alinhar: "left" | "center" | "right" = "left") => {
    fonte("bold", tam, cor);
    const w = doc.getTextWidth(txt(s)) + 7, h = tam * 0.55 + 3;
    const x0 = alinhar === "center" ? x - w / 2 : alinhar === "right" ? x - w : x;
    fill(bg); doc.roundedRect(x0, y - h + 1.8, w, h, h / 2, h / 2, "F");
    texto(s, x0 + w / 2, y, { align: "center" });
    return w;
  };
  const seta = (cx: number, cy: number, raio: number) => {
    fill(C.verde600); doc.circle(cx, cy, raio, "F");
    stroke(C.branco); doc.setLineWidth(0.9);
    doc.line(cx - raio * 0.45, cy, cx + raio * 0.4, cy);
    doc.line(cx + raio * 0.1, cy - raio * 0.32, cx + raio * 0.42, cy);
    doc.line(cx + raio * 0.1, cy + raio * 0.32, cx + raio * 0.42, cy);
  };
  const tituloSecao = (n: string, s: string, x: number, y: number) => {
    fill(C.verde600); doc.roundedRect(x, y - 4.6, 6.5, 6.5, 1.6, 1.6, "F");
    fonte("bold", 8, C.branco); texto(n, x + 3.25, y - 0.2, { align: "center" });
    fonte("bold", 11.5, C.tinta); texto(s, x + 9.5, y);
  };
  const rosca = (cx: number, cy: number, raioExt: number, raioInt: number, partes: { valor: number; cor: RGB }[]) => {
    const soma = partes.reduce((a, b) => a + Math.max(0, b.valor), 0) || 1;
    let ang = -Math.PI / 2;
    partes.forEach((pt) => {
      const fatia = (Math.max(0, pt.valor) / soma) * Math.PI * 2;
      const passos = Math.max(2, Math.ceil(fatia / 0.04));
      fill(pt.cor);
      for (let k = 0; k < passos; k++) {
        const a1 = ang + (fatia * k) / passos, a2 = ang + (fatia * (k + 1)) / passos + 0.006;
        doc.triangle(cx, cy, cx + raioExt * Math.cos(a1), cy + raioExt * Math.sin(a1), cx + raioExt * Math.cos(a2), cy + raioExt * Math.sin(a2), "F");
      }
      ang += fatia;
    });
    fill(C.branco); doc.circle(cx, cy, raioInt, "F");
  };
  const rodape = (pag: number, totalPag: number) => {
    stroke(C.linha); doc.setLineWidth(0.25); doc.line(M, PH - 13, PW - M, PH - 13);
    fonte("normal", 7, C.cinza);
    texto(`${empresa}${p.empresa?.cnpj ? `  ·  CNPJ ${p.empresa.cnpj}` : ""}  ·  Consultor: ${p.consultor_nome || "-"}`, M, PH - 8.5);
    texto(`Proposta ${p.numero}  ·  gerada em ${dataHoraBR(new Date().toISOString())}  ·  ${pag}/${totalPag}`, PW - M, PH - 8.5, { align: "right" });
  };
  const marca = (x: number, y: number, tam: number, fundo: RGB, letra: RGB) => {
    fill(fundo); doc.roundedRect(x, y, tam, tam, tam * 0.24, tam * 0.24, "F");
    fonte("bold", tam * 1.55, letra); texto("W", x + tam / 2, y + tam * 0.71, { align: "center" });
  };

  /* =================== PÁGINA 1 — CAPA =================== */
  fill(C.fundo); doc.rect(0, 0, PW, PH, "F");
  const HB = 104; // altura da faixa verde
  degrade(0, 0, PW, HB, C.verde600, C.verde900, true, 80);
  // formas decorativas translúcidas
  opacidade(0.09); fill(C.branco);
  doc.circle(PW - 12, 8, 46, "F"); doc.circle(PW - 40, HB + 6, 30, "F");
  opacidade(0.07); doc.circle(8, HB - 6, 26, "F");
  opacidade(1);

  // topo da faixa
  marca(M, 12, 11, C.branco, C.verde700);
  fonte("bold", 13, C.branco); texto(empresa, M + 15, 17);
  fonte("normal", 8, C.verde100); texto(imovel ? "Revisão de financiamento imobiliário" : "Revisão de financiamento de veículo", M + 15, 21.5);
  // selo do número
  opacidade(0.16); fill(C.branco); doc.roundedRect(PW - M - 52, 11, 52, 15, 3, 3, "F"); opacidade(1);
  fonte("normal", 6.5, C.verde100); texto("PROPOSTA Nº", PW - M - 26, 16, { align: "center" });
  fonte("bold", 11, C.branco); texto(p.numero, PW - M - 26, 22.2, { align: "center" });

  // destaque principal
  const nome = (p.cliente_nome || "").trim().split(/\s+/)[0] || "";
  fonte("normal", 11, C.verde100); texto(nome ? `${nome}, identificamos` : "Identificamos", M, 44);
  fonte("bold", 44, C.branco); texto(brl(total), M - 0.6, 62);
  fonte("normal", 10.5, C.verde100);
  texto(imovel ? "em cobranças indevidas no seu financiamento imobiliário" : "de economia no seu financiamento de veículo", M, 71);
  fonte("bold", 10.5, C.branco); texto(d.banco || "", M, 76.5);
  // validade
  pilula(`Válida até ${dataHoraBR(p.expira_em)}`, M, 89, C.ambar100, C.ambar800, 8);

  // cartão do cliente (sobre a faixa)
  let y = HB - 9;
  cartao(M, y, W, 22, 4);
  const cols: [string, string][] = [["CLIENTE", p.cliente_nome], ["CPF/CNPJ", p.cliente_documento || "-"], ["CONSULTOR", p.consultor_nome || "-"], ["EMISSÃO", dataBR(p.criada_em)]];
  const larg = [62, 40, 46, 34];
  let cx = M + 6;
  cols.forEach(([k, v], i) => {
    fonte("normal", 6.8, C.cinza); texto(k, cx, y + 8.5);
    fonte("bold", 9.5, C.tinta); texto(doc.splitTextToSize(txt(v), larg[i] - 4)[0], cx, y + 14.8);
    if (i < 3) { stroke(C.linha); doc.setLineWidth(0.25); doc.line(cx + larg[i] - 4, y + 5, cx + larg[i] - 4, y + 17); }
    cx += larg[i];
  });
  y += 32;

  // parcela antes x depois
  tituloSecao("1", "Sua parcela", M, y);
  y += 5;
  const wc = (W - 16) / 2;
  cartao(M, y, wc, 30, 4, C.vermelho50, C.vermelho100);
  fonte("bold", 7.5, C.vermelho500); texto("HOJE VOCÊ PAGA", M + wc / 2, y + 8, { align: "center" });
  fonte("bold", 21, C.vermelho600); texto(brl(parcelaAtual), M + wc / 2, y + 19, { align: "center" });
  const lw = doc.getTextWidth(txt(brl(parcelaAtual)));
  stroke(C.vermelho500); doc.setLineWidth(0.7); doc.line(M + wc / 2 - lw / 2, y + 16.4, M + wc / 2 + lw / 2, y + 16.4);
  fonte("normal", 7.5, C.vermelho500); texto("por mês", M + wc / 2, y + 25.5, { align: "center" });
  seta(PW / 2, y + 15, 5.2);
  const x2 = M + wc + 16;
  cartao(x2, y, wc, 30, 4, C.verde50, C.verde500);
  stroke(C.verde500); doc.setLineWidth(0.8); doc.roundedRect(x2, y, wc, 30, 4, 4, "S");
  fonte("bold", 7.5, C.verde700); texto("COM A REVISÃO", x2 + wc / 2, y + 8, { align: "center" });
  fonte("bold", 21, C.verde600); texto(brl(parcelaNova), x2 + wc / 2, y + 19, { align: "center" });
  fonte("normal", 7.5, C.verde700); texto("por mês", x2 + wc / 2, y + 25.5, { align: "center" });
  y += 37;
  // barras comparativas
  const bx = M + 34, bw = W - 34 - 30;
  [["Parcela cobrada", parcelaAtual, C.vermelho500], ["Parcela correta", parcelaNova, C.verde500]].forEach(([k, v, cor], i) => {
    const yy = y + i * 7;
    fonte("normal", 8, C.suave); texto(k as string, M, yy + 2.6);
    fill(C.linha); doc.roundedRect(bx, yy, bw, 3.6, 1.8, 1.8, "F");
    fill(cor as RGB); doc.roundedRect(bx, yy, Math.max(4, (bw * (v as number)) / Math.max(parcelaAtual, 1)), 3.6, 1.8, 1.8, "F");
    fonte("bold", 8.5, cor as RGB); texto(brl(v as number), PW - M, yy + 2.8, { align: "right" });
  });
  y += 18;
  let px = M;
  px += pilula(`${brl(economiaParcela)} a menos por mês`, px, y, C.verde600, C.branco, 9) + 3;
  if (reducaoPct > 0) pilula(`-${reducaoPct}% na parcela`, px, y, C.ambar100, C.ambar800, 9);
  y += 10;

  // indicadores
  tituloSecao("2", "Números da revisão", M, y);
  y += 5;
  const kpis: [string, number, RGB][] = imovel
    ? [["Saldo devedor correto", r.saldo_correto, C.azul600], ["Economia por parcela", r.diferenca_parcela, C.verde600], ["Economia até o fim", r.economia_total, C.roxo500]]
    : [["Devolução das pagas", r.estorno, C.ambar500], ["Redução nas restantes", r.reducao_total, C.azul600], ["Economia total", r.economia_total, C.verde600]];
  const wk = (W - 8) / 3;
  kpis.forEach(([k, v, cor], i) => {
    const kx = M + i * (wk + 4);
    cartao(kx, y, wk, 22, 4);
    fill(cor); doc.roundedRect(kx, y, wk, 2.2, 1.1, 1.1, "F"); doc.rect(kx, y + 1, wk, 1.2, "F");
    fonte("bold", 6.8, C.cinza); texto(k.toUpperCase(), kx + 5, y + 9);
    fonte("bold", 14, C.tinta); texto(brl(v), kx + 5, y + 17);
  });
  y += 30;

  // juros x mercado
  if (taxaCobrada && taxaMedia) {
    tituloSecao("3", "Seus juros × média do mercado", M, y);
    y += 5;
    cartao(M, y, W, 36, 4);
    const max = Math.max(taxaCobrada, taxaMedia) * 1.1;
    const tx = M + 6, tw = W - 12 - 50;
    ([["Juros cobrados no seu contrato", taxaCobrada, C.vermelho500], [`Média do mercado - Banco Central${d.taxa_media_ref ? ` (${d.taxa_media_ref})` : ""}`, taxaMedia, C.verde500]] as [string, number, RGB][]).forEach(([k, v, cor], i) => {
      const yy = y + 8 + i * 12;
      fonte("normal", 8, C.suave); texto(k, tx, yy);
      fonte("bold", 9, cor); texto(`${pctBR(v)} a.m.`, tx + tw, yy, { align: "right" });
      fill(C.linha); doc.roundedRect(tx, yy + 2, tw, 3.4, 1.7, 1.7, "F");
      fill(cor); doc.roundedRect(tx, yy + 2, (tw * v) / max, 3.4, 1.7, 1.7, "F");
    });
    // selo das vezes
    const sx = PW - M - 46, sw = 40;
    const acima = vezes != null && vezes > 1;
    fill(acima ? C.vermelho50 : C.verde50); doc.roundedRect(sx, y + 6, sw, 24, 4, 4, "F");
    fonte("bold", 20, acima ? C.vermelho600 : C.verde600); texto(vezes != null ? `${vezes.toLocaleString("pt-BR")}×` : "-", sx + sw / 2, y + 18, { align: "center" });
    fonte("normal", 7, acima ? C.vermelho600 : C.verde700); texto(acima ? "acima da média" : "da média", sx + sw / 2, y + 24.5, { align: "center" });
    y += 44;
  }

  /* =================== PÁGINA 2 — DETALHES =================== */
  doc.addPage();
  fill(C.fundo); doc.rect(0, 0, PW, PH, "F");
  degrade(0, 0, PW, 24, C.verde700, C.verde900, false, 60);
  marca(M, 7, 9, C.branco, C.verde700);
  fonte("bold", 11, C.branco); texto("Detalhamento da análise", M + 13, 12.6);
  fonte("normal", 7.5, C.verde100); texto(`${p.cliente_nome}  ·  ${d.banco || ""}`, M + 13, 17);
  fonte("bold", 9, C.branco); texto(`Nº ${p.numero}`, PW - M, 14.5, { align: "right" });
  y = 36;

  // quadro: composição (imóvel) ou andamento (veículo)
  if (imovel) {
    tituloSecao("4", "Para onde vai sua parcela", M, y);
    y += 5;
    cartao(M, y, W, 38, 4);
    const partes = [
      { rotulo: "Juros", valor: Number(d.juros) || 0, cor: C.vermelho500 },
      { rotulo: "Amortização", valor: Number(d.amortizacao) || 0, cor: C.verde500 },
      { rotulo: "Tarifa administrativa", valor: Number(d.tarifa_adm) || 0, cor: C.ambar500 },
      { rotulo: "Seguros", valor: Number(d.seguros) || 0, cor: C.roxo500 },
    ];
    const soma = partes.reduce((a, b) => a + b.valor, 0) || 1;
    rosca(M + 26, y + 19, 14, 8.6, partes);
    const pctJuros = Math.round((partes[0].valor / soma) * 100);
    fonte("bold", 12, C.tinta); texto(`${pctJuros}%`, M + 26, y + 19.5, { align: "center" });
    fonte("normal", 6, C.cinza); texto("é juros", M + 26, y + 23, { align: "center" });
    partes.forEach((pt, i) => {
      const ly = y + 9.5 + i * 7;
      fill(pt.cor); doc.circle(M + 56, ly - 1.2, 1.8, "F");
      fonte("normal", 9, C.suave); texto(pt.rotulo, M + 61, ly);
      fonte("normal", 8, C.cinza); texto(`${Math.round((pt.valor / soma) * 100)}%`, M + 128, ly, { align: "right" });
      fonte("bold", 9.5, C.tinta); texto(brl(pt.valor), PW - M - 6, ly, { align: "right" });
    });
    y += 46;
  } else {
    tituloSecao("4", "Andamento do contrato", M, y);
    y += 5;
    cartao(M, y, W, 34, 4);
    const pagas = Number(d.pagas) || 0, prazo = Math.max(1, Number(d.prazo) || 1);
    const bw2 = W - 12;
    fill(C.linha); doc.roundedRect(M + 6, y + 10, bw2, 5, 2.5, 2.5, "F");
    fill(C.verde500); doc.roundedRect(M + 6, y + 10, Math.max(5, (bw2 * pagas) / prazo), 5, 2.5, 2.5, "F");
    fonte("bold", 9, C.tinta); texto(`${pagas} de ${prazo} parcelas pagas`, M + 6, y + 7);
    fonte("normal", 8, C.cinza); texto(`${r.restantes} restantes`, PW - M - 6, y + 7, { align: "right" });
    fonte("normal", 8, C.suave);
    texto(`Já pagas: devolução de ${brl(r.estorno)}`, M + 6, y + 24);
    texto(`Restantes: redução de ${brl(r.reducao_total)}`, PW - M - 6, y + 24, { align: "right" });
    y += 42;
  }

  // quadros de dados
  const quadro = (titulo: string, cor: RGB, linhas: [string, string, RGB?][], x: number, yy: number, w: number) => {
    const h = 11 + linhas.length * 6.1 + 2;
    cartao(x, yy, w, h, 4);
    fill(cor); doc.roundedRect(x + 0.2, yy + 4, 1.6, h - 8, 0.8, 0.8, "F");
    fonte("bold", 8.5, cor); texto(titulo.toUpperCase(), x + 7, yy + 7.5);
    linhas.forEach(([k, v, c], i) => {
      const ly = yy + 14.5 + i * 6.1;
      if (i > 0) { stroke(C.linha); doc.setLineWidth(0.2); doc.line(x + 7, ly - 4.3, x + w - 5, ly - 4.3); }
      fonte("normal", 8.3, C.suave); texto(k, x + 7, ly);
      fonte("bold", 8.6, c || C.tinta); texto(v, x + w - 5, ly, { align: "right" });
    });
    return h;
  };
  const meia = (W - 5) / 2;
  const contrato: [string, string, RGB?][] = imovel
    ? [["Financeira", d.banco || "-"], ["Valor financiado", brl(d.valor_financiado)], ["Saldo devedor", brl(d.saldo_devedor)], ["Prazo", `${d.prazo} meses`], ["Pagas / em atraso", `${d.pagas} / ${d.atrasadas || 0}`], ["Modalidade", d.modalidade || "SAC"], ["Sofreu pausa?", d.pausa ? "Sim" : "Não"], ...(d.taxa_anual ? [["Taxa do contrato", `${pctBR(d.taxa_anual)} a.a.`] as [string, string]] : [])]
    : [["Financeira", d.banco || "-"], ["Veículo", `${d.modelo || "-"}${d.ano ? ` ${d.ano}` : ""}`], ["Valor financiado", brl(d.valor_financiado)], ["Prazo", `${d.prazo} meses`], ["Pagas / em atraso", `${d.pagas} / ${d.atrasadas || 0}`], ...(taxaCobrada ? [["Taxa cobrada (estimada)", `${pctBR(taxaCobrada)} a.m.`, C.vermelho600] as [string, string, RGB]] : [])];
  const parcela: [string, string, RGB?][] = imovel
    ? [["Parcela atual", brl(d.parcela_atual), C.vermelho600], ["Parcela corrigida", brl(r.parcela_corrigida), C.verde600], ["Juros", brl(d.juros)], ["Amortização", brl(d.amortizacao)], ["Tarifa administrativa", brl(d.tarifa_adm)], ["Seguros", brl(d.seguros)]]
    : [["Parcela atual", brl(d.parcela_atual), C.vermelho600], ["Parcela corrigida", brl(r.parcela_corrigida), C.verde600], ["Juros abusivos/parcela", brl(r.reducao_parcela), C.laranja500], ...(taxaMedia ? [["Taxa aplicada", `${pctBR(r.taxa_aplicada)} a.m.`] as [string, string]] : [])];
  tituloSecao("5", "Dados analisados", M, y);
  y += 5;
  const h1 = quadro("Contrato", C.azul600, contrato, M, y, meia);
  const h2 = quadro("Parcela", C.roxo500, parcela, M + meia + 5, y, meia);
  y += Math.max(h1, h2) + 9;

  // resultado
  tituloSecao("6", "Resultado da análise", M, y);
  y += 5;
  const res: [string, string, RGB?][] = imovel
    ? [["Parcelas de amortização pagas", brl(r.amortizacao_corrigida)], ["Parcelas de juros pagas", brl(r.juros_pagos)], ["Amortizado pelo banco", brl(r.amortizado)], ["Diferença na amortização", brl(r.diferenca_amortizacao), C.vermelho600], ["Tarifas e seguros questionáveis", brl(r.tarifas_questionaveis), C.laranja500]]
    : [["Redução por parcela", brl(r.reducao_parcela), C.verde600], [`Redução nas ${r.restantes} parcelas restantes`, brl(r.reducao_total)], [`Devolução das ${d.pagas} parcelas pagas`, brl(r.estorno), C.ambar800]];
  const h3 = quadro("Apuração", C.vermelho500, res, M, y, W);
  y += h3 + 4;
  // faixa do total
  sombra(M, y, W, 18, 4);
  fill(C.verde700); doc.roundedRect(M, y, W, 18, 4, 4, "F");
  opacidade(0.12); fill(C.branco); doc.roundedRect(M + W * 0.55, y, W * 0.45, 18, 4, 4, "F"); opacidade(1);
  fonte("bold", 9, C.verde100); texto(imovel ? "DIFERENÇA TOTAL IDENTIFICADA" : "ECONOMIA TOTAL IDENTIFICADA", M + 7, y + 11);
  fonte("bold", 19, C.branco); texto(brl(total), PW - M - 7, y + 12.3, { align: "right" });
  y += 26;

  // próximos passos
  if (y + 22 < PH - 32) {
    tituloSecao("7", "Próximos passos", M, y);
    y += 5;
    const passos: [string, string][] = [
      ["Aceite a proposta", "Pelo link, dentro do prazo de validade."],
      ["Análise do contrato", "Conferimos documentos e valores."],
      ["Revisão e economia", "Parcela menor e devolução do excesso."],
    ];
    const wp = W / 3;
    cartao(M, y, W, 19, 4);
    passos.forEach(([t, s], i) => {
      const x = M + i * wp;
      if (i > 0) { stroke(C.linha); doc.setLineWidth(0.25); doc.line(x, y + 4, x, y + 15); }
      fill(C.verde600); doc.circle(x + 8, y + 7.2, 3.2, "F");
      fonte("bold", 8.5, C.branco); texto(String(i + 1), x + 8, y + 8.4, { align: "center" });
      fonte("bold", 8.8, C.tinta); texto(t, x + 13.5, y + 8.4);
      fonte("normal", 6.8, C.suave); doc.text(doc.splitTextToSize(txt(s), wp - 9), x + 4.5, y + 13.6);
    });
    y += 27;
  }

  // base legal
  fonte("bold", 7.5, C.texto); texto("BASE LEGAL — ARTS. 42, 43 E 51 DA LEI Nº 8.078/1990 (CÓDIGO DE DEFESA DO CONSUMIDOR)", M, y);
  fonte("normal", 7, C.cinza);
  const legal = doc.splitTextToSize(txt(
    "Art. 42: proibição de cobrança abusiva. Art. 43: direito de acesso e correção de dados. Art. 51: nulidade de cláusulas abusivas em contratos de consumo. " +
    "Valores estimados com base nos dados informados, sujeitos à análise do contrato." +
    (taxaMedia ? " Taxa média de mercado: Banco Central do Brasil (SGS)." : "")
  ), W);
  doc.text(legal, M, y + 4.5);

  const totalPag = doc.getNumberOfPages();
  for (let i = 1; i <= totalPag; i++) { doc.setPage(i); rodape(i, totalPag); }

  const arquivo = `proposta-${p.numero}-${(p.cliente_nome || "cliente").split(/\s+/)[0]}`.toLowerCase().normalize("NFD").replace(/[^\w-]+/g, "");
  return { doc, arquivo: `${arquivo}.pdf` };
}

export async function baixarPdfProposta(p: PropostaPdf) {
  const { doc, arquivo } = await gerarPdfProposta(p);
  doc.save(arquivo);
}
