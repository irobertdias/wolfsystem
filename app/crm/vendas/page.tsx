"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Proposta = {
  id: number; created_at: string; data_proposta: string; nome: string;
  vendedor: string; valor_plano: number; status_venda: string;
  operadora: string; plano: string; workspace_id: string;
};

const statusColor: Record<string, string> = {
  PENDENTE: "#f59e0b", "AGUARDANDO AUDITORIA": "#3b82f6",
  CANCELADA: "#dc2626", INSTALADA: "#16a34a", GERADA: "#8b5cf6", REPROVADA: "#ef4444",
};

export default function Vendas() {
  const router = useRouter();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).single();
      if (ws) {
        const wsId = ws.username || ws.id.toString();
        const { data } = await supabase.from("proposta").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
        setPropostas(data || []);
      }
      setLoading(false);
    };
    init();
  }, []);

  const propostasFiltradas = propostas
    .filter(p => filtroStatus === "todos" || p.status_venda === filtroStatus)
    .filter(p => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.vendedor?.toLowerCase().includes(busca.toLowerCase()));

  const inputStyle = { background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 13 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>💰 Vendas</h1>
        <button onClick={() => router.push("/crm/proposta")} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>📋 Nova Proposta</button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar por cliente ou vendedor..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inputStyle, minWidth: 280 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "todos", label: "Todos" },
            { key: "INSTALADA", label: "✅ Instaladas" },
            { key: "GERADA", label: "📄 Geradas" },
            { key: "PENDENTE", label: "⏳ Pendentes" },
            { key: "AGUARDANDO AUDITORIA", label: "🔍 Auditoria" },
            { key: "CANCELADA", label: "❌ Canceladas" },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtroStatus === f.key ? "#16a34a" : "#1f2937", color: filtroStatus === f.key ? "white" : "#9ca3af" }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0d0d0d" }}>
              {["Cliente", "Vendedor", "Operadora", "Valor", "Status", "Data"].map(h => (
                <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>Carregando...</td></tr>
            ) : propostasFiltradas.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: "center" }}>
                <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Nenhuma proposta encontrada</p>
              </td></tr>
            ) : propostasFiltradas.map((v, i) => (
              <tr key={v.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                <td style={{ padding: "14px 16px", color: "white", fontSize: 13 }}>{v.nome}</td>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{v.vendedor}</td>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{v.operadora || "—"}</td>
                <td style={{ padding: "14px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>R$ {(v.valor_plano || 0).toLocaleString("pt-BR")}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ background: `${statusColor[v.status_venda] || "#6b7280"}22`, color: statusColor[v.status_venda] || "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{v.status_venda}</span>
                </td>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{v.data_proposta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}