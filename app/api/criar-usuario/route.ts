import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "robert.dias@live.com";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    email, senha, nome, perfil, fila, workspace_id, grupo_id,
    equipe_id,                    // 🆕 equipe primária
    equipes_acesso,               // 🆕 múltiplas equipes (UUID[])
    filas_acesso,                 // 🆕 múltiplas filas (INT[])
    canais_acesso,                // 🆕 canais/conexões (INT[])
    ramal,                        // 🆕 ramal VOIP
    telefone,                     // 🆕 telefone pessoal
    exige_ponto,                  // 🕐 trava de acesso por ponto
    exige_selfie,                 // 🤳 selfie obrigatória no ponto
  } = body;

  if (!email || !senha || !nome || !workspace_id) {
    return NextResponse.json({ success: false, error: "Campos obrigatórios faltando" });
  }

  if (senha.length < 6) {
    return NextResponse.json({ success: false, error: "Senha deve ter pelo menos 6 caracteres" });
  }

  try {
    // ═══ 1. Autenticação: quem está chamando essa API? ═══
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const { data: { user: authUser }, error: authUserErr } = await supabase.auth.getUser(token);
    if (authUserErr || !authUser) {
      return NextResponse.json({ success: false, error: "Sessão inválida" }, { status: 401 });
    }

    const chamadorEmail = authUser.email?.toLowerCase() || "";
    const isAdminMaster = chamadorEmail === ADMIN_EMAIL.toLowerCase();

    // ═══ 2. Verifica se o chamador é o DONO do workspace (ou admin master) ═══
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, username, owner_id, owner_email")
      .eq("username", workspace_id)
      .maybeSingle();

    if (!ws) {
      return NextResponse.json({ success: false, error: "Workspace não encontrado" }, { status: 404 });
    }

    const ehDono = ws.owner_id === authUser.id || ws.owner_email?.toLowerCase() === chamadorEmail;

    // 🆕 FIX (sessão 18): também aceita SUB-USUÁRIO com perfil "Administrador"
    let ehAdminSubUsuario = false;
    if (!ehDono && !isAdminMaster) {
      const { data: subUser } = await supabase
        .from("usuarios_workspace")
        .select("perfil")
        .eq("email", chamadorEmail)
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subUser?.perfil === "Administrador") {
        ehAdminSubUsuario = true;
      }
    }

    if (!ehDono && !isAdminMaster && !ehAdminSubUsuario) {
      return NextResponse.json({ success: false, error: "Você não tem permissão para criar usuários neste workspace" }, { status: 403 });
    }

    // 🛡️ Hardening: Administrador sub-usuário NÃO pode criar outro Administrador
    if (ehAdminSubUsuario && !ehDono && !isAdminMaster && perfil === "Administrador") {
      return NextResponse.json({
        success: false,
        error: "Apenas o dono do workspace pode criar Administradores. Você pode criar Supervisor ou Atendente.",
      }, { status: 403 });
    }

    // ═══ 3. VALIDAÇÃO DE LIMITE — servidor (não tem como burlar) ═══
    if (!isAdminMaster) {
      const { data: cadastro } = await supabase
        .from("cadastros")
        .select("usuarios_liberados, autorizado")
        .eq("email", ws.owner_email)
        .maybeSingle();

      if (!cadastro) {
        return NextResponse.json({ success: false, error: "Cadastro do dono não encontrado" }, { status: 404 });
      }

      if (!cadastro.autorizado) {
        return NextResponse.json({ success: false, error: "Workspace não autorizado pelo administrador" }, { status: 403 });
      }

      const limite = cadastro.usuarios_liberados || 1;

      const { count: usadosCount } = await supabase
        .from("usuarios_workspace")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace_id);

      const usados = usadosCount || 0;

      if (usados >= limite) {
        return NextResponse.json({
          success: false,
          error: "limite_atingido",
          detalhes: `Limite de ${limite} usuário(s) atingido. Atualmente: ${usados}/${limite}. Faça upgrade do plano para adicionar mais usuários.`,
        }, { status: 403 });
      }
    }

    // ═══ 4. Checa se o email já não está em uso ═══
    const { data: existente } = await supabase
      .from("usuarios_workspace")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (existente) {
      return NextResponse.json({ success: false, error: "email_exists" });
    }

    // ═══ 5. Cria no Supabase Auth ═══
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

    // ═══ 6. Salva na tabela usuarios_workspace ═══
    //    🆕 Agora salva TODOS os campos da tela de configurações
    const { error: dbError } = await supabase.from("usuarios_workspace").insert([{
      nome,
      email,
      perfil,
      fila: fila || "",
      status: "offline",
      workspace_id,
      user_id: authData.user?.id,
      grupo_id: grupo_id || null,
      equipe_id: equipe_id || null,                                              // 🆕
      equipes_acesso: Array.isArray(equipes_acesso) ? equipes_acesso : [],       // 🆕
      filas_acesso: Array.isArray(filas_acesso) ? filas_acesso : [],             // 🆕
      canais_acesso: Array.isArray(canais_acesso) ? canais_acesso : [],          // 🆕
      ramal: ramal || null,                                                       // 🆕
      telefone: telefone || null,                                                 // 🆕
      exige_ponto: exige_ponto !== false,                                         // default true
      exige_selfie: exige_selfie !== false,                                       // 🆕 default true
    }]);

    if (dbError) {
      // Rollback: remove do Auth se deu pau no banco
      await supabase.auth.admin.deleteUser(authData.user?.id || "").catch(() => {});
      return NextResponse.json({ success: false, error: dbError.message });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}