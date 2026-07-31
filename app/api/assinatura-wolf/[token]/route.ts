import { NextResponse } from "next/server";
import { headersProxyAssinatura } from "../proxy";

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_URL ||
  "https://api.wolfgyn.com.br";

function tokenValido(token: string) {
  return /^[a-zA-Z0-9_-]{40,100}$/.test(token);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!tokenValido(token)) {
    return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  }
  try {
    let response = await fetch(`${BACKEND}/assinaturas-wolf/envelopes/${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: headersProxyAssinatura(request),
    });
    if (response.status === 404) {
      response = await fetch(`${BACKEND}/assinaturas-wolf/${encodeURIComponent(token)}`, {
        cache: "no-store", headers: headersProxyAssinatura(request),
      });
    }
    const data = await response.json().catch(() => ({ success: false, error: "Resposta inválida" }));
    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Serviço de assinatura temporariamente indisponível" },
      { status: 502 }
    );
  }
}

