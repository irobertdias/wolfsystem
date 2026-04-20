import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, senha, nome, username, empresa, cnpj, cpf, whatsapp, plano } = body;

  try {
    // 1. Cria no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, username },
    });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        return NextResponse.json({ success: false, error: "email_exists" });
      }
      return NextResponse.json({ success: false, error: authError.message });
    }

    const userId = authData.user?.id;

    // 2. Salva na tabela cadastros
    const { error: dbError } = await supabase.from("cadastros").insert([{
      nome, empresa, cnpj, cpf, email, whatsapp, senha,
      username, plano, autorizado: false,
      user_id: userId,
    }]);

    if (dbError) {
      return NextResponse.json({ success: false, error: dbError.message });
    }

    // 3. Cria workspace para o cliente
    // username: usa o digitado, ou gera a partir do email
    const wsUsername = username || email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase();

    const { error: wsError } = await supabase.from("workspaces").insert([{
      nome: empresa || nome,
      owner_id: userId,
      owner_email: email,
      username: wsUsername,
      plano: plano || "basico",
      ativo: true,
    }]);

    if (wsError) {
      return NextResponse.json({ success: false, error: "Cadastro criado mas workspace falhou: " + wsError.message });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}