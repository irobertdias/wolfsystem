import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.json();
  const { id, email, senha, nome, empresa, plano, ia, usuarios, conexoes } = body;

  try {
    // 1. Cria o usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, empresa },
    });

    if (authError && !authError.message.includes("already been registered")) {
      return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    }

    const userId = authUser?.user?.id || (await supabaseAdmin.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 400 });
    }

    // 2. Cria o workspace do cliente
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .insert([{
        nome: empresa || nome,
        owner_id: userId,
        owner_email: email,
        plano: plano || "básico",
        usuarios_limite: usuarios || "5",
        conexoes_limite: conexoes || "1",
        ia: ia || "",
        ativo: true,
      }])
      .select()
      .single();

    if (wsError) {
      return NextResponse.json({ success: false, error: wsError.message }, { status: 400 });
    }

    // 3. Atualiza o cadastro com workspace_id e autorizado
    await supabaseAdmin
      .from("cadastros")
      .update({ autorizado: true, workspace_id: workspace.id.toString() })
      .eq("id", id);

    return NextResponse.json({ success: true, workspace_id: workspace.id });

  } catch (error) {
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}