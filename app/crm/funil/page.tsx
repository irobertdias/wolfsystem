"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Proposta = {
  id: number; created_at: string; nome: string;
  vendedor: string; valor_plano: number; status_venda: string; workspace_id: string;
};

export default function Funil() {
  const router = useRouter();
  const [filtro, setFiltro] = useState("diario");
  const [propostas, setPropostas] = useState<Proposta[]>([]);

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
    };
    init();
  }, []);

  const hoje = new Date();
  const filtrar = (lista: Proposta[]) => lista.filter(p => {
    const data = new Date(p.created_at);
    if (filtro === "diario") return data.toDateString() === hoje.toDateString();
    else if (filtro === "semanal") return (hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    else return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  });

  const pf = filtrar(propostas);
  const filtroLabel: Record<string, string> = { diario: "Hoje", semanal: "Esta Semana", mensal: "Este Mês" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🎯 Funil de Vendas</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["diario", "semanal", "mensal"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtro === f ? "#16a34a" : "#1f2937", color: filtro === f ? "white" : "#9ca3af" }}>{filtroLabel[f]}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { stage: "Instaladas", status: "INSTALADA", color: "#16a34a" },
          { stage: "Geradas", status: "GERADA", color: "#8b5cf6" },
          { stage: "Pendentes", status: "PENDENTE", color: "#f59e0b" },
          { stage: "Auditoria", status: "AGUARDANDO AUDITORIA", color: "#3b82f6" },
          { stage: "Canceladas", status: "CANCELADA", color: "#dc2626" },
        ].map(f => (
          <div key={f.stage} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 24, border: `1px solid ${f.color}33`, textAlign: "center" }}>
            <p style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", margin: "0 0 12px" }}>{f.stage}</p>
            <p style={{ color: f.color, fontSize: 40, fontWeight: "bold", margin: 0 }}>{pf.filter(p => p.status_venda === f.status).length}</p>
          </div>
        ))}
      </div>
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
        <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 16px" }}>Propostas — {filtroLabel[filtro]}</h3>
        {pf.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhuma proposta neste período.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#0d0d0d" }}>{["Cliente", "Vendedor", "Valor", "Status"].map(h => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
            <tbody>{pf.map((p, i) => (
              <tr key={p.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                <td style={{ padding: "14px 16px", color: "white", fontSize: 13 }}>{p.nome}</td>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{p.vendedor}</td>
                <td style={{ padding: "14px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>R$ {(p.valor_plano || 0).toLocaleString("pt-BR")}</td>
                <td style={{ padding: "14px 16px" }}><span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>{p.status_venda}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}