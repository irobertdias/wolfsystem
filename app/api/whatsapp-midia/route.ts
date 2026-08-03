import { NextRequest, NextResponse } from "next/server";
import { autenticarWorkspace, exigirAtendimentoDoUsuario, exigirPermissao, respostaErroAcesso, segredoInternoWolf } from "../_auth";
export const runtime = "nodejs"; export const maxDuration = 60;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.WHATSAPP_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://api.wolfgyn.com.br";
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData(); const numero = String(formData.get("numero") || ""); const canalId = String(formData.get("canalId") || ""); if (!numero || !canalId) return NextResponse.json({ success: false, error: "numero e canalId são obrigatórios" }, { status: 400 }); const acesso = await autenticarWorkspace(req, String(formData.get("workspaceId") || "")); exigirPermissao(acesso, "chat_proprio", "chat_todos"); await exigirAtendimentoDoUsuario(acesso, numero, canalId);
    formData.set("workspaceId", acesso.workspaceId); const resp = await fetch(`${BACKEND_URL}/enviar-midia`, { method: "POST", body: formData, headers: { "x-wolf-internal-secret": segredoInternoWolf() } });
    const data = await resp.json().catch(() => ({ success: false, error: "Resposta inválida do backend" })); return NextResponse.json(data, { status: resp.status });
  } catch (error) { const item = respostaErroAcesso(error); return NextResponse.json({ success: false, error: item.message }, { status: item.status }); }
}
