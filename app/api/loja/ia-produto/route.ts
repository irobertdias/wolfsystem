import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, autenticarWorkspace, respostaErroAcesso, SUPER_ADMIN_EMAIL } from "../../_auth";
import { buscarImagens, buscaKabum, imagensWikimedia, type FotoAchada, type ProdutoLoja } from "../_web";
import { lerChaveCadastro } from "../_ia-chave";

// IA no cadastro de produtos das lojas.
// 1) Busca o produto sozinha (sem depender da IA): fotos do Bing Imagens e,
//    em informática/vendas, os produtos da busca da KaBuM (nome, preço, foto, descrição).
// 2) A IA (chave de Ajustes da loja) organiza isso nos campos do cadastro.
//    Se não houver nada encontrado, a IA pesquisa na web por conta própria.
// 3) Se a IA falhar, o cadastro é preenchido com o que a busca achou.
// Chamada direta por fetch (o projeto não tem o SDK instalado no ambiente de build).

export const maxDuration = 60;

type Achado = { nome?: string; marca?: string; modelo?: string; categoria?: string; descricao?: string; especificacoes?: string[]; preco_medio?: number; garantia_meses?: number; ean?: string; fontes?: string[]; imagens?: string[] };

const FORMATO = (categorias: string[]) => `{"nome":"nome comercial completo","marca":"","modelo":"","categoria":"uma destas: ${categorias.join(", ") || "livre"}","descricao":"2 a 3 frases para vender o produto","especificacoes":["até 8 itens curtos"],"preco_medio":0,"garantia_meses":0,"ean":""}`;

const PROMPT_CONTEXTO = (q: string, nicho: string, categorias: string[], contexto: string) => `Você ajuda a cadastrar produtos numa loja do ramo ${nicho} no Brasil.
O lojista digitou: "${q}".
Resultados encontrados em lojas e na busca de imagens:
${contexto}

Monte o cadastro do produto que o lojista procura. Use os resultados e o que você sabe do produto.
Responda APENAS com um objeto JSON neste formato:
${FORMATO(categorias)}
preco_medio = preço médio em reais no varejo brasileiro (número). Campo desconhecido fica vazio.`;

const PROMPT_WEB = (q: string, nicho: string, categorias: string[]) => `Pesquise na web o produto "${q}" (loja do ramo ${nicho}, Brasil).
Responda APENAS com um objeto JSON, sem texto antes ou depois, neste formato:
${FORMATO(categorias).slice(0, -1)},"fontes":["URLs das páginas usadas"],"imagens":["URLs diretas de fotos do produto"]}
preco_medio = preço médio em reais no varejo brasileiro (número). Campo desconhecido fica vazio.`;

function extrairJson(texto: string): Achado | null {
  const limpo = texto.replace(/```(?:json)?/gi, "").replace(/【[^】]*】/g, "");
  const i = limpo.indexOf("{"), f = limpo.lastIndexOf("}");
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(limpo.slice(i, f + 1)); } catch {}
  try { return JSON.parse(limpo.slice(i, f + 1).replace(/,\s*([}\]])/g, "$1")); } catch { return null; }
}

async function comClaude(chave: string, prompt: string, web: boolean) {
  const messages: any[] = [{ role: "user", content: prompt }];
  let texto = "";
  for (let volta = 0; volta < 3; volta++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "anthropic-beta": "server-side-fallback-2026-07-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-5-5", max_tokens: 3000,
        output_config: { effort: "low" },
        fallbacks: "default",
        ...(web ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "BR" } }] } : {}),
        messages,
      }),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `Claude ${r.status}`);
    texto = "";
    for (const b of j.content || []) if (b.type === "text") texto += b.text;
    if (j.stop_reason === "refusal") throw new Error("A IA recusou esta busca");
    if (j.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: j.content });
  }
  return texto;
}

async function comOpenAI(chave: string, prompt: string, web: boolean) {
  if (!web) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `OpenAI ${r.status}`);
    return String(j.choices?.[0]?.message?.content || "");
  }
  const pedir = (tipo: string) => fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", tools: [{ type: tipo, user_location: { type: "approximate", country: "BR" } }], input: prompt }),
  });
  let r = await pedir("web_search");
  if (r.status === 400) r = await pedir("web_search_preview");
  const j: any = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI ${r.status}`);
  let texto = "";
  for (const item of j.output || []) if (item.type === "message") for (const c of item.content || []) if (c.type === "output_text") texto += c.text;
  return texto || String(j.output_text || "");
}

async function chaveDoWorkspace(ws: string): Promise<{ ia: "claude" | "gpt"; chave: string } | null> {
  const propria = await lerChaveCadastro(ws);
  if (propria) return propria;
  if (process.env.ANTHROPIC_API_KEY) return { ia: "claude", chave: process.env.ANTHROPIC_API_KEY };
  if (process.env.OPENAI_API_KEY) return { ia: "gpt", chave: process.env.OPENAI_API_KEY };
  return null;
}

/** Palavras da busca que aparecem no nome (para pegar o produto certo da lista da loja). */
function aderencia(nome: string, q: string) {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const n = norm(nome); const termos = norm(q).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  return termos.filter((t) => n.includes(t)).length / Math.max(1, termos.length);
}

