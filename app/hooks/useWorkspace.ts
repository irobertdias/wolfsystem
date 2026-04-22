import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Workspace = {
  id: number;
  nome: string;
  owner_id: string;
  owner_email: string;
  plano: string;
  usuarios_limite: string;
  conexoes_limite: string;
  ia: string;
  ativo: boolean;
  username: string;
};

type User = {
  id: string;
  email: string;
};

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspace = async () => {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }
      setUser({ id: authUser.id, email: authUser.email || "" });

      // ═══ 1. É dono do workspace? ═══
      const { data: wsDono } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", authUser.id)
        .maybeSingle();

      if (wsDono) {
        setWorkspace(wsDono);
        setLoading(false);
        return;
      }

      // ═══ 2. É sub-usuário de algum workspace? ═══
      // Busca a linha MAIS RECENTE (desempata duplicatas ficando com a última criada)
      const { data: usuarioWs } = await supabase
        .from("usuarios_workspace")
        .select("workspace_id")
        .eq("email", authUser.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usuarioWs?.workspace_id) {
        // ✅ Busca o workspace pelo username (workspace_id sempre guarda o username)
        const { data: wsSub } = await supabase
          .from("workspaces")
          .select("*")
          .eq("username", usuarioWs.workspace_id)
          .maybeSingle();

        if (wsSub) {
          setWorkspace(wsSub);
          setLoading(false);
          return;
        }

        // ⚠️ Fallback: se workspace_id for numérico (dados legados),
        // busca por id. Só converte se for só dígitos (evita erro de cast).
        if (/^\d+$/.test(usuarioWs.workspace_id)) {
          const { data: wsLegado } = await supabase
            .from("workspaces")
            .select("*")
            .eq("id", parseInt(usuarioWs.workspace_id))
            .maybeSingle();

          if (wsLegado) {
            setWorkspace(wsLegado);
            setLoading(false);
            return;
          }
        }
      }

      // Não encontrou
      setWorkspace(null);
      setLoading(false);
    };
    fetchWorkspace();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // ✅ MULTI-TENANT: wsId é SEMPRE o username do workspace
  const wsId = workspace?.username || "";
  const wsPronto = !loading && !!wsId;

  return { workspace, user, loading, signOut, wsId, wsPronto };
}