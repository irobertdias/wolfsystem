import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🔐 Sistema de permissões Wolf CRM
// ═══════════════════════════════════════════════════════════════════════
// HIERARQUIA (analogia Presidente → STF → Ministros):
//
//   👑 Super Admin Wolf (robert.dias@live.com) = "Presidente"
//      → Acesso TOTAL em qualquer workspace, sempre. Bypass tudo.
//
//   🏢 Dono do workspace = "STF"
//      → Pode tudo dentro do workspace dele
//      → MAS respeita o limite do plano que paga
//
//   👔 Administrador = "Ministro de Estado"
//      → Sem grupo: recebe o padrão administrativo completo
//      → Com grupo: respeita exatamente as permissões marcadas no grupo
//
//   🔍 Supervisor / 👤 Atendente = "Ministros comuns"
//      → Respeita o grupo de permissão configurado pelo Dono
//      → Respeita o plano do workspace
//
// 🆕 INTEGRAÇÃO EQUIPES (multi-tenant): além das permissões, o hook agora
//    expõe `equipeId` e `workspaceId` do usuário logado, e um helper
//    `escopoVisao()` que diz se a tela deve mostrar TUDO do workspace,
//    só a EQUIPE do usuário, só o que é DELE, ou NADA.
// ═══════════════════════════════════════════════════════════════════════

// 🔒 Email do super admin Wolf (você)
const ADMIN_EMAIL = "robert.dias@live.com";

export type Permissoes = {
  // 💬 ATENDIMENTO
  chat_proprio: boolean;
  chat_todos: boolean;
  chat_interno: boolean;
  respostas_rapidas: boolean;
  transferir_chat: boolean;
  finalizar_chat: boolean;

  // 🏷️ CONTATOS & ETIQUETAS
  contatos_ver: boolean;
  contatos_editar: boolean;
  etiquetas: boolean;

  // 💰 VENDAS & CRM
  dashboard: boolean;
  vendas_proprio: boolean;
  vendas_equipe: boolean;
  funil: boolean;
  proposta_criar: boolean;
  contratos_acessar: boolean;
  contratos_criar: boolean;
  contratos_editar: boolean;
  contratos_reenviar: boolean;
  contratos_excluir: boolean;
  contratos_baixar: boolean;
  contratos_configurar: boolean;

  // 🧑‍💼 RH & PONTO
  rh: boolean;
  // 🧑‍💼 RH — telas (granular)
  rh_dashboard: boolean;
  rh_indicadores: boolean;
  rh_funcionarios: boolean;
  rh_departamentos: boolean;
  rh_cargos: boolean;
  rh_folha: boolean;
  rh_holerites: boolean;
  rh_encargos: boolean;
  rh_ponto: boolean;
  rh_ferias: boolean;
  rh_afastamentos: boolean;
  rh_banco_horas: boolean;
  rh_beneficios: boolean;
  rh_vale_transporte: boolean;
  rh_vale_refeicao: boolean;
  rh_plano_saude: boolean;
  rh_vagas: boolean;
  rh_candidatos: boolean;
  rh_selecao: boolean;
  rh_treinamentos: boolean;
  rh_avaliacoes: boolean;
  rh_documentos: boolean;
  rh_contratos: boolean;
  rh_config: boolean;
  // 💰 FINANCEIRO — acesso + telas (granular)
  financeiro_acessar: boolean;
  fin_dashboard: boolean;
  fin_indicadores: boolean;
  fin_contas_receber: boolean;
  fin_contas_pagar: boolean;
  fin_caixa: boolean;
  fin_transferencias: boolean;
  fin_contas_bancarias: boolean;
  fin_conciliacao: boolean;
  fin_extrato: boolean;
  fin_integracao_banco: boolean;
  fin_emitir_nota: boolean;
  fin_notas_recebidas: boolean;
  fin_boletos: boolean;
  fin_plano_contas: boolean;
  fin_centros_custo: boolean;
  fin_contatos: boolean;
  fin_formas_pagamento: boolean;
  fin_dre: boolean;
  fin_fluxo_caixa: boolean;
  fin_relatorios: boolean;
  fin_config: boolean;
  bater_ponto: boolean;

  // 💰 COBRANÇA
  cobranca: boolean;

  // 📤 MARKETING & DISPAROS
  disparo_enviar: boolean;
  templates_waba: boolean;

  // 📞 TELEFONIA VOIP
  voip_usar: boolean;
  voip_conexoes: boolean;
  voip_campanhas: boolean;

  // ⚙️ ADMINISTRAÇÃO
  conexoes: boolean;
  filas: boolean;
  usuarios_gerenciar: boolean;
  grupos_permissao: boolean;
  roleta_gerenciar: boolean;
  configuracoes_workspace: boolean;

  // 📊 RELATÓRIOS
  relatorios: boolean;
  relatorios_voip: boolean;

  // 👤 PESSOAL
  config_proprio: boolean;

  // ⚠️ ADMIN (true apenas quando o conjunto efetivo concede poder administrativo)
  administrador: boolean;

  // 🚪 ACESSO AOS MÓDULOS (mostra/esconde o botão na barra lateral)
  crm_acessar: boolean;
  chatbot_acessar: boolean;
  telefonia_acessar: boolean;
};

