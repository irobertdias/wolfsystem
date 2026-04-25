import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob | null;
    const numero = formData.get("numero") as string | null;
    const canalId = formData.get("canalId") as string | null;
    // 🔒 MULTI-TENANT: workspaceId é obrigatório no backend desde a blindagem multi-tenant.
    // Antes, esse proxy só extraía audio/numero/canalId e descartava o resto do FormData,
    // fazendo o backend rejeitar com "workspaceId obrigatório (segurança multi-tenant)".
    const workspaceId = formData.get("workspaceId") as string | null;

    if (!audioBlob || !numero || !canalId) {
      return NextResponse.json(
        { success: false, error: "audio, numero e canalId são obrigatórios" },
        { status: 400 }
      );
    }
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "workspaceId obrigatório (segurança multi-tenant)" },
        { status: 400 }
      );
    }

    const vpsForm = new FormData();
    vpsForm.append("audio", audioBlob, `audio_${Date.now()}.ogg`);
    vpsForm.append("numero", numero);
    vpsForm.append("canalId", canalId);
    // 🆕 Repassa workspaceId pro backend — sem ele, /enviar-audio retorna 400.
    vpsForm.append("workspaceId", workspaceId);

    const resp = await fetch(`${WHATSAPP_URL}/enviar-audio`, {
      method: "POST",
      body: vpsForm,
      headers: { "ngrok-skip-browser-warning": "true" },
    });

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Erro /api/whatsapp-audio:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao enviar áudio" },
      { status: 500 }
    );
  }
}