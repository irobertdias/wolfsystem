import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../../_auth";
import { modulosLoja } from "../../../_modulos";
import { lerGateway, consultarPagamento, confirmarPagamento, linkPagamentoDoPedido } from "../../../_pagamento";

// Link de pagamento online do pedido aceito (gateway do lojista).
// POST { documento? } → { url }. O valor vem sempre do banco.
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const b = await request.json().catch(() => ({}));
    const { data: p } = await supabaseServer.from("proposta").select("id,workspace_id,nome,cpf,email,telefone1,status_venda,valor_plano,dados_customizados").eq("dados_customizados->pedido->>link_token", token).limit(1).maybeSingle();
    if (!p) return NextResponse.json({ success: false, error: "Pedido não encontrado" }, { status: 404 });
    const x: any = p; const d = x.dados_customizados?.pedido || {};
    if (!d.aceite) return NextResponse.json({ success: false, error: "Aprove o orçamento antes de pagar" }, { status: 409 });
    if (!(await modulosLoja(x.workspace_id)).liberado("pagamento_online")) return NextResponse.json({ success: false, error: "A loja não ativou o pagamento online" }, { status: 400 });
    const r = await linkPagamentoDoPedido(x, request.nextUrl.origin, b.documento);
    if (r.erro) return NextResponse.json({ success: false, error: r.erro }, { status: 409 });
    return NextResponse.json({ success: true, url: r.url });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || "Não foi possível abrir o pagamento").slice(0, 200) }, { status: 502 });
  }
}

// GET ?pagamento_id= (Mercado Pago devolve no retorno) → confere e dá baixa sem esperar o aviso.
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return NextResponse.json({ success: false }, { status: 400 });
  try {
    const id = request.nextUrl.searchParams.get("pagamento_id") || "";
    const { data: p } = await supabaseServer.from("proposta").select("id,workspace_id,dados_customizados").eq("dados_customizados->pedido->>link_token", token).limit(1).maybeSingle();
    if (!p) return NextResponse.json({ success: false }, { status: 404 });
    const x: any = p; const d = x.dados_customizados?.pedido || {};
    if (d.pagamento_online?.status === "pago") return NextResponse.json({ success: true, pago: true });
    const g = await lerGateway(x.workspace_id);
    if (!g || !id) return NextResponse.json({ success: true, pago: false });
    const pg = await consultarPagamento(g, id);
    if (pg?.pago && Number(pg.ref) === x.id) { await confirmarPagamento(x.workspace_id, x.id, { gateway: g.gateway, id, valor: pg.valor, metodo: pg.metodo }); return NextResponse.json({ success: true, pago: true }); }
    return NextResponse.json({ success: true, pago: false, status: pg?.status || "" });
  } catch {
    return NextResponse.json({ success: false }, { status: 502 });
  }
}
