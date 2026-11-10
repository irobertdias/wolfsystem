"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import * as XLSX from "xlsx";

import Icone, { IconeEmoji } from "../../components/a2/Icone";
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
// 👥 Equipe (time/empresa dentro do workspace)
type Equipe = { id: string; nome: string; };

export function RelatoriosSection() {
  const { wsId } = useWorkspace();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [resultado, setResultado] = useState<Atendimento[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasPorAtend, setEtiquetasPorAtend] = useState<Record<number, number[]>>({});
  // 👥 equipes do workspace + mapa fila(nome) → equipe_id (a fila carrega o equipe_id)
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [filaEquipeMap, setFilaEquipeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [gerado, setGerado] = useState(false);

  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes" | "customizado" | "todas">("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  // 👥 filtro de equipe (afunila também as filas)
  const [filtroEquipe, setFiltroEquipe] = useState("todas");
  const [filtroFila, setFiltroFila] = useState("todas");
  const [filtroAtendente, setFiltroAtendente] = useState("todos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("todas");

  const IS = { background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, width: "100%", boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };

  const cardStyle = { background: "#ffffff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };

  const [truncado, setTruncado] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    const fetchTudo = async () => {
      // 🆕 PAGINAÇÃO ATÉ 20.000 — relatórios precisam de histórico longo (análise mensal/trimestral).
      // Antes era query única, então Supabase cortava em 1000 e o Excel saía MUITO incompleto
      // (ex: cliente com 8.000 leads exportava só 1.000 e tomava decisão errada).
      // Limite de 20k cobre relatório anual de ~55 leads/dia útil.
      // Se passar disso, mostra aviso de truncamento — user pode filtrar por período pra refinar.
      const PAGE_SIZE = 1000;
      const TOTAL_LIMITE = 20000;
      const fetchAtendimentosPaginado = async (): Promise<Atendimento[]> => {
        let lista: Atendimento[] = [];
        let offset = 0;
        while (offset < TOTAL_LIMITE) {
          const { data: pagina, error } = await supabase.from("atendimentos")
            .select("*")
            .eq("workspace_id", wsId)
            .order("created_at", { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) {
            console.error("Erro fetchAtendimentos paginado (Relatórios):", error);
            break;
          }
          if (!pagina || pagina.length === 0) break;
          lista = lista.concat(pagina as Atendimento[]);
          if (pagina.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }
        return lista;
      };

      const [atends, resEtiq, resEquipes, resFilas] = await Promise.all([
        fetchAtendimentosPaginado(),
        supabase.from("etiquetas").select("*").eq("workspace_id", wsId),
        // 👥 equipes ativas + tabela de filas (pra mapear fila → equipe_id)
        supabase.from("equipes").select("id, nome").eq("workspace_id", wsId).eq("ativo", true).order("nome", { ascending: true }),
        supabase.from("filas").select("nome, equipe_id").eq("workspace_id", wsId),
      ]);
      setAtendimentos(atends);
      setEtiquetas(resEtiq.data || []);
      setEquipes((resEquipes.data as Equipe[]) || []);
      // monta mapa fila(nome) → equipe_id
      const mapaFE: Record<string, string> = {};
      (resFilas.data || []).forEach((f: any) => { if (f.nome) mapaFE[f.nome] = f.equipe_id || ""; });
      setFilaEquipeMap(mapaFE);
      setTruncado(atends.length >= TOTAL_LIMITE);

      // 🔒 PAGINAÇÃO: .in() com muitos ids estoura — divide em lotes de 500
      if (atends.length > 0) {
        const ids = atends.map(a => a.id);
        const LOTE_IN = 500;
        const mapa: Record<number, number[]> = {};
        for (let i = 0; i < ids.length; i += LOTE_IN) {
          const lote = ids.slice(i, i + LOTE_IN);
          const { data: relacoes } = await supabase.from("atendimento_etiquetas")
            .select("atendimento_id, etiqueta_id")
            .in("atendimento_id", lote);
          (relacoes || []).forEach(r => {
            if (!mapa[r.atendimento_id]) mapa[r.atendimento_id] = [];
            mapa[r.atendimento_id].push(r.etiqueta_id);
          });
        }
        setEtiquetasPorAtend(mapa);
      }
    };
    fetchTudo();
  }, [wsId]);

  const filas = [...new Set(atendimentos.map(a => a.fila))].filter(Boolean);
  const atendentes = [...new Set(atendimentos.map(a => a.atendente))].filter(Boolean);

  // 👥 filas mostradas no dropdown: filtradas pela equipe escolhida (todas = sem filtro)
  const filasFiltradas = filas.filter(f => filtroEquipe === "todas" || (filaEquipeMap[f] || "") === filtroEquipe);

  // 👥 nome da equipe de um atendimento (via fila)
  const equipeNome = (a: Atendimento): string => {
    const eqId = filaEquipeMap[a.fila || ""] || "";
    if (!eqId) return "";
    return equipes.find(e => e.id === eqId)?.nome || "";
  };

  const etiquetasNomes = (atendId: number): string => {
    const ids = etiquetasPorAtend[atendId] || [];
    return ids.map(id => {
      const e = etiquetas.find(et => et.id === id);
      return e ? `${e.icone} ${e.nome}` : "";
    }).filter(Boolean).join(", ");
  };

  const filtrarPorPeriodo = (items: Atendimento[]): Atendimento[] => {
    if (periodo === "todas") return items;
    const agora = new Date();
    let dtInicio: Date | null = null;
    let dtFim: Date | null = null;
    if (periodo === "hoje") {
      dtInicio = new Date(agora); dtInicio.setHours(0, 0, 0, 0);
      dtFim = new Date(agora); dtFim.setHours(23, 59, 59, 999);
    } else if (periodo === "semana") {
      dtInicio = new Date(agora); dtInicio.setDate(dtInicio.getDate() - 7); dtInicio.setHours(0, 0, 0, 0);
      dtFim = new Date(agora);
    } else if (periodo === "mes") {
      dtInicio = new Date(agora); dtInicio.setDate(dtInicio.getDate() - 30); dtInicio.setHours(0, 0, 0, 0);
      dtFim = new Date(agora);
    } else if (periodo === "customizado") {
      if (dataInicio) dtInicio = new Date(dataInicio + "T00:00:00");
      if (dataFim) dtFim = new Date(dataFim + "T23:59:59");
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
    // 👥 filtro de equipe — via fila do atendimento (a fila carrega o equipe_id)
    if (filtroEquipe !== "todas") filtrados = filtrados.filter(a => (filaEquipeMap[a.fila || ""] || "") === filtroEquipe);
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

  const exportarExcel = () => {
    if (resultado.length === 0) { alert("Nenhum atendimento para exportar!"); return; }
    setExportando(true);
    try {
      const dados = resultado.map(a => ({
        "Nome": a.nome || "",
        "Telefone": (a.numero || "").replace(/\D/g, ""),
        "Etiqueta": etiquetasNomes(a.id),
        "Equipe": equipeNome(a),
        "Fila": a.fila || "",
        "Atendente": a.atendente || "",
        "Status": a.status === "resolvido" ? "Resolvido" : a.status === "aberto" ? "Aberto" : a.status === "pendente" ? "Pendente" : a.status,
        "Data": new Date(a.created_at).toLocaleString("pt-BR"),
      }));
      const ws = XLSX.utils.json_to_sheet(dados);
      ws["!cols"] = [
        { wch: 28 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 20 },
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
    setFiltroEquipe("todas");
    setFiltroFila("todas");
    setFiltroAtendente("todos");
    setFiltroEtiqueta("todas");
    setGerado(false);
  };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", height: "100vh", background: "#F3F6F5" }}>

      {/* ═══ HEADER ═══ */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={"📈"} tamanho={22} /></div>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Relatórios</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Filtre e exporte seus atendimentos em Excel</p>
          </div>
        </div>

        {/* Aviso de truncamento */}
        {truncado && (
          <div style={{ background: "#FFF7ED", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 16px", marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <IconeEmoji e="⚠️" tamanho={20} />
            <div style={{ flex: 1 }}>
              <p style={{ color: "#92400e", fontSize: 13, fontWeight: 700, margin: 0 }}>
                Mostrando os 20.000 atendimentos mais recentes
              </p>
              <p style={{ color: "#78350f", fontSize: 11, margin: "2px 0 0", lineHeight: 1.4 }}>
                Seu workspace tem mais que isso no histórico. Pra análise de períodos antigos, use o filtro <b>Personalizado</b> com data específica e exporte em fatias.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ FILTROS ═══ */}
      <div style={{ ...cardStyle, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: "#64748B", fontSize: 11, fontWeight: 700, margin: 0 }}>Filtros</p>
          <button onClick={limparFiltros} style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "6px 12px", borderRadius: 8 }}>Limpar tudo</button>
        </div>

        {/* PERÍODO */}
        <div>
          <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 10 }}>Período</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "todas", label: "Todas", color: "#059669" },
              { key: "hoje", label: "Hoje", color: "#059669" },
              { key: "semana", label: "Últimos 7 dias", color: "#059669" },
              { key: "mes", label: "Últimos 30 dias", color: "#C2410C" },
              { key: "customizado", label: "Personalizado", color: "#BE185D" },
            ].map(p => {
              const ativo = periodo === p.key;
              return (
                <button key={p.key} onClick={() => setPeriodo(p.key as any)}
                  style={{
                    background: ativo ? `${p.color}15` : "#F7FAF9",
                    color: ativo ? p.color : "#64748B",
                    border: `1px solid ${ativo ? `${p.color}50` : "#E6ECEA"}`,
                    borderRadius: 10, padding: "8px 16px", fontSize: 12,
                    cursor: "pointer", fontWeight: ativo ? 700 : 600,
                    transition: "all 0.15s",
                    boxShadow: ativo ? `0 2px 8px ${p.color}25` : "none",
                  }}>
                  {p.label}
                </button>
              );
            })}
          </div>

          {periodo === "customizado" && (
            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 4 }}>De:</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ ...IS, colorScheme: "light" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 4 }}>Até:</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ ...IS, colorScheme: "light" }} />
              </div>
            </div>
          )}
        </div>

        {/* OUTROS FILTROS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={IS}>
              <option value="todos">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="pendente">Pendente</option>
              <option value="resolvido">Resolvido</option>
            </select>
          </div>
          {/* 👥 Equipe — afunila as filas abaixo */}
          {equipes.length > 0 && (
            <div>
              <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Equipe</label>
              <select
                value={filtroEquipe}
                onChange={e => {
                  const nova = e.target.value;
                  setFiltroEquipe(nova);
                  // se a fila selecionada não pertence à nova equipe, volta pra "todas"
                  if (nova !== "todas" && filtroFila !== "todas" && (filaEquipeMap[filtroFila] || "") !== nova) setFiltroFila("todas");
                }}
                style={IS}>
                <option value="todas">Todas</option>
                {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Fila</label>
            <select value={filtroFila} onChange={e => setFiltroFila(e.target.value)} style={IS}>
              <option value="todas">Todas</option>
              {filasFiltradas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Atendente</label>
            <select value={filtroAtendente} onChange={e => setFiltroAtendente(e.target.value)} style={IS}>
              <option value="todos">Todos</option>
              {atendentes.map(a => <option key={a} value={a}>{a === "BOT" ? "BOT" : a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Etiqueta</label>
            <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} style={IS}>
              <option value="todas">Todas</option>
              {etiquetas.map(e => <option key={e.id} value={e.id.toString()}>{e.icone} {e.nome}</option>)}
            </select>
          </div>
        </div>

        <button onClick={gerarRelatorio} disabled={loading}
          style={{
            background: loading ? "#047857" : "linear-gradient(140deg, #10B981, #059669 60%, #047857)",
            color: "white", border: "none", borderRadius: 12,
            padding: "14px", fontSize: 14, cursor: "pointer", fontWeight: 700,
            boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
          }}>
          {loading ? "⏳ Gerando..." : "Gerar Relatório"}
        </button>
      </div>

      {/* ═══ RESULTADO ═══ */}
      {gerado && (
        <>
          {/* CARDS */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Total", value: resultado.length, color: "#059669", icon: "📊" },
              { label: "Abertos", value: resultado.filter(a => a.status === "aberto").length, color: "#059669", icon: "💬" },
              { label: "Pendentes", value: resultado.filter(a => a.status === "pendente").length, color: "#C2410C", icon: "⏳" },
              { label: "Resolvidos", value: resultado.filter(a => a.status === "resolvido").length, color: "#059669", icon: "✅" },
            ].map(card => (
              <div key={card.label}
                style={{
                  flex: "1 1 180px",
                  ...cardStyle,
                  padding: 22,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 20px ${card.color}20`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    {<IconeEmoji e={card.icon} />}
                  </div>
                  <p style={{ color: "#64748B", fontSize: 12, margin: 0, fontWeight: 600 }}>{card.label}</p>
                </div>
                <p style={{ color: card.color, fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* TABELA */}
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid #E6ECEA", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ color: "#0F172A", fontSize: 14, fontWeight: 700, margin: 0 }}>
                Atendimentos — <span style={{ color: "#059669" }}>{resultado.length}</span> resultado(s)
              </h2>
              <button onClick={exportarExcel} disabled={exportando || resultado.length === 0}
                style={{
                  background: exportando ? "#047857" : "linear-gradient(140deg, #10B981, #059669 60%, #047857)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
                }}>
                {exportando ? "⏳ Exportando..." : "Exportar Excel (.xlsx)"}
              </button>
            </div>
            {resultado.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="pasta" tamanho={24} /></span>
                <p style={{ color: "#64748B", fontSize: 13 }}>Nenhum atendimento encontrado com esses filtros</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr style={{ background: "#F7FAF9" }}>
                      {["Nome", "Telefone", "Etiquetas", "Equipe", "Fila", "Atendente", "Status", "Data"].map(h => (
                        <th key={h} style={{ padding: "12px 18px", color: "#64748B", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #E6ECEA" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.map((a, i) => {
                      const ids = etiquetasPorAtend[a.id] || [];
                      const etiqs = ids.map(id => etiquetas.find(e => e.id === id)).filter(Boolean) as Etiqueta[];
                      const eqNome = equipeNome(a);
                      return (
                        <tr key={a.id}
                          style={{ borderTop: "1px solid #F1F5F4", background: "#ffffff", transition: "background 0.1s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#F7FAF9"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
                        >
                          <td style={{ padding: "14px 18px", color: "#0F172A", fontSize: 13, fontWeight: 600 }}>{a.nome}</td>
                          <td style={{ padding: "14px 18px", color: "#64748B", fontSize: 12, fontFamily: "monospace" }}>{(a.numero || "").replace(/\D/g, "")}</td>
                          <td style={{ padding: "14px 18px" }}>
                            {etiqs.length === 0 ? (
                              <span style={{ color: "#CBD5E1", fontSize: 11 }}>—</span>
                            ) : (
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {etiqs.map(e => (
                                  <span key={e.id} style={{ background: e.cor + "15", border: `1px solid ${e.cor}`, color: e.cor, fontSize: 12, padding: "3px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                                    <span>{<IconeEmoji e={e.icone} />}</span>{e.nome}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {eqNome ? (
                              <span style={{ background: "#a855f715", color: "#059669", fontSize: 11, padding: "4px 10px", borderRadius: 10, fontWeight: 600, border: "1px solid #a855f730", whiteSpace: "nowrap" }}>{eqNome}</span>
                            ) : (
                              <span style={{ color: "#CBD5E1", fontSize: 11 }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {a.fila ? (
                              <span style={{ background: "#14B8A615", color: "#059669", fontSize: 11, padding: "4px 10px", borderRadius: 10, fontWeight: 600, border: "1px solid #14B8A630" }}>{a.fila}</span>
                            ) : (
                              <span style={{ color: "#CBD5E1", fontSize: 11 }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px", color: "#475569", fontSize: 12, fontWeight: 500 }}>{a.atendente === "BOT" ? "BOT" : a.atendente || <span style={{ color: "#CBD5E1" }}>—</span>}</td>
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{
                              background: a.status === "resolvido" ? "#ECFDF5" : a.status === "aberto" ? "#ECFDF5" : "#FFF7ED",
                              color: a.status === "resolvido" ? "#059669" : a.status === "aberto" ? "#059669" : "#C2410C",
                              border: `1px solid ${a.status === "resolvido" ? "#A7F3D0" : a.status === "aberto" ? "#A7F3D0" : "#fde68a"}`,
                              fontSize: 11, padding: "4px 10px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap",
                            }}>
                              {a.status === "resolvido" ? "Resolvido" : a.status === "aberto" ? "Aberto" : "⏳ Pendente"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}>
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