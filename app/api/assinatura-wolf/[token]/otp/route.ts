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
  try {
    const response = await fetch(
      `${BACKEND}/assinaturas-wolf/${encodeURIComponent(token)}/otp`,
      {
        method: "POST",
        cache: "no-store",
        headers: headersProxyAssinatura(request, true),
        body: "{}",
      }
    );
    const data = await response.json().catch(() => ({ success: false, error: "Resposta inválida" }));
    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Não foi possível enviar o código" },
      { status: 502 }
    );
  }
}

