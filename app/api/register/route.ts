import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../_auth";

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const janela = new Map<string, { inicio: number; tentativas: number }>();

function ipDaRequisicao(request: NextRequest) {
  return (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "desconhecido").split(",")[0].trim();
}

function limitar(request: NextRequest, maximo: number, duracaoMs: number) {
  const agora = Date.now();
  const chave = `${request.method}:${ipDaRequisicao(request)}`;
  const atual = janela.get(chave);
  if (!atual || agora - atual.inicio >= duracaoMs) {
    janela.set(chave, { inicio: agora, tentativas: 1 });
    return false;
  }
  atual.tentativas += 1;
  return atual.tentativas > maximo;
}

function texto(value: unknown, maximo = 200) {
  return String(value || "").trim().slice(0, maximo);
}

async function notificarCadastro(dados: Record<string, string>) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) return;
  const mensagem = `🐺 *NOVO CADASTRO - Wolf System*\n\n👤 *Nome:* ${dados.nome}\n🏢 *Empresa:* ${dados.empresa}\n📱 *WhatsApp:* ${dados.whatsapp}\n📧 *Email:* ${dados.email}\n📦 *Plano:* ${dados.plano}\n\n⚠️ Acesse o painel para autorizar o acesso.`;
  await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(mensagem)}&apikey=${encodeURIComponent(apikey)}`).catch(() => undefined);
}

export async function GET(request: NextRequest) {
  if (limitar(request, 60, 15 * 60_000)) return NextResponse.json({ error: "Muitas consultas. Aguarde alguns minutos." }, { status: 429 });
  const username = texto(request.nextUrl.searchParams.get("username"), 30).toLowerCase();
  if (!USERNAME_REGEX.test(username)) return NextResponse.json({ available: false, invalid: true }, { status: 400 });
  const { data, error } = await supabaseServer.from("workspaces").select("username").ilike("username", username).maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível verificar agora" }, { status: 500 });
  return NextResponse.json({ available: !data });
}

export async function POST(request: NextRequest) {
  if (limitar(request, 5, 60 * 60_000)) return NextResponse.json({ success: false, error: "Muitas tentativas de cadastro. Aguarde uma hora." }, { status: 429 });
  let userId = "";
  let workspaceId: string | number | null = null;
  try {
    const body = await request.json();
    const nome = texto(body.nome, 120);
    const empresa = texto(body.empresa, 160);
    const cnpj = texto(body.cnpj, 24);
    const cpf = texto(body.cpf, 18);
    const email = texto(body.email, 254).toLowerCase();
    const whatsapp = texto(body.whatsapp, 30);
    const senha = String(body.senha || "");
    const username = texto(body.username, 30).toLowerCase();
    const plano = texto(body.plano, 100);
    if (!nome || !email || !whatsapp || !senha || !username || !plano) return NextResponse.json({ success: false, error: "Campos obrigatórios faltando" }, { status: 400 });
    if (!EMAIL_REGEX.test(email)) return NextResponse.json({ success: false, error: "E-mail inválido" }, { status: 400 });
    if (senha.length < 8 || senha.length > 128) return NextResponse.json({ success: false, error: "A senha deve ter entre 8 e 128 caracteres" }, { status: 400 });
    if (!USERNAME_REGEX.test(username)) return NextResponse.json({ success: false, error: "Username inválido (use a-z, 0-9 e _; 3 a 30 caracteres)" }, { status: 400 });

    const { data: wsExiste } = await supabaseServer.from("workspaces").select("username").ilike("username", username).maybeSingle();
    if (wsExiste) return NextResponse.json({ success: false, error: "username_exists" }, { status: 409 });
    const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, username } });
    if (authError) {
      const duplicado = /already (?:been registered|exists)/i.test(authError.message);
      return NextResponse.json({ success: false, error: duplicado ? "email_exists" : authError.message }, { status: duplicado ? 409 : 400 });
    }
    userId = authData.user?.id || "";
    if (!userId) throw new Error("Falha ao criar usuário");
    const { data: workspace, error: wsError } = await supabaseServer.from("workspaces").insert([{ nome: empresa || nome, owner_id: userId, owner_email: email, username, plano, ativo: false }]).select("id").single();
    if (wsError) throw wsError;
    workspaceId = workspace.id;
    const { error: cadastroError } = await supabaseServer.from("cadastros").insert([{ nome, empresa, cnpj, cpf, email, whatsapp, username, plano, autorizado: false, user_id: userId, workspace_id: username }]);
    if (cadastroError) throw cadastroError;
    await notificarCadastro({ nome, empresa, whatsapp, email, plano });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (workspaceId !== null) {
      try {
        await supabaseServer.from("workspaces").delete().eq("id", workspaceId);
      } catch {}
    }
    if (userId) await supabaseServer.auth.admin.deleteUser(userId).catch(() => undefined);
    const item = error as { code?: string; message?: string };
    if (item.code === "23505") return NextResponse.json({ success: false, error: "username_exists" }, { status: 409 });
    return NextResponse.json({ success: false, error: item.message || "Erro ao cadastrar" }, { status: 500 });
  }
}
