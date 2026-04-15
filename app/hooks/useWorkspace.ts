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

      // Pega o usuário logado
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      setUser({ id: authUser.id, email: authUser.email || "" });

      // Busca o workspace do usuário
      const { data: ws } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", authUser.id)
        .single();

      setWorkspace(ws || null);
      setLoading(false);
    };

    fetchWorkspace();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return { workspace, user, loading, signOut };
}