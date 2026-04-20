"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../lib/supabase";

type Proposta = {
  id: number; created_at: string; data_proposta: string; nome: string;
  vendedor: string; valor_plano: number; status_venda: string;
  operadora: string; plano: string; workspace_id: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [filtro, setFiltro] = useState("diario");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).single();
      if (ws) {
        const wsId = ws.username || ws.id.toString();
        setWorkspaceId(wsId);
        const { data } = await supabase.from("proposta").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
        setPropostas(data || []);
      }
      setLoading(false);
    };
    init();
  }, []);

  const hoje = new Date();
  const filtrarPorPeriodo = (lista: Proposta[]) => lista.filter(p => {
    const data = new Date(p.created_at);
    if (filtro === "diario") return data.toDateString() === hoje.toDateString();
    else if (filtro === "semanal") return (hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    else return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  });

  const pf = filtrarPorPeriodo(propostas);
  const totalReceita = pf.reduce((acc, p) => acc + (p.valor_plano || 0), 0);
  const totalInstaladas = pf.filter(p => p.status_venda === "INSTALADA").length;
  const totalGeradas = pf.filter(p => p.status_venda === "GERADA").length;
  const totalCanceladas = pf.filter(p => p.status_venda === "CANCELADA").length;
  const totalPendentes = pf.filter(p => p.status_venda === "PENDENTE").length;
  const totalAuditoria = pf.filter(p => p.status_venda === "AGUARDANDO AUDITORIA").length;
  const filtroLabel: Record<string, string> = { diario: "Hoje", semanal: "Esta Semana", mensal: "Este Mês" };
  const rankingVendedores = Object.entries(pf.reduce((acc: Record<string, number>, p) => { if (p.vendedor) acc[p.vendedor] = (acc[p.vendedor] || 0) + (p.valor_plano || 0); return acc; }, {})).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  const funilVendedores = Object.entries(pf.reduce((acc: Record<string, Record<string, number>>, p) => { if (!p.vendedor) return acc; if (!acc[p.vendedor]) acc[p.vendedor] = { INSTALADA: 0, GERADA: 0, CANCELADA: 0, PENDENTE: 0 }; if (acc[p.vendedor][p.status_venda] !== undefined) acc[p.vendedor][p.status_venda]++; return acc; }, {})).map(([vendedor, status]) => ({ vendedor, ...status }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <button onClick={() => router.push("/crm")} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0, marginBottom: 8 }}>← Voltar ao CRM</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["diario", "semanal", "mensal"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtro === f ? "#16a34a" : "#1f2937", color: filtro === f ? "white" : "#9ca3af" }}>{filtroLabel[f]}</button>
          ))}
        </div>
      </div>
      {loading ? <p style={{ color: "#6b7280" }}>Carregando...</p> : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Total Receita", value: `R$ ${totalReceita.toLocaleString("pt-BR")}`, color: "#16a34a", icon: "💰" },
              { label: "Instaladas", value: totalInstaladas, color: "#16a34a", icon: "✅" },
              { label: "Geradas", value: totalGeradas, color: "#8b5cf6", icon: "📄" },
              { label: "Pendentes", value: totalPendentes, color: "#f59e0b", icon: "⏳" },
              { label: "Auditoria", value: totalAuditoria, color: "#3b82f6", icon: "🔍" },
              { label: "Canceladas", value: totalCanceladas, color: "#dc2626", icon: "❌" },
            ].map(card => (
              <div key={card.label} style={{ flex: "1 1 140px", background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
                <p style={{ color: card.color, fontSize: 26, fontWeight: "bold", margin: 0 }}>{card.value}</p>
                <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>{filtroLabel[filtro]}</p>
              </div>
            ))}
          </div>
          <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
            <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 20px" }}>🏆 Ranking de Receita por Vendedor</h3>
            {rankingVendedores.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhuma proposta neste período.</p> : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rankingVendedores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="nome" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} tickFormatter={v => `R$${v}`} />
                    <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8, color: "white" }} formatter={(value: any) => [`R$ ${value.toLocaleString("pt-BR")}`, "Receita"]} />
                    <Bar dataKey="valor" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                  {rankingVendedores.map((v, i) => (
                    <div key={v.nome} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d0d", borderRadius: 8, padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: "bold", fontSize: 16 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                        <span style={{ color: "white", fontSize: 14, fontWeight: "bold" }}>{v.nome}</span>
                      </div>
                      <span style={{ color: "#16a34a", fontSize: 14, fontWeight: "bold" }}>R$ {v.valor.toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
            <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 20px" }}>🎯 Funil por Vendedor</h3>
            {funilVendedores.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhuma proposta neste período.</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#0d0d0d" }}>{["Vendedor", "✅ Instaladas", "📄 Geradas", "⏳ Pendentes", "❌ Canceladas"].map(h => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                <tbody>{funilVendedores.map((v, i) => (<tr key={v.vendedor} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{v.vendedor}</td><td style={{ padding: "14px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>{(v as any).INSTALADA || 0}</td><td style={{ padding: "14px 16px", color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>{(v as any).GERADA || 0}</td><td style={{ padding: "14px 16px", color: "#f59e0b", fontSize: 13, fontWeight: "bold" }}>{(v as any).PENDENTE || 0}</td><td style={{ padding: "14px 16px", color: "#dc2626", fontSize: 13, fontWeight: "bold" }}>{(v as any).CANCELADA || 0}</td></tr>))}</tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}