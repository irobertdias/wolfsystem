"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";

type Proposta = {
  id: number; created_at: string; updated_at?: string; nome: string;
  vendedor: string; valor_plano: number; status_venda: string;
  operadora?: string; plano?: string; workspace_id: string;
};
type UsuarioWs = { email: string; nome: string };

export default function Funil() {
  const router = useRouter();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();

  const [filtro, setFiltro] = useState<"semanal" | "mensal" | "trimestral" | "ano">("mensal");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🎨 ESTILOS LIGHT TECH
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };
  const inputStyle = {
    background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
    padding: "9px 14px", color: "#1f2937", fontSize: 13,
    outline: "none", cursor: "pointer", fontWeight: 600,
  };

  // ═══ Descobre workspace (dono OU sub-usuário) ═══
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      let wsIds: string[] = [];
      let ownerEmail = "";
      let wsNomeStr = "";

      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono) {
        if (wsDono.username) wsIds.push(wsDono.username);
        if (wsDono.id) wsIds.push(wsDono.id.toString());
        ownerEmail = wsDono.owner_email || "";
        wsNomeStr = wsDono.nome || "";
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
            ownerEmail = wsSub.owner_email || "";
            wsNomeStr = wsSub.nome || "";
            if (wsSub.username && !wsIds.includes(wsSub.username)) wsIds.push(wsSub.username);
            if (wsSub.id && !wsIds.includes(wsSub.id.toString())) wsIds.push(wsSub.id.toString());
          }
        }
      }
      if (wsIds.length === 0) { setLoading(false); return; }

      const { data: props } = await supabase.from("proposta").select("*")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false })
        .limit(5000);
      setPropostas((props || []) as Proposta[]);

      const lista: UsuarioWs[] = [];
      if (ownerEmail) lista.push({ email: ownerEmail, nome: wsNomeStr || "Dono" });
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

  // ═══ FILTRO POR PERÍODO ═══
  const periodoEmDias = filtro === "semanal" ? 7 : filtro === "mensal" ? 30 : filtro === "trimestral" ? 90 : 365;
  const filtroLabel: Record<string, string> = { semanal: "7 dias", mensal: "30 dias", trimestral: "90 dias", ano: "1 ano" };

  const propsFiltradas = useMemo(() => {
    const agora = new Date();
    const limite = new Date(agora.getTime() - periodoEmDias * 24 * 60 * 60 * 1000);
    let lista = propostas.filter(p => new Date(p.created_at) >= limite);
    if (filtroVendedor !== "todos") lista = lista.filter(p => p.vendedor === filtroVendedor);
    return lista;
  }, [propostas, periodoEmDias, filtroVendedor]);

  // ═══ MÉTRICAS PRINCIPAIS ═══
  const metricas = useMemo(() => {
    const pf = propsFiltradas;
    const instaladas = pf.filter(p => p.status_venda === "INSTALADA");
    const canceladas = pf.filter(p => p.status_venda === "CANCELADA");
    const geradas = pf.filter(p => p.status_venda === "GERADA");
    const auditoria = pf.filter(p => p.status_venda === "AGUARDANDO AUDITORIA");
    const pendentes = pf.filter(p => p.status_venda === "PENDENTE");

    // Receita realizada (instaladas)
    const receitaRealizada = instaladas.reduce((acc, p) => acc + (p.valor_plano || 0), 0);

    // Pipeline ativo = tudo que ainda pode fechar (GERADA + AUDITORIA + PENDENTE)
    const emPipeline = [...geradas, ...auditoria, ...pendentes];
    const pipelineValue = emPipeline.reduce((acc, p) => acc + (p.valor_plano || 0), 0);

    // Win rate = INSTALADAS / (INSTALADAS + CANCELADAS) — só conta deals já fechados
    const totalFechados = instaladas.length + canceladas.length;
    const winRate = totalFechados > 0 ? Math.round((instaladas.length / totalFechados) * 100) : 0;

    // Ciclo médio em dias (das instaladas, usando updated_at se existir)
    let cicloMedio = 0;
    if (instaladas.length > 0) {
      const dias = instaladas.map(p => {
        const inicio = new Date(p.created_at).getTime();
        const fim = p.updated_at ? new Date(p.updated_at).getTime() : Date.now();
        return Math.max(0, (fim - inicio) / (1000 * 60 * 60 * 24));
      });
      cicloMedio = Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
    }

    return {
      receitaRealizada, pipelineValue, winRate, cicloMedio,
      instaladas: instaladas.length, canceladas: canceladas.length,
      geradas: geradas.length, auditoria: auditoria.length, pendentes: pendentes.length,
      total: pf.length,
    };
  }, [propsFiltradas]);

  // ═══ ETAPAS DO FUNIL (com taxas de conversão entre etapas) ═══
  const etapasFunil = useMemo(() => {
    const total = metricas.total;
    // Cada etapa é cumulativa: GERADAS conta tudo que ALGUM DIA virou proposta
    // AUDITORIA conta tudo que passou ou tá em auditoria/pendente/instalada
    // etc. Simplificação: como o status é o ATUAL, vou somar quem JÁ ATINGIU OU PASSOU pela etapa.
    const naAuditoriaOuDepois = metricas.auditoria + metricas.pendentes + metricas.instaladas;
    const pendentesOuDepois = metricas.pendentes + metricas.instaladas;
    const instaladas = metricas.instaladas;

    return [
      { nome: "📨 Propostas Geradas", qtd: total, color: "#3b82f6", taxa: 100 },
      { nome: "🔍 Em Auditoria", qtd: naAuditoriaOuDepois, color: "#06b6d4", taxa: total > 0 ? Math.round((naAuditoriaOuDepois / total) * 100) : 0 },
      { nome: "⏳ Pendentes", qtd: pendentesOuDepois, color: "#f59e0b", taxa: total > 0 ? Math.round((pendentesOuDepois / total) * 100) : 0 },
      { nome: "✅ Instaladas", qtd: instaladas, color: "#16a34a", taxa: total > 0 ? Math.round((instaladas / total) * 100) : 0 },
    ];
  }, [metricas]);

  // Taxas de conversão entre etapas adjacentes
  const conversoes = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < etapasFunil.length - 1; i++) {
      const atual = etapasFunil[i].qtd;
      const prox = etapasFunil[i + 1].qtd;
      arr.push(atual > 0 ? Math.round((prox / atual) * 100) : 0);
    }
    return arr;
  }, [etapasFunil]);

  // ═══ PROPOSTAS EM RISCO ═══
  // Propostas em AUDITORIA ou PENDENTE há mais de 7 dias — atenção!
  const propostasEmRisco = useMemo(() => {
    const agora = Date.now();
    return propostas
      .filter(p => p.status_venda === "AGUARDANDO AUDITORIA" || p.status_venda === "PENDENTE")
      .map(p => ({
        ...p,
        diasParado: Math.floor((agora - new Date(p.updated_at || p.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .filter(p => p.diasParado >= 7)
      .sort((a, b) => b.diasParado - a.diasParado)
      .slice(0, 10);
  }, [propostas]);

  // ═══ TOP VENDEDORES POR CONVERSÃO ═══
  const topConvertem = useMemo(() => {
    const mapa: Record<string, { total: number; instaladas: number; canceladas: number; pipeline: number; valorInstalado: number }> = {};
    for (const p of propsFiltradas) {
      if (!p.vendedor) continue;
      if (!mapa[p.vendedor]) mapa[p.vendedor] = { total: 0, instaladas: 0, canceladas: 0, pipeline: 0, valorInstalado: 0 };
      mapa[p.vendedor].total++;
      if (p.status_venda === "INSTALADA") { mapa[p.vendedor].instaladas++; mapa[p.vendedor].valorInstalado += (p.valor_plano || 0); }
      else if (p.status_venda === "CANCELADA") mapa[p.vendedor].canceladas++;
      else if (p.status_venda === "GERADA" || p.status_venda === "AGUARDANDO AUDITORIA" || p.status_venda === "PENDENTE") {
        mapa[p.vendedor].pipeline += (p.valor_plano || 0);
      }
    }
    return Object.entries(mapa).map(([email, dados]) => {
      const fechados = dados.instaladas + dados.canceladas;
      const wr = fechados > 0 ? Math.round((dados.instaladas / fechados) * 100) : 0;
      return { nome: nomeVendedor(email), ...dados, winRate: wr };
    }).filter(v => v.total >= 3) // só mostra quem tem pelo menos 3 propostas (relevância estatística)
      .sort((a, b) => b.winRate - a.winRate || b.instaladas - a.instaladas);
  }, [propsFiltradas, usuariosWs]);

  // ═══ Acesso restrito ═══
  if (!isDono && !isSuperAdmin && !permissoes.funil) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32 }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(239,68,68,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>
          <h1 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Você não tem permissão para ver o Funil de Vendas.</p>
        </div>
      </div>
    );
  }

  const formatBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(6,182,212,0.25)",
            flexShrink: 0,
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🎯</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Funil de Vendas</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>
              Pipeline, conversão e gargalos · <b style={{ color: "#06b6d4" }}>{metricas.total}</b> propostas nos últimos {filtroLabel[filtro]}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
            <option value="todos">👥 Todos vendedores</option>
            {Array.from(new Set(propostas.map(p => p.vendedor).filter(Boolean))).map(v => (
              <option key={v} value={v}>{nomeVendedor(v)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══ FILTRO DE PERÍODO ═══ */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { key: "semanal", label: "📅 7 dias", color: "#16a34a" },
          { key: "mensal", label: "📊 30 dias", color: "#3b82f6" },
          { key: "trimestral", label: "📈 90 dias", color: "#8b5cf6" },
          { key: "ano", label: "🗓️ 1 ano", color: "#f59e0b" },
        ].map(p => {
          const ativo = filtro === p.key;
          return (
            <button key={p.key} onClick={() => setFiltro(p.key as any)}
              style={{
                background: ativo ? `${p.color}15` : "#ffffff",
                color: ativo ? p.color : "#6b7280",
                border: `1px solid ${ativo ? `${p.color}50` : "#e5e7eb"}`,
                borderRadius: 10, padding: "8px 16px", fontSize: 12,
                cursor: "pointer", fontWeight: ativo ? 700 : 600,
                boxShadow: ativo ? `0 2px 8px ${p.color}20` : "none",
                transition: "all 0.15s",
              }}>
              {p.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "#6b7280" }}>Carregando funil...</div>
      ) : metricas.total === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(6,182,212,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🎯</span>
          </div>
          <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Sem propostas no período</h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Tente um período maior ou cadastre novas propostas em Vendas.</p>
        </div>
      ) : (
        <>
          {/* ═══ STATS PRINCIPAIS (4 cards UNIQUE) ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
            {/* Receita realizada */}
            <div style={{
              ...cardStyle, padding: isMobile ? 14 : 18,
              borderTop: "3px solid #16a34a",
              transition: "all 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 20px rgba(22,163,74,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>💰</div>
                <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Receita Realizada</p>
              </div>
              <p style={{ color: "#16a34a", fontSize: isMobile ? 18 : 24, fontWeight: 800, margin: 0, letterSpacing: -0.5, wordBreak: "break-word" }}>{formatBRL(metricas.receitaRealizada)}</p>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>{metricas.instaladas} instaladas</p>
            </div>

            {/* Pipeline ativo */}
            <div style={{
              ...cardStyle, padding: isMobile ? 14 : 18,
              borderTop: "3px solid #3b82f6",
              transition: "all 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 20px rgba(59,130,246,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎯</div>
                <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Pipeline Ativo</p>
              </div>
              <p style={{ color: "#3b82f6", fontSize: isMobile ? 18 : 24, fontWeight: 800, margin: 0, letterSpacing: -0.5, wordBreak: "break-word" }}>{formatBRL(metricas.pipelineValue)}</p>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>
                {metricas.geradas + metricas.auditoria + metricas.pendentes} propostas em aberto
              </p>
            </div>

            {/* Win Rate */}
            <div style={{
              ...cardStyle, padding: isMobile ? 14 : 18,
              borderTop: "3px solid #8b5cf6",
              transition: "all 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 20px rgba(139,92,246,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📊</div>
                <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Win Rate</p>
              </div>
              <p style={{ color: "#8b5cf6", fontSize: isMobile ? 26 : 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{metricas.winRate}<span style={{ fontSize: 16, marginLeft: 2 }}>%</span></p>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>
                {metricas.instaladas} ✅ vs {metricas.canceladas} ❌
              </p>
            </div>

            {/* Ciclo médio */}
            <div style={{
              ...cardStyle, padding: isMobile ? 14 : 18,
              borderTop: "3px solid #f59e0b",
              transition: "all 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 20px rgba(245,158,11,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⏱️</div>
                <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Ciclo Médio</p>
              </div>
              <p style={{ color: "#f59e0b", fontSize: isMobile ? 26 : 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
                {metricas.cicloMedio}<span style={{ fontSize: 14, marginLeft: 4 }}>dias</span>
              </p>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>Geração → Instalação</p>
            </div>
          </div>

          {/* ═══ FUNIL VISUAL ═══ */}
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <h3 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "0 0 18px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📊</span>
              Funil de Conversão
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {etapasFunil.map((etapa, i) => {
                const larguraMax = 100;
                const larguraMin = 30;
                const largura = etapasFunil[0].qtd > 0
                  ? Math.max(larguraMin, larguraMax * (etapa.qtd / etapasFunil[0].qtd))
                  : larguraMin;
                return (
                  <div key={etapa.nome}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{
                        background: `linear-gradient(135deg, ${etapa.color} 0%, ${etapa.color}dd 100%)`,
                        color: "white",
                        width: `${largura}%`,
                        minHeight: isMobile ? 56 : 70,
                        borderRadius: 12,
                        padding: isMobile ? "10px 14px" : "14px 22px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: `0 4px 12px ${etapa.color}40`,
                        gap: 10,
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: isMobile ? 12 : 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etapa.nome}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 500, opacity: 0.9 }}>{etapa.taxa}% do topo</p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 800, letterSpacing: -0.5 }}>{etapa.qtd}</p>
                        </div>
                      </div>
                    </div>
                    {/* Taxa de conversão entre etapas */}
                    {i < etapasFunil.length - 1 && (
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "6px 0" }}>
                        <div style={{
                          background: conversoes[i] >= 50 ? "#f0fdf4" : conversoes[i] >= 25 ? "#fffbeb" : "#fef2f2",
                          color: conversoes[i] >= 50 ? "#16a34a" : conversoes[i] >= 25 ? "#f59e0b" : "#dc2626",
                          border: `1px solid ${conversoes[i] >= 50 ? "#bbf7d0" : conversoes[i] >= 25 ? "#fde68a" : "#fecaca"}`,
                          fontSize: 11, fontWeight: 700,
                          padding: "4px 12px", borderRadius: 20,
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}>
                          ↓ {conversoes[i]}% convertem
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Canceladas como nota lateral */}
            {metricas.canceladas > 0 && (
              <div style={{
                marginTop: 16, padding: "12px 16px",
                background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626",
                borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <p style={{ color: "#991b1b", fontSize: 12, fontWeight: 700, margin: 0 }}>❌ Canceladas no período</p>
                  <p style={{ color: "#7f1d1d", fontSize: 10, margin: "2px 0 0" }}>Não entram no funil — saem por baixo</p>
                </div>
                <p style={{ color: "#dc2626", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{metricas.canceladas}</p>
              </div>
            )}
          </div>

          {/* ═══ PROPOSTAS EM RISCO ═══ */}
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fffbeb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚠️</span>
                Propostas em Risco
              </h3>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>Paradas há mais de 7 dias</span>
            </div>
            {propostasEmRisco.length === 0 ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <p style={{ color: "#15803d", fontSize: 13, margin: 0, fontWeight: 600 }}>✅ Nenhuma proposta parada — bom trabalho!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {propostasEmRisco.map(p => {
                  const corStatus = p.status_venda === "AGUARDANDO AUDITORIA" ? "#3b82f6" : "#f59e0b";
                  const bgStatus = p.status_venda === "AGUARDANDO AUDITORIA" ? "#eff6ff" : "#fffbeb";
                  const borderStatus = p.status_venda === "AGUARDANDO AUDITORIA" ? "#bfdbfe" : "#fde68a";
                  const urgencia = p.diasParado >= 30 ? "#dc2626" : p.diasParado >= 15 ? "#f59e0b" : "#6b7280";
                  return (
                    <div key={p.id}
                      onClick={() => router.push("/crm/vendas")}
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderLeft: `4px solid ${urgencia}`,
                        borderRadius: 10, padding: "12px 16px",
                        display: "flex", flexDirection: isMobile ? "column" : "row",
                        justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center",
                        gap: 10, cursor: "pointer", transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.boxShadow = `0 4px 12px ${urgencia}20`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome || "Sem nome"}</p>
                        <p style={{ color: "#6b7280", fontSize: 11, margin: "3px 0 0" }}>
                          👤 {nomeVendedor(p.vendedor)}
                          {p.valor_plano > 0 && <> · 💰 {formatBRL(p.valor_plano)}</>}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ background: bgStatus, color: corStatus, border: `1px solid ${borderStatus}`, fontSize: 10, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>
                          {p.status_venda}
                        </span>
                        <span style={{
                          background: `${urgencia}15`, color: urgencia, border: `1px solid ${urgencia}40`,
                          fontSize: 11, padding: "4px 12px", borderRadius: 10, fontWeight: 700,
                        }}>
                          ⏳ {p.diasParado} dias parado
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ TOP VENDEDORES POR CONVERSÃO ═══ */}
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f3e8ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🏆</span>
                Quem Mais Converte
              </h3>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>Win rate (3+ propostas)</span>
            </div>
            {topConvertem.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: 0 }}>Ainda sem dados suficientes — vendedor precisa de pelo menos 3 propostas no período.</p>
            ) : isMobile ? (
              /* MOBILE: cards */
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topConvertem.map((v, i) => {
                  const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  const corWr = v.winRate >= 70 ? "#16a34a" : v.winRate >= 40 ? "#f59e0b" : "#dc2626";
                  return (
                    <div key={v.nome} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {medalha ? <span style={{ fontSize: 18 }}>{medalha}</span> :
                            <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6 }}>#{i + 1}</span>}
                          <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{v.nome}</span>
                        </div>
                        <span style={{ background: `${corWr}15`, color: corWr, border: `1px solid ${corWr}40`, fontSize: 14, padding: "3px 10px", borderRadius: 10, fontWeight: 800 }}>
                          {v.winRate}%
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                          <p style={{ color: "#3b82f6", fontSize: 16, fontWeight: 800, margin: 0 }}>{v.total}</p>
                          <p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase" }}>Total</p>
                        </div>
                        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                          <p style={{ color: "#16a34a", fontSize: 16, fontWeight: 800, margin: 0 }}>{v.instaladas}</p>
                          <p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase" }}>Inst.</p>
                        </div>
                        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                          <p style={{ color: "#dc2626", fontSize: 16, fontWeight: 800, margin: 0 }}>{v.canceladas}</p>
                          <p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase" }}>Canc.</p>
                        </div>
                      </div>
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: "8px 0 0", textAlign: "center" }}>
                        Pipeline: <b style={{ color: "#3b82f6" }}>{formatBRL(v.pipeline)}</b> · Realizado: <b style={{ color: "#16a34a" }}>{formatBRL(v.valorInstalado)}</b>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* DESKTOP: tabela */
              <div style={{ overflow: "hidden", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["#", "Vendedor", "Total", "Instaladas", "Canceladas", "Win Rate", "Pipeline", "Realizado"].map(h => (
                        <th key={h} style={{ padding: "12px 14px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topConvertem.map((v, i) => {
                      const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                      const corWr = v.winRate >= 70 ? "#16a34a" : v.winRate >= 40 ? "#f59e0b" : "#dc2626";
                      return (
                        <tr key={v.nome}
                          style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc", transition: "background 0.1s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                          onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                        >
                          <td style={{ padding: "14px", fontSize: 18, fontWeight: 700 }}>
                            {medalha ? medalha : <span style={{ color: "#6b7280", fontSize: 12 }}>#{i + 1}</span>}
                          </td>
                          <td style={{ padding: "14px", color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{v.nome}</td>
                          <td style={{ padding: "14px", color: "#3b82f6", fontSize: 13, fontWeight: 700 }}>{v.total}</td>
                          <td style={{ padding: "14px" }}>
                            <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 12, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>{v.instaladas}</span>
                          </td>
                          <td style={{ padding: "14px" }}>
                            <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 12, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>{v.canceladas}</span>
                          </td>
                          <td style={{ padding: "14px" }}>
                            <span style={{ background: `${corWr}15`, color: corWr, border: `1px solid ${corWr}40`, fontSize: 13, padding: "4px 12px", borderRadius: 10, fontWeight: 800 }}>
                              {v.winRate}%
                            </span>
                          </td>
                          <td style={{ padding: "14px", color: "#3b82f6", fontSize: 12, fontWeight: 700 }}>{formatBRL(v.pipeline)}</td>
                          <td style={{ padding: "14px", color: "#16a34a", fontSize: 12, fontWeight: 700 }}>{formatBRL(v.valorInstalado)}</td>
                        </tr>
                      );
                    })}
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