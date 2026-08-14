import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "robert.dias@live.com";

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 /api/atualizar-usuario — atualiza dados de um usuário (auth + workspace)
// ───────────────────────────────────────────────────────────────────────────
// Aceita 2 modos:
//
//   1. MODO PRÓPRIO (chamador altera o próprio cadastro):
//      Body: { modo: "proprio", senha_atual, nova_senha?, nome?, telefone?, foto_url? }
//      - Pode trocar senha (exige senha_atual pra confirmar)
//      - Pode trocar nome, telefone, foto_url
//      - NÃO pode trocar email (só admin pode)
//      - NÃO pode trocar perfil/grupo/equipe/permissões
//
//   2. MODO ADMIN (dono/admin do workspace altera outro usuário):
//      Body: { modo: "admin", email_alvo, workspace_id, novo_email?, nova_senha?, nome?, telefone?, foto_url?, ... }
//      - Pode trocar email do alvo (via auth.admin.updateUserById)
//      - Pode trocar senha do alvo
//      - Pode trocar todos os campos da usuarios_workspace
//      - Verifica que chamador é Dono OR Admin Master OR Sub-usuário Administrador DO mesmo workspace
//      - Anti-escalada: Sub-usuário Administrador NÃO pode mexer em outro Administrador
//
// MULTI-TENANT: todas as queries filtram por workspace_id no modo admin.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const body = await req.json();
  const modo = body.modo as "proprio" | "admin";

  // ═══ 1. Autenticação obrigatória ═══
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
  }
  const token = authHeader.substring(7);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ success: false, error: "Sessão inválida" }, { status: 401 });
  }

  try {
    // ───────────────────────────────────────────────────────────────────────
    // MODO PRÓPRIO — usuário trocando seu próprio cadastro
    // ───────────────────────────────────────────────────────────────────────
    if (modo === "proprio") {
      const { workspace_id, senha_atual, nova_senha, nome, telefone, foto_url } = body;

      if (!workspace_id) {
        return NextResponse.json({ success: false, error: "workspace_id obrigatório" }, { status: 400 });
      }

      // ═══ Valida que o user logado realmente pertence ao workspace_id enviado ═══
      // Cenário A: É dono do workspace (workspaces.owner_id)
      // Cenário B: É sub-usuário (linha em usuarios_workspace com esse workspace_id)
      const { data: wsDono } = await supabase
        .from("workspaces")
        .select("id, username")
        .eq("owner_id", authUser.id)
        .eq("username", workspace_id)
        .maybeSingle();

      let ehDono = !!wsDono;
      let subUserRow: { id: number; user_id: string | null } | null = null;

      if (!ehDono) {
        const { data: sub } = await supabase
          .from("usuarios_workspace")
          .select("id, user_id")
          .eq("email", authUser.email)
          .eq("workspace_id", workspace_id)  // 🔒 isolamento multi-tenant
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        subUserRow = sub || null;
      }

      if (!ehDono && !subUserRow) {
        return NextResponse.json({
          success: false,
          error: "Você não pertence a esse workspace",
        }, { status: 403 });
      }

      // ═══ Confirma senha atual (se vai trocar senha) ═══
      if (nova_senha) {
        if (!senha_atual) {
          return NextResponse.json({ success: false, error: "Informe sua senha atual" });
        }
        if (nova_senha.length < 6) {
          return NextResponse.json({ success: false, error: "Nova senha deve ter no mínimo 6 caracteres" });
        }
        const sbTeste = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error: loginErr } = await sbTeste.auth.signInWithPassword({
          email: authUser.email!, password: senha_atual,
        });
        if (loginErr) {
          return NextResponse.json({ success: false, error: "Senha atual incorreta" }, { status: 403 });
        }
      }

      // ═══ Atualiza Auth (só senha — email no modo próprio é fixo) ═══
      if (nova_senha) {
        const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(authUser.id, {
          password: nova_senha,
        });
        if (authUpdateErr) {
          return NextResponse.json({ success: false, error: "Falha ao atualizar senha: " + authUpdateErr.message });
        }
      }

      // ═══ Atualiza dados (nome, telefone, foto) ═══
      const updates: any = {};
      if (typeof nome === "string" && nome.trim()) updates.nome = nome.trim();
      if (typeof telefone === "string") updates.telefone = telefone || null;
      if (typeof foto_url === "string") updates.foto_url = foto_url || null;

      if (Object.keys(updates).length > 0) {
        if (ehDono) {
          // Dono não tem linha em usuarios_workspace → salva em auth.users.user_metadata
          const novosMetadados = {
            ...(authUser.user_metadata || {}),
            ...updates,
          };
          await supabase.auth.admin.updateUserById(authUser.id, {
            user_metadata: novosMetadados,
          });
        } else if (subUserRow) {
          // Sub-usuário → filtra POR workspace_id + id da linha (defesa em profundidade)
          await supabase.from("usuarios_workspace")
            .update(updates)
            .eq("id", subUserRow.id)
            .eq("workspace_id", workspace_id)   // 🔒 isolamento multi-tenant
            .eq("email", authUser.email);       // 🔒 garante que é a linha do próprio user
        }
      }

      return NextResponse.json({ success: true });
    }

    // ───────────────────────────────────────────────────────────────────────
    // MODO ADMIN — dono/admin trocando dados de OUTRO usuário
    // ───────────────────────────────────────────────────────────────────────
    if (modo === "admin") {
      const {
        email_alvo, workspace_id,
        novo_email, nova_senha,
        nome, telefone, foto_url,
        perfil, fila, grupo_id, equipe_id,
        equipes_acesso, filas_acesso, canais_acesso, voip_conexoes_acesso,
        ramal, exige_ponto, exige_selfie,
      } = body;

      if (!email_alvo || !workspace_id) {
        return NextResponse.json({ success: false, error: "email_alvo e workspace_id são obrigatórios" });
      }

      const chamadorEmail = authUser.email?.toLowerCase() || "";
      const isAdminMaster = chamadorEmail === ADMIN_EMAIL.toLowerCase();

      // Verifica autoridade do chamador NO WORKSPACE específico
      const { data: ws } = await supabase
        .from("workspaces")
        .select("owner_id, owner_email")
        .eq("username", workspace_id)
        .maybeSingle();

      if (!ws) {
        return NextResponse.json({ success: false, error: "Workspace não encontrado" }, { status: 404 });
      }

      const ehDono = ws.owner_id === authUser.id || ws.owner_email?.toLowerCase() === chamadorEmail;

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
        if (subUser?.perfil === "Administrador") ehAdminSubUsuario = true;
      }

      if (!ehDono && !isAdminMaster && !ehAdminSubUsuario) {
        return NextResponse.json({
          success: false,
          error: "Você não tem permissão pra editar usuários neste workspace",
        }, { status: 403 });
      }

      // Busca o alvo (precisa pra pegar user_id pro auth.admin.updateUserById)
      const { data: alvo } = await supabase
        .from("usuarios_workspace")
        .select("perfil, user_id")
        .eq("email", email_alvo)
        .eq("workspace_id", workspace_id)
        .maybeSingle();

      if (!alvo) {
        return NextResponse.json({ success: false, error: "Usuário alvo não encontrado neste workspace" }, { status: 404 });
      }

      // 🛡️ Anti-escalada: sub-admin NÃO mexe em outro Administrador
      if (ehAdminSubUsuario && !ehDono && !isAdminMaster && alvo.perfil === "Administrador") {
        return NextResponse.json({
          success: false,
          error: "Apenas o dono do workspace pode editar Administradores",
        }, { status: 403 });
      }

      // Valida senha nova (se vier)
      if (nova_senha && nova_senha.length < 6) {
        return NextResponse.json({ success: false, error: "Nova senha deve ter no mínimo 6 caracteres" });
      }

      // Valida e-mail novo (se vier — não pode estar em uso)
      if (novo_email && novo_email !== email_alvo) {
        const { data: emailExistente } = await supabase
          .from("usuarios_workspace")
          .select("email")
          .eq("email", novo_email)
          .neq("workspace_id", workspace_id)  // OK estar no mesmo workspace (raro mas ok)
          .maybeSingle();
        if (emailExistente) {
          return NextResponse.json({ success: false, error: "Esse e-mail já está em uso em outro workspace" });
        }
      }

      // ═══ Atualiza Auth (email + senha) ═══
      if (alvo.user_id && (novo_email || nova_senha)) {
        const authUpdate: any = {};
        if (novo_email) {
          authUpdate.email = novo_email;
          authUpdate.email_confirm = true;  // admin tá confirmando — pula o email de verificação
        }
        if (nova_senha) authUpdate.password = nova_senha;

        const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(alvo.user_id, authUpdate);
        if (authUpdateErr) {
          return NextResponse.json({
            success: false,
            error: "Falha ao atualizar auth: " + authUpdateErr.message,
          });
        }
      }

      // ═══ Atualiza usuarios_workspace ═══
      const updateWs: any = {};
      if (typeof nome === "string" && nome.trim()) updateWs.nome = nome.trim();
      if (typeof telefone === "string") updateWs.telefone = telefone || null;
      if (typeof foto_url === "string") updateWs.foto_url = foto_url || null;
      if (typeof perfil === "string") updateWs.perfil = perfil;
      if (typeof fila === "string") updateWs.fila = fila;
      if (grupo_id !== undefined) updateWs.grupo_id = grupo_id || null;
      if (equipe_id !== undefined) updateWs.equipe_id = equipe_id || null;
      if (Array.isArray(equipes_acesso)) updateWs.equipes_acesso = equipes_acesso;
      if (Array.isArray(filas_acesso)) updateWs.filas_acesso = filas_acesso;
      if (Array.isArray(canais_acesso)) updateWs.canais_acesso = canais_acesso;
      if (Array.isArray(voip_conexoes_acesso)) updateWs.voip_conexoes_acesso = voip_conexoes_acesso.map(Number).filter(Number.isFinite);
      if (typeof ramal === "string") updateWs.ramal = ramal || null;
      if (typeof exige_ponto === "boolean") updateWs.exige_ponto = exige_ponto;
      if (typeof exige_selfie === "boolean") updateWs.exige_selfie = exige_selfie;
      // 🔧 Se trocou email, atualiza tb na tabela usuarios_workspace
      if (novo_email && novo_email !== email_alvo) updateWs.email = novo_email;

      if (Object.keys(updateWs).length > 0) {
        const { error: dbErr } = await supabase.from("usuarios_workspace")
          .update(updateWs)
          .eq("email", email_alvo)
          .eq("workspace_id", workspace_id);
        if (dbErr) {
          return NextResponse.json({ success: false, error: "Erro no banco: " + dbErr.message });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Modo inválido (use 'proprio' ou 'admin')" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}