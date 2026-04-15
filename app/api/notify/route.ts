import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { nome, empresa, whatsapp, email, plano, ia } = body;

  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;

  const mensagem = `🐺 *NOVO CADASTRO - Wolf System*\n\n👤 *Nome:* ${nome}\n🏢 *Empresa:* ${empresa}\n📱 *WhatsApp:* ${whatsapp}\n📧 *Email:* ${email}\n📦 *Plano:* ${plano}\n🤖 *IA:* ${ia}\n\n⚠️ Acesse o painel para autorizar o acesso!`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(mensagem)}&apikey=${apikey}`;

  try {
    await fetch(url);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Erro ao enviar mensagem" }, { status: 500 });
  }
}