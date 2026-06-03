"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { supabase } from "../../../lib/supabase";
import { useEquipeFiltro } from "../../../hooks/useEquipeFiltro";

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD — Wolf System (multi-tenant, verde premium)
// ═══════════════════════════════════════════════════════════════════════
// Mantém:
// - Multi-tenant (workspaces + usuarios_workspace)
// - Hierarquia (dono vs sub-usuário)
// - Filtro de equipe (useEquipeFiltro)
// - Cor verde como identidade
// Adiciona:
// - 6 KPIs com trend (% vs período anterior)
// - Insights automáticos
// - Gráfico de receita 30 dias (area chart)
// - Donut de status + top operadoras
// - Ranking com medalhas
// - Tabela do funil
// - Metas do mês + atividade recente
// ═══════════════════════════════════════════════════════════════════════

type Proposta = {
  id: number;
  created_at: string;
  data_proposta?: string;
  nome: string;
  vendedor: string;
  valor_plano: number;
  status_venda: string;
  operadora: string;
  plano: string;
  workspace_id: string;
  equipe_id?: string | null;
};
type UsuarioWs = { email: string; nome: string };
type Periodo = "hoje" | "semana" | "mes" | "trimestre";

export default function Dashboard() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [workspaceNome, setWorkspaceNome] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [userNome, setUserNome] = useState("");
  const [loading, setLoading] = useState(true);

  // Filtro de equipe (dropdown que aparece pro admin)
  const { equipeId, EquipeSelector } = useEquipeFiltro(workspaceId);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ─── Init: carrega workspace, propostas, usuários ────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      // Tenta achar workspace pelas duas vias (dono OU sub-usuário)
      let wsIds: string[] = [];
      let wsNome = "";
      let ownerEmail = "";

      const { data: wsDono } = await supabase.from("workspaces")
        .select("*").eq("owner_id", user.id).maybeSingle();

      if (wsDono) {
        if (wsDono.username) wsIds.push(wsDono.username);
        if (wsDono.id) wsIds.push(wsDono.id.toString());
        wsNome = wsDono.nome || "";
        ownerEmail = wsDono.owner_email || "";
      } else {
        const { data: uw } = await supabase.from("usuarios_workspace")
          .select("workspace_id, nome").eq("email", user.email)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (uw?.workspace_id) {
          wsIds.push(uw.workspace_id);
          if (uw.nome) setUserNome(uw.nome);
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

      if (!userNome) setUserNome(user.email?.split("@")[0] || "");

      // Carrega propostas
      const { data: props } = await supabase.from("proposta").select("*")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false });
      setPropostas(props || []);

      // Mapa email → nome
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────
  const nomeVendedor = (email: string): string => {
    if (!email) return "—";
    const u = usuariosWs.find(x => x.email?.toLowerCase() === email?.toLowerCase());
    return u?.nome || email.split("@")[0];
  };

  const saudacao = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  // Filtros por equipe + período
  const filtrarPorPeriodo = (lista: Proposta[], p: Periodo): Proposta[] => {
    const agora = new Date();
    return lista.filter(prop => {
      if (equipeId && prop.equipe_id !== equipeId) return false;
      const data = new Date(prop.created_at);
      if (p === "hoje") return data.toDateString() === agora.toDateString();
      if (p === "semana") {
        const diff = (agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff >= 0;
      }
      if (p === "mes") return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
      const trimAtual = Math.floor(agora.getMonth() / 3);
      const trimData = Math.floor(data.getMonth() / 3);
      return trimAtual === trimData && data.getFullYear() === agora.getFullYear();
    });
  };

  const periodoAnterior = (lista: Proposta[], p: Periodo): Proposta[] => {
    const agora = new Date();
    return lista.filter(prop => {
      if (equipeId && prop.equipe_id !== equipeId) return false;
      const data = new Date(prop.created_at);
      if (p === "hoje") {
        const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
        return data.toDateString() === ontem.toDateString();
      }
      if (p === "semana") {
        const diff = (agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24);
        return diff > 7 && diff <= 14;
      }
      if (p === "mes") {
        const mesAnt = agora.getMonth() === 0 ? 11 : agora.getMonth() - 1;
        const anoAnt = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
        return data.getMonth() === mesAnt && data.getFullYear() === anoAnt;
      }
      return false;
    });
  };

  // ─── Cálculos derivados ──────────────────────────────────────────────
  const pf = useMemo(() => filtrarPorPeriodo(propostas, periodo), [propostas, periodo, equipeId]);
  const pAnt = useMemo(() => periodoAnterior(propostas, periodo), [propostas, periodo, equipeId]);

  const calc = (lista: Proposta[]) => {
    const totalReceita = lista
      .filter(p => p.status_venda === "INSTALADA")
      .reduce((acc, p) => acc + (p.valor_plano || 0), 0);
    const instaladas = lista.filter(p => p.status_venda === "INSTALADA").length;
    const geradas = lista.filter(p => p.status_venda === "GERADA").length;
    const pendentes = lista.filter(p => p.status_venda === "PENDENTE").length;
    const canceladas = lista.filter(p => p.status_venda === "CANCELADA").length;
    const auditoria = lista.filter(p => p.status_venda === "AGUARDANDO AUDITORIA").length;
    const total = lista.length;
    const taxaConversao = total > 0 ? (instaladas / total) * 100 : 0;
    const ticketMedio = instaladas > 0 ? totalReceita / instaladas : 0;
    const vendedoresAtivos = new Set(lista.filter(p => p.vendedor).map(p => p.vendedor)).size;
    return { totalReceita, instaladas, geradas, pendentes, canceladas, auditoria, total, taxaConversao, ticketMedio, vendedoresAtivos };
  };

  const stats = calc(pf);
  const statsAnt = calc(pAnt);

  const trend = (atual: number, anterior: number): { val: number; up: boolean } => {
    if (anterior === 0) return { val: atual > 0 ? 100 : 0, up: atual > 0 };
    const diff = ((atual - anterior) / anterior) * 100;
    return { val: Math.abs(diff), up: diff >= 0 };
  };

  // Ranking de vendedores por receita
  const rankingVendedores = useMemo(() => {
    return Object.entries(
      pf.filter(p => p.status_venda === "INSTALADA").reduce((acc: Record<string, number>, p) => {
        if (p.vendedor) acc[p.vendedor] = (acc[p.vendedor] || 0) + (p.valor_plano || 0);
        return acc;
      }, {})
    )
      .map(([k, v]) => ({ nome: nomeVendedor(k), valor: v, key: k }))
      .sort((a, b) => b.valor - a.valor);
  }, [pf, usuariosWs]);

  // Funil por vendedor
  const funilVendedores = useMemo(() => {
    return Object.entries(
      pf.reduce((acc: Record<string, Record<string, number>>, p) => {
        if (!p.vendedor) return acc;
        if (!acc[p.vendedor]) acc[p.vendedor] = { INSTALADA: 0, GERADA: 0, PENDENTE: 0, CANCELADA: 0, AUDITORIA: 0 };
        if (p.status_venda === "AGUARDANDO AUDITORIA") acc[p.vendedor].AUDITORIA++;
        else if (acc[p.vendedor][p.status_venda] !== undefined) acc[p.vendedor][p.status_venda]++;
        return acc;
      }, {})
    ).map(([k, v]) => ({ vendedor: nomeVendedor(k), ...v }));
  }, [pf, usuariosWs]);

  // Distribuição por status (donut)
  const statusData = [
    { name: "Instaladas", value: stats.instaladas, color: "#16a34a" },
    { name: "Geradas", value: stats.geradas, color: "#8b5cf6" },
    { name: "Pendentes", value: stats.pendentes, color: "#f59e0b" },
    { name: "Auditoria", value: stats.auditoria, color: "#06b6d4" },
    { name: "Canceladas", value: stats.canceladas, color: "#ef4444" },
  ].filter(s => s.value > 0);

  // Top operadoras (donut)
  const operadorasData = useMemo(() => {
    const counts: Record<string, number> = {};
    pf.forEach(p => {
      if (p.operadora) counts[p.operadora] = (counts[p.operadora] || 0) + 1;
    });
    const cores = ["#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0"];
    return Object.entries(counts)
      .map(([nome, value], i) => ({ name: nome, value, color: cores[i % cores.length] }))
      .sort((a, b) => b.value - a.value);
  }, [pf]);

  // Receita ao longo do tempo (últimos 30 dias) — respeita filtro de equipe
  const receitaPorDia = useMemo(() => {
    const dias: Record<string, number> = {};
    const agora = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(agora);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      dias[k] = 0;
    }
    propostas.forEach(p => {
      if (equipeId && p.equipe_id !== equipeId) return;
      if (p.status_venda !== "INSTALADA") return;
      const k = p.created_at.slice(0, 10);
      if (dias[k] !== undefined) dias[k] += p.valor_plano || 0;
    });
    return Object.entries(dias).map(([data, receita]) => {
      const d = new Date(data + "T12:00:00");
      return {
        data: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        receita,
      };
    });
  }, [propostas, equipeId]);

  // Atividade recente
  const atividadeRecente = useMemo(() => {
    return propostas
      .filter(p => !equipeId || p.equipe_id === equipeId)
      .slice(0, 6);
  }, [propostas, equipeId]);

  // Insights automáticos
  const insights = useMemo(() => {
    const lista: { icon: string; text: string; color: string }[] = [];
    if (rankingVendedores.length > 0) {
      const top = rankingVendedores[0];
      lista.push({
        icon: "🏆",
        text: `${top.nome} lidera com R$ ${top.valor.toLocaleString("pt-BR")}`,
        color: "#f59e0b",
      });
    }
    if (statsAnt.totalReceita > 0) {
      const t = trend(stats.totalReceita, statsAnt.totalReceita);
      lista.push({
        icon: t.up ? "📈" : "📉",
        text: `Receita ${t.up ? "cresceu" : "caiu"} ${t.val.toFixed(1)}% vs período anterior`,
        color: t.up ? "#16a34a" : "#ef4444",
      });
    }
    if (stats.taxaConversao >= 50) {
      lista.push({
        icon: "🎯",
        text: `Taxa de conversão alta: ${stats.taxaConversao.toFixed(1)}%`,
        color: "#16a34a",
      });
    } else if (stats.pendentes > 0) {
      lista.push({
        icon: "💪",
        text: `${stats.pendentes} propostas pendentes esperando ação`,
        color: "#8b5cf6",
      });
    }
    if (operadorasData.length > 0) {
      const top = operadorasData[0];
      lista.push({
        icon: "📡",
        text: `${top.name} é a operadora mais vendida (${top.value} propostas)`,
        color: "#06b6d4",
      });
    }
    return lista.slice(0, 4);
  }, [rankingVendedores, stats, statsAnt, operadorasData]);

  // Metas (mockadas — pode trocar pelo banco depois)
  const metaReceita = 50000;
  const metaVendas = 30;
  const percReceita = Math.min(100, (stats.totalReceita / metaReceita) * 100);
  const percVendas = Math.min(100, (stats.instaladas / metaVendas) * 100);

  const periodoLabel: Record<Periodo, string> = {
    hoje: "Hoje",
    semana: "Esta Semana",
    mes: "Este Mês",
    trimestre: "Este Trimestre",
  };

  // ───── ESTILOS ─────────────────────────────────────────────────────────
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
  };

  // ───── RENDER ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
          <div style={{
            width: 32, height: 32,
            border: "3px solid #e5e7eb",
            borderTopColor: "#16a34a",
            borderRadius: "50%",
            margin: "0 auto 16px",
            animation: "spin 0.7s linear infinite",
          }} />
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Carregando dashboard...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 20 }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade-up { animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
        .stat-card { transition: all 0.2s ease; }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(22, 163, 74, 0.12), 0 4px 12px rgba(0, 0, 0, 0.05) !important;
        }
        .period-btn {
          padding: 9px 16px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #6b7280;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .period-btn:hover {
          border-color: #d1d5db;
          color: #1f2937;
        }
        .period-btn.active {
          background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
        }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div className="fade-up" style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between",
        alignItems: isMobile ? "stretch" : "center",
        gap: 14,
      }}>
        <div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, fontWeight: 500 }}>
            {saudacao}, {userNome || "vendedor"} 👋
          </p>
          <h1 style={{
            color: "#1f2937", fontSize: isMobile ? 22 : 28, fontWeight: 800,
            margin: "4px 0 0", letterSpacing: -0.8,
          }}>Visão Geral</h1>
          {workspaceNome && (
            <p style={{ color: "#9ca3af", fontSize: 12, margin: "4px 0 0", fontWeight: 500 }}>
              Workspace: <b style={{ color: "#16a34a" }}>{workspaceNome}</b>
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {/* Filtro de equipe */}
          <EquipeSelector />
          {([
            { key: "hoje", label: "Hoje" },
            { key: "semana", label: "Semana" },
            { key: "mes", label: "Mês" },
            { key: "trimestre", label: "Trimestre" },
          ] as { key: Periodo; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setPeriodo(f.key)}
              className={`period-btn ${periodo === f.key ? "active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)",
        gap: isMobile ? 10 : 14,
      }}>
        {[
          { label: "Receita", value: `R$ ${stats.totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: "#16a34a", icon: "💰", trend: trend(stats.totalReceita, statsAnt.totalReceita) },
          { label: "Vendas", value: stats.instaladas, color: "#10b981", icon: "✅", trend: trend(stats.instaladas, statsAnt.instaladas) },
          { label: "Conversão", value: `${stats.taxaConversao.toFixed(1)}%`, color: "#14b8a6", icon: "🎯", trend: trend(stats.taxaConversao, statsAnt.taxaConversao) },
          { label: "Ticket Médio", value: `R$ ${stats.ticketMedio.toFixed(0)}`, color: "#0891b2", icon: "💎", trend: trend(stats.ticketMedio, statsAnt.ticketMedio) },
          { label: "Pendentes", value: stats.pendentes, color: "#f59e0b", icon: "⏳", trend: trend(stats.pendentes, statsAnt.pendentes) },
          { label: "Vendedores", value: stats.vendedoresAtivos, color: "#15803d", icon: "👥", trend: trend(stats.vendedoresAtivos, statsAnt.vendedoresAtivos) },
        ].map((c, i) => (
          <div
            key={c.label}
            className="stat-card fade-up"
            style={{
              ...cardStyle,
              padding: isMobile ? 14 : 18,
              animationDelay: `${i * 0.05}s`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c.color }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${c.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>{c.icon}</div>
              {statsAnt.totalReceita > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 2,
                  background: c.trend.up ? "#dcfce7" : "#fee2e2",
                  color: c.trend.up ? "#15803d" : "#b91c1c",
                  fontSize: 10.5, fontWeight: 700,
                  padding: "3px 7px", borderRadius: 6,
                }}>
                  {c.trend.up ? "▲" : "▼"} {c.trend.val.toFixed(0)}%
                </div>
              )}
            </div>
            <p style={{
              color: "#6b7280", fontSize: 11, fontWeight: 600, margin: "0 0 4px",
              letterSpacing: 0.3, textTransform: "uppercase",
            }}>{c.label}</p>
            <p style={{
              color: "#1f2937", fontSize: isMobile ? 18 : 22, fontWeight: 800,
              margin: 0, letterSpacing: -0.5,
            }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ INSIGHTS ═══ */}
      {insights.length > 0 && (
        <div className="fade-up" style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : `repeat(${insights.length}, 1fr)`,
          gap: 10,
        }}>
          {insights.map((ins, i) => (
            <div key={i} style={{
              ...cardStyle, padding: "12px 14px",
              borderLeft: `3px solid ${ins.color}`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ins.icon}</span>
              <p style={{
                color: "#374151", fontSize: 12.5, margin: 0,
                fontWeight: 600, lineHeight: 1.4,
              }}>{ins.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ═══ RECEITA + FUNIL STATUS ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
        gap: isMobile ? 14 : 20,
      }}>
        <div className="fade-up" style={{ ...cardStyle, padding: isMobile ? 16 : 22 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            marginBottom: 18,
          }}>
            <div>
              <h3 style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>
                Receita — últimos 30 dias
              </h3>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>
                Evolução das vendas instaladas
              </p>
            </div>
            <div style={{
              background: "#f0fdf4", color: "#15803d",
              fontSize: 11, fontWeight: 700, padding: "4px 10px",
              borderRadius: 8, letterSpacing: 0.3,
            }}>
              R$ {receitaPorDia.reduce((acc, d) => acc + d.receita, 0).toLocaleString("pt-BR")}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
            <AreaChart data={receitaPorDia} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceitaWolf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="data" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} interval={isMobile ? 6 : 3} />
              <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12, padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                formatter={(value: any) => [`R$ ${Number(value).toLocaleString("pt-BR")}`, "Receita"]}
                labelStyle={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="receita" stroke="#16a34a" strokeWidth={2.5} fill="url(#colorReceitaWolf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="fade-up" style={{ ...cardStyle, padding: isMobile ? 16 : 22 }}>
          <h3 style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px", letterSpacing: -0.2 }}>
            Funil de status
          </h3>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 18px" }}>
            {periodoLabel[periodo]} · {stats.total} propostas
          </p>
          {statusData.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "40px 0" }}>
              Sem dados no período.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12, padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
                {statusData.map(s => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                      <span style={{ color: "#4b5563", fontWeight: 500 }}>{s.name}</span>
                    </div>
                    <span style={{ color: "#1f2937", fontWeight: 700 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ RANKING + OPERADORAS ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
        gap: isMobile ? 14 : 20,
      }}>
        <div className="fade-up" style={{ ...cardStyle, padding: isMobile ? 16 : 22 }}>
          <h3 style={{
            color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px",
            letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>🏆</span> Ranking de vendedores
          </h3>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 18px" }}>
            Por receita de vendas instaladas · {periodoLabel[periodo]}
          </p>
          {rankingVendedores.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Sem vendas no período.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
                <BarChart data={rankingVendedores} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBarWolf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="nome" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={isMobile ? -25 : 0} textAnchor={isMobile ? "end" : "middle"} height={isMobile ? 55 : 30} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12, padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR")}`, "Receita"]}
                    cursor={{ fill: "#f0fdf4" }}
                  />
                  <Bar dataKey="valor" fill="url(#colorBarWolf)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
                {rankingVendedores.slice(0, 5).map((v, i) => {
                  const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  return (
                    <div
                      key={v.key}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: i === 0 ? "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" : "#f9fafb",
                        border: "1px solid",
                        borderColor: i === 0 ? "#fcd34d" : "#e5e7eb",
                        borderRadius: 10,
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        {medalha ? (
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{medalha}</span>
                        ) : (
                          <span style={{
                            background: "#e5e7eb", color: "#6b7280",
                            fontSize: 11, fontWeight: 700, padding: "3px 8px",
                            borderRadius: 6, flexShrink: 0, minWidth: 28, textAlign: "center",
                          }}>#{i + 1}</span>
                        )}
                        <span style={{
                          color: "#1f2937", fontSize: 13, fontWeight: 600,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{v.nome}</span>
                      </div>
                      <span style={{
                        color: i === 0 ? "#92400e" : "#15803d",
                        fontSize: 13, fontWeight: 800, letterSpacing: -0.3,
                      }}>
                        R$ {v.valor.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="fade-up" style={{ ...cardStyle, padding: isMobile ? 16 : 22 }}>
          <h3 style={{
            color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px",
            letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>📡</span> Top operadoras
          </h3>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 18px" }}>{periodoLabel[periodo]}</p>
          {operadorasData.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "40px 0" }}>
              Sem dados no período.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={operadorasData} innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {operadorasData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12, padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                {operadorasData.slice(0, 5).map(o => (
                  <div key={o.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: o.color }} />
                      <span style={{ color: "#4b5563", fontWeight: 500 }}>{o.name}</span>
                    </div>
                    <span style={{ color: "#1f2937", fontWeight: 700 }}>{o.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ FUNIL POR VENDEDOR ═══ */}
      <div className="fade-up" style={{ ...cardStyle, padding: isMobile ? 16 : 22 }}>
        <h3 style={{
          color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px",
          letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>🎯</span> Funil por vendedor
        </h3>
        <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 18px" }}>
          Breakdown de status por colaborador · {periodoLabel[periodo]}
        </p>
        {funilVendedores.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Sem propostas no período.</p>
        ) : isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funilVendedores.map((v, i) => (
              <div key={v.vendedor + i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
                <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>{v.vendedor}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Instaladas", k: "INSTALADA", color: "#16a34a", bg: "#dcfce7" },
                    { label: "Geradas", k: "GERADA", color: "#8b5cf6", bg: "#ede9fe" },
                    { label: "Pendentes", k: "PENDENTE", color: "#f59e0b", bg: "#fef3c7" },
                    { label: "Canceladas", k: "CANCELADA", color: "#ef4444", bg: "#fee2e2" },
                  ].map(s => (
                    <div key={s.k} style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, padding: "8px 12px" }}>
                      <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 600 }}>{s.label}</p>
                      <p style={{ color: s.color, fontSize: 18, fontWeight: 800, margin: "2px 0 0" }}>{(v as any)[s.k] || 0}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Vendedor", "✅ Instaladas", "📄 Geradas", "⏳ Pendentes", "🔍 Auditoria", "❌ Canceladas"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funilVendedores.map((v, i) => (
                  <tr key={v.vendedor + i} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                    <td style={{ padding: "14px 16px", color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{v.vendedor}</td>
                    {[
                      { k: "INSTALADA", color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
                      { k: "GERADA", color: "#8b5cf6", bg: "#ede9fe", border: "#c4b5fd" },
                      { k: "PENDENTE", color: "#f59e0b", bg: "#fef3c7", border: "#fcd34d" },
                      { k: "AUDITORIA", color: "#06b6d4", bg: "#cffafe", border: "#67e8f9" },
                      { k: "CANCELADA", color: "#ef4444", bg: "#fee2e2", border: "#fca5a5" },
                    ].map(s => (
                      <td key={s.k} style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: s.bg, color: s.color,
                          border: `1px solid ${s.border}`, fontSize: 13,
                          padding: "4px 12px", borderRadius: 8, fontWeight: 700,
                          display: "inline-block", minWidth: 32, textAlign: "center",
                        }}>{(v as any)[s.k] || 0}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ METAS + ATIVIDADE RECENTE ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: isMobile ? 14 : 20,
      }}>
        <div className="fade-up" style={{ ...cardStyle, padding: isMobile ? 16 : 22 }}>
          <h3 style={{
            color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px",
            letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>🎯</span> Metas do mês
          </h3>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 22px" }}>
            Acompanhe seu progresso
          </p>

          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <p style={{ color: "#4b5563", fontSize: 12.5, margin: 0, fontWeight: 600 }}>💰 Receita</p>
              <p style={{ color: "#1f2937", fontSize: 13, margin: 0, fontWeight: 700 }}>
                R$ {stats.totalReceita.toLocaleString("pt-BR")} <span style={{ color: "#9ca3af", fontWeight: 500 }}>/ R$ {metaReceita.toLocaleString("pt-BR")}</span>
              </p>
            </div>
            <div style={{ width: "100%", height: 10, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                width: `${percReceita}%`, height: "100%",
                background: "linear-gradient(90deg, #16a34a 0%, #22c55e 100%)",
                borderRadius: 6,
                transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                boxShadow: "0 2px 4px rgba(22, 163, 74, 0.3)",
              }} />
            </div>
            <p style={{
              color: percReceita >= 100 ? "#16a34a" : "#6b7280",
              fontSize: 11, margin: "6px 0 0", fontWeight: 600,
            }}>
              {percReceita >= 100 ? "🎉 Meta batida!" : `${percReceita.toFixed(1)}% do objetivo`}
            </p>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <p style={{ color: "#4b5563", fontSize: 12.5, margin: 0, fontWeight: 600 }}>✅ Vendas</p>
              <p style={{ color: "#1f2937", fontSize: 13, margin: 0, fontWeight: 700 }}>
                {stats.instaladas} <span style={{ color: "#9ca3af", fontWeight: 500 }}>/ {metaVendas}</span>
              </p>
            </div>
            <div style={{ width: "100%", height: 10, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                width: `${percVendas}%`, height: "100%",
                background: "linear-gradient(90deg, #15803d 0%, #16a34a 100%)",
                borderRadius: 6,
                transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                boxShadow: "0 2px 4px rgba(21, 128, 61, 0.3)",
              }} />
            </div>
            <p style={{
              color: percVendas >= 100 ? "#16a34a" : "#6b7280",
              fontSize: 11, margin: "6px 0 0", fontWeight: 600,
            }}>
              {percVendas >= 100 ? "🎉 Meta batida!" : `${percVendas.toFixed(1)}% do objetivo`}
            </p>
          </div>

          <p style={{ color: "#9ca3af", fontSize: 10.5, margin: "20px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>
            💡 Personalize as metas em Configurações → Metas
          </p>
        </div>

        <div className="fade-up" style={{ ...cardStyle, padding: isMobile ? 16 : 22 }}>
          <h3 style={{
            color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px",
            letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>⚡</span> Atividade recente
          </h3>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 18px" }}>
            Últimas propostas registradas
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {atividadeRecente.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Sem atividade recente.</p>
            ) : (
              atividadeRecente.map((p, i) => {
                const corStatus =
                  p.status_venda === "INSTALADA" ? "#16a34a" :
                  p.status_venda === "GERADA" ? "#8b5cf6" :
                  p.status_venda === "PENDENTE" ? "#f59e0b" :
                  p.status_venda === "AGUARDANDO AUDITORIA" ? "#06b6d4" :
                  "#ef4444";
                const dataRel = ((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60));
                const dataLabel =
                  dataRel < 1 ? `${Math.floor(dataRel * 60)} min atrás` :
                  dataRel < 24 ? `${Math.floor(dataRel)}h atrás` :
                  `${Math.floor(dataRel / 24)} dias atrás`;
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 0",
                    borderBottom: i < atividadeRecente.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${corStatus}15`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: corStatus }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: "#1f2937", fontSize: 12.5, margin: 0, fontWeight: 600,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{p.nome}</p>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>
                        {nomeVendedor(p.vendedor)} · {p.operadora}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ color: corStatus, fontSize: 11, margin: 0, fontWeight: 700 }}>
                        R$ {(p.valor_plano || 0).toLocaleString("pt-BR")}
                      </p>
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: "1px 0 0" }}>
                        {dataLabel}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        textAlign: "center", padding: "8px 0 16px",
        fontSize: 11, color: "#9ca3af", letterSpacing: 0.3,
      }}>
        Dashboard atualizado em {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · Wolf System
      </div>
    </div>
  );
}