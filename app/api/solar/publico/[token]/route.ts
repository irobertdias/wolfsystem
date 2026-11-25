import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../_auth";
import { tokenValido, lerConfigSolar, propostaPublica, dadosSolar, atualizarSolar, avisarEmpresaSolar } from "../../_solar";

// Página pública da proposta solar (/solar/[token]). Sem login: o token do link é a credencial.
// GET → dados da proposta · POST { acao: "aceitar" | "recusar" | "visita", ... }

const SEM_CACHE = { "Cache-Control": "no-store" };

async function buscar(token: string) {
  const { data, error } = await supabaseServer.from("proposta")
    .select("id,workspace_id,created_at,data_proposta,nome,telefone1,endereco,cidade,estado,status_venda,valor_plano,dados_customizados")
    .eq("dados_customizados->solar->>token", token).limit(1).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function GET(_r: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const p = await buscar(token);
    if (!p) return NextResponse.json({ success: false, error: "Proposta não encontrada" }, { status: 404 });
    const { cfg } = await lerConfigSolar(p.workspace_id);
    const d = dadosSolar(p);
    if (!d.visualizado_em) await atualizarSolar(p.id, "Cliente abriu a proposta", () => ({ visualizado_em: new Date().toISOString() })).catch(() => {});
    return NextResponse.json({ success: true, proposta: propostaPublica(p, cfg) }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const b = await request.json().catch(() => ({}));
    const p = await buscar(token);
    if (!p) return NextResponse.json({ success: false, error: "Proposta não encontrada" }, { status: 404 });
    const { cfg } = await lerConfigSolar(p.workspace_id);
    const atual = propostaPublica(p, cfg);
    const acao = String(b.acao || "");
    const txt = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

    if (acao === "aceitar") {
      if (atual.status === "aceita") return NextResponse.json({ success: true, proposta: atual });
      if (atual.status !== "aberta") return NextResponse.json({ success: false, error: atual.status === "expirada" ? "Esta proposta expirou. Peça uma nova." : "Esta proposta não está mais aberta." }, { status: 409 });
      const pagamento = txt(b.pagamento, 80) || cfg.formas_pagamento[0] || "";
      const prazo = Math.round(Number(b.prazo) || 0) || null;
      const endereco = txt(b.endereco, 200);
      await atualizarSolar(p.id, `Cliente aceitou a proposta pelo link (${pagamento}${prazo ? ` em ${prazo}x` : ""})`,
        () => ({ aceite: { em: new Date().toISOString(), pagamento, prazo, por: "link", nome: txt(b.nome, 120), cpf: txt(b.cpf, 20), endereco } }),
        "ACEITA", endereco ? { endereco } : {});
      await avisarEmpresaSolar(p.workspace_id, p.id, "aceite", txt(b.obs, 300) ? `Obs. do cliente: ${txt(b.obs, 300)}` : "");
    } else if (acao === "recusar") {
      if (atual.status !== "aberta") return NextResponse.json({ success: false, error: "Esta proposta não está mais aberta." }, { status: 409 });
      const motivo = txt(b.motivo, 300) || "não informado";
      await atualizarSolar(p.id, `Cliente recusou pelo link: ${motivo}`, () => ({ recusa: { em: new Date().toISOString(), motivo, por: "link" } }), "PERDIDA");
      await avisarEmpresaSolar(p.workspace_id, p.id, "recusa", `Motivo: ${motivo}`);
    } else if (acao === "visita") {
      const data = txt(b.data, 60), endereco = txt(b.endereco, 200);
      await atualizarSolar(p.id, `Cliente pediu visita técnica${data ? ` (${data})` : ""}`, () => ({ visita: { pedida_em: new Date().toISOString(), data, endereco, obs: txt(b.obs, 300) } }),
        ["LEAD", "PROPOSTA ENVIADA", "ACEITA"].includes(p.status_venda || "") ? "VISITA TECNICA" : undefined, endereco ? { endereco } : {});
      await avisarEmpresaSolar(p.workspace_id, p.id, "visita", [data && `Data sugerida: ${data}`, endereco && `Endereço: ${endereco}`, txt(b.obs, 300)].filter(Boolean).join("\n"));
    } else {
      return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 });
    }
    const novo = await buscar(token);
    return NextResponse.json({ success: true, proposta: propostaPublica(novo, cfg) }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}
