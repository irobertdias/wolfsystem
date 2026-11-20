import { NextResponse, type NextRequest } from "next/server";
import { autenticarUsuario, respostaErroAcesso } from "../../_auth";

// Testa a leitura do catálogo da Vendedora IA (planilha do Google ou API), do mesmo
// jeito que o servidor do WhatsApp lê, para o cliente conferir antes de salvar.

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z_]/g, "");
const COLUNAS: Record<string, string[]> = {
  nome: ["nome", "produto", "servico", "item", "titulo", "plano", "name", "product", "title"],
  preco: ["preco", "valor", "price", "preco_venda", "valor_venda"],
};
function csv(texto: string) {
  const linhas: string[][] = []; let campo = "", linha: string[] = [], aspas = false;
  const sep = texto.slice(0, 500).includes(",") ? "," : ";";
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => x.trim()));
}
function item(o: Record<string, unknown>) {
  const ch = Object.keys(o);
  const pega = (k: string) => { const c = ch.find((x) => COLUNAS[k].includes(sem(x))); return c ? o[c] : undefined; };
  const nome = String(pega("nome") ?? "").trim();
  if (!nome) return null;
  const p = pega("preco");
  const preco = typeof p === "number" ? p : Number(String(p ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return { nome, preco: Number.isFinite(preco) && String(p ?? "").trim() !== "" ? preco : null };
}
function urlPlanilha(u: string) {
  const m = u.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (m && !/output=csv|format=csv/.test(u)) { const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1] || "0"; return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`; }
  return u;
}

export async function POST(request: NextRequest) {
  try { await autenticarUsuario(request); } catch (e) { const { status, message } = respostaErroAcesso(e); return NextResponse.json({ ok: false, erro: message }, { status }); }
  const b = await request.json().catch(() => ({}));
  const fonte = b.fonte === "api" ? "api" : "planilha";
  const url = fonte === "planilha" ? urlPlanilha(String(b.url || "").trim()) : String(b.url || "").trim();
  if (!/^https:\/\//.test(url)) return NextResponse.json({ ok: false, erro: fonte === "planilha" ? "Cole o link da planilha do Google." : "Informe a URL (https://)." });
  const headers: Record<string, string> = {};
  for (const l of String(b.headers || "").split("\n")) { const i = l.indexOf(":"); if (i > 0) headers[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  try {
    const r = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!r.ok) return NextResponse.json({ ok: false, erro: `Respondeu ${r.status}.${fonte === "planilha" ? " Compartilhe a planilha como “qualquer pessoa com o link pode ver”." : ""}` });
    let itens: ({ nome: string; preco: number | null } | null)[];
    if (fonte === "planilha") {
      const t = await r.text();
      if (/<html/i.test(t.slice(0, 200))) return NextResponse.json({ ok: false, erro: "A planilha não está pública. Compartilhar → Qualquer pessoa com o link → Leitor." });
      const [cab, ...linhas] = csv(t);
      if (!cab?.some((h) => COLUNAS.nome.includes(sem(h)))) return NextResponse.json({ ok: false, erro: `Não achei a coluna "nome" na primeira linha. Colunas lidas: ${(cab || []).join(", ") || "nenhuma"}.` });
      itens = linhas.map((l) => item(Object.fromEntries(cab.map((h, k) => [h, l[k] ?? ""]))));
    } else {
      let j = await r.json().catch(() => null);
      if (!Array.isArray(j)) j = j?.produtos || j?.items || j?.itens || j?.data || j?.results || j?.ofertas || [];
      itens = (Array.isArray(j) ? j : []).map((o: Record<string, unknown>) => item(o || {}));
    }
    const ok = itens.filter(Boolean) as { nome: string; preco: number | null }[];
    if (!ok.length) return NextResponse.json({ ok: false, erro: "Li a fonte, mas não achei nenhum item com nome." });
    return NextResponse.json({ ok: true, total: ok.length, itens: ok.slice(0, 5), sem_preco: ok.filter((i) => i.preco === null).length });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: "Não consegui ler: " + (e instanceof Error ? e.message : "erro") });
  }
}
