import { TABELA_SEDEX_PADRAO, type FreteConfig, type OpcaoFrete } from "../../lib/loja-orcamento";
import { buscarComTempo } from "./_web";

// Cálculo de frete das lojas (somente servidor).
// Modo "fixo": a taxa de entrega da configuração.
// Modo "calculado": pelo CEP do cliente e o peso dos itens. Com contrato dos
// Correios (usuário, código de acesso e cartão de postagem) usa a API oficial
// (SEDEX 03220 e PAC 03298); sem contrato, ou se a API falhar, usa a tabela
// padrão por faixa (local, estadual, regional, nacional) editável em Ajustes.

const REGIAO: Record<string, string> = {
  AC: "N", AM: "N", AP: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MS: "CO", MT: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
};
// Capitais (lat, lon) para estimar a distância entre estados na tabela.
const CAPITAL: Record<string, [number, number]> = {
  AC: [-9.97, -67.81], AL: [-9.67, -35.74], AM: [-3.12, -60.02], AP: [0.03, -51.07], BA: [-12.97, -38.5], CE: [-3.72, -38.54], DF: [-15.79, -47.88],
  ES: [-20.32, -40.34], GO: [-16.68, -49.25], MA: [-2.53, -44.3], MG: [-19.92, -43.94], MS: [-20.44, -54.65], MT: [-15.6, -56.1], PA: [-1.46, -48.5],
  PB: [-7.12, -34.86], PE: [-8.05, -34.88], PI: [-5.09, -42.8], PR: [-25.43, -49.27], RJ: [-22.91, -43.17], RN: [-5.79, -35.21], RO: [-8.76, -63.9],
  RR: [2.82, -60.67], RS: [-30.03, -51.23], SC: [-27.6, -48.55], SE: [-10.91, -37.07], SP: [-23.55, -46.63], TO: [-10.18, -48.33],
};
function distanciaUF(a: string, b: string) {
  const p = CAPITAL[a], q = CAPITAL[b]; if (!p || !q) return 99999;
  const r = Math.PI / 180, dLat = (q[0] - p[0]) * r, dLon = (q[1] - p[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p[0] * r) * Math.cos(q[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const CODIGO: Record<string, string> = { SEDEX: "03220", PAC: "03298" };
const PRAZO_TABELA: Record<string, Record<string, string>> = {
  SEDEX: { local: "1 dia útil", estadual: "1 a 2 dias úteis", regional: "2 a 4 dias úteis", nacional: "3 a 6 dias úteis" },
  PAC: { local: "3 a 5 dias úteis", estadual: "4 a 7 dias úteis", regional: "6 a 10 dias úteis", nacional: "8 a 14 dias úteis" },
};
const FATOR_KG: Record<string, number> = { local: 1, estadual: 1.3, regional: 1.8, nacional: 2.5 };

const so = (v: any) => String(v || "").replace(/\D/g, "");
const num = (v: any) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const arred = (v: number) => Math.round(v * 100) / 100;

export type Destino = { cep: string; cidade: string; uf: string; logradouro: string; bairro: string };

export async function consultarCep(cep: string): Promise<Destino | null> {
  const c = so(cep); if (c.length !== 8) return null;
  try {
    const r = await buscarComTempo(`https://viacep.com.br/ws/${c}/json/`, 6000);
    const j: any = await r.json();
    if (j?.erro) return null;
    return { cep: c, cidade: j.localidade || "", uf: j.uf || "", logradouro: j.logradouro || "", bairro: j.bairro || "" };
  } catch { return null; }
}

/** Peso total (kg) dos itens que não são serviço. */
export function pesoItens(itens: any[], produtos: any[], cfg: FreteConfig) {
  const padrao = num(cfg.peso_padrao_kg) || 0.5;
  const kg = (itens || []).reduce((s: number, i: any) => {
    const p = produtos.find((x: any) => x.id === i.produto_id);
    if (i.servico || p?.servico) return s;
    return s + Math.max(1, num(i.qtd)) * (num(p?.peso_kg) || padrao);
  }, 0);
  return Math.max(0.3, Math.round(kg * 1000) / 1000);
}

async function tokenCorreios(c: NonNullable<FreteConfig["correios"]>) {
  const r = await buscarComTempo("https://api.correios.com.br/token/v1/autentica/cartaopostagem", 9000, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${c.usuario}:${c.codigo_acesso}`).toString("base64"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ numero: c.cartao }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(j?.msgs?.[0] || `Correios ${r.status}`);
  return String(j.token);
}

async function viaCorreios(cfg: FreteConfig, origem: string, destino: string, kg: number, servicos: string[]): Promise<OpcaoFrete[]> {
  const c = cfg.correios!;
  const token = await tokenCorreios(c);
  const e = cfg.embalagem || { comprimento: 30, largura: 20, altura: 15 };
  const h = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const out: OpcaoFrete[] = [];
  for (const s of servicos) {
    const cod = CODIGO[s]; if (!cod) continue;
    const q = new URLSearchParams({ cepOrigem: origem, cepDestino: destino, psObjeto: String(Math.round(kg * 1000)), tpObjeto: "2", comprimento: String(e.comprimento), largura: String(e.largura), altura: String(e.altura) });
    if (c.contrato) q.set("nuContrato", c.contrato);
    if (c.dr) q.set("nuDR", c.dr);
    const [rp, rz] = await Promise.all([
      buscarComTempo(`https://api.correios.com.br/preco/v1/nacional/${cod}?${q}`, 9000, { headers: h }),
      buscarComTempo(`https://api.correios.com.br/prazo/v1/nacional/${cod}?cepOrigem=${origem}&cepDestino=${destino}`, 9000, { headers: h }),
    ]);
    const jp: any = await rp.json().catch(() => ({}));
    const jz: any = await rz.json().catch(() => ({}));
    const valor = num(String(jp.pcFinal ?? jp.pcBase ?? "").replace(/\./g, "").replace(",", "."));
    if (!rp.ok || !valor) throw new Error(jp?.msgs?.[0] || `Correios preço ${rp.status}`);
    const dias = num(jz.prazoEntrega);
    out.push({ servico: s, valor, prazo: dias ? `${dias} dia${dias > 1 ? "s" : ""} út${dias > 1 ? "eis" : "il"}` : undefined, fonte: "correios" });
  }
  return out;
}

function viaTabela(cfg: FreteConfig, faixa: "local" | "estadual" | "regional" | "nacional", kg: number, servicos: string[]): OpcaoFrete[] {
  const t = { ...TABELA_SEDEX_PADRAO, ...(cfg.tabela || {}) };
  const extra = Math.max(0, Math.ceil(kg - 1)) * num(t.kg_adicional) * FATOR_KG[faixa];
  const sedex = num(t[faixa]) + extra;
  return servicos.map((s) => ({ servico: s, valor: arred(s === "PAC" ? Math.max(12, sedex * 0.68) : sedex), prazo: PRAZO_TABELA[s]?.[faixa], fonte: "tabela" as const }));
}

/** Calcula as opções de frete para o CEP do cliente. */
export async function calcularFrete(loja: any, cepDestino: string, itens: any[]): Promise<{ opcoes: OpcaoFrete[]; destino: Destino | null; aviso?: string }> {
  const cfg: FreteConfig = loja?.frete || {};
  const subtotal = (itens || []).reduce((s: number, i: any) => s + num(i.qtd) * num(i.preco), 0);
  const gratis = num(cfg.gratis_acima) > 0 && subtotal >= num(cfg.gratis_acima);
  const destino = await consultarCep(cepDestino);

  if (cfg.modo !== "calculado") {
    const v = gratis ? 0 : num(loja?.taxa_entrega);
    return { opcoes: [{ servico: "Entrega", valor: v, fonte: "fixo" }], destino };
  }
  if (!destino) return { opcoes: [], destino: null, aviso: "CEP não encontrado." };

  const cepOrigem = so(cfg.cep_origem || loja?.empresa?.cep);
  const origem = cepOrigem.length === 8 ? await consultarCep(cepOrigem) : null;
  const servicos = (cfg.servicos?.length ? cfg.servicos : ["SEDEX", "PAC"]) as string[];
  const kg = pesoItens(itens, loja?.produtos || [], cfg);

  let opcoes: OpcaoFrete[] = [];
  let aviso: string | undefined;
  const c = cfg.correios;
  if (c?.usuario && c?.codigo_acesso && c?.cartao && origem) {
    try { opcoes = await viaCorreios(cfg, origem.cep, destino.cep, kg, servicos); }
    catch (e: any) { aviso = `Correios indisponível (${String(e?.message || e).slice(0, 80)}); usei a tabela.`; }
  }
  if (!opcoes.length) {
    const faixa = !origem ? "nacional"
      : origem.uf === destino.uf && origem.cidade.toLowerCase() === destino.cidade.toLowerCase() ? "local"
      : origem.uf === destino.uf ? "estadual"
      : distanciaUF(origem.uf, destino.uf) <= 1100 || (REGIAO[origem.uf] && REGIAO[origem.uf] === REGIAO[destino.uf]) ? "regional" : "nacional";
    opcoes = viaTabela(cfg, faixa, kg, servicos);
    if (!origem) aviso = (aviso ? aviso + " " : "") + "Cadastre o CEP de origem em Ajustes para calcular certo.";
  }
  const add = num(cfg.adicional);
  opcoes = opcoes.map((o) => ({ ...o, valor: gratis ? 0 : arred(o.valor + add) }));
  return { opcoes: opcoes.sort((a, b) => a.valor - b.valor), destino, aviso };
}
