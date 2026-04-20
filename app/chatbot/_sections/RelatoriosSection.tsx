"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

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

export function RelatoriosSection() {
  const { workspace } = useWorkspace();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [resultado, setResultado] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [gerado, setGerado] = useState(false);

  // Filtros
  const [diaInicio, setDiaInicio] = useState("");
  const [mesInicio, setMesInicio] = useState("");
  const [anoInicio, setAnoInicio] = useState("");
  const [diaFim, setDiaFim] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [anoFim, setAnoFim] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroFila, setFiltroFila] = useState("todas");
  const [filtroAtendente, setFiltroAtendente] = useState("todos");

  const IS = { background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13 };

  useEffect(() => {
    if (!workspace?.id) return;
    const fetchTodos = async () => {
      const { data } = await supabase.from("atendimentos").select("*")
        .eq("workspace_id", workspace.username || workspace.id.toString())
        .order("created_at", { ascending: false });
      setAtendimentos(data || []);
    };
    fetchTodos();
  }, [workspace]);

  const filas = [...new Set(atendimentos.map(a => a.fila))].filter(Boolean);
  const atendentes = [...new Set(atendimentos.map(a => a.atendente))].filter(Boolean);

  const gerarRelatorio = () => {
    setLoading(true);
    let filtrados = [...atendimentos];

    // Filtro data início
    if (diaInicio && mesInicio && anoInicio) {
      const inicio = new Date(`${anoInicio}-${mesInicio.padStart(2,"0")}-${diaInicio.padStart(2,"0")}T00:00:00`);
      filtrados = filtrados.filter(a => new Date(a.created_at) >= inicio);
    }

    // Filtro data fim
    if (diaFim && mesFim && anoFim) {
      const fim = new Date(`${anoFim}-${mesFim.padStart(2,"0")}-${diaFim.padStart(2,"0")}T23:59:59`);
      filtrados = filtrados.filter(a => new Date(a.created_at) <= fim);
    }

    if (filtroStatus !== "todos") filtrados = filtrados.filter(a => a.status === filtroStatus);
    if (filtroFila !== "todas") filtrados = filtrados.filter(a => a.fila === filtroFila);
    if (filtroAtendente !== "todos") filtrados = filtrados.filter(a => a.atendente === filtroAtendente);

    setResultado(filtrados);
    setGerado(true);
    setLoading(false);
  };

  const exportarCSV = async () => {
    if (resultado.length === 0) { alert("Nenhum atendimento para exportar!"); return; }
    setExportando(true);
    try {
      const numeros = [...new Set(resultado.map(a => a.numero))];
      const { data: mensagens } = await supabase.from("mensagens").select("*").in("numero", numeros).order("created_at", { ascending: true });

      const headerAtendimentos = ["ID", "Data", "Nome", "Número", "Fila", "Atendente", "Status", "Última Mensagem"];
      const rowsAtendimentos = resultado.map(a => [
        a.id,
        new Date(a.created_at).toLocaleString("pt-BR"),
        a.nome,
        a.numero,
        a.fila,
        a.atendente,
        a.status,
        `"${(a.mensagem || "").replace(/"/g, "'')}"`,
      ]);

      const headerMensagens = ["Número", "Data", "De", "Mensagem"];
      const rowsMensagens = (mensagens || []).map(m => [
        m.numero,
        new Date(m.created_at).toLocaleString("pt-BR"),
        m.de,
        '"' + (m.mensagem || "").replace(/"/g, "'").replace(/\n/g, " ") + '"',
      ]);

      const csv = [
        "RELATÓRIO DE ATENDIMENTOS - WOLF SYSTEM",
        `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
        `Total: ${resultado.length} atendimentos`,
        "",
        headerAtendimentos.join(";"),
        ...rowsAtendimentos.map(r => r.join(";")),
        "",
        "",
        "HISTÓRICO DE MENSAGENS",
        headerMensagens.join(";"),
        ...rowsMensagens.map(r => r.join(";")),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio_wolf_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert("Erro ao exportar: " + e.message); }
    setExportando(false);
  };

  const tempoRelativo = (data: string) => {
    const d = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
    return d < 1 ? "agora" : d < 60 ? `${d}min` : d < 1440 ? `${Math.floor(d/60)}h` : `${Math.floor(d/1440)}d`;
  };

  const dias = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, "0"));
  const meses = [
    {v:"01",l:"Janeiro"},{v:"02",l:"Fevereiro"},{v:"03",l:"Março"},{v:"04",l:"Abril"},
    {v:"05",l:"Maio"},{v:"06",l:"Junho"},{v:"07",l:"Julho"},{v:"08",l:"Agosto"},
    {v:"09",l:"Setembro"},{v:"10",l:"Outubro"},{v:"11",l:"Novembro"},{v:"12",l:"Dezembro"},
  ];
  const anos = ["2024", "2025", "2026", "2027"];

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", height: "100vh" }}>
      <div>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📈 Relatórios</h1>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Filtre e exporte seus atendimentos</p>
      </div>

      {/* FILTROS */}
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20 }}>
        <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>🔍 Filtros</p>

        {/* DATA INÍCIO */}
        <div>
          <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>📅 Data Início</label>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4 }}>Dia</label>
              <select value={diaInicio} onChange={e => setDiaInicio(e.target.value)} style={{ ...IS, width: "100%" }}>
                <option value="">Dia</option>
                {dias.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4 }}>Mês</label>
              <select value={mesInicio} onChange={e => setMesInicio(e.target.value)} style={{ ...IS, width: "100%" }}>
                <option value="">Mês</option>
                {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4 }}>Ano</label>
              <select value={anoInicio} onChange={e => setAnoInicio(e.target.value)} style={{ ...IS, width: "100%" }}>
                <option value="">Ano</option>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* DATA FIM */}
        <div>
          <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>📅 Data Fim</label>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4 }}>Dia</label>
              <select value={diaFim} onChange={e => setDiaFim(e.target.value)} style={{ ...IS, width: "100%" }}>
                <option value="">Dia</option>
                {dias.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4 }}>Mês</label>
              <select value={mesFim} onChange={e => setMesFim(e.target.value)} style={{ ...IS, width: "100%" }}>
                <option value="">Mês</option>
                {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4 }}>Ano</label>
              <select value={anoFim} onChange={e => setAnoFim(e.target.value)} style={{ ...IS, width: "100%" }}>
                <option value="">Ano</option>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* OUTROS FILTROS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...IS, width: "100%" }}>
              <option value="todos">Todos</option>
              <option value="aberto">💬 Aberto</option>
              <option value="pendente">⏳ Pendente</option>
              <option value="resolvido">✅ Resolvido</option>
            </select>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Fila</label>
            <select value={filtroFila} onChange={e => setFiltroFila(e.target.value)} style={{ ...IS, width: "100%" }}>
              <option value="todas">Todas</option>
              {filas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Atendente</label>
            <select value={filtroAtendente} onChange={e => setFiltroAtendente(e.target.value)} style={{ ...IS, width: "100%" }}>
              <option value="todos">Todos</option>
              {atendentes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <button onClick={gerarRelatorio} disabled={loading} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>
          {loading ? "⏳ Gerando..." : "🔍 Gerar Relatório"}
        </button>
      </div>

      {/* RESULTADO */}
      {gerado && (
        <>
          {/* CARDS RESUMO */}
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
              <h2 style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>Atendimentos — {resultado.length} resultado(s)</h2>
              <button onClick={exportarCSV} disabled={exportando || resultado.length === 0}
                style={{ background: exportando ? "#166534" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                {exportando ? "⏳ Exportando..." : "📥 Exportar .csv"}
              </button>
            </div>
            {resultado.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}><p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum atendimento encontrado com esses filtros</p></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0d0d0d" }}>
                      {["Data", "Nome", "Número", "Fila", "Atendente", "Status", "Última Mensagem"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.map((a, i) => (
                      <tr key={a.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                        <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>{tempoRelativo(a.created_at)}</td>
                        <td style={{ padding: "12px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{a.nome}</td>
                        <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{a.numero}</td>
                        <td style={{ padding: "12px 16px" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 8px", borderRadius: 10 }}>{a.fila}</span></td>
                        <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{a.atendente}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ background: a.status === "resolvido" ? "#16a34a22" : a.status === "aberto" ? "#3b82f622" : "#f59e0b22", color: a.status === "resolvido" ? "#16a34a" : a.status === "aberto" ? "#3b82f6" : "#f59e0b", fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: "bold" }}>
                            {a.status === "resolvido" ? "✅ Resolvido" : a.status === "aberto" ? "💬 Aberto" : "⏳ Pendente"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.mensagem}</td>
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