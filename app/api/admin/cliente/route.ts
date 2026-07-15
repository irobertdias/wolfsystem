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
// 🆕 Agora aceita TODOS os módulos comerciais + dados de cobrança
// ═══════════════════════════════════════════════════════
function addWsId(lista: string[], valor: any) {
  const v = String(valor ?? "").trim();
  if (v && !lista.includes(v)) lista.push(v);
}

function idsDeWorkspaces(lista: any[]) {
  const ids: string[] = [];
  for (const ws of lista || []) {
    addWsId(ids, ws.username);
    addWsId(ids, ws.id);
  }
  return ids;
}

async function buscarPaginasPorWorkspaces(tabela: string, select: string, wsIds: string[], opts?: { order?: string; ascending?: boolean; limite?: number }) {
  if (wsIds.length === 0) return [];

  const PAGE_SIZE = 1000;
  const TOTAL_LIMITE = opts?.limite || 50000;
  const lista: any[] = [];
  let offset = 0;

  while (offset < TOTAL_LIMITE) {
    let query = supabase
      .from(tabela)
      .select(select)
      .in("workspace_id", wsIds)
      .range(offset, offset + PAGE_SIZE - 1);

    if (opts?.order) query = query.order(opts.order, { ascending: opts.ascending ?? true });

    const { data, error } = await query;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    if (!data || data.length === 0) break;

    lista.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return lista;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("acao") !== "visao-global") {
    return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 });
  }

  try {
    const [cadResp, wsResp] = await Promise.all([
      supabase.from("cadastros").select("*").order("created_at", { ascending: false }).limit(10000),
      supabase.from("workspaces").select("id, username, nome, owner_email, ativo").limit(10000),
    ]);

    if (cadResp.error) throw new Error("cadastros: " + cadResp.error.message);
    if (wsResp.error) throw new Error("workspaces: " + wsResp.error.message);

    const workspaces = wsResp.data || [];
    const wsIds = idsDeWorkspaces(workspaces);

    const [propostas, conexoes, usuarios] = await Promise.all([
      buscarPaginasPorWorkspaces("proposta", "*", wsIds, { order: "created_at", ascending: false, limite: 80000 }),
      buscarPaginasPorWorkspaces("conexoes", "id, tipo, status, nome, numero, workspace_id, created_at", wsIds, { order: "created_at", ascending: false, limite: 50000 }),
      buscarPaginasPorWorkspaces("usuarios_workspace", "email, nome, workspace_id", wsIds, { limite: 50000 }),
    ]);

    return NextResponse.json({
      success: true,
      cadastros: cadResp.data || [],
      workspaces,
      propostas,
      conexoes,
      usuarios,
      debug: {
        workspaces: workspaces.length,
        workspace_ids_consultados: wsIds.length,
        propostas: propostas.length,
        conexoes: conexoes.length,
        usuarios: usuarios.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Erro ao carregar visão global" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const {
    email, senha, nome, empresa, cpf, cnpj, whatsapp, username, plano,
    usuarios_liberados, conexoes_liberadas,
    permite_webjs, permite_waba, permite_instagram,
    ia, autorizado,
    // 🆕 MÓDULOS COMERCIAIS — todos os boleanos do schema cadastros
    modulo_roleta,
    modulo_disparos_web,
    modulo_disparos_api,
    modulo_voip,
    modulo_api_integracao,
    modulo_instagram,
    modulo_cobranca,
    modulo_meta_ads,
    modulo_equipes,
    modulo_funil_avancado,
    modulo_rh,
    modulo_bater_ponto,
    modulo_financeiro,
    financeiro_opcoes,
    // 🆕 COBRANÇA AUTOMÁTICA — dados que o useLembretePagamento usa
    dia_vencimento,
    valor_mensalidade,
    proximo_vencimento,
    status_pagamento,
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

    // ═══ 4. Salva na tabela cadastros (com TODOS os módulos novos) ═══
    const { error: cadError } = await supabase.from("cadastros").insert([{
      nome, empresa, cpf, cnpj, email, whatsapp, username: usernameLimpo, plano,
      usuarios_liberados: usuarios_liberados || 7,
      conexoes_liberadas: conexoes_liberadas || 1,
      permite_webjs: permite_webjs !== false,
      permite_waba: !!permite_waba,
      permite_instagram: !!permite_instagram,
      ia: ia || "gpt",
      autorizado: !!autorizado,
      user_id: userId,
      workspace_id: usernameLimpo,    // 🆕 mesma string que o workspace.username

      // 🆕 MÓDULOS COMERCIAIS (default = false — admin libera o que vendeu)
      modulo_roleta:         !!modulo_roleta,
      modulo_disparos_web:   !!modulo_disparos_web,
      modulo_disparos_api:   !!modulo_disparos_api,
      modulo_voip:           !!modulo_voip,
      modulo_api_integracao: !!modulo_api_integracao,
      modulo_instagram:      !!modulo_instagram,
      modulo_meta_ads:       !!modulo_meta_ads,
      modulo_cobranca:       !!modulo_cobranca,
      modulo_equipes:        !!modulo_equipes,
      modulo_funil_avancado: !!modulo_funil_avancado,
      modulo_rh:             !!modulo_rh,
      modulo_bater_ponto:    !!modulo_bater_ponto,
      modulo_financeiro:     !!modulo_financeiro,
      financeiro_opcoes:     financeiro_opcoes || {},   // JSONB com as 22 sub-opções

      // 🆕 COBRANÇA AUTOMÁTICA (usada pelo useLembretePagamento)
      dia_vencimento:      dia_vencimento || null,        // 1-31
      valor_mensalidade:   valor_mensalidade || null,     // numeric
      proximo_vencimento:  proximo_vencimento || null,    // date
      status_pagamento:    status_pagamento || "ativo",   // ativo | suspenso | bloqueado
    }]);

    if (cadError) {
      console.error("[admin/cliente] Erro ao salvar em cadastros:", cadError.message);
      // Não faz rollback — workspace + auth já estão criados.
      // Admin pode editar o cadastro manualmente depois.
    }

    return NextResponse.json({ success: true, userId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}

// ═══════════════════════════════════════════════════════
// PATCH — Atualiza módulos/limites de um cliente existente
// 🆕 Pra editar plano sem recriar tudo
// 🆕 Agora também suporta trocar EMAIL (login no Auth) e
//    USERNAME (renomeação em cascata via rpc_renomear_workspace)
//    de forma segura, através de "novo_email" / "novo_username"
// ═══════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { email, novo_email, novo_username, ...campos } = body;

  if (!email) {
    return NextResponse.json({ success: false, error: "email é obrigatório" });
  }

  try {
    // ═══ Busca o cadastro atual — precisamos do user_id e do username pra
    //     conseguir trocar o email no Auth e/ou renomear o workspace ═══
    const { data: cadastro, error: cadFindError } = await supabase
      .from("cadastros")
      .select("id, user_id, username, email")
      .eq("email", email)
      .maybeSingle();

    if (cadFindError || !cadastro) {
      return NextResponse.json({ success: false, error: "Cliente não encontrado" }, { status: 404 });
    }

    let emailAtual = cadastro.email as string;

    // ═══════════════════════════════════════════════════════
    // Troca de E-MAIL — atualiza Auth + cadastros + workspaces.owner_email
    // ═══════════════════════════════════════════════════════
    if (novo_email && String(novo_email).toLowerCase().trim() !== emailAtual.toLowerCase().trim()) {
      const novoEmailLimpo = String(novo_email).toLowerCase().trim();

      if (!cadastro.user_id) {
        return NextResponse.json({
          success: false,
          error: "Este cadastro não tem user_id vinculado ao Auth — não dá pra trocar o e-mail com segurança.",
        }, { status: 400 });
      }

      const { data: emailExiste } = await supabase
        .from("cadastros")
        .select("id")
        .ilike("email", novoEmailLimpo)
        .maybeSingle();

      if (emailExiste) {
        return NextResponse.json({ success: false, error: "email_exists" });
      }

      const { error: authUpdError } = await supabase.auth.admin.updateUserById(cadastro.user_id, {
        email: novoEmailLimpo,
        email_confirm: true,
      });

      if (authUpdError) {
        if (authUpdError.message.includes("already been registered") || authUpdError.message.includes("already exists")) {
          return NextResponse.json({ success: false, error: "email_exists" });
        }
        return NextResponse.json({ success: false, error: "Erro ao atualizar e-mail no Auth: " + authUpdError.message });
      }

      const { error: cadEmailError } = await supabase
        .from("cadastros")
        .update({ email: novoEmailLimpo })
        .eq("id", cadastro.id);

      if (cadEmailError) {
        return NextResponse.json({
          success: false,
          error: "E-mail já foi trocado no Auth, mas falhou ao atualizar em cadastros: " + cadEmailError.message,
        });
      }

      // owner_email em workspaces não é a chave primária — melhor esforço, não trava o fluxo
      await supabase.from("workspaces").update({ owner_email: novoEmailLimpo }).eq("owner_email", emailAtual);

      emailAtual = novoEmailLimpo;
    }

    // ═══════════════════════════════════════════════════════
    // Troca de USERNAME — cascata completa via função no banco
    // (rpc_renomear_workspace atualiza cadastros, workspaces e
    //  todas as ~58 tabelas com workspace_id numa única transação)
    // ═══════════════════════════════════════════════════════
    let usernameAlterado = false;
    if (novo_username && String(novo_username).toLowerCase().trim() !== (cadastro.username || "").toLowerCase().trim()) {
      const novoUsernameLimpo = String(novo_username).toLowerCase().trim();

      if (!USERNAME_REGEX.test(novoUsernameLimpo)) {
        return NextResponse.json({ success: false, error: "Username inválido (use a-z, 0-9, _ — 3 a 30 caracteres)" });
      }

      if (!cadastro.username) {
        return NextResponse.json({
          success: false,
          error: "Este cadastro não tem username atual — não dá pra renomear.",
        }, { status: 400 });
      }

      const { error: rpcError } = await supabase.rpc("rpc_renomear_workspace", {
        p_username_antigo: cadastro.username,
        p_username_novo: novoUsernameLimpo,
      });

      if (rpcError) {
        const msg = rpcError.message || "";
        if (msg.includes("username_novo_ja_existe")) return NextResponse.json({ success: false, error: "username_exists" });
        if (msg.includes("username_invalido")) return NextResponse.json({ success: false, error: "Username inválido" });
        if (msg.includes("username_antigo_nao_encontrado")) return NextResponse.json({ success: false, error: "Username atual não encontrado no banco" });
        return NextResponse.json({ success: false, error: "Erro ao renomear workspace: " + msg });
      }

      usernameAlterado = true;
    }

    // ═══════════════════════════════════════════════════════
    // Demais campos — whitelist original, aplicada pelo email já atualizado
    // ═══════════════════════════════════════════════════════
    const camposValidos = [
      "nome", "empresa", "cpf", "cnpj", "whatsapp", "plano",
      "usuarios_liberados", "conexoes_liberadas",
      "permite_webjs", "permite_waba", "permite_instagram",
      "ia", "autorizado",
      "modulo_roleta", "modulo_disparos_web", "modulo_disparos_api",
      "modulo_voip", "modulo_api_integracao", "modulo_instagram",
      "modulo_cobranca", "modulo_meta_ads", "modulo_equipes", "modulo_funil_avancado",
      "modulo_rh", "modulo_bater_ponto", "modulo_financeiro", "financeiro_opcoes",
      "dia_vencimento", "valor_mensalidade", "proximo_vencimento", "status_pagamento",
      "ultimo_pagamento_em", "bloqueio_postergado_ate",
    ];

    const update: Record<string, any> = {};
    for (const k of camposValidos) {
      if (k in campos) update[k] = campos[k];
    }

    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from("cadastros")
        .update(update)
        .eq("email", emailAtual);

      if (error) {
        return NextResponse.json({ success: false, error: "Erro ao atualizar: " + error.message });
      }
    }

    return NextResponse.json({
      success: true,
      email_atual: emailAtual,
      email_alterado: emailAtual !== email,
      username_alterado: usernameAlterado,
      atualizados: Object.keys(update),
    });
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
      // 🆕 Cobrança + permissões + equipes (módulos novos)
      await supabase.from("faturas_status").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("disparos").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("disparo_contatos").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("grupos_permissao").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("equipes").delete().eq("workspace_id", username).then(() => {}, () => {});
      await supabase.from("filas").delete().eq("workspace_id", username).then(() => {}, () => {});
      // proposta também — é grande, vai por último
      await supabase.from("proposta").delete().eq("workspace_id", username).then(() => {}, () => {});
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
