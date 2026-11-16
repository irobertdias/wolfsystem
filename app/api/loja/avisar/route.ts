import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso } from "../../_auth";
import { avisarEtapa } from "../_avisos";

// Chamado pela tela quando o vendedor muda a etapa do pedido (separação, enviado, entregue).
// POST { ws, pedidoId, etapa }
export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(b.ws || ""));
    const id = Number(b.pedidoId);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ success: false, error: "Pedido inválido" }, { status: 400 });
    const r = await avisarEtapa(acesso.workspaceId, id, String(b.etapa || ""));
    return NextResponse.json({ success: true, ...r });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
