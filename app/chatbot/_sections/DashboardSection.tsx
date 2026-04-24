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
type UsuarioWs = { email: string; nome: string };

type Periodo = "hoje" | "semana" | "mes" | "ano" | "todos";

export function DashboardSection() {
  const { workspace, wsId } = useWorkspace();

  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [carregando, setCarregando] = useState(true);

  // 🆕 Filtros
  const [periodo, setPeriodo] = useState<Periodo>("mes"); // default = últimos 30 dias
  const [canalFiltro, setCanalFiltro] = useState<string>("todos"); // "todos" ou String(id)
  const [filaFiltro, setFilaFiltro] = useState<string>("todas"); // "todas" ou nome da fila
  const [atendenteFiltro, setAtendenteFiltro] = useState<string>("todos"); // "todos" ou email

  // Busca dados (atendimentos + canais + filas)
  useEffect(() => {
    if (!wsId) return;
    let cancel = false;

    const fetchTudo = async () => {
      setCarregando(true);
      try {
        const [resAt, resCx, resFi, resUs] = await Promise.all([
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
          supabase
            .from("usuarios_workspace")
            .select("email, nome")
            .eq("workspace_id", wsId),
        ]);
        if (cancel) return;
        setAtendimentos((resAt.data as Atendimento[]) || []);
        setCanais((resCx.data as Canal[]) || []);
        setFilas((resFi.data as Fila[]) || []);
        // 🆕 Lista de usuários do workspace — inclui o dono também
        const subs: UsuarioWs[] = (resUs.data as UsuarioWs[]) || [];
        if (workspace?.owner_email) {
          subs.push({ email: workspace.owner_email, nome: workspace.nome || "Dono" });
        }
        setUsuariosWs(subs);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${wsId}` },
        () => fetchTudo()
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [wsId, workspace?.owner_email, workspace?.nome]);

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
      if (atendenteFiltro !== "todos" && (a.atendente || "") !== atendenteFiltro) return false;
      return true;
    });
  }, [atendimentos, dataInicio, canalFiltro, filaFiltro, atendenteFiltro]);

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

  // 🆕 Breakdown por atendente — mostra quantos cada usuário tá tratando e quantos já resolveu
  // Útil pra ver produtividade da equipe no período filtrado
  const porAtendente = useMemo(() => {
    type Bucket = { chave: string; emAtendimento: number; resolvidos: number; total: number };
    const map: Record<string, Bucket> = {};

    atendimentosFiltrados.forEach(a => {
      const chave = a.atendente || "sem-atendente";
      if (!map[chave]) map[chave] = { chave, emAtendimento: 0, resolvidos: 0, total: 0 };
      map[chave].total++;
      if (a.status === "resolvido") map[chave].resolvidos++;
      else map[chave].emAtendimento++;
    });

    // Pega o nome amigável pelo email, com tratamento especial pro BOT e vazio
    const nomeDe = (chave: string): string => {
      if (chave === "sem-atendente") return "— Sem atendente —";
      if (chave === "BOT") return "🤖 BOT (automático)";
      if (chave === "Humano") return "👤 Humano (legado)"; // atendimentos antigos antes do fix do email
      const u = usuariosWs.find(us => us.email?.toLowerCase() === chave.toLowerCase());
      if (u?.nome) return u.nome;
      return chave.includes("@") ? chave.split("@")[0] : chave;
    };

    const corDe = (chave: string): string => {
      if (chave === "BOT") return "#8b5cf6";
      if (chave === "sem-atendente") return "#6b7280";
      if (chave === "Humano") return "#64748b";
      return "#00a884";
    };

    return Object.values(map)
      .map(b => ({
        ...b,
        nome: nomeDe(b.chave),
        cor: corDe(b.chave),
        inicial: (nomeDe(b.chave).replace(/[^a-zA-Z0-9À-ÿ]/g, "").charAt(0) || "?").toUpperCase(),
      }))
      .sort((a, b) => b.total - a.total);
  }, [atendimentosFiltrados, usuariosWs]);

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
    periodo !== "todos" || canalFiltro !== "todos" || filaFiltro !== "todas" || atendenteFiltro !== "todos";

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

          {/* 🆕 Filtro por atendente */}
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px" }}>
              Atendente
            </p>
            <select
              value={atendenteFiltro}
              onChange={e => setAtendenteFiltro(e.target.value)}
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
              <option value="todos">👥 Todos os atendentes</option>
              <option value="BOT">🤖 BOT (automático)</option>
              {usuariosWs.map((u, i) => (
                <option key={u.email + i} value={u.email}>
                  👤 {u.nome || u.email.split("@")[0]}
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
                setAtendenteFiltro("todos");
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

      {/* 🆕 POR ATENDENTE — quem tá tratando e quem tratou */}
      {/* Barra stacked (laranja = em atendimento, verde = resolvidos) pra ver produtividade de cada um */}
      <div
        style={{
          background: "#111",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #1f2937",
          minHeight: 140,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, textTransform: "uppercase", fontWeight: "bold" }}>
            👥 Por Atendente
          </p>
          {/* Legenda */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontSize: 10, fontWeight: "bold" }}>
              <span style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: 2, display: "inline-block" }} />
              Em atendimento
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#16a34a", fontSize: 10, fontWeight: "bold" }}>
              <span style={{ width: 10, height: 10, background: "#16a34a", borderRadius: 2, display: "inline-block" }} />
              Resolvidos
            </span>
          </div>
        </div>

        {porAtendente.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Nenhum atendimento no período.</p>
        ) : (
          porAtendente.map((a, i) => {
            const maxTotal = porAtendente[0]?.total || 1;
            const pctBarra = (a.total / maxTotal) * 100;
            const pctAtendendo = a.total > 0 ? (a.emAtendimento / a.total) * 100 : 0;
            // barra externa representa proporção do total dessa pessoa vs quem mais atendeu;
            // dentro dela, divisão laranja/verde mostra split entre "em atendimento" vs "resolvidos"
            return (
              <div key={a.chave + i} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {/* Avatar com inicial */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: a.cor + "33", color: a.cor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: "bold", fontSize: 12, flexShrink: 0,
                  }}>
                    {a.inicial}
                  </div>
                  <span style={{ color: "white", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.nome}
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: 11, flexShrink: 0 }}>
                    <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{a.emAtendimento}</span>
                    <span style={{ opacity: 0.5, margin: "0 4px" }}>·</span>
                    <span style={{ color: "#16a34a", fontWeight: "bold" }}>{a.resolvidos}</span>
                    <span style={{ opacity: 0.5, margin: "0 4px" }}>·</span>
                    <span style={{ color: "white", fontWeight: "bold" }}>{a.total}</span>
                  </span>
                </div>
                {/* Barra stacked */}
                <div style={{
                  height: 8, background: "#1f2937", borderRadius: 4, overflow: "hidden",
                  width: `${pctBarra}%`, // a largura da barra mostra o peso desse atendente vs o top
                  minWidth: 40,
                  transition: "width 0.3s",
                  display: "flex",
                }}>
                  <div style={{ width: `${pctAtendendo}%`, height: "100%", background: "#f59e0b" }} />
                  <div style={{ flex: 1, height: "100%", background: "#16a34a" }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}