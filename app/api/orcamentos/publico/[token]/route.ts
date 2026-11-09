import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../_auth";
import { normalizarImplantacao, validarImplantacao } from "../../../../lib/orcamento";

// Página pública do orçamento: sem login, o token do link é a credencial.

const SEM_CACHE = { "Cache-Control": "no-store" };
const tokenValido = (t: string) => /^[A-Za-z0-9_-]{40,64}$/.test(t);

async function buscar(token: string) {
  const { data, error } = await supabaseServer.from("wolf_orcamentos").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  return data;
}

function estado(o: { status: string; expira_em: string }) {
  if ((o.status === "enviado" || o.status === "visualizado") && new Date(o.expira_em).getTime() <= Date.now()) return "expirado";
  return o.status;
}

function publico(o: NonNullable<Awaited<ReturnType<typeof buscar>>>) {
  const st = estado(o);
  return {
    numero: o.numero,
    cliente_nome: o.cliente_nome,
    itens: o.itens,
    usuarios_incluidos: o.usuarios_incluidos,
    mensalidade: Number(o.mensalidade),
    configuracao: Number(o.configuracao),
    status: st,
    expira_em: o.expira_em,
    criado_em: o.created_at,
    aceito_em: o.aceito_em,
    // dados de pagamento e formulário só depois do aceite
    pagamento: st === "aceito" ? o.pagamento : null,
    implantacao: st === "aceito" ? o.implantacao : null,
    implantacao_enviada: !!o.implantacao_em,
    implantacao_em: o.implantacao_em,
    agora: new Date().toISOString(),
  };
}

export async function GET(_r: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const o = await buscar(token);
    if (!o) return NextResponse.json({ success: false, error: "Orçamento não encontrado" }, { status: 404 });
    if (o.status === "cancelado") return NextResponse.json({ success: false, error: "Este orçamento foi cancelado" }, { status: 410 });
    const novoStatus = o.status === "enviado" && estado(o) === "enviado" ? "visualizado" : o.status;
    await supabaseServer.from("wolf_orcamentos").update({
      visualizacoes: Number(o.visualizacoes || 0) + 1,
      ...(o.visualizado_em ? {} : { visualizado_em: new Date().toISOString() }),
      status: novoStatus,
    }).eq("id", o.id);
    return NextResponse.json({ success: true, orcamento: publico({ ...o, status: novoStatus }) }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}

// POST { acao: "aceitar" }  |  POST { acao: "implantacao", dados: {...} }
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const b = await request.json().catch(() => ({}));
    const o = await buscar(token);
    if (!o) return NextResponse.json({ success: false, error: "Orçamento não encontrado" }, { status: 404 });
    const agora = new Date().toISOString();

    if (b.acao === "aceitar") {
      const st = estado(o);
      if (st === "expirado") return NextResponse.json({ success: false, error: "O prazo deste orçamento expirou" }, { status: 410 });
      if (st !== "enviado" && st !== "visualizado") return NextResponse.json({ success: false, error: "Este orçamento não pode mais ser aceito" }, { status: 409 });
      const { data: ok, error } = await supabaseServer.from("wolf_orcamentos").update({
        status: "aceito",
        aceito_em: agora,
        aceite_ip: (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64),
        aceite_user_agent: (request.headers.get("user-agent") || "").slice(0, 300),
        updated_at: agora,
      }).eq("id", o.id).in("status", ["enviado", "visualizado"]).gt("expira_em", agora).select("id");
      if (error) throw error;
      if (!ok?.length) return NextResponse.json({ success: false, error: "Este orçamento não pode mais ser aceito" }, { status: 409 });
      return NextResponse.json({ success: true, orcamento: publico({ ...o, status: "aceito", aceito_em: agora }) }, { headers: SEM_CACHE });
    }

    if (b.acao === "implantacao") {
      if (o.status !== "aceito") return NextResponse.json({ success: false, error: "Aceite o orçamento antes de enviar os dados" }, { status: 409 });
      const dados = normalizarImplantacao(b.dados || {}, Number(o.usuarios_incluidos) || 10);
      const erros = validarImplantacao(dados);
      if (erros.length) return NextResponse.json({ success: false, error: erros.join(". ") }, { status: 400 });
      const { error } = await supabaseServer.from("wolf_orcamentos")
        .update({ implantacao: dados, implantacao_em: agora, updated_at: agora }).eq("id", o.id);
      if (error) throw error;
      return NextResponse.json({ success: true, implantacao_em: agora }, { headers: SEM_CACHE });
    }

    return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}
