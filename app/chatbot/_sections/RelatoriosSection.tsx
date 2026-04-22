"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import * as XLSX from "xlsx";

type Atendimento = {
  id: number;
  created_at: string;
  numero: string;
  nome: string;
  mensagem: string;
  status: string;
  fila: string;
  atendente: string;
};

type Etiqueta = { id: number; nome: string; cor: string; icone: string; };

export function RelatoriosSection() {
  const { wsId } = useWorkspace();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [resultado, setResultado] = useState<Atendimento[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  // Mapa: { atendimento_id: [etiqueta_id, ...] }
  const [etiquetasPorAtend, setEtiquetasPorAtend] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [gerado, setGerado] = useState(false);

  // ═══ Filtros ═══
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes" | "customizado" | "todas">("todas");
  const [dataInicio, setDataInicio] = useState(""); // YYYY-MM-DD
  const [dataFim, setDataFim] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroFila, setFiltroFila] = useState("todas");
  const [filtroAtendente, setFiltroAtendente] = useState("todos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("todas");

  const IS = { background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, width: "100%", boxSizing: "border-box" as const };

  // ═══ Carrega atendimentos + etiquetas ═══
  useEffect(() => {
    if (!wsId) return;
    const fetchTudo = async () => {
      const [resAtend, resEtiq, resRelacoes] = await Promise.all([
        supabase.from("atendimentos").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
        supabase.from("etiquetas").select("*").eq("workspace_id", wsId),
        // Só pega relações dos atendimentos deste workspace — buscamos depois de ter os ids
        Promise.resolve({ data: null }),
      ]);
      const atends = resAtend.data || [];
      setAtendimentos(atends);
      setEtiquetas(resEtiq.data || []);

      // Agora pega as relações atendimento_etiquetas baseado nos ids
      if (atends.length > 0) {
        const ids = atends.map(a => a.id);
        const { data: relacoes } = await supabase.from("atendimento_etiquetas")
          .select("atendimento_id, etiqueta_id")
          .in("atendimento_id", ids);
        const mapa: Record<number, number[]> = {};
        (relacoes || []).forEach(r => {
          if (!mapa[r.atendimento_id]) mapa[r.atendimento_id] = [];
          mapa[r.atendimento_id].push(r.etiqueta_id);
        });
        setEtiquetasPorAtend(mapa);
      }
    };
    fetchTudo();
  }, [wsId]);

  const filas = [...new Set(atendimentos.map(a => a.fila))].filter(Boolean);
  const atendentes = [...new Set(atendimentos.map(a => a.atendente))].filter(Boolean);

  // ═══ Retorna string com nomes das etiquetas do atendimento ═══
  const etiquetasNomes = (atendId: number): string => {
    const ids = etiquetasPorAtend[atendId] || [];
    return ids.map(id => {
      const e = etiquetas.find(et => et.id === id);
      return e ? `${e.icone} ${e.nome}` : "";
    }).filter(Boolean).join(", ");
  };

  // ═══ Filtra por período ═══
  const filtrarPorPeriodo = (items: Atendimento[]): Atendimento[] => {
    if (periodo === "todas") return items;

    const agora = new Date();
    let dtInicio: Date | null = null;
    let dtFim: Date | null = null;

    if (periodo === "hoje") {
      dtInicio = new Date(agora);
      dtInicio.setHours(0, 0, 0, 0);
      dtFim = new Date(agora);
      dtFim.setHours(23, 59, 59, 999);
    } else if (periodo === "semana") {
      dtInicio = new Date(agora);
      dtInicio.setDate(dtInicio.getDate() - 7);
      dtInicio.setHours(0, 0, 0, 0);
      dtFim = new Date(agora);
    } else if (periodo === "mes") {
      dtInicio = new Date(agora);
      dtInicio.setDate(dtInicio.getDate() - 30);
      dtInicio.setHours(0, 0, 0, 0);
      dtFim = new Date(agora);
    } else if (periodo === "customizado") {
      if (dataInicio) {
        dtInicio = new Date(dataInicio + "T00:00:00");
      }
      if (dataFim) {
        dtFim = new Date(dataFim + "T23:59:59");
      }
    }

    return items.filter(a => {
      const dt = new Date(a.created_at);
      if (dtInicio && dt < dtInicio) return false;
      if (dtFim && dt > dtFim) return false;
      return true;
    });
  };

  const gerarRelatorio = () => {
    setLoading(true);
    let filtrados = filtrarPorPeriodo(atendimentos);

    if (filtroStatus !== "todos") filtrados = filtrados.filter(a => a.status === filtroStatus);
    if (filtroFila !== "todas") filtrados = filtrados.filter(a => a.fila === filtroFila);
    if (filtroAtendente !== "todos") filtrados = filtrados.filter(a => a.atendente === filtroAtendente);
    if (filtroEtiqueta !== "todas") {
      const etId = parseInt(filtroEtiqueta);
      filtrados = filtrados.filter(a => (etiquetasPorAtend[a.id] || []).includes(etId));
    }

    setResultado(filtrados);
    setGerado(true);
    setLoading(false);
  };

  // ═══ EXPORT EXCEL (.xlsx) com SheetJS ═══
  const exportarExcel = () => {
    if (resultado.length === 0) { alert("Nenhum atendimento para exportar!"); return; }
    setExportando(true);
    try {
      const dados = resultado.map(a => ({
        "Nome": a.nome || "",
        "Telefone": (a.numero || "").replace(/\D/g, ""),
        "Etiqueta": etiquetasNomes(a.id),
        "Fila": a.fila || "",
        "Atendente": a.atendente || "",
        "Status": a.status === "resolvido" ? "Resolvido" : a.status === "aberto" ? "Aberto" : a.status === "pendente" ? "Pendente" : a.status,
        "Data": new Date(a.created_at).toLocaleString("pt-BR"),
      }));

      const ws = XLSX.utils.json_to_sheet(dados);

      // Ajusta largura das colunas
      ws["!cols"] = [
        { wch: 28 }, // Nome
        { wch: 18 }, // Telefone
        { wch: 30 }, // Etiqueta
        { wch: 18 }, // Fila
        { wch: 25 }, // Atendente
        { wch: 12 }, // Status
        { wch: 20 }, // Data
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Atendimentos");

      const hoje = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `relatorio_wolf_${hoje}.xlsx`);
    } catch (e: any) { alert("Erro ao exportar: " + e.message); }
    setExportando(false);
  };

  const limparFiltros = () => {
    setPeriodo("todas");
    setDataInicio("");
    setDataFim("");
    setFiltroStatus("todos");
    setFiltroFila("todas");
    setFiltroAtendente("todos");
    setFiltroEtiqueta("todas");
    setGerado(false);
  };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", height: "100vh" }}>
      <div>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📈 Relatórios</h1>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Filtre e exporte seus atendimentos em Excel</p>
      </div>

      {/* FILTROS */}
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>🔍 Filtros</p>
          <button onClick={limparFiltros} style={{ background: "none", border: "none", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>✕ Limpar tudo</button>
        </div>

        {/* PERÍODO — atalhos */}
        <div>
          <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>📅 Período</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "todas", label: "🌐 Todas", color: "#8b5cf6" },
              { key: "hoje", label: "📆 Hoje", color: "#16a34a" },
              { key: "semana", label: "🗓️ Últimos 7 dias", color: "#3b82f6" },
              { key: "mes", label: "📊 Últimos 30 dias", color: "#f59e0b" },
              { key: "customizado", label: "🎯 Personalizado", color: "#dc2626" },
            ].map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key as any)}
                style={{
                  background: periodo === p.key ? p.color : "#1f2937",
                  color: periodo === p.key ? "white" : "#9ca3af",
                  border: `1px solid ${periodo === p.key ? p.color : "#374151"}`,
                  borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold",
                }}>
                {p.label}
              </button>
            ))}
          </div>

          {periodo === "customizado" && (
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4, textTransform: "uppercase" }}>De:</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={IS} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Até:</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={IS} />
              </div>
            </div>
          )}
        </div>

        {/* OUTROS FILTROS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={IS}>
              <option value="todos">Todos</option>
              <option value="aberto">💬 Aberto</option>
              <option value="pendente">⏳ Pendente</option>
              <option value="resolvido">✅ Resolvido</option>
            </select>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Fila</label>
            <select value={filtroFila} onChange={e => setFiltroFila(e.target.value)} style={IS}>
              <option value="todas">Todas</option>
              {filas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Atendente</label>
            <select value={filtroAtendente} onChange={e => setFiltroAtendente(e.target.value)} style={IS}>
              <option value="todos">Todos</option>
              {atendentes.map(a => <option key={a} value={a}>{a === "BOT" ? "🤖 BOT" : a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Etiqueta</label>
            <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} style={IS}>
              <option value="todas">Todas</option>
              {etiquetas.map(e => <option key={e.id} value={e.id.toString()}>{e.icone} {e.nome}</option>)}
            </select>
          </div>
        </div>

        <button onClick={gerarRelatorio} disabled={loading}
          style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "14px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>
          {loading ? "⏳ Gerando..." : "🔍 Gerar Relatório"}
        </button>
      </div>

      {/* RESULTADO */}
      {gerado && (
        <>
          {/* CARDS */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Total", value: resultado.length, color: "#8b5cf6", icon: "📊" },
              { label: "Abertos", value: resultado.filter(a => a.status === "aberto").length, color: "#3b82f6", icon: "💬" },
              { label: "Pendentes", value: resultado.filter(a => a.status === "pendente").length, color: "#f59e0b", icon: "⏳" },
              { label: "Resolvidos", value: resultado.filter(a => a.status === "resolvido").length, color: "#16a34a", icon: "✅" },
            ].map(card => (
              <div key={card.label} style={{ flex: "1 1 150px", background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
                <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* TABELA */}
          <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>
                Atendimentos — {resultado.length} resultado(s)
              </h2>
              <button onClick={exportarExcel} disabled={exportando || resultado.length === 0}
                style={{ background: exportando ? "#166534" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                {exportando ? "⏳ Exportando..." : "📥 Exportar Excel (.xlsx)"}
              </button>
            </div>
            {resultado.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <p style={{ fontSize: 32, margin: "0 0 8px" }}>📭</p>
                <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum atendimento encontrado com esses filtros</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr style={{ background: "#0d0d0d" }}>
                      {["Nome", "Telefone", "Etiquetas", "Fila", "Atendente", "Status", "Data"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.map((a, i) => {
                      const ids = etiquetasPorAtend[a.id] || [];
                      const etiqs = ids.map(id => etiquetas.find(e => e.id === id)).filter(Boolean) as Etiqueta[];
                      return (
                        <tr key={a.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                          <td style={{ padding: "12px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{a.nome}</td>
                          <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{(a.numero || "").replace(/\D/g, "")}</td>
                          <td style={{ padding: "12px 16px" }}>
                            {etiqs.length === 0 ? (
                              <span style={{ color: "#6b7280", fontSize: 11 }}>—</span>
                            ) : (
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {etiqs.map(e => (
                                  <span key={e.id} style={{ background: e.cor + "22", border: `1px solid ${e.cor}`, color: e.cor, fontSize: 10, padding: "2px 7px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    <span>{e.icone}</span>{e.nome}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 8px", borderRadius: 10 }}>{a.fila || "—"}</span></td>
                          <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{a.atendente === "BOT" ? "🤖 BOT" : a.atendente || "—"}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: a.status === "resolvido" ? "#16a34a22" : a.status === "aberto" ? "#3b82f622" : "#f59e0b22", color: a.status === "resolvido" ? "#16a34a" : a.status === "aberto" ? "#3b82f6" : "#f59e0b", fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: "bold" }}>
                              {a.status === "resolvido" ? "✅ Resolvido" : a.status === "aberto" ? "💬 Aberto" : "⏳ Pendente"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>
                            {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
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