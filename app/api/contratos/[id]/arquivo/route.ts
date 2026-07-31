import { NextRequest, NextResponse } from "next/server";
import { autenticarContratos, respostaErroContratos } from "../../_auth";

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_URL ||
  "https://api.wolfgyn.com.br";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ success: false, error: "Contrato inválido" }, { status: 400 });
    }
    const acesso = await autenticarContratos(
      request,
      request.nextUrl.searchParams.get("workspaceId") || ""
    );
    const segredo = process.env.WOLF_SIGNATURE_PROXY_SECRET || "";
    if (segredo.length < 32) throw new Error("Proxy seguro da assinatura não configurado");

    const response = await fetch(
      `${BACKEND}/assinaturas-wolf/admin/${encodeURIComponent(id)}/arquivo?workspaceId=${encodeURIComponent(acesso.workspaceId)}`,
      {
        cache: "no-store",
        headers: { "X-Wolf-Signature-Proxy": segredo, Accept: "application/pdf" },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Arquivo indisponível" }));
      return NextResponse.json({ success: false, error: data.error || "Arquivo indisponível" }, { status: response.status });
    }
    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": response.headers.get("content-disposition") || 'attachment; filename="contrato_assinado.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}