// Permissões totais do Dono e do Administrador SEM grupo restritivo
const PERMISSOES_DONO: Permissoes = {
  chat_proprio: true, chat_todos: true, chat_interno: true, respostas_rapidas: true,
  transferir_chat: true, finalizar_chat: true,
  contatos_ver: true, contatos_editar: true, etiquetas: true,
  dashboard: true, vendas_proprio: true, vendas_equipe: true, funil: true, proposta_criar: true,
  contratos_acessar: true, contratos_criar: true, contratos_editar: true, contratos_reenviar: true, contratos_excluir: true, contratos_baixar: true, contratos_configurar: true,
  rh: true, bater_ponto: true, cobranca: true,
  rh_dashboard: true, rh_indicadores: true, rh_funcionarios: true, rh_departamentos: true, rh_cargos: true, rh_folha: true, rh_holerites: true, rh_encargos: true, rh_ponto: true, rh_ferias: true, rh_afastamentos: true, rh_banco_horas: true, rh_beneficios: true, rh_vale_transporte: true, rh_vale_refeicao: true, rh_plano_saude: true, rh_vagas: true, rh_candidatos: true, rh_selecao: true, rh_treinamentos: true, rh_avaliacoes: true, rh_documentos: true, rh_contratos: true, rh_config: true,
  financeiro_acessar: true, fin_dashboard: true, fin_indicadores: true, fin_contas_receber: true, fin_contas_pagar: true, fin_caixa: true, fin_transferencias: true, fin_contas_bancarias: true, fin_conciliacao: true, fin_extrato: true, fin_integracao_banco: true, fin_emitir_nota: true, fin_notas_recebidas: true, fin_boletos: true, fin_plano_contas: true, fin_centros_custo: true, fin_contatos: true, fin_formas_pagamento: true, fin_dre: true, fin_fluxo_caixa: true, fin_relatorios: true, fin_config: true,
  disparo_enviar: true, templates_waba: true,
  voip_usar: true, voip_conexoes: true, voip_campanhas: true,
  conexoes: true, filas: true, usuarios_gerenciar: true, grupos_permissao: true,
  roleta_gerenciar: true, configuracoes_workspace: true,
  relatorios: true, relatorios_voip: true,
  config_proprio: true,
  administrador: true,
  crm_acessar: true, chatbot_acessar: true, telefonia_acessar: true,
};

// Supervisor: tudo menos admin de workspace
const PERMISSOES_SUPERVISOR: Permissoes = {
  ...PERMISSOES_DONO,
  conexoes: false,
  usuarios_gerenciar: false,
  grupos_permissao: false,
  configuracoes_workspace: false,
  voip_conexoes: false,
  administrador: false,
  contratos_acessar: false, contratos_criar: false, contratos_editar: false, contratos_reenviar: false, contratos_excluir: false, contratos_baixar: false, contratos_configurar: false,
  crm_acessar: true, chatbot_acessar: true, telefonia_acessar: true,
};

