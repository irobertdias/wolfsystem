"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Proposta = {
  id: number; created_at: string; nome: string; vendedor: string;
  valor_plano: number; status_venda: string; workspace_id: string;
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
  const filtroLabel: Record<string, string> = { diario: "Hoje", semanal: "Esta Semana", mensal: "Este Mês" };

  const filtrarPorPeriodo = (lista: Proposta[]) => lista.filter(p => {
    const data = new Date(p.created_at);
    if (filtro === "diario") return data.toDateString() === hoje.toDateString();
    else if (filtro === "semanal") return (hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    else return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  });

  const pf = filtrarPorPeriodo(propostas);
  const totalInstaladas = pf.filter(p => p.status_venda === "INSTALADA").length;
  const totalGeradas = pf.filter(p => p.status_venda === "GERADA").length;
  const totalCanceladas = pf.filter(p => p.status_venda === "CANCELADA").length;
  const totalPendentes = pf.filter(p => p.status_venda === "PENDENTE").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Funil de Vendas</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["diario", "semanal", "mensal"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtro === f ? "#16a34a" : "#1f2937", color: filtro === f ? "white" : "#9ca3af" }}>{filtroLabel[f]}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { stage: "Instaladas", count: totalInstaladas, color: "#16a34a" },
          { stage: "Geradas", count: totalGeradas, color: "#8b5cf6" },
          { stage: "Pendentes", count: totalPendentes, color: "#f59e0b" },
          { stage: "Canceladas", count: totalCanceladas, color: "#dc2626" },
        ].map(f => (
          <div key={f.stage} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 24, border: `1px solid ${f.color}33`, textAlign: "center" }}>
            <p style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", margin: "0 0 12px 0" }}>{f.stage}</p>
            <p style={{ color: f.color, fontSize: 40, fontWeight: "bold", margin: 0 }}>{f.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}