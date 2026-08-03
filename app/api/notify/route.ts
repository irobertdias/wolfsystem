import { NextRequest, NextResponse } from "next/server";
import { autenticarUsuario, respostaErroAcesso } from "../_auth";

export async function POST(request: NextRequest) {
  try {
    const acesso = await autenticarUsuario(request);
    if (!acesso.isSuperAdmin) return NextResponse.json({ success: false, error: "Acesso exclusivo do super administrador" }, { status: 403 });
    const body = await request.json();
    const { nome, empresa, whatsapp, email, plano, ia } = body;
    const phone = process.env.CALLMEBOT_PHONE;
    const apikey = process.env.CALLMEBOT_APIKEY;
    if (!phone || !apikey) return NextResponse.json({ success: false, error: "Notificação não configurada" }, { status: 503 });
    const mensagem = `🐺 *NOVO CADASTRO - Wolf System*\n\n👤 *Nome:* ${String(nome || "").slice(0, 120)}\n🏢 *Empresa:* ${String(empresa || "").slice(0, 160)}\n📱 *WhatsApp:* ${String(whatsapp || "").slice(0, 30)}\n📧 *Email:* ${String(email || "").slice(0, 254)}\n📦 *Plano:* ${String(plano || "").slice(0, 100)}\n🤖 *IA:* ${String(ia || "").slice(0, 100)}\n\n⚠️ Acesse o painel para autorizar o acesso.`;
    const response = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(mensagem)}&apikey=${encodeURIComponent(apikey)}`);
    if (!response.ok) return NextResponse.json({ success: false, error: "Falha no provedor de notificação" }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const item = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: item.message }, { status: item.status });
  }
}