// Atendente padrão
const PERMISSOES_ATENDENTE: Permissoes = {
  chat_proprio: true, chat_todos: false, chat_interno: true, respostas_rapidas: true,
  transferir_chat: true, finalizar_chat: true,
  contatos_ver: true, contatos_editar: false, etiquetas: false,
  dashboard: true, vendas_proprio: true, vendas_equipe: false, funil: false, proposta_criar: true,
  contratos_acessar: false, contratos_criar: false, contratos_editar: false, contratos_reenviar: false, contratos_excluir: false, contratos_baixar: false, contratos_configurar: false,
  rh: false, bater_ponto: true, cobranca: false,
  rh_dashboard: false, rh_indicadores: false, rh_funcionarios: false, rh_departamentos: false, rh_cargos: false, rh_folha: false, rh_holerites: false, rh_encargos: false, rh_ponto: false, rh_ferias: false, rh_afastamentos: false, rh_banco_horas: false, rh_beneficios: false, rh_vale_transporte: false, rh_vale_refeicao: false, rh_plano_saude: false, rh_vagas: false, rh_candidatos: false, rh_selecao: false, rh_treinamentos: false, rh_avaliacoes: false, rh_documentos: false, rh_contratos: false, rh_config: false,
  financeiro_acessar: false, fin_dashboard: false, fin_indicadores: false, fin_contas_receber: false, fin_contas_pagar: false, fin_caixa: false, fin_transferencias: false, fin_contas_bancarias: false, fin_conciliacao: false, fin_extrato: false, fin_integracao_banco: false, fin_emitir_nota: false, fin_notas_recebidas: false, fin_boletos: false, fin_plano_contas: false, fin_centros_custo: false, fin_contatos: false, fin_formas_pagamento: false, fin_dre: false, fin_fluxo_caixa: false, fin_relatorios: false, fin_config: false,
  disparo_enviar: false, templates_waba: false,
  voip_usar: true, voip_conexoes: false, voip_campanhas: false,
  conexoes: false, filas: false, usuarios_gerenciar: false, grupos_permissao: false,
  roleta_gerenciar: false, configuracoes_workspace: false,
  relatorios: false, relatorios_voip: false,
  config_proprio: true,
  administrador: false,
  // 🆕 FIX: faltavam essas 3 chaves — ficavam `undefined` (efetivamente "false" em
  // condicionais), o que podia esconder esses módulos do menu do atendente mesmo
  // quando ele deveria ter acesso (ex: chat_proprio=true mas chatbot_acessar ausente).
  crm_acessar: true, chatbot_acessar: true, telefonia_acessar: true,
};

// Objeto-base: se um grupo salvo tiver campos faltando (ex: foi criado antes dessa atualização),
// a gente mescla com FALSE em todas as chaves novas.
export const PERMISSOES_ZERO: Permissoes = Object.keys(PERMISSOES_DONO).reduce((acc, k) => {
  (acc as any)[k] = false;
  return acc;
}, {} as Permissoes);

// Versão com TUDO true — usada como fallback pro super admin Wolf
const PERMISSOES_SUPER_ADMIN: Permissoes = { ...PERMISSOES_DONO };

// 🆕 Escopo de visão de uma área (vendas, chat, etc.)
//   "all"  → vê tudo do workspace (dono / admin / super admin / sem equipe atribuída)
//   "team" → vê só a equipe dele
//   "own"  → vê só o que é dele (vendedor = email dele)
//   "none" → não vê nada
export type EscopoVisao = "all" | "team" | "own" | "none";

