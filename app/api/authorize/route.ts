import { NextRequest, NextResponse } from "next/server";
import { autenticarUsuario, respostaErroAcesso, supabaseServer } from "../_auth";

export async function POST(request: NextRequest) {
  try {
    const acesso = await autenticarUsuario(request);
    if (!acesso.isSuperAdmin) return NextResponse.json({ success: false, error: "Acesso exclusivo do super administrador" }, { status: 403 });
    const body = await request.json(); const { id, email, senha, nome, empresa, plano, ia, usuarios, conexoes, username } = body;
    if (!id || !email || !senha) return NextResponse.json({ success: false, error: "id, email e senha são obrigatórios" }, { status: 400 });
    const { data: authUser, error: authError } = await supabaseServer.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, empresa, username } });
    if (authError && !authError.message.includes("already been registered")) return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    const userId = authUser?.user?.id || (await supabaseServer.auth.admin.listUsers()).data.users.find((item) => item.email?.toLowerCase() === String(email).toLowerCase())?.id;
    if (!userId) return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 400 });
    const { data: existente } = await supabaseServer.from("workspaces").select("id,username,ativo").eq("owner_id", userId).maybeSingle();
    if (existente) { await supabaseServer.from("workspaces").update({ ativo: true }).eq("id", existente.id); await supabaseServer.from("cadastros").update({ autorizado: true, workspace_id: existente.username }).eq("id", id); return NextResponse.json({ success: true, workspace_id: existente.username }); }
    const { data: workspace, error: wsError } = await supabaseServer.from("workspaces").insert([{ nome: empresa || nome, owner_id: userId, owner_email: email, plano: plano || "básico", usuarios_limite: usuarios || "5", conexoes_limite: conexoes || "1", ia: ia || "", ativo: true, username: username || String(email).split("@")[0] }]).select().single();
    if (wsError) return NextResponse.json({ success: false, error: wsError.message }, { status: 400 });
    await supabaseServer.from("cadastros").update({ autorizado: true, workspace_id: workspace.username }).eq("id", id);
    return NextResponse.json({ success: true, workspace_id: workspace.id });
  } catch (error) { const item = respostaErroAcesso(error); return NextResponse.json({ success: false, error: item.message }, { status: item.status }); }
}
