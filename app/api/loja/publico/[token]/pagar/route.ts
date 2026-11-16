import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../../_auth";
import { lerGateway, criarCobranca, consultarPagamento, confirmarPagamento, NOME_GATEWAY } from "../../../_pagamento";

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
    if (["CANCELADA", "PERDIDA"].includes(x.status_venda)) return NextResponse.json({ success: false, error: "Este pedido foi cancelado" }, { status: 409 });
    if (d.pagamento_online?.status === "pago") return NextResponse.json({ success: false, error: "Este pedido já está pago" }, { status: 409 });
    const g = await lerGateway(x.workspace_id);
    if (!g) return NextResponse.json({ success: false, error: "A loja não ativou o pagamento online" }, { status: 400 });

    // Reaproveita a cobrança já criada (mesmo gateway, mesmo valor, menos de 2 dias)
    const total = Number(x.valor_plano) || 0;
    const po = d.pagamento_online;
    if (po?.url && po.gateway === g.gateway && Number(po.valor) === total && Date.now() - new Date(po.criado_em).getTime() < 2 * 86400_000) {
      return NextResponse.json({ success: true, url: po.url });
    }
    if (total <= 0) return NextResponse.json({ success: false, error: "Pedido sem valor" }, { status: 400 });

    const { data: cfg } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", x.workspace_id).maybeSingle();
    const emp = (cfg as any)?.config?.loja?.empresa || {};
    const doc = String(b.documento || x.cpf || "").replace(/\D/g, "");
    const origem = request.nextUrl.origin;
    const cob = await criarCobranca(g, {
      ws: x.workspace_id, pedidoId: x.id, numero: d.numero || String(x.id), total,
      descricao: `Pedido nº ${d.numero || x.id}${emp.nome ? ` - ${emp.nome}` : ""}`,
      cliente: { nome: x.nome, documento: doc, email: x.email || undefined, telefone: x.telefone1 || undefined },
      voltar: `${origem}/pedido/${token}?pagamento=retorno`, origem,
    });
    const agora = new Date().toISOString();
    const novo = { ...d, pagamento_online: { gateway: g.gateway, cobranca_id: cob.id, url: cob.url, valor: total, status: "aguardando", criado_em: agora },
      historico: [...(d.historico || []), { em: agora, nota: `Cliente abriu o pagamento online (${NOME_GATEWAY[g.gateway]})`, por: "cliente" }] };
    await supabaseServer.from("proposta").update({ ...(doc && !x.cpf ? { cpf: doc } : {}), dados_customizados: { ...x.dados_customizados, pedido: novo } }).eq("id", x.id);
    return NextResponse.json({ success: true, url: cob.url });
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
