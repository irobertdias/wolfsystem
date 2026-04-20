import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, senha, nome, perfil, fila, workspace_id } = body;

  if (!email || !senha || !nome || !workspace_id) {
    return NextResponse.json({ success: false, error: "Campos obrigatórios faltando" });
  }

  if (senha.length < 6) {
    return NextResponse.json({ success: false, error: "Senha deve ter pelo menos 6 caracteres" });
  }

  try {
    // 1. Cria no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, perfil, workspace_id },
    });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        return NextResponse.json({ success: false, error: "email_exists" });
      }
      return NextResponse.json({ success: false, error: authError.message });
    }

    // 2. Salva na tabela usuarios_workspace
    const { error: dbError } = await supabase.from("usuarios_workspace").insert([{
      nome,
      email,
      perfil,
      fila: fila || "",
      status: "offline",
      workspace_id,
      user_id: authData.user?.id,
    }]);

    if (dbError) {
      // Se falhou no banco, remove do Auth para não ficar inconsistente
      await supabase.auth.admin.deleteUser(authData.user?.id || "");
      return NextResponse.json({ success: false, error: dbError.message });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}