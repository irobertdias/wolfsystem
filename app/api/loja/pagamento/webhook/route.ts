import { NextResponse, type NextRequest } from "next/server";
import { lerGateway, consultarPagamento, confirmarPagamento, type Gateway } from "../../_pagamento";

// Aviso de pagamento dos gateways (Mercado Pago e Asaas).
// Sem login: o aviso só serve de gatilho. O pagamento é consultado de novo no gateway
// com a chave do lojista (?ws=) e só então o pedido recebe a baixa.

async function tratar(request: NextRequest, corpo: any) {
  const q = request.nextUrl.searchParams;
  const ws = q.get("ws") || "";
  const gw = (q.get("g") || "") as Gateway;
  if (!ws || ws.length > 120 || /[\s/?#]/.test(ws)) return NextResponse.json({ ok: false }, { status: 400 });
  const g = await lerGateway(ws);
  if (!g || g.gateway !== gw) return NextResponse.json({ ok: true, ignorado: "gateway não configurado" });

  let id = "";
  if (gw === "mercadopago") {
    const tipo = corpo?.type || corpo?.topic || q.get("type") || q.get("topic") || "";
    if (tipo && tipo !== "payment") return NextResponse.json({ ok: true, ignorado: tipo });
    id = String(corpo?.data?.id || q.get("data.id") || q.get("id") || "");
  } else {
    id = String(corpo?.payment?.id || "");
  }
  if (!id) return NextResponse.json({ ok: true, ignorado: "sem id" });

  const pg = await consultarPagamento(g, id);
  if (!pg) return NextResponse.json({ ok: true, ignorado: "pagamento não encontrado" });
  const pedidoId = Number(pg.ref);
  if (!pg.pago || !Number.isFinite(pedidoId) || pedidoId <= 0) return NextResponse.json({ ok: true, status: pg.status });
  const r = await confirmarPagamento(ws, pedidoId, { gateway: gw, id, valor: pg.valor, metodo: pg.metodo });
  return NextResponse.json({ ...r, ok: true });
}

export async function POST(request: NextRequest) {
  try { return await tratar(request, await request.json().catch(() => ({}))); }
  catch { return NextResponse.json({ ok: false }, { status: 500 }); } // o gateway reenvia
}
export async function GET(request: NextRequest) {
  try { return await tratar(request, {}); }
  catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}
