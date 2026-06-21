import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "robert.dias@live.com";

export async function POST(req: NextRequest) {
  const { email, workspace_id } = await req.json();

  if (!email || !workspace_id) {
    return NextResponse.json({ success: false, error: "Campos obrigatórios faltando" });
  }

  try {
    // ═══ 1. Autenticação: quem está chamando essa API? ═══
    // 🆕 ANTES ESSA ROTA NÃO TINHA NENHUMA VERIFICAÇÃO — qualquer usuário
    //    podia deletar qualquer outro de QUALQUER workspace só mandando POST.
    //    Bug crítico de segurança. Corrigido agora.
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

    // ═══ 2. Não deixa apagar o próprio admin master ═══
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Não pode excluir o admin master" }, { status: 403 });
    }

    // ═══ 3. Não deixa apagar a si mesmo (evita ficar sem dono no workspace) ═══
    if (email.toLowerCase() === chamadorEmail) {
      return NextResponse.json({ success: false, error: "Você não pode excluir a si mesmo" }, { status: 403 });
    }

    // ═══ 4. Verifica se o chamador tem permissão pra deletar nesse workspace ═══
    //    Aceita: Dono | Admin Master Wolf | Sub-usuário com perfil "Administrador"
    const { data: ws } = await supabase
      .from("workspaces")
      .select("owner_id, owner_email")
      .eq("username", workspace_id)
      .maybeSingle();

    if (!ws) {
      return NextResponse.json({ success: false, error: "Workspace não encontrado" }, { status: 404 });
    }

    const ehDono = ws.owner_id === authUser.id || ws.owner_email?.toLowerCase() === chamadorEmail;

    // Sub-usuário Administrador DESSE workspace também pode deletar
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
      return NextResponse.json({
        success: false,
        error: "Você não tem permissão para excluir usuários neste workspace",
      }, { status: 403 });
    }

    // ═══ 5. Verifica se o alvo realmente pertence a esse workspace ═══
    //    Evita um admin de workspace A deletar usuário do workspace B
    const { data: alvo } = await supabase
      .from("usuarios_workspace")
      .select("perfil, workspace_id, user_id")
      .eq("email", email)
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (!alvo) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado neste workspace" }, { status: 404 });
    }

    // ═══ 6. Hardening: Administrador sub-usuário NÃO pode deletar outro Administrador ═══
    //    Mesma regra da criação — só Dono ou Master Wolf podem mexer em Administradores.
    if (ehAdminSubUsuario && !ehDono && !isAdminMaster && alvo.perfil === "Administrador") {
      return NextResponse.json({
        success: false,
        error: "Apenas o dono do workspace pode excluir Administradores",
      }, { status: 403 });
    }

    // ═══ 7. Remove da tabela usuarios_workspace ═══
    const { error: delDbErr } = await supabase
      .from("usuarios_workspace")
      .delete()
      .eq("email", email)
      .eq("workspace_id", workspace_id);

    if (delDbErr) {
      return NextResponse.json({ success: false, error: "Erro ao remover do banco: " + delDbErr.message });
    }

    // ═══ 8. Remove do Auth (se tiver vínculo) ═══
    //    Antes a rota fazia listUsers() pra todo mundo (super pesado, custa
    //    paginação inteira do Auth). Agora usa user_id direto da row, que
    //    foi salvo quando criamos o usuário em /api/criar-usuario.
    if (alvo.user_id) {
      await supabase.auth.admin.deleteUser(alvo.user_id).catch((e: any) => {
        console.error("[deletar-usuario] erro no auth.deleteUser:", e?.message);
      });
    } else {
      // Fallback antigo (caso user_id não tenha sido salvo na criação)
      try {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const u = users.find((x: any) => x.email?.toLowerCase() === email.toLowerCase());
        if (u) await supabase.auth.admin.deleteUser(u.id);
      } catch (e: any) {
        console.error("[deletar-usuario] fallback listUsers falhou:", e?.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}