export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(b.ws || ""));
    const q = String(b.q || "").trim().slice(0, 160);
    if (q.length < 3) return NextResponse.json({ success: false, error: "Digite o nome do produto (mínimo 3 letras)." }, { status: 400 });
    const nicho = String(b.nicho || "loja");
    const categorias: string[] = Array.isArray(b.categorias) ? b.categorias.slice(0, 20).map(String) : [];

    // Módulo liberado pelo admin (cadastros.nicho_opcoes.ia_cadastro)
    if (!acesso.isSuperAdmin) {
      const { data: ws } = await supabaseServer.from("workspaces").select("owner_email").eq("username", acesso.workspaceId).maybeSingle();
      const dono = String((ws as any)?.owner_email || "").toLowerCase();
      if (dono !== SUPER_ADMIN_EMAIL) {
        const { data: cad } = await supabaseServer.from("cadastros").select("nicho_opcoes").ilike("email", dono).maybeSingle();
        if ((cad as any)?.nicho_opcoes?.ia_cadastro !== true) return NextResponse.json({ success: false, error: "A IA no cadastro de produtos não está liberada para este workspace." }, { status: 403 });
      }
    }

    const ia = await chaveDoWorkspace(acesso.workspaceId);

    // 1) Busca própria, em paralelo
    const termoImagem = nicho === "roupas" ? `${q} roupa` : q;
    const [bing, lojas] = await Promise.all([
      buscarImagens(termoImagem),
      nicho === "informatica" || nicho === "vendas" ? buscaKabum(q) : Promise.resolve([] as ProdutoLoja[]),
    ]);
    const lojasOrdenadas = [...lojas].sort((a, b2) => aderencia(b2.nome, q) - aderencia(a.nome, q)).slice(0, 5);
    const melhor = lojasOrdenadas[0] && aderencia(lojasOrdenadas[0].nome, q) >= 0.5 ? lojasOrdenadas[0] : undefined;

    const contexto = [
      ...lojasOrdenadas.map((p) => `- ${p.loja}: ${p.nome}${p.preco ? ` · R$ ${p.preco}` : ""}${p.descricao ? ` · ${p.descricao.slice(0, 350)}` : ""}`),
      ...bing.filter((f) => f.titulo).slice(0, 8).map((f) => `- imagem: ${f.titulo}${f.pagina ? ` (${new URL(f.pagina).hostname})` : ""}`),
    ].join("\n");

    // 2) IA organiza os dados
    let achado: Achado = {};
    let aviso = "";
    if (!ia) aviso = "Sem chave de IA em Ajustes: preenchi só com o que a busca encontrou.";
    else {
      try {
        const temContexto = contexto.length > 40;
        const prompt = temContexto ? PROMPT_CONTEXTO(q, nicho, categorias, contexto) : PROMPT_WEB(q, nicho, categorias);
        const texto = ia.ia === "claude" ? await comClaude(ia.chave, prompt, !temContexto) : await comOpenAI(ia.chave, prompt, !temContexto);
        achado = extrairJson(texto) || {};
        if (!achado.nome) aviso = "A IA não organizou os dados desta vez; preenchi com o que a busca encontrou.";
      } catch (e: any) {
        aviso = `A IA respondeu com erro (${String(e?.message || e).slice(0, 140)}). Preenchi com o que a busca encontrou.`;
      }
    }

    // 3) Reserva: dados da loja encontrada
    if (melhor) {
      achado = {
        ...achado,
        nome: achado.nome || melhor.nome,
        marca: achado.marca || (melhor.marca && !/kabum/i.test(melhor.marca) ? melhor.marca : undefined),
        descricao: achado.descricao || melhor.descricao?.slice(0, 400),
        preco_medio: achado.preco_medio || melhor.preco,
      };
    }
    if (!achado.nome && bing[0]?.titulo) achado.nome = bing[0].titulo;

    // Fotos: da loja (as mais certas) + Bing; Wikimedia só se não achar nada
    const vistos = new Set<string>();
    let fotos: FotoAchada[] = [];
    const add = (f: FotoAchada) => { if (f.url && !vistos.has(f.url)) { vistos.add(f.url); fotos.push(f); } };
    lojasOrdenadas.filter((p) => p.imagem && aderencia(p.nome, q) >= 0.5).forEach((p) => add({ url: p.imagem!, pagina: p.url, titulo: p.nome }));
    (achado.imagens || []).filter((u) => /^https?:\/\//.test(u)).forEach((u) => add({ url: u }));
    bing.forEach(add);
    if (fotos.length < 3) (await imagensWikimedia(achado.nome || q)).forEach((u) => add({ url: u }));
    fotos = fotos.slice(0, 24);

    const fontes = [...new Set([melhor?.url, ...(achado.fontes || []), ...bing.slice(0, 3).map((f) => f.pagina)].filter(Boolean) as string[])].slice(0, 5);
    delete achado.imagens;
    return NextResponse.json({ success: true, dados: { ...achado, fontes }, fotos, ia: ia?.ia || null, aviso });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
