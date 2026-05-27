"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════
// 👥 useEquipeFiltro + <EquipeSelector />
//
// Hook + componente reutilizáveis pra qualquer página que queira
// filtrar por equipe (Vendas, Dashboard, Chatbot Dashboard, etc).
//
// USO:
//   const { equipes, equipeId, setEquipeId, EquipeSelector } = useEquipeFiltro(workspaceId);
//   ...
//   <EquipeSelector />  // renderiza o dropdown
//   ...
//   const propostasDaEquipe = propostas.filter(p =>
//     !equipeId || p.equipe_id === equipeId
//   );
// ═══════════════════════════════════════════════════════════════════

export type Equipe = {
  id: string;
  workspace_id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  created_at: string;
};

const LS_PREFIX = "equipe_filtro_v1";

export function useEquipeFiltro(workspaceId: string) {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeId, setEquipeIdState] = useState<string>("");
  const [carregando, setCarregando] = useState(false);

  const lsKey = workspaceId ? `${LS_PREFIX}__${workspaceId}` : "";

  // Carrega da localStorage só uma vez por workspace
  useEffect(() => {
    if (!lsKey || typeof window === "undefined") return;
    const stored = localStorage.getItem(lsKey);
    if (stored) setEquipeIdState(stored);
    else setEquipeIdState("");
  }, [lsKey]);

  // Setter que persiste
  const setEquipeId = useCallback((id: string) => {
    setEquipeIdState(id);
    if (typeof window !== "undefined" && lsKey) {
      if (id) localStorage.setItem(lsKey, id);
      else localStorage.removeItem(lsKey);
    }
  }, [lsKey]);

  // Fetch das equipes do workspace
  const fetchEquipes = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from("equipes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (!error && data) setEquipes(data as Equipe[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { fetchEquipes(); }, [fetchEquipes]);

  // Realtime — quando admin cria/edita equipe noutra aba, atualiza aqui
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase.channel("equipes_rt_" + workspaceId)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "equipes", filter: `workspace_id=eq.${workspaceId}` },
        () => fetchEquipes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, fetchEquipes]);

  // Se a equipe selecionada for desativada/removida, volta pra "todas"
  useEffect(() => {
    if (!equipeId) return;
    if (equipes.length > 0 && !equipes.find(e => e.id === equipeId)) {
      setEquipeId("");
    }
  }, [equipes, equipeId, setEquipeId]);

  const equipeSelecionada = equipes.find(e => e.id === equipeId) || null;

  // ─── Componente <EquipeSelector /> ──────────────────────────────
  const EquipeSelector = ({
    mostrarSeVazio = false,
    estilo,
  }: {
    mostrarSeVazio?: boolean;
    estilo?: React.CSSProperties;
  }) => {
    if (!mostrarSeVazio && equipes.length === 0) return null;

    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: equipeId ? "#f0fdf4" : "#ffffff",
        border: `1px solid ${equipeId ? "#bbf7d0" : "#e5e7eb"}`,
        borderRadius: 12, padding: "6px 12px 6px 14px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.15s",
        ...estilo,
      }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>👥</span>
        <span style={{
          color: "#6b7280", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.5,
          whiteSpace: "nowrap",
        }}>
          Equipe
        </span>
        <select
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          style={{
            background: "transparent", border: "none", outline: "none",
            color: equipeId ? "#16a34a" : "#1f2937",
            fontSize: 13, fontWeight: 700,
            cursor: equipes.length === 0 ? "not-allowed" : "pointer",
            padding: "4px 0", minWidth: 140,
          }}
          disabled={equipes.length === 0}
        >
          <option value="">🌐 Todas as equipes</option>
          {equipes.map(eq => (
            <option key={eq.id} value={eq.id}>{eq.nome}</option>
          ))}
        </select>
      </div>
    );
  };

  return {
    equipes,
    equipeId,
    equipeSelecionada,
    setEquipeId,
    carregando,
    EquipeSelector,
    refetch: fetchEquipes,
  };
}