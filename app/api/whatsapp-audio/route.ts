import { NextRequest, NextResponse } from "next/server";
import { autenticarWorkspace, exigirAtendimentoDoUsuario, exigirPermissao, respostaErroAcesso, segredoInternoWolf } from "../_auth";
const WHATSAPP_URL = process.env.WHATSAPP_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData(); const audio = formData.get("audio") as Blob | null; const numero = String(formData.get("numero") || ""); const canalId = String(formData.get("canalId") || "");
    if (!audio || !numero || !canalId) return NextResponse.json({ success: false, error: "audio, numero e canalId são obrigatórios" }, { status: 400 });
    const acesso = await autenticarWorkspace(req, String(formData.get("workspaceId") || "")); exigirPermissao(acesso, "chat_proprio", "chat_todos"); await exigirAtendimentoDoUsuario(acesso, numero, canalId);
    const vps = new FormData(); vps.append("audio", audio, `audio_${Date.now()}.ogg`); vps.append("numero", numero); vps.append("canalId", canalId); vps.append("workspaceId", acesso.workspaceId);
    const resp = await fetch(`${WHATSAPP_URL}/enviar-audio`, { method: "POST", body: vps, headers: { "ngrok-skip-browser-warning": "true", "x-wolf-internal-secret": segredoInternoWolf() } });
    const data = await resp.json().catch(() => ({ success: false, error: "Resposta inválida do backend" })); return NextResponse.json(data, { status: resp.status });
  } catch (error) { const item = respostaErroAcesso(error); return NextResponse.json({ success: false, error: item.message }, { status: item.status }); }
}
