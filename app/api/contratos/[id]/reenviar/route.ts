import { NextRequest, NextResponse } from "next/server";
import { autenticarContratos, respostaErroContratos } from "../../_auth";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://api.wolfgyn.com.br";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const acesso = await autenticarContratos(request, String(body.workspaceId || ""));
    const { id } = await context.params;
    const response = await fetch(`${BACKEND}/assinaturas-wolf/admin/${encodeURIComponent(id)}/reenviar`, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Wolf-Signature-Proxy": process.env.WOLF_SIGNATURE_PROXY_SECRET || "" },
      body: JSON.stringify({ workspace_id: acesso.workspaceId, expira_horas: Number(body.expira_horas || 48), mensagem: String(body.mensagem || "") }),
    });
    const data = await response.json().catch(() => ({ success: false, error: "Resposta inválida do backend" }));
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}