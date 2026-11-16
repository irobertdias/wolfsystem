import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso } from "../../_auth";
import { buscaKabum, buscarComTempo } from "../_web";
import { modulosLoja } from "../_modulos";

// Comparação de preço produto a produto (módulo "precos_concorrencia").
// KaBuM: busca pública da loja (dados schema.org). Terabyte e outras lojas: Google Shopping
// via Serper, quando SERPER_API_KEY existe. A Terabyte bloqueia acesso automático direto
// (verificação Cloudflare), então não é consultada diretamente.
// POST { ws, produtos: [{ id, nome, marca?, modelo? }] }  (até 10 por chamada)

export const maxDuration = 60;
type Oferta = { loja: string; preco: number; nome: string; url?: string };

const norm = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Quanto das palavras importantes da busca aparecem no nome da oferta (0..1). */
function aderencia(nome: string, q: string) {
  const n = norm(nome); const termos = norm(q).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !["de", "da", "do", "com", "para", "e"].includes(t));
  if (!termos.length) return 0;
  // Termos com número (modelo, capacidade) pesam o dobro: "b550m" errado não pode passar.
  let ok = 0, total = 0;
  for (const t of termos) { const p = /\d/.test(t) ? 2 : 1; total += p; if (n.includes(t)) ok += p; }
  return ok / total;
}
const precoBR = (s: any) => { const m = String(s || "").replace(/\s/g, "").match(/(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/); return m ? Number(m[1].replace(/\./g, "") + "." + m[2]) : Number(s) || 0; };

async function viaSerper(q: string): Promise<Oferta[]> {
  const key = process.env.SERPER_API_KEY; if (!key) return [];
  try {
    const r = await buscarComTempo("https://google.serper.dev/shopping", 12000, { method: "POST", headers: { "X-API-KEY": key, "Content-Type": "application/json" }, body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: 20 }) });
    if (!r.ok) return [];
    const j: any = await r.json();
    return (j.shopping || []).map((x: any) => ({ loja: String(x.source || ""), preco: precoBR(x.price), nome: String(x.title || ""), url: x.link })).filter((o: Oferta) => o.preco > 0);
  } catch { return []; }
}

export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(b.ws || ""));
    if (!(await modulosLoja(acesso.workspaceId)).liberado("precos_concorrencia")) return NextResponse.json({ success: false, error: "O módulo de comparação de preços não está liberado para este workspace." }, { status: 403 });
    const itens = (Array.isArray(b.produtos) ? b.produtos : []).slice(0, 10);
    const serper = !!process.env.SERPER_API_KEY;
    const resultado = await Promise.all(itens.map(async (p: any) => {
      const q = [p.marca && !norm(p.nome).includes(norm(p.marca)) ? p.marca : "", p.nome, p.modelo && !norm(p.nome).includes(norm(p.modelo)) ? p.modelo : ""].filter(Boolean).join(" ").slice(0, 120);
      const [kab, shop] = await Promise.all([buscaKabum(q), viaSerper(q)]);
      const melhorKabum = kab.filter((x) => x.preco).map((x) => ({ loja: "KaBuM", preco: x.preco!, nome: x.nome, url: x.url, a: aderencia(x.nome, q) })).filter((x) => x.a >= 0.75).sort((a, c) => c.a - a.a || a.preco - c.preco)[0];
      const daLoja = (rx: RegExp) => shop.filter((o) => rx.test(o.loja) && aderencia(o.nome, q) >= 0.75).sort((a, c) => a.preco - c.preco)[0];
      const terabyte = daLoja(/terabyte/i);
      const kabumShop = melhorKabum ? undefined : daLoja(/kabum/i);
      const outras = shop.filter((o) => !/terabyte|kabum/i.test(o.loja) && aderencia(o.nome, q) >= 0.75).sort((a, c) => a.preco - c.preco).slice(0, 3);
      const kabum = melhorKabum ? { loja: "KaBuM", preco: melhorKabum.preco, nome: melhorKabum.nome, url: melhorKabum.url } : kabumShop || null;
      return { id: p.id, busca: q, kabum, terabyte: terabyte || null, outras };
    }));
    return NextResponse.json({ success: true, serper, resultado });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
