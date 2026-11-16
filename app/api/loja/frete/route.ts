import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso } from "../../_auth";
import { lerConfigLoja } from "../_ia-chave";
import { calcularFrete } from "../_frete";
import { modulosLoja, lojaComModulos } from "../_modulos";

// Cálculo de frete para o vendedor (modal do orçamento/pedido).
// POST { ws, cep, itens }
export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(b.ws || ""));
    const { config } = await lerConfigLoja(acesso.workspaceId);
    const itens = Array.isArray(b.itens) ? b.itens.slice(0, 100) : [];
    const { liberado } = await modulosLoja(acesso.workspaceId);
    const r = await calcularFrete(lojaComModulos(config.loja || {}, liberado), String(b.cep || ""), itens);
    return NextResponse.json({ success: true, ...r });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
