import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Valida formato: a-z, 0-9, _ (3-30 chars)
const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, senha, nome, username, empresa, cnpj, cpf, whatsapp, plano } = body;

  try {
    // ═══ VALIDAÇÕES ═══
    if (!email || !senha || !nome || !username || !plano) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios faltando" });
    }
    if (senha.length < 6) {
      return NextResponse.json({ success: false, error: "A senha deve ter no mínimo 6 caracteres" });
    }
    const usernameLimpo = String(username).toLowerCase().trim();
    if (!USERNAME_REGEX.test(usernameLimpo)) {
      return NextResponse.json({ success: false, error: "Username inválido (use a-z, 0-9, _ — 3 a 30 caracteres)" });
    }

    // ═══ 1. CHECA USERNAME (antes de criar no Auth, evita usuário zumbi) ═══
    const { data: wsExiste } = await supabase
      .from("workspaces")
      .select("username")
      .ilike("username", usernameLimpo)
      .maybeSingle();

    if (wsExiste) {
      return NextResponse.json({ success: false, error: "username_exists" });
    }

    // ═══ 2. CRIA NO AUTH (senha é hasheada pelo Supabase automaticamente) ═══
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, username: usernameLimpo },
    });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        return NextResponse.json({ success: false, error: "email_exists" });
      }
      return NextResponse.json({ success: false, error: authError.message });
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Falha ao criar usuário" });
    }

    // ═══ 3. CRIA WORKSPACE (se falhar, apaga o user do Auth pra não virar zumbi) ═══
    const { error: wsError } = await supabase.from("workspaces").insert([{
      nome: empresa || nome,
      owner_id: userId,
      owner_email: email,
      username: usernameLimpo,
      plano: plano || "basico",
      ativo: true,
    }]);

    if (wsError) {
      // Rollback: apaga usuário do Auth pra não deixar zumbi
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      if (wsError.code === "23505") {
        // unique violation — alguém tomou o username na corrida
        return NextResponse.json({ success: false, error: "username_exists" });
      }
      return NextResponse.json({ success: false, error: "Erro ao criar workspace: " + wsError.message });
    }

    // ═══ 4. SALVA NA TABELA CADASTROS (SEM SALVAR A SENHA EM TEXTO PURO) ═══
    const { error: dbError } = await supabase.from("cadastros").insert([{
      nome, empresa, cnpj, cpf, email, whatsapp,
      username: usernameLimpo, plano,
      autorizado: false,
      user_id: userId,
    }]);

    if (dbError) {
      // Já criamos o workspace e o user — não dá pra rollback fácil
      // Só logamos (o cadastro em si falhou mas o login funciona)
      console.error("Erro ao salvar em cadastros:", dbError.message);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}