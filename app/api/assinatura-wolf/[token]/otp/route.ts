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
    let response = await fetch(
      `${BACKEND}/assinaturas-wolf/envelopes/${encodeURIComponent(token)}/otp`,
      {
        method: "POST",
        signal: AbortSignal.timeout(40000),
        cache: "no-store",
        headers: headersProxyAssinatura(request, true),
        body: "{}",
      }
    );
    if (response.status === 404) {
      response = await fetch(`${BACKEND}/assinaturas-wolf/${encodeURIComponent(token)}/otp`, {
        method: "POST", cache: "no-store", headers: headersProxyAssinatura(request, true), body: "{}", signal: AbortSignal.timeout(40000),
      });
    }
    if (!response.ok) console.error(`[Wolf Sign OTP] Backend recusou o envio: HTTP ${response.status}`);
    const data = await response.json().catch(() => ({ success: false, error: "Resposta inválida" }));
    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Wolf Sign OTP] Falha ao acessar backend:", error instanceof Error ? error.name : "Erro de conexão");
    return NextResponse.json(
      { success: false, error: "Não foi possível enviar o código" },
      { status: 502 }
    );
  }
}

