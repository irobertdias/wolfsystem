import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// E-mail do admin master — só ele pode chamar essa rota
const ADMIN_EMAIL = "robert.dias@live.com";

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

// ═══════════════════════════════════════════════════════
// Checagem de admin — usa o Authorization Bearer token do front
// ═══════════════════════════════════════════════════════
async function isAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.substring(7);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return false;
    return data.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// POST — Cria cliente completo (auth + workspace + cadastro)
// ═══════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const {
    email, senha, nome, empresa, whatsapp, username, plano,
    usuarios_liberados, conexoes_liberadas,
    permite_webjs, permite_waba, permite_instagram,
    ia, autorizado,
  } = body;

  try {
    // ═══ Validações ═══
    if (!email || !senha || !nome || !username) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: email, senha, nome, username" });
    }
    if (senha.length < 6) {
      return NextResponse.json({ success: false, error: "A senha precisa ter no mínimo 6 caracteres" });
    }
    const usernameLimpo = String(username).toLowerCase().trim();
    if (!USERNAME_REGEX.test(usernameLimpo)) {
      return NextResponse.json({ success: false, error: "Username inválido (use a-z, 0-9, _ — 3 a 30 caracteres)" });
    }

    // ═══ 1. Checa se username já existe ═══
    const { data: wsExiste } = await supabase
      .from("workspaces")
      .select("username")
      .ilike("username", usernameLimpo)
      .maybeSingle();

    if (wsExiste) {
      return NextResponse.json({ success: false, error: "username_exists" });
    }

    // ═══ 2. Cria no auth.users ═══
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
    if (!userId) return NextResponse.json({ success: false, error: "Falha ao criar usuário" });

    // ═══ 3. Cria workspace ═══
    const { error: wsError } = await supabase.from("workspaces").insert([{
      nome: empresa || nome,
      owner_id: userId,
      owner_email: email,
      username: usernameLimpo,
      plano: plano || "basico",
      ativo: true,
    }]);

    if (wsError) {
      // Rollback
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      if (wsError.code === "23505") {
        return NextResponse.json({ success: false, error: "username_exists" });
      }
      return NextResponse.json({ success: false, error: "Erro ao criar workspace: " + wsError.message });
    }

    // ═══ 4. Salva na tabela cadastros ═══
    const { error: cadError } = await supabase.from("cadastros").insert([{
      nome, empresa, email, whatsapp, username: usernameLimpo, plano,
      usuarios_liberados: usuarios_liberados || 7,
      conexoes_liberadas: conexoes_liberadas || 1,
      permite_webjs: permite_webjs !== false,
      permite_waba: !!permite_waba,
      permite_instagram: !!permite_instagram,
      ia: ia || "gpt",
      autorizado: !!autorizado,
      user_id: userId,
    }]);

    if (cadError) {
      console.error("Erro ao salvar em cadastros:", cadError.message);
    }

    return NextResponse.json({ success: true, userId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}

// ═══════════════════════════════════════════════════════
// DELETE — Apaga cliente completo (auth + workspace + dados)
// Recebe { email } no body
// ═══════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ success: false, error: "email é obrigatório" });
  }

  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ success: false, error: "Não pode excluir o admin master" });
  }

  try {
    // ═══ 1. Busca o user_id e username ═══
    const { data: cadastro } = await supabase
      .from("cadastros")
      .select("user_id, username")
      .eq("email", email)
      .maybeSingle();

    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, username, owner_id")
      .eq("owner_email", email)
      .maybeSingle();

    const userId = cadastro?.user_id || ws?.owner_id;
    const username = cadastro?.username || ws?.username;

    // ═══ 2. Apaga dados do workspace (conexões, fluxos, atendimentos, mensagens, etc.) ═══
    if (username) {
      await supabase.from("fluxo_sessoes").delete().eq("workspace_id", username);
      await supabase.from("mensagens").delete().eq("workspace_id", username);
      await supabase.from("atendimentos").delete().eq("workspace_id", username);
      await supabase.from("fluxos").delete().eq("workspace_id", username);
      await supabase.from("conexoes").delete().eq("workspace_id", username);
      await supabase.from("etiquetas").delete().eq("workspace_id", username);
      // Limpa tabelas opcionais (ignora erro se não existirem)
      await supabase.from("atendimento_etiquetas").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("contato_logs").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("mensagens_agendadas").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("usuarios_workspace").delete().eq("workspace_id", username).then(() => {}, () => {});
    }

    // ═══ 3. Apaga o workspace ═══
    await supabase.from("workspaces").delete().eq("owner_email", email);

    // ═══ 4. Apaga o cadastro ═══
    await supabase.from("cadastros").delete().eq("email", email);

    // ═══ 5. Apaga do auth.users ═══
    if (userId) {
      await supabase.auth.admin.deleteUser(userId).catch((e: any) => {
        console.error("Erro ao deletar do auth:", e.message);
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}