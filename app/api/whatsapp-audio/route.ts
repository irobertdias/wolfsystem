import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    // Pega o FormData do cliente
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob | null;
    const numero = formData.get("numero") as string | null;
    const workspaceId = formData.get("workspaceId") as string | null;

    if (!audioBlob || !numero || !workspaceId) {
      return NextResponse.json(
        { success: false, error: "audio, numero e workspaceId são obrigatórios" },
        { status: 400 }
      );
    }

    // Reenvia pro VPS com FormData
    const vpsForm = new FormData();
    // Renomeia pra .ogg (WhatsApp prefere esse formato)
    vpsForm.append("audio", audioBlob, `audio_${Date.now()}.ogg`);
    vpsForm.append("numero", numero);
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