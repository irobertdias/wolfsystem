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
  user_metadata?: Record<string, unknown>;
};

type Resolucao = { workspace: Workspace | null; wsIdDireto: string };

// ⚡ Vários componentes da mesma tela usam este hook; antes cada um refazia a
// mesma sequência de consultas. Agora a resolução é compartilhada por 60 s
// para o mesmo usuário (consultas simultâneas também viram uma só).
let resolucaoCompartilhada: { userId: string; em: number; promessa: Promise<Resolucao> } | null = null;

async function resolverWorkspace(authUser: { id: string; email?: string | null }): Promise<Resolucao> {
      // ═══ 1. É dono do workspace? ═══
      const { data: wsDono } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", authUser.id)
        .maybeSingle();

      if (wsDono) return { workspace: wsDono, wsIdDireto: "" };

      // ═══ 2. É sub-usuário de algum workspace? ═══
      // Busca a linha MAIS RECENTE (desempata duplicatas ficando com a última criada)
      const { data: usuarioWs } = await supabase
        .from("usuarios_workspace")
        .select("workspace_id")
        .eq("email", authUser.email ?? "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usuarioWs?.workspace_id) {
        // ✅ FIX: o wsId vem DIRETO do vínculo do sub-usuário. É o mesmo valor
        //    carimbado em funcionarios/ponto_registros. Não pode depender de
        //    achar a linha em `workspaces` (RLS bloqueia funcionário de ler
        //    essa tabela, ou o username diverge → wsId vazio → ponto quebra).
        const wsIdDireto = String(usuarioWs.workspace_id);

        // Busca o objeto workspace só pra exibição (best-effort — não trava o wsId)
        const { data: wsSub } = await supabase
          .from("workspaces")
          .select("*")
          .eq("username", usuarioWs.workspace_id)
          .maybeSingle();

        if (wsSub) return { workspace: wsSub, wsIdDireto };

        // ⚠️ Fallback: se workspace_id for numérico (dados legados),
        // busca por id. Só converte se for só dígitos (evita erro de cast).
        if (/^\d+$/.test(usuarioWs.workspace_id)) {
          const { data: wsLegado } = await supabase
            .from("workspaces")
            .select("*")
            .eq("id", parseInt(usuarioWs.workspace_id))
            .maybeSingle();

          if (wsLegado) return { workspace: wsLegado, wsIdDireto };
        }

        // Não achou o objeto workspace (provável RLS), mas o wsId direto já
        // está setado — o ponto e os filtros por workspace_id seguem funcionando.
        return { workspace: null, wsIdDireto };
      }

      // Não encontrou nenhum vínculo
      return { workspace: null, wsIdDireto: "" };
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [wsIdDireto, setWsIdDireto] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const fetchWorkspace = async () => {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (cancelado) return;
      if (!authUser) { setLoading(false); return; }
      setUser({
        id: authUser.id,
        email: authUser.email || "",
        user_metadata: authUser.user_metadata || {},
      });
      if (!resolucaoCompartilhada || resolucaoCompartilhada.userId !== authUser.id || Date.now() - resolucaoCompartilhada.em > 60_000) {
        const promessa = resolverWorkspace(authUser);
        resolucaoCompartilhada = { userId: authUser.id, em: Date.now(), promessa };
        promessa.catch(() => { if (resolucaoCompartilhada?.promessa === promessa) resolucaoCompartilhada = null; });
      }
      try {
        const r = await resolucaoCompartilhada.promessa;
        if (cancelado) return;
        setWsIdDireto(r.wsIdDireto);
        setWorkspace(r.workspace);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    fetchWorkspace();
    return () => { cancelado = true; };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // ✅ MULTI-TENANT: wsId é SEMPRE o username do workspace
  const wsId = workspace?.username || wsIdDireto || "";
  const wsPronto = !loading && !!wsId;

  return { workspace, user, loading, signOut, wsId, wsPronto };
}