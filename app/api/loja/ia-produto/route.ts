import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, autenticarWorkspace, respostaErroAcesso, SUPER_ADMIN_EMAIL } from "../../_auth";
import { imagensDaPagina, imagensWikimedia } from "../_web";
import { lerChaveCadastro } from "../_ia-chave";

// IA no cadastro de produtos das lojas: pesquisa o produto na web e devolve
// dados para preencher o cadastro + fotos tiradas das páginas encontradas.
// Usa a chave de IA cadastrada em Ajustes da loja (não a do atendimento).
// Chamada direta por fetch (o projeto não tem o SDK instalado no ambiente de build).

export const maxDuration = 60;

type Achado = { nome?: string; marca?: string; modelo?: string; categoria?: string; descricao?: string; especificacoes?: string[]; preco_medio?: number; garantia_meses?: number; ean?: string; fontes?: string[]; imagens?: string[] };

const PROMPT = (q: string, nicho: string, categorias: string[]) => `Pesquise na web o produto "${q}" (loja do ramo ${nicho}, Brasil).
Responda APENAS com um objeto JSON, sem texto antes ou depois, neste formato:
{"nome":"nome comercial completo","marca":"","modelo":"","categoria":"uma destas: ${categorias.join(", ") || "livre"}","descricao":"2 a 3 frases para vender o produto","especificacoes":["até 8 itens curtos"],"preco_medio":0,"garantia_meses":0,"ean":"","fontes":["URLs das páginas de produto usadas (lojas ou fabricante)"],"imagens":["URLs diretas de fotos do produto, se encontrar"]}
Use preço médio em reais no varejo brasileiro (número). Se não souber um campo, deixe vazio.`;

function extrairJson(texto: string): Achado | null {
  const i = texto.indexOf("{"), f = texto.lastIndexOf("}");
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(texto.slice(i, f + 1)); } catch { return null; }
}

async function comClaude(chave: string, prompt: string) {
  const messages: any[] = [{ role: "user", content: prompt }];
  const fontes = new Set<string>();
  let texto = "";
  for (let volta = 0; volta < 3; volta++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "anthropic-beta": "server-side-fallback-2026-07-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-5-5", max_tokens: 4000,
        output_config: { effort: "low" },
        fallbacks: "default",
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "BR" } }],
        messages,
      }),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `Claude ${r.status}`);
    for (const b of j.content || []) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const x of b.content) if (x?.url) fontes.add(x.url);
      if (b.type === "text") texto += b.text;
    }
    if (j.stop_reason === "refusal") throw new Error("A IA não respondeu a esta busca");
    if (j.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: j.content }); // continua a busca pausada
  }
  return { texto, fontes: [...fontes] };
}

async function comOpenAI(chave: string, prompt: string) {
  const pedir = (tipo: string) => fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", tools: [{ type: tipo, user_location: { type: "approximate", country: "BR" } }], input: prompt }),
  });
  let r = await pedir("web_search");
  if (r.status === 400) r = await pedir("web_search_preview");
  const j: any = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI ${r.status}`);
  let texto = ""; const fontes = new Set<string>();
  for (const item of j.output || []) {
    if (item.type !== "message") continue;
    for (const c of item.content || []) {
      if (c.type === "output_text") { texto += c.text; for (const a of c.annotations || []) if (a?.url) fontes.add(a.url); }
    }
  }
  return { texto, fontes: [...fontes] };
}

// Chave cadastrada em Ajustes da loja (separada da IA do atendimento).
async function chaveDoWorkspace(ws: string): Promise<{ ia: "claude" | "gpt"; chave: string } | null> {
  const propria = await lerChaveCadastro(ws);
  if (propria) return propria;
  if (process.env.ANTHROPIC_API_KEY) return { ia: "claude", chave: process.env.ANTHROPIC_API_KEY };
  if (process.env.OPENAI_API_KEY) return { ia: "gpt", chave: process.env.OPENAI_API_KEY };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(b.ws || ""));
    const q = String(b.q || "").trim().slice(0, 160);
    if (q.length < 3) return NextResponse.json({ success: false, error: "Digite o nome do produto (mínimo 3 letras)." }, { status: 400 });

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
    if (!ia) return NextResponse.json({ success: false, error: "Cadastre a chave de IA do cadastro em Ajustes da loja (card \"IA no cadastro de produtos\")." }, { status: 400 });

    const prompt = PROMPT(q, String(b.nicho || "loja"), Array.isArray(b.categorias) ? b.categorias.slice(0, 20).map(String) : []);
    const { texto, fontes } = ia.ia === "claude" ? await comClaude(ia.chave, prompt) : await comOpenAI(ia.chave, prompt);
    const achado = extrairJson(texto) || {};

    // Fotos: as que a IA indicou + as das páginas de produto encontradas + Wikimedia
    const paginas = [...new Set([...(achado.fontes || []), ...fontes])].filter((u) => /^https?:\/\//.test(u)).slice(0, 6);
    const dasPaginas = (await Promise.all(paginas.map((u) => imagensDaPagina(u)))).flat();
    let fotos = [...new Set([...(achado.imagens || []).filter((u) => /^https?:\/\/.+\.(jpe?g|png|webp)(\?|$)/i.test(u)), ...dasPaginas])];
    if (fotos.length < 4) fotos = [...new Set([...fotos, ...(await imagensWikimedia(achado.nome || q))])];

    return NextResponse.json({ success: true, dados: { ...achado, fontes: paginas }, fotos: fotos.slice(0, 12), ia: ia.ia });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
