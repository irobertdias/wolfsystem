import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🔐 Sistema de permissões Wolf CRM
// ═══════════════════════════════════════════════════════════════════════
// Cada chave é uma permissão granular. Agrupadas em 8 categorias lógicas
// na UI de edição de grupos. Mas aqui no hook é um objeto plano.
// ═══════════════════════════════════════════════════════════════════════

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
};

// Dono e Administrador recebem TUDO habilitado
const PERMISSOES_DONO: Permissoes = {
  chat_proprio: true, chat_todos: true, chat_interno: true, respostas_rapidas: true,
  transferir_chat: true, finalizar_chat: true,
  contatos_ver: true, contatos_editar: true, etiquetas: true,
  dashboard: true, vendas_proprio: true, vendas_equipe: true, funil: true, proposta_criar: true,
  disparo_enviar: true, templates_waba: true,
  voip_usar: true, voip_conexoes: true, voip_campanhas: true,
  conexoes: true, filas: true, usuarios_gerenciar: true, grupos_permissao: true,
  roleta_gerenciar: true, configuracoes_workspace: true,
  relatorios: true, relatorios_voip: true,
  config_proprio: true,
  administrador: true,
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
};

// Atendente padrão
const PERMISSOES_ATENDENTE: Permissoes = {
  chat_proprio: true, chat_todos: false, chat_interno: true, respostas_rapidas: true,
  transferir_chat: true, finalizar_chat: true,
  contatos_ver: true, contatos_editar: false, etiquetas: false,
  dashboard: true, vendas_proprio: true, vendas_equipe: false, funil: false, proposta_criar: true,
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

export function usePermissao() {
  const [permissoes, setPermissoes] = useState<Permissoes>(PERMISSOES_ZERO);
  const [isDono, setIsDono] = useState(false);
  const [perfil, setPerfil] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // ═══ É dono? ═══
      const { data: ws } = await supabase.from("workspaces").select("id")
        .eq("owner_id", user.id).maybeSingle();

      if (ws) {
        setIsDono(true);
        setPerfil("dono");
        setPermissoes(PERMISSOES_DONO);
        setLoading(false);
        return;
      }

      // ═══ É sub-usuário? ═══
      const { data: usuarioWs } = await supabase.from("usuarios_workspace")
        .select("perfil, grupo_id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usuarioWs) {
        setPerfil(usuarioWs.perfil || "Atendente");

        // Tem grupo customizado?
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

  return { permissoes, isDono, perfil, loading };
}