export function usePermissao() {
  const [permissoes, setPermissoes] = useState<Permissoes>(PERMISSOES_ZERO);
  const [isDono, setIsDono] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [perfil, setPerfil] = useState("");
  const [equipeId, setEquipeId] = useState<string | null>(null);  // 🆕 uuid da equipe (null = sem recorte) — primeira equipe, por compat
  const [equipeIds, setEquipeIds] = useState<string[]>([]);        // 🆕 TODAS as equipes do atendente (equipes_acesso)
  const [workspaceId, setWorkspaceId] = useState<string>("");      // 🆕 username do workspace atual
  const [userEmail, setUserEmail] = useState<string>("");          // 🆕 email do usuário logado
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserEmail(user.email || "");

      // Detecta SUPER ADMIN Wolf — bypass total em qualquer workspace
      const ehSuperAdmin = (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setIsSuperAdmin(ehSuperAdmin);

      // ═══ É dono do workspace atual? ═══
      const { data: ws } = await supabase.from("workspaces").select("id, username")
        .eq("owner_id", user.id).maybeSingle();

      if (ws) {
        setIsDono(true);
        setPerfil(ehSuperAdmin ? "super_admin" : "dono");
        setPermissoes(PERMISSOES_DONO);
        setWorkspaceId(ws.username || "");
        setEquipeId(null);              // dono enxerga todas as equipes do workspace
        setLoading(false);
        return;
      }

      // Se é super admin mas não é dono desse workspace, ainda assim libera tudo
      // (super admin entra em workspace alheio pra dar suporte, deve poder fazer tudo)
      if (ehSuperAdmin) {
        setIsDono(false);
        setPerfil("super_admin");
        setPermissoes(PERMISSOES_SUPER_ADMIN);
        // Tenta descobrir o workspace via vínculo de sub-usuário (se houver)
        const { data: suWs } = await supabase.from("usuarios_workspace")
          .select("workspace_id")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setWorkspaceId(suWs?.workspace_id || "");
        setEquipeId(null);
        setLoading(false);
        return;
      }

      // ═══ É sub-usuário? ═══
      // 🆕 FIX: buscava a coluna "equipe_id" (singular) — que não é onde o sistema
      // grava a equipe do atendente. A coluna real é "equipes_acesso" (array de UUIDs,
      // o mesmo campo que o ChatSection já usa pra filtrar respostas rápidas). Com a
      // coluna errada, equipeId ficava sempre null pro atendente comum, e qualquer tela
      // que dependesse de escopoVisao() pra recortar por equipe não recortava nada.
      const { data: usuarioWs } = await supabase.from("usuarios_workspace")
        .select("perfil, grupo_id, equipes_acesso, workspace_id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usuarioWs) {
        setPerfil(usuarioWs.perfil || "Atendente");
        // 🆕 equipes_acesso é array (atendente pode estar em mais de uma equipe).
        // equipeId (singular) fica como a primeira, mantido só por compatibilidade
        // com código existente que já lê esse campo; equipeIds traz o array completo.
        const equipesDoUsuario: string[] = Array.isArray(usuarioWs.equipes_acesso) ? usuarioWs.equipes_acesso : [];
        setEquipeIds(equipesDoUsuario);
        setEquipeId(equipesDoUsuario[0] || null);
        setWorkspaceId(usuarioWs.workspace_id || "");   // 🆕 workspace do sub-usuário

        // Tem grupo customizado? O grupo é a fonte de verdade para QUALQUER
        // subusuário, inclusive Administrador. Dono e superadmin já foram tratados acima.
        if (usuarioWs.grupo_id) {
          const { data: grupo, error: erroGrupo } = await supabase.from("grupos_permissao")
            .select("permissoes")
            .eq("id", usuarioWs.grupo_id)
            .eq("workspace_id", usuarioWs.workspace_id)
            .maybeSingle();

          if (!erroGrupo && grupo?.permissoes) {
            // Mescla com PERMISSOES_ZERO pra garantir que TODAS as chaves existam
            // (importante: grupos antigos podem não ter as novas permissões)
            setPermissoes({ ...PERMISSOES_ZERO, ...grupo.permissoes });
            setLoading(false);
            return;
          }

          // Grupo foi selecionado, mas não pôde ser carregado: falha fechado.
          // Nunca herda o padrão do perfil, pois isso criaria permissões não marcadas.
          console.error("[usePermissao] grupo configurado não encontrado", {
            workspaceId: usuarioWs.workspace_id,
            grupoId: usuarioWs.grupo_id,
            erro: erroGrupo?.message,
          });
          setPermissoes(PERMISSOES_ZERO);
          setLoading(false);
          return;
        }

        // Sem grupo — usa padrão por perfil
        if (usuarioWs.perfil === "Administrador") {
          setPermissoes({ ...PERMISSOES_DONO, administrador: true });
        } else if (usuarioWs.perfil === "Supervisor") {
          setPermissoes(PERMISSOES_SUPERVISOR);
        } else {
          setPermissoes(PERMISSOES_ATENDENTE);
        }
      }

      setLoading(false);
    };
    init();
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────

  // Checa uma permissão pontual (dono/superadmin sempre passam; subusuário usa o grupo/padrão efetivo)
  const tem = (key: keyof Permissoes): boolean =>
    isSuperAdmin || isDono || !!permissoes[key];

  // Manda total? Dono/superadmin sempre; subusuário somente se a permissão efetiva conceder.
  const veTudo = isSuperAdmin || isDono || !!permissoes.administrador;

  // 🆕 Escopo de visão pra uma área que tem permissão "de equipe" e "própria".
  // Ex: vendas → escopoVisao("vendas_equipe", "vendas_proprio")
  //   - dono/admin/super       → "all"
  //   - tem _equipe + tem equipe(s) atribuída(s) → "team"
  //   - tem _equipe sem nenhuma equipe atribuída → "all" (não dá pra recortar, vê o workspace)
  //   - só tem _proprio          → "own"
  //   - não tem nenhuma          → "none"
  const escopoVisao = (
    keyEquipe: keyof Permissoes,
    keyProprio: keyof Permissoes
  ): EscopoVisao => {
    if (veTudo) return "all";
    if (permissoes[keyEquipe]) return equipeIds.length > 0 ? "team" : "all";
    if (permissoes[keyProprio]) return "own";
    return "none";
  };

  return {
    permissoes,
    isDono,
    isSuperAdmin,
    perfil,
    equipeId,      // 🆕 primeira equipe (compat)
    equipeIds,     // 🆕 todas as equipes do atendente
    workspaceId,   // 🆕
    userEmail,     // 🆕
    loading,
    tem,           // 🆕
    veTudo,        // 🆕
    escopoVisao,   // 🆕
  };
}