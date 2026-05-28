"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../lib/supabase";
import { useEquipeFiltro } from "../../hooks/useEquipeFiltro";

type Proposta = {
  id: number; created_at: string; data_proposta: string; nome: string;
  vendedor: string; valor_plano: number; status_venda: string;
  operadora: string; plano: string; workspace_id: string;
  equipe_id?: string | null;
};
type UsuarioWs = { email: string; nome: string; };

export default function Dashboard() {
  const router = useRouter();
  const [filtro, setFiltro] = useState("diario");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceNome, setWorkspaceNome] = useState("");
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");

  // 👥 Filtro por equipe (dropdown que aparece pro admin)
  const { equipeId, EquipeSelector } = useEquipeFiltro(workspaceId);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      // 🆕 FIX: tenta achar workspace pelas duas vias (dono OU sub-usuário)
      let wsIds: string[] = [];
      let wsNome = "";
      let ownerEmail = "";

      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono) {
        if (wsDono.username) wsIds.push(wsDono.username);
        if (wsDono.id) wsIds.push(wsDono.id.toString());
        wsNome = wsDono.nome || "";
        ownerEmail = wsDono.owner_email || "";
      } else {
        const { data: uw } = await supabase.from("usuarios_workspace")
          .select("workspace_id").eq("email", user.email)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (uw?.workspace_id) {
          wsIds.push(uw.workspace_id);
          const { data: wsSub } = await supabase.from("workspaces")
            .select("nome, username, id, owner_email")
            .or(`username.eq.${uw.workspace_id},id.eq.${uw.workspace_id}`).maybeSingle();
          if (wsSub) {
            wsNome = wsSub.nome || "";
            ownerEmail = wsSub.owner_email || "";
            if (wsSub.username && !wsIds.includes(wsSub.username)) wsIds.push(wsSub.username);
            if (wsSub.id && !wsIds.includes(wsSub.id.toString())) wsIds.push(wsSub.id.toString());
          }
        }
      }

      if (wsIds.length === 0) { setLoading(false); return; }
      setWorkspaceNome(wsNome);
      setWorkspaceId(wsIds[0]);

      const { data: props } = await supabase.from("proposta").select("*")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false });
      setPropostas(props || []);

      // 🆕 Mapa email → nome
      const lista: UsuarioWs[] = [];
      if (ownerEmail) lista.push({ email: ownerEmail, nome: wsNome || "Dono" });
      const { data: subs } = await supabase.from("usuarios_workspace")
        .select("email, nome").in("workspace_id", wsIds);
      for (const s of (subs || [])) {
        if (s.email && !lista.find(x => x.email?.toLowerCase() === s.email?.toLowerCase())) {
          lista.push({ email: s.email, nome: s.nome || s.email });
        }
      }
      setUsuariosWs(lista);
      setLoading(false);
    };
    init();
  }, []);

  const nomeVendedor = (v: string): string => {
    if (!v) return "—";
    const u = usuariosWs.find(x => x.email?.toLowerCase() === v?.toLowerCase());
    return u?.nome || v;
  };

  const hoje = new Date();
  const filtroLabel: Record<string, string> = { diario: "Hoje", semanal: "Esta Semana", mensal: "Este Mês" };

  const filtrarPorPeriodo = (lista: Proposta[]) => lista.filter(p => {
    if (equipeId && p.equipe_id !== equipeId) return false;
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

  const rankingVendedores = Object.entries(pf.reduce((acc: Record<string, number>, p) => {
    if (p.vendedor) acc[p.vendedor] = (acc[p.vendedor] || 0) + (p.valor_plano || 0);
    return acc;
  }, {})).map(([vendedorKey, valor]) => ({
    nome: nomeVendedor(vendedorKey),
    valor
  })).sort((a, b) => b.valor - a.valor);

  const funilVendedores = Object.entries(pf.reduce((acc: Record<string, Record<string, number>>, p) => {
    if (!p.vendedor) return acc;
    if (!acc[p.vendedor]) acc[p.vendedor] = { INSTALADA: 0, GERADA: 0, CANCELADA: 0, PENDENTE: 0 };
    if (acc[p.vendedor][p.status_venda] !== undefined) acc[p.vendedor][p.status_venda]++;
    return acc;
  }, {})).map(([vendedorKey, status]) => ({
    vendedor: nomeVendedor(vendedorKey),
    ...status
  }));

  // 🎨 ESTILOS LIGHT TECH
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(22,163,74,0.25)",
            flexShrink: 0,
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>💰</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Dashboard</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>Workspace: <b>{workspaceNome}</b></p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {/* 👥 Filtro de Equipe */}
          <EquipeSelector />
          {[
            { key: "diario", label: "Hoje", color: "#16a34a" },
            { key: "semanal", label: "Esta Semana", color: "#3b82f6" },
            { key: "mensal", label: "Este Mês", color: "#8b5cf6" },
          ].map(f => {
            const ativo = filtro === f.key;
            return (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                style={{
                  flex: isMobile ? 1 : "0 0 auto",
                  padding: "9px 18px", borderRadius: 10,
                  border: `1px solid ${ativo ? `${f.color}50` : "#e5e7eb"}`,
                  cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: ativo ? `${f.color}15` : "#ffffff",
                  color: ativo ? f.color : "#6b7280",
                  boxShadow: ativo ? `0 2px 8px ${f.color}25` : "none",
                  transition: "all 0.15s",
                }}>
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <p style={{ color: "#6b7280" }}>Carregando dados...</p> : (
        <>
          {/* ═══ STATS CARDS ═══ */}
          <div style={{ display: "flex", gap: isMobile ? 10 : 14, flexWrap: "wrap" }}>
            {[
              { label: "Total Receita", value: `R$ ${totalReceita.toLocaleString("pt-BR")}`, color: "#16a34a", icon: "💰" },
              { label: "Instaladas", value: totalInstaladas, color: "#16a34a", icon: "✅" },
              { label: "Geradas", value: totalGeradas, color: "#8b5cf6", icon: "📄" },
              { label: "Pendentes", value: totalPendentes, color: "#f59e0b", icon: "⏳" },
              { label: "Auditoria", value: totalAuditoria, color: "#3b82f6", icon: "🔍" },
              { label: "Canceladas", value: totalCanceladas, color: "#dc2626", icon: "❌" },
            ].map(card => (
              <div key={card.label}
                style={{
                  flex: isMobile ? "1 1 calc(50% - 5px)" : "1 1 150px",
                  minWidth: 0,
                  ...cardStyle,
                  padding: isMobile ? 14 : 18,
                  borderTop: `3px solid ${card.color}`,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 20px ${card.color}20`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    {card.icon}
                  </div>
                  <p style={{ color: "#6b7280", fontSize: isMobile ? 10 : 11, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.label}</p>
                </div>
                <p style={{ color: card.color, fontSize: isMobile ? 19 : 26, fontWeight: 800, margin: 0, wordBreak: "break-word", letterSpacing: -0.5 }}>{card.value}</p>
                <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>{filtroLabel[filtro]}</p>
              </div>
            ))}
          </div>

          {/* ═══ RANKING DE VENDEDORES ═══ */}
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <h3 style={{ color: "#1f2937", fontSize: isMobile ? 14 : 15, fontWeight: 700, margin: "0 0 18px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fffbeb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🏆</span>
              Ranking de Receita por Vendedor — <span style={{ color: "#16a34a" }}>{filtroLabel[filtro]}</span>
            </h3>
            {rankingVendedores.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Nenhuma proposta neste período.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                  <BarChart data={rankingVendedores} margin={isMobile ? { top: 5, right: 5, left: -10, bottom: 0 } : { top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="nome" stroke="#6b7280" fontSize={isMobile ? 10 : 12} interval={0} angle={isMobile ? -30 : 0} textAnchor={isMobile ? "end" : "middle"} height={isMobile ? 60 : 30} />
                    <YAxis stroke="#6b7280" fontSize={isMobile ? 10 : 12} tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, color: "#1f2937", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                      formatter={(value: any) => [`R$ ${value.toLocaleString("pt-BR")}`, "Receita"]}
                      cursor={{ fill: "#f0fdf4" }}
                    />
                    <Bar dataKey="valor" fill="#16a34a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
                  {rankingVendedores.map((v, i) => {
                    const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                    const corPos = i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#a16207" : "#6b7280";
                    return (
                      <div key={v.nome + i}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderLeft: i < 3 ? `4px solid ${corPos}` : "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: isMobile ? "10px 14px" : "12px 18px",
                          gap: 8,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                          {medalha ? (
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{medalha}</span>
                          ) : (
                            <span style={{
                              background: "#f3f4f6", color: "#6b7280",
                              fontSize: 11, fontWeight: 700, padding: "3px 8px",
                              borderRadius: 8, flexShrink: 0, minWidth: 28, textAlign: "center",
                            }}>#{i + 1}</span>
                          )}
                          <span style={{ color: "#1f2937", fontSize: isMobile ? 12 : 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nome}</span>
                        </div>
                        <span style={{ color: "#16a34a", fontSize: isMobile ? 13 : 15, fontWeight: 800, flexShrink: 0, whiteSpace: "nowrap", letterSpacing: -0.3 }}>
                          R$ {v.valor.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ═══ FUNIL POR VENDEDOR ═══ */}
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <h3 style={{ color: "#1f2937", fontSize: isMobile ? 14 : 15, fontWeight: 700, margin: "0 0 18px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🎯</span>
              Funil por Vendedor — <span style={{ color: "#3b82f6" }}>{filtroLabel[filtro]}</span>
            </h3>
            {funilVendedores.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Nenhuma proposta neste período.</p>
            ) : isMobile ? (
              /* MOBILE: cards */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {funilVendedores.map((v, i) => (
                  <div key={v.vendedor + i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
                    <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: "0 0 10px 0" }}>{v.vendedor}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Instaladas", icon: "✅", key: "INSTALADA", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
                        { label: "Geradas", icon: "📄", key: "GERADA", color: "#8b5cf6", bg: "#f3e8ff", border: "#ddd6fe" },
                        { label: "Pendentes", icon: "⏳", key: "PENDENTE", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
                        { label: "Canceladas", icon: "❌", key: "CANCELADA", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
                      ].map(s => (
                        <div key={s.key} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: "8px 12px" }}>
                          <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 600 }}>{s.icon} {s.label}</p>
                          <p style={{ color: s.color, fontSize: 18, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.5 }}>{(v as any)[s.key] || 0}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* DESKTOP: tabela */
              <div style={{ overflow: "hidden", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Vendedor", "✅ Instaladas", "📄 Geradas", "⏳ Pendentes", "❌ Canceladas"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {funilVendedores.map((v, i) => (
                      <tr key={v.vendedor + i}
                        style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc", transition: "background 0.1s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                        onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                      >
                        <td style={{ padding: "14px 16px", color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{v.vendedor}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 13, padding: "4px 12px", borderRadius: 10, fontWeight: 700 }}>
                            {(v as any).INSTALADA || 0}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", fontSize: 13, padding: "4px 12px", borderRadius: 10, fontWeight: 700 }}>
                            {(v as any).GERADA || 0}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", fontSize: 13, padding: "4px 12px", borderRadius: 10, fontWeight: 700 }}>
                            {(v as any).PENDENTE || 0}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 13, padding: "4px 12px", borderRadius: 10, fontWeight: 700 }}>
                            {(v as any).CANCELADA || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}