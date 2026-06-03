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
//      → Sub-usuário com PODERES IGUAIS AO DONO
//      → IGNORA qualquer grupo de permissão atribuído (acesso total sempre)
//      → Pra ter "admin com restrições", use perfil Supervisor + grupo
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

  // ⚠️ ADMIN (usado por perfil === "Administrador")
  administrador: boolean;

  // 🚪 ACESSO AOS MÓDULOS (mostra/esconde o botão na barra lateral)
  crm_acessar: boolean;
  chatbot_acessar: boolean;
  telefonia_acessar: boolean;
};

// Dono e Administrador recebem TUDO habilitado
const PERMISSOES_DONO: Permissoes = {
  chat_proprio: true, chat_todos: true, chat_interno: true, respostas_rapidas: true,
  transferir_chat: true, finalizar_chat: true,
  contatos_ver: true, contatos_editar: true, etiquetas: true,
  dashboard: true, vendas_proprio: true, vendas_equipe: true, funil: true, proposta_criar: true,
  rh: true, bater_ponto: true, cobranca: true,
  rh_dashboard: true, rh_indicadores: true, rh_funcionarios: true, rh_departamentos: true, rh_cargos: true, rh_folha: true, rh_holerites: true, rh_encargos: true, rh_ponto: true, rh_ferias: true, rh_afastamentos: true, rh_banco_horas: true, rh_beneficios: true, rh_vale_transporte: true, rh_vale_refeicao: true, rh_plano_saude: true, rh_vagas: true, rh_candidatos: true, rh_selecao: true, rh_treinamentos: true, rh_avaliacoes: true, rh_documentos: true, rh_contratos: true, rh_config: true,
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
  crm_acessar: true, chatbot_acessar: true, telefonia_acessar: true,
};

// Atendente padrão
const PERMISSOES_ATENDENTE: Permissoes = {
  chat_proprio: true, chat_todos: false, chat_interno: true, respostas_rapidas: true,
  transferir_chat: true, finalizar_chat: true,
  contatos_ver: true, contatos_editar: false, etiquetas: false,
  dashboard: true, vendas_proprio: true, vendas_equipe: false, funil: false, proposta_criar: true,
  rh: false, bater_ponto: true, cobranca: false,
  rh_dashboard: false, rh_indicadores: false, rh_funcionarios: false, rh_departamentos: false, rh_cargos: false, rh_folha: false, rh_holerites: false, rh_encargos: false, rh_ponto: false, rh_ferias: false, rh_afastamentos: false, rh_banco_horas: false, rh_beneficios: false, rh_vale_transporte: false, rh_vale_refeicao: false, rh_plano_saude: false, rh_vagas: false, rh_candidatos: false, rh_selecao: false, rh_treinamentos: false, rh_avaliacoes: false, rh_documentos: false, rh_contratos: false, rh_config: false,
  disparo_enviar: false, templates_waba: false,
  voip_usar: true, voip_conexoes: false, voip_campanhas: false,
  conexoes: false, filas: false, usuarios_gerenciar: false, grupos_permissao: false,
  roleta_gerenciar: false, configuracoes_workspace: false,
  relatorios: false, relatorios_voip: false,
  config_proprio: true,
  administrador: false,
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
  const [equipeId, setEquipeId] = useState<string | null>(null);  // 🆕 uuid da equipe (null = sem recorte)
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
      const { data: usuarioWs } = await supabase.from("usuarios_workspace")
        .select("perfil, grupo_id, equipe_id, workspace_id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usuarioWs) {
        setPerfil(usuarioWs.perfil || "Atendente");
        setEquipeId(usuarioWs.equipe_id || null);       // 🆕 equipe do sub-usuário
        setWorkspaceId(usuarioWs.workspace_id || "");   // 🆕 workspace do sub-usuário

        // 🆕 FIX (sessão 18): Administrador SEMPRE tem acesso total, IGNORA grupo.
        // Por design: "Administrador" implica acesso TOTAL, igual ao Dono.
        // Pra criar "admin com restrições", use perfil Supervisor + grupo.
        if (usuarioWs.perfil === "Administrador") {
          setPermissoes({ ...PERMISSOES_DONO, administrador: true });
          setLoading(false);
          return;
        }

        // Tem grupo customizado? (vale pra Supervisor e Atendente)
        if (usuarioWs.grupo_id) {
          const { data: grupo } = await supabase.from("grupos_permissao")
            .select("permissoes").eq("id", usuarioWs.grupo_id).maybeSingle();

          if (grupo?.permissoes) {
            // Mescla com PERMISSOES_ZERO pra garantir que TODAS as chaves existam
            // (importante: grupos antigos podem não ter as novas permissões)
            setPermissoes({ ...PERMISSOES_ZERO, ...grupo.permissoes });
            setLoading(false);
            return;
          }
        }

        // Sem grupo — usa padrão por perfil
        if (usuarioWs.perfil === "Supervisor") {
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

  // Checa uma permissão pontual (dono/admin/super admin sempre passam)
  const tem = (key: keyof Permissoes): boolean =>
    isSuperAdmin || isDono || !!permissoes[key];

  // Manda total? (dono, super admin ou perfil Administrador)
  const veTudo = isSuperAdmin || isDono || perfil === "Administrador";

  // 🆕 Escopo de visão pra uma área que tem permissão "de equipe" e "própria".
  // Ex: vendas → escopoVisao("vendas_equipe", "vendas_proprio")
  //   - dono/admin/super       → "all"
  //   - tem _equipe + tem equipe atribuída → "team"
  //   - tem _equipe sem equipe atribuída   → "all" (não dá pra recortar, vê o workspace)
  //   - só tem _proprio          → "own"
  //   - não tem nenhuma          → "none"
  const escopoVisao = (
    keyEquipe: keyof Permissoes,
    keyProprio: keyof Permissoes
  ): EscopoVisao => {
    if (veTudo) return "all";
    if (permissoes[keyEquipe]) return equipeId ? "team" : "all";
    if (permissoes[keyProprio]) return "own";
    return "none";
  };

  return {
    permissoes,
    isDono,
    isSuperAdmin,
    perfil,
    equipeId,      // 🆕
    workspaceId,   // 🆕
    userEmail,     // 🆕
    loading,
    tem,           // 🆕
    veTudo,        // 🆕
    escopoVisao,   // 🆕
  };
}