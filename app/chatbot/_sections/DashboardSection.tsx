"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

type Atendimento = {
  id: number;
  status: string;
  created_at: string;
  fila?: string;
  canal_id?: number;
  atendente?: string;
};
type Canal = { id: number; nome: string; tipo: string };
type Fila = { id: number; nome: string };

type Periodo = "hoje" | "semana" | "mes" | "ano" | "todos";

export function DashboardSection() {
  const { workspace, wsId } = useWorkspace();

  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [carregando, setCarregando] = useState(true);

  // 🆕 Filtros
  const [periodo, setPeriodo] = useState<Periodo>("mes"); // default = últimos 30 dias
  const [canalFiltro, setCanalFiltro] = useState<string>("todos"); // "todos" ou String(id)
  const [filaFiltro, setFilaFiltro] = useState<string>("todas"); // "todas" ou nome da fila

  // Busca dados (atendimentos + canais + filas)
  useEffect(() => {
    if (!wsId) return;
    let cancel = false;

    const fetchTudo = async () => {
      setCarregando(true);
      try {
        const [resAt, resCx, resFi] = await Promise.all([
          supabase
            .from("atendimentos")
            .select("id, status, created_at, fila, canal_id, atendente")
            .eq("workspace_id", wsId)
            .order("created_at", { ascending: false }),
          supabase
            .from("conexoes")
            .select("id, nome, tipo")
            .eq("workspace_id", wsId),
          supabase
            .from("filas")
            .select("id, nome")
            .eq("workspace_id", wsId)
            .order("nome", { ascending: true }),
        ]);
        if (cancel) return;
        setAtendimentos((resAt.data as Atendimento[]) || []);
        setCanais((resCx.data as Canal[]) || []);
        setFilas((resFi.data as Fila[]) || []);
      } finally {
        if (!cancel) setCarregando(false);
      }
    };

    fetchTudo();

    // Realtime — atualiza sozinho quando entram novos leads
    const ch = supabase
      .channel(`dash_${wsId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atendimentos", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conexoes", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "filas", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [wsId]);

  // 🆕 Calcula data de início conforme o período selecionado
  const dataInicio = useMemo(() => {
    const agora = new Date();
    if (periodo === "hoje") {
      const d = new Date(agora);
      d.setHours(0, 0, 0, 0); // começo do dia de hoje
      return d;
    }
    if (periodo === "semana") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (periodo === "mes") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 30);
      return d;
    }
    if (periodo === "ano") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 365);
      return d;
    }
    return null; // "todos" = sem limite
  }, [periodo]);

  // 🆕 Aplica todos os filtros
  const atendimentosFiltrados = useMemo(() => {
    return atendimentos.filter(a => {
      if (dataInicio && new Date(a.created_at) < dataInicio) return false;
      if (canalFiltro !== "todos" && String(a.canal_id || "") !== canalFiltro) return false;
      if (filaFiltro !== "todas" && (a.fila || "") !== filaFiltro) return false;
      return true;
    });
  }, [atendimentos, dataInicio, canalFiltro, filaFiltro]);

  // Cards principais — usa o mesmo critério de status que já existia
  const cards = [
    {
      label: "Abertos",
      value: atendimentosFiltrados.filter(a => a.status === "aberto").length,
      color: "#3b82f6",
      icon: "💬",
    },
    {
      label: "Em Atendimento",
      value: atendimentosFiltrados.filter(a => a.status === "em_atendimento").length,
      color: "#f59e0b",
      icon: "👤",
    },
    {
      label: "Resolvidos",
      value: atendimentosFiltrados.filter(a => a.status === "resolvido").length,
      color: "#16a34a",
      icon: "✅",
    },
    {
      label: "Total",
      value: atendimentosFiltrados.length,
      color: "#8b5cf6",
      icon: "📊",
    },
  ];

  // 🆕 Breakdown por canal (quantos leads chegaram de cada conexão)
  const porCanal = useMemo(() => {
    const map: Record<string, number> = {};
    atendimentosFiltrados.forEach(a => {
      const id = String(a.canal_id || "sem-canal");
      map[id] = (map[id] || 0) + 1;
    });
    return Object.entries(map)
      .map(([id, count]) => {
        const canal = canais.find(c => String(c.id) === id);
        return {
          id,
          nome: canal ? canal.nome : id === "sem-canal" ? "— Sem canal —" : `Canal ${id}`,
          tipo: canal?.tipo || "",
          count,
          cor: canal?.tipo === "waba" ? "#3b82f6" : "#16a34a",
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [atendimentosFiltrados, canais]);

  // 🆕 Breakdown por fila (quantos leads por cada fila)
  const porFila = useMemo(() => {
    const map: Record<string, number> = {};
    atendimentosFiltrados.forEach(a => {
      const fila = a.fila || "— Sem fila —";
      map[fila] = (map[fila] || 0) + 1;
    });
    return Object.entries(map)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);
  }, [atendimentosFiltrados]);

  // Helpers de estilo
  const botaoPeriodo = (p: Periodo, label: string, icone: string) => {
    const ativo = periodo === p;
    return (
      <button
        onClick={() => setPeriodo(p)}
        style={{
          background: ativo ? "#8b5cf6" : "#1f2937",
          color: ativo ? "white" : "#9ca3af",
          border: `1px solid ${ativo ? "#8b5cf6" : "#374151"}`,
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: "bold",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span>{icone}</span> {label}
      </button>
    );
  };

  const temFiltroAtivo =
    periodo !== "todos" || canalFiltro !== "todos" || filaFiltro !== "todas";

  // Label amigável do período ativo (aparece nos cards)
  const labelPeriodo = {
    hoje: "hoje",
    semana: "últimos 7 dias",
    mes: "últimos 30 dias",
    ano: "últimos 365 dias",
    todos: "período total",
  }[periodo];

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📊 Dashboard</h1>
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
          {carregando ? "🔄 Carregando..." : `📍 Mostrando: ${labelPeriodo}`}
        </p>
      </div>

      {/* 🆕 BARRA DE FILTROS */}
      <div
        style={{
          background: "#111",
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Período */}
        <div>
          <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px" }}>
            Período
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {botaoPeriodo("hoje", "Hoje", "📅")}
            {botaoPeriodo("semana", "7 dias", "🗓️")}
            {botaoPeriodo("mes", "30 dias", "📆")}
            {botaoPeriodo("ano", "365 dias", "🗃️")}
            {botaoPeriodo("todos", "Todos", "∞")}
          </div>
        </div>

        {/* Canal e Fila */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
              Canal / Conexão
            </p>
            <select
              value={canalFiltro}
              onChange={e => setCanalFiltro(e.target.value)}
              style={{
                width: "100%",
                background: "#1f2937",
                color: "white",
                border: "1px solid #374151",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <option value="todos">📡 Todos os canais</option>
              {canais.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.tipo === "waba" ? "🔗" : "📱"} {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
              Fila
            </p>
            <select
              value={filaFiltro}
              onChange={e => setFilaFiltro(e.target.value)}
              style={{
                width: "100%",
                background: "#1f2937",
                color: "white",
                border: "1px solid #374151",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <option value="todas">📋 Todas as filas</option>
              {filas.map(f => (
                <option key={f.id} value={f.nome}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          {temFiltroAtivo && (
            <button
              onClick={() => {
                setPeriodo("todos");
                setCanalFiltro("todos");
                setFilaFiltro("todas");
              }}
              style={{
                background: "#7f1d1d",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✕ Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {cards.map(card => (
          <div
            key={card.label}
            style={{
              flex: "1 1 200px",
              background: "#111",
              borderRadius: 12,
              padding: 20,
              border: `1px solid ${card.color}33`,
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase" }}>
              {card.icon} {card.label}
            </p>
            <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 🆕 BREAKDOWNS — quantos leads por canal e por fila */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Por canal */}
        <div
          style={{
            flex: "1 1 320px",
            background: "#111",
            borderRadius: 12,
            padding: 20,
            border: "1px solid #1f2937",
            minHeight: 140,
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 14px", textTransform: "uppercase", fontWeight: "bold" }}>
            📡 Por Canal / Conexão
          </p>
          {porCanal.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Nenhum atendimento no período.</p>
          ) : (
            porCanal.map((c, i) => {
              const max = porCanal[0]?.count || 1;
              const pct = (c.count / max) * 100;
              return (
                <div key={c.id + i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                    <span style={{ color: "white", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.tipo === "waba" ? "🔗" : c.tipo === "webjs" ? "📱" : "📡"} {c.nome}
                    </span>
                    <span style={{ color: c.cor, fontSize: 13, fontWeight: "bold", flexShrink: 0 }}>{c.count}</span>
                  </div>
                  <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: c.cor, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Por fila */}
        <div
          style={{
            flex: "1 1 320px",
            background: "#111",
            borderRadius: 12,
            padding: 20,
            border: "1px solid #1f2937",
            minHeight: 140,
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 14px", textTransform: "uppercase", fontWeight: "bold" }}>
            📋 Por Fila
          </p>
          {porFila.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Nenhum atendimento no período.</p>
          ) : (
            porFila.map((f, i) => {
              const max = porFila[0]?.count || 1;
              const pct = (f.count / max) * 100;
              return (
                <div key={f.nome + i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                    <span style={{ color: "white", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.nome}
                    </span>
                    <span style={{ color: "#00a884", fontSize: 13, fontWeight: "bold", flexShrink: 0 }}>{f.count}</span>
                  </div>
                  <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#00a884", transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}