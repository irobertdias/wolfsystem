// app/api/whatsapp-midia/route.ts
// Rota proxy do Next.js pra upload de mídia (arquivos multipart).
// Segue o mesmo padrão de /api/whatsapp-audio — só encaminha o FormData pro backend VPS.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Upload de arquivo até 25MB — aumentar o limite padrão do Next.js
export const maxDuration = 60;

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.wolfgyn.com.br";

export async function POST(req: NextRequest) {
  try {
    // Recebe o FormData do cliente e encaminha pro backend sem modificar
    const formData = await req.formData();

    const resp = await fetch(`${BACKEND_URL}/enviar-midia`, {
      method: "POST",
      body: formData,
      // Não setar Content-Type manualmente — o fetch define o boundary automaticamente
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error: any) {
    console.error("Erro proxy /api/whatsapp-midia:", error.message);
    return NextResponse.json(
      { success: false, error: "Proxy: " + error.message },
      { status: 500 }
    );
  }
}