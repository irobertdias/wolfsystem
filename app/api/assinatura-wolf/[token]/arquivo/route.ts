import { NextResponse } from "next/server";
import { headersProxyAssinatura } from "../../proxy";

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_URL ||
  "https://api.wolfgyn.com.br";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!/^[a-zA-Z0-9_-]{40,100}$/.test(token)) {
    return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  }
  try {
    let response = await fetch(
      `${BACKEND}/assinaturas-wolf/envelopes/${encodeURIComponent(token)}/arquivo`,
      { cache: "no-store", headers: headersProxyAssinatura(request) }
    );
    if (response.status === 404) {
      response = await fetch(`${BACKEND}/assinaturas-wolf/${encodeURIComponent(token)}/arquivo`, {
        cache: "no-store", headers: headersProxyAssinatura(request),
      });
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Arquivo indisponível" }));
      return NextResponse.json(data, { status: response.status });
    }
    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": response.headers.get("content-disposition") || 'inline; filename="contrato.pdf"',
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Arquivo indisponível" }, { status: 502 });
  }
}

