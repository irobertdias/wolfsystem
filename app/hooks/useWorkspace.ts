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

      // 1. Verifica se é dono do workspace
      const { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", authUser.id).single();
      if (ws) { setWorkspace(ws); setLoading(false); return; }

      // 2. Verifica se é sub-usuário de algum workspace
      const { data: usuarioWs } = await supabase.from("usuarios_workspace").select("workspace_id").eq("email", authUser.email).single();
      if (usuarioWs) {
        const { data: wsDoono } = await supabase.from("workspaces").select("*").or(`username.eq.${usuarioWs.workspace_id},id.eq.${usuarioWs.workspace_id}`).single();
        if (wsDoono) { setWorkspace(wsDoono); setLoading(false); return; }
      }

      setWorkspace(null);
      setLoading(false);
    };
    fetchWorkspace();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // ✅ MULTI-TENANT: wsId é SEMPRE o username do workspace.
  // Se o workspace não tiver username, retorna string vazia (trava o sistema).
  // Isso garante isolamento entre clientes e bate com o RLS do Supabase.
  const wsId = workspace?.username || "";

  // ✅ Flag pra o frontend saber quando já pode começar a buscar dados
  const wsPronto = !loading && !!wsId;

  return { workspace, user, loading, signOut, wsId, wsPronto };
}