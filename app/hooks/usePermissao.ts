import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type Permissoes = {
  chat_proprio: boolean;
  chat_todos: boolean;
  dashboard: boolean;
  chat_interno: boolean;
  respostas_rapidas: boolean;
  vendas_proprio: boolean;
  vendas_equipe: boolean;
  conexoes: boolean;
  filas: boolean;
  configuracoes_workspace: boolean;
  relatorios: boolean;
  config_proprio: boolean;
};

const PERMISSOES_DONO: Permissoes = {
  chat_proprio: true, chat_todos: true, dashboard: true,
  chat_interno: true, respostas_rapidas: true, vendas_proprio: true,
  vendas_equipe: true, conexoes: true, filas: true,
  configuracoes_workspace: true, relatorios: true, config_proprio: true,
};

const PERMISSOES_ATENDENTE: Permissoes = {
  chat_proprio: true, chat_todos: false, dashboard: true,
  chat_interno: true, respostas_rapidas: true, vendas_proprio: true,
  vendas_equipe: false, conexoes: false, filas: false,
  configuracoes_workspace: false, relatorios: false, config_proprio: true,
};

export function usePermissao() {
  const [permissoes, setPermissoes] = useState<Permissoes>(PERMISSOES_DONO);
  const [isDono, setIsDono] = useState(false);
  const [perfil, setPerfil] = useState("dono");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // ═══ É dono do workspace? ═══
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (ws) {
        setIsDono(true);
        setPerfil("dono");
        setPermissoes(PERMISSOES_DONO);
        setLoading(false);
        return;
      }

      // ═══ É sub-usuário? ═══
      // ✅ Pega a linha MAIS RECENTE (evita pegar registro antigo de duplicatas)
      const { data: usuarioWs } = await supabase
        .from("usuarios_workspace")
        .select("perfil, grupo_id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usuarioWs) {
        setPerfil(usuarioWs.perfil || "Atendente");

        // Tem grupo de permissão customizado?
        if (usuarioWs.grupo_id) {
          const { data: grupo } = await supabase
            .from("grupos_permissao")
            .select("permissoes")
            .eq("id", usuarioWs.grupo_id)
            .maybeSingle();

          if (grupo?.permissoes) {
            setPermissoes({ ...PERMISSOES_ATENDENTE, ...grupo.permissoes });
            setLoading(false);
            return;
          }
        }

        // Sem grupo — usa padrão por perfil
        if (usuarioWs.perfil === "Supervisor") {
          // Supervisor: tudo do dono menos conexões e config do workspace
          setPermissoes({ ...PERMISSOES_DONO, conexoes: false, configuracoes_workspace: false });
        } else if (usuarioWs.perfil === "Administrador") {
          // Administrador: igual ao dono
          setPermissoes(PERMISSOES_DONO);
        } else {
          // Atendente (padrão)
          setPermissoes(PERMISSOES_ATENDENTE);
        }
      }

      setLoading(false);
    };
    init();
  }, []);

  return { permissoes, isDono, perfil, loading };
}