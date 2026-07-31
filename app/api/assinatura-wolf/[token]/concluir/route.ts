import { NextResponse } from "next/server";
import { headersProxyAssinatura } from "../../proxy";

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_URL ||
  "https://api.wolfgyn.com.br";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!/^[a-zA-Z0-9_-]{40,100}$/.test(token)) {
    return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "Envio maior que 8 MB" }, { status: 413 });
  }
  try {
    const body = await request.text();
    const response = await fetch(
      `${BACKEND}/assinaturas-wolf/${encodeURIComponent(token)}/concluir`,
      {
        method: "POST",
        cache: "no-store",
        headers: headersProxyAssinatura(request, true),
        body,
      }
    );
    const data = await response.json().catch(() => ({ success: false, error: "Resposta inválida" }));
    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Não foi possível concluir a assinatura" },
      { status: 502 }
    );
  }
}

