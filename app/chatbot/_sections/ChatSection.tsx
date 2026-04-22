"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

type Atendimento = {
  id: number; created_at: string; numero: string; nome: string; mensagem: string;
  status: string; fila: string; atendente: string; workspace_id: string;
  email?: string; notas?: string; avaliacao?: number;
  bloqueado_ia?: boolean; bloqueado_fluxo?: boolean; bloqueado_typebot?: boolean; bloqueado_contato?: boolean;
  funil_etapa?: string; kanban_coluna?: string; demanda?: string; valor?: number;
};
type Mensagem = { id?: number; created_at?: string; numero: string; mensagem: string; de: string; workspace_id?: string; };

export function ChatSection() {
  const { workspace, wsId } = useWorkspace();
  const { permissoes, isDono } = usePermissao();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [gravando, setGravando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemInterna, setMensagemInterna] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [showChatInterno, setShowChatInterno] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [abaConversa, setAbaConversa] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<Atendimento | null>(null);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [enviandoMsg, setEnviandoMsg] = useState(false);

  // ✅ Painel Dados do Contato
  const [showPainelContato, setShowPainelContato] = useState(false);
  const [abaPainel, setAbaPainel] = useState<"perfil" | "protocolo" | "funil" | "ia" | "utils">("perfil");
  const [salvandoContato, setSalvandoContato] = useState(false);

  // Filtros
  const [visualizarTickets, setVisualizarTickets] = useState(false);
  const [filtroFila, setFiltroFila] = useState("todas");
  const [filtroAtendente, setFiltroAtendente] = useState("todos");
  const [filtroConexao, setFiltroConexao] = useState("todas");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("todas");
  const [filtrosStatus, setFiltrosStatus] = useState<string[]>(["aberto", "pendente"]);

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };
  const inputSm = { ...IS, padding: "7px 10px", fontSize: 12 };

  const respostasRapidas = [
    { atalho: "/oi", mensagem: "Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?" },
    { atalho: "/planos", mensagem: "Temos planos a partir de R$ 89,90. Posso te passar mais detalhes!" },
    { atalho: "/aguarda", mensagem: "Por favor, aguarde um momento que já vou te atender!" },
    { atalho: "/encerrar", mensagem: "Obrigado pelo contato! Tenha um ótimo dia!" },
  ];

  const mensagensInternas = [
    { de: "Pedro Lima", texto: "Robert, o cliente está perguntando sobre desconto", hora: "10:05" },
    { de: "Você", texto: "Pode oferecer 10% para ele!", hora: "10:06" },
  ];

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return resp.json();
    }
    const resp = await fetch(`/api/whatsapp?rota=${rota}`);
    return resp.json();
  };

  // ✅ Usa apenas wsId (username) — sem fallback pra id numérico
  const fetchAtendimentos = async () => {
    if (!wsId) return;
    const { data } = await supabase.from("atendimentos").select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    setAtendimentos(data || []);
  };

  const fetchHistorico = async (numero: string) => {
    const { data } = await supabase.from("mensagens").select("*").eq("numero", numero).order("created_at", { ascending: true });
    setHistorico(data || []);
  };

  useEffect(() => {
    if (!wsId) return;
    fetchAtendimentos();
    const ch = supabase.channel("atendimentos_chat_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos", filter: `workspace_id=eq.${wsId}` }, () => fetchAtendimentos())
      .subscribe();
    const polling = setInterval(() => fetchAtendimentos(), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(polling); };
  }, [wsId]);

  useEffect(() => {
    if (!atendimentoAtivo) return;
    setHistorico([]);
    fetchHistorico(atendimentoAtivo.numero);
    const num = atendimentoAtivo.numero;
    const ch = supabase.channel(`msgs_${num}_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, (payload) => {
        const m = payload.new as Mensagem;
        if (m.numero === num) { setHistorico(p => [...p, m]); setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }
      }).subscribe();
    const polling = setInterval(() => fetchHistorico(num), 3000);
    return () => { supabase.removeChannel(ch); clearInterval(polling); };
  }, [atendimentoAtivo?.numero]);

  useEffect(() => { setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, [historico]);

  const filas = [...new Set(atendimentos.map(a => a.fila))].filter(Boolean);
  const atendentes = [...new Set(atendimentos.map(a => a.atendente))].filter(Boolean);
  const podeVerFiltrosAvancados = isDono || permissoes.chat_todos;

  const atendimentosFiltrados = atendimentos
    .filter(a => {
      if (showFiltros && filtrosStatus.length > 0) return filtrosStatus.includes(a.status);
      if (abaConversa === "abertos") return a.status === "aberto";
      if (abaConversa === "pendentes") return a.status === "pendente";
      if (abaConversa === "resolvidos") return a.status === "resolvido";
      return true;
    })
    .filter(a => {
      if (!isDono && !permissoes.chat_todos && permissoes.chat_proprio) {
        return a.atendente === "BOT" || a.status === "pendente" || a.atendente === wsId;
      }
      return true;
    })
    .filter(a => !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.numero?.includes(busca))
    .filter(a => filtroFila === "todas" || a.fila === filtroFila)
    .filter(a => filtroAtendente === "todos" || a.atendente === filtroAtendente);

  const temFiltroAtivo = filtroFila !== "todas" || filtroAtendente !== "todos" || filtroEtiqueta !== "todas";

  const enviarMensagem = async () => {
    if (!mensagem || !atendimentoAtivo) return;
    setEnviandoMsg(true);
    try { await wa("enviar", { numero: atendimentoAtivo.numero, mensagem, workspaceId: wsId }); setMensagem(""); }
    catch { alert("Erro ao enviar!"); }
    setEnviandoMsg(false);
  };

  const assumirChat = async (numero: string) => { await wa("assumir", { numero, workspaceId: wsId }); fetchAtendimentos(); };
  const finalizarChat = async (numero: string) => { await wa("finalizar", { numero, workspaceId: wsId }); fetchAtendimentos(); setAtendimentoAtivo(null); setHistorico([]); };
  const devolverBot = async (numero: string) => { await wa("devolver", { numero, workspaceId: wsId }); fetchAtendimentos(); };
  const limparFiltros = () => { setFiltroFila("todas"); setFiltroAtendente("todos"); setFiltroConexao("todas"); setFiltroEtiqueta("todas"); setFiltrosStatus(["aberto", "pendente"]); };

  const tempoRelativo = (data: string) => { const d = Math.floor((Date.now() - new Date(data).getTime()) / 60000); return d < 1 ? "agora" : d < 60 ? `${d}min` : d < 1440 ? `${Math.floor(d/60)}h` : `${Math.floor(d/1440)}d`; };
  const horaMsg = (data: string) => new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const toggleStatus = (s: string) => setFiltrosStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ═══ Salva um campo do painel no banco ═══
  const salvarCampoContato = async (campo: string, valor: any) => {
    if (!atendimentoAtivo) return;
    setSalvandoContato(true);
    try {
      const { error } = await supabase.from("atendimentos")
        .update({ [campo]: valor })
        .eq("id", atendimentoAtivo.id);
      if (error) { alert("Erro ao salvar: " + error.message); setSalvandoContato(false); return; }
      // Atualiza local
      setAtendimentoAtivo({ ...atendimentoAtivo, [campo]: valor });
      setAtendimentos(prev => prev.map(a => a.id === atendimentoAtivo.id ? { ...a, [campo]: valor } : a));
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoContato(false);
  };

  // ═══ Exportar histórico como PDF (print do navegador) ═══
  const exportarPDF = () => {
    if (!atendimentoAtivo) return;
    const janela = window.open("", "_blank", "width=800,height=600");
    if (!janela) { alert("Popup bloqueado! Libere popups neste site."); return; }
    const html = `
      <html><head><title>Histórico ${atendimentoAtivo.nome}</title>
      <style>body{font-family:Arial;padding:20px}h1{color:#16a34a}.msg{padding:10px;margin:5px 0;border-radius:8px;max-width:60%}.cliente{background:#e5e7eb;margin-right:auto}.atendente{background:#dbeafe;margin-left:auto;text-align:right}.bot{background:#dcfce7;margin-left:auto;text-align:right}.meta{font-size:10px;color:#6b7280}</style>
      </head><body>
      <h1>📄 Histórico — ${atendimentoAtivo.nome}</h1>
      <p><b>Número:</b> ${atendimentoAtivo.numero}<br><b>Fila:</b> ${atendimentoAtivo.fila || "—"}<br><b>Exportado em:</b> ${new Date().toLocaleString("pt-BR")}</p>
      <hr>
      ${historico.map(m => `<div class="msg ${m.de === "cliente" ? "cliente" : m.de === "bot" ? "bot" : "atendente"}">
        <div>${(m.mensagem || "").replace(/</g, "&lt;")}</div>
        <div class="meta">${m.de === "cliente" ? "Cliente" : m.de === "bot" ? "BOT" : "Atendente"} • ${m.created_at ? new Date(m.created_at).toLocaleString("pt-BR") : ""}</div>
      </div>`).join("")}
      </body></html>`;
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => janela.print(), 500);
  };

  // Sanitizar número — só dígitos, DDI/DDD, sem @c.us ou @lid
  const numeroSanitizado = (num: string) => (num || "").replace(/\D/g, "");

  return (
    <div style={{ display: "flex", flex: 1, height: "100vh" }}>

      {/* LISTA */}
      <div style={{ width: 310, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #1f2937" }}>
          <input placeholder="Buscar por nome ou número..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...IS, padding: "8px 12px", fontSize: 12 }} />
        </div>

        <div style={{ padding: "6px 12px", borderBottom: "1px solid #1f2937", display: "flex", gap: 6 }}>
          <button onClick={fetchAtendimentos} title="Atualizar" style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>🔄</button>
          {permissoes.chat_interno && (
            <button onClick={() => setShowChatInterno(!showChatInterno)} title="Chat Interno" style={{ background: showChatInterno ? "#8b5cf622" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: showChatInterno ? "#8b5cf6" : "#9ca3af", cursor: "pointer", fontSize: 14 }}>💭</button>
          )}
          <button onClick={() => setShowFiltros(!showFiltros)} title="Filtros Avançados" style={{ position: "relative", background: showFiltros || temFiltroAtivo ? "#3b82f622" : "#1f2937", border: `1px solid ${temFiltroAtivo ? "#3b82f6" : "#374151"}`, borderRadius: 6, padding: "5px 9px", color: temFiltroAtivo ? "#3b82f6" : "#9ca3af", cursor: "pointer", fontSize: 14 }}>
            🔽{temFiltroAtivo && <span style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, background: "#3b82f6", borderRadius: "50%" }} />}
          </button>
        </div>

        {showFiltros && (
          <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1f2937", padding: 14, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase" }}>Filtro Avançado</span>
              {temFiltroAtivo && <button onClick={limparFiltros} style={{ background: "none", border: "none", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>✕ Limpar</button>}
            </div>
            <div style={{ background: "#1f2937", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "white", fontSize: 12 }}>Visualizar Tickets</span>
              <button onClick={() => setVisualizarTickets(!visualizarTickets)} style={{ width: 36, height: 20, background: visualizarTickets ? "#3b82f6" : "#374151", borderRadius: 10, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: visualizarTickets ? 19 : 3, transition: "left 0.2s" }} />
              </button>
            </div>
            <div>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Filas</label>
              <select value={filtroFila} onChange={e => setFiltroFila(e.target.value)} style={{ ...IS, padding: "7px 10px", fontSize: 12 }}>
                <option value="todas">Todas as filas</option>
                {filas.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {podeVerFiltrosAvancados && (
              <div>
                <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Conexão</label>
                <select value={filtroConexao} onChange={e => setFiltroConexao(e.target.value)} style={{ ...IS, padding: "7px 10px", fontSize: 12 }}>
                  <option value="todas">Todas as conexões</option>
                  {filas.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            )}
            {podeVerFiltrosAvancados && (
              <div>
                <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Usuário</label>
                <select value={filtroAtendente} onChange={e => setFiltroAtendente(e.target.value)} style={{ ...IS, padding: "7px 10px", fontSize: 12 }}>
                  <option value="todos">Todos os usuários</option>
                  {atendentes.map(a => <option key={a} value={a}>{a === "BOT" ? "🤖 BOT" : "👤 " + a}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Etiquetas</label>
              <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} style={{ ...IS, padding: "7px 10px", fontSize: 12 }}>
                <option value="todas">Todas as etiquetas</option>
                <option value="lead_quente">🔴 Lead Quente</option>
                <option value="lead_frio">🔵 Lead Frio</option>
                <option value="agendado">🟡 Agendado</option>
                <option value="fechado">🟢 Fechado</option>
                <option value="retornar">🟣 Retornar</option>
              </select>
            </div>
            <div>
              <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 8, textTransform: "uppercase" }}>Status</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[{ key: "aberto", label: "Abertos", color: "#3b82f6" }, { key: "pendente", label: "Pendentes", color: "#dc2626" }, { key: "resolvido", label: "Resolvidos", color: "#16a34a" }].map(s => (
                  <label key={s.key} onClick={() => toggleStatus(s.key)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${filtrosStatus.includes(s.key) ? s.color : "#374151"}`, background: filtrosStatus.includes(s.key) ? s.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {filtrosStatus.includes(s.key) && <span style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>✓</span>}
                    </div>
                    <span style={{ color: "white", fontSize: 13 }}>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ background: "#1f2937", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontSize: 11 }}>Resultados</span>
              <span style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>{atendimentosFiltrados.length} atendimentos</span>
            </div>
          </div>
        )}

        {!showFiltros && (
          <div style={{ display: "flex", borderBottom: "1px solid #1f2937" }}>
            {[{ key: "abertos", label: "Abertos", color: "#3b82f6", count: atendimentos.filter(a => a.status === "aberto").length }, { key: "pendentes", label: "Pendentes", color: "#f59e0b", count: atendimentos.filter(a => a.status === "pendente").length }, { key: "resolvidos", label: "Resolvidos", color: "#16a34a", count: atendimentos.filter(a => a.status === "resolvido").length }].map(t => (
              <button key={t.key} onClick={() => setAbaConversa(t.key)} style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", color: abaConversa === t.key ? t.color : "#6b7280", fontSize: 11, fontWeight: "bold", cursor: "pointer", borderBottom: abaConversa === t.key ? `2px solid ${t.color}` : "2px solid transparent" }}>
                {t.label}{t.count > 0 && <span style={{ background: t.color, color: "white", borderRadius: 8, padding: "0 5px", fontSize: 9, marginLeft: 3 }}>{t.count}</span>}
              </button>
            ))}
          </div>
        )}

        {showChatInterno && permissoes.chat_interno ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #1f2937" }}>
              <span style={{ color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>💭 Chat Interno</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {mensagensInternas.map((msg, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.de === "Você" ? "flex-end" : "flex-start" }}>
                  {msg.de !== "Você" && <span style={{ color: "#8b5cf6", fontSize: 10, marginBottom: 2, fontWeight: "bold" }}>{msg.de}</span>}
                  <div style={{ background: msg.de === "Você" ? "#8b5cf6" : "#1f2937", borderRadius: 10, padding: "8px 12px", maxWidth: "85%" }}>
                    <p style={{ color: "white", fontSize: 12, margin: 0 }}>{msg.texto}</p>
                    <p style={{ color: "#ddd6fe", fontSize: 10, margin: "3px 0 0 0", textAlign: "right" }}>{msg.hora}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 10, borderTop: "1px solid #1f2937", display: "flex", gap: 8 }}>
              <input placeholder="Mensagem interna..." value={mensagemInterna} onChange={e => setMensagemInterna(e.target.value)} style={{ flex: 1, background: "#1f2937", border: "none", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12 }} />
              <button style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>➤</button>
            </div>
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1 }}>
            {atendimentosFiltrados.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <p style={{ fontSize: 32, margin: "0 0 8px" }}>💬</p>
                <p style={{ color: "#6b7280", fontSize: 13 }}>{temFiltroAtivo ? "Nenhum resultado para os filtros" : "Nenhum atendimento"}</p>
                {temFiltroAtivo && <button onClick={limparFiltros} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, padding: "6px 12px", color: "#9ca3af", fontSize: 12, cursor: "pointer", marginTop: 8 }}>Limpar filtros</button>}
              </div>
            ) : atendimentosFiltrados.map(a => (
              <div key={a.id} onClick={() => { setAtendimentoAtivo(a); setHistorico([]); fetchHistorico(a.numero); }}
                style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937", cursor: "pointer", background: atendimentoAtivo?.id === a.id ? "#1f2937" : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{a.nome}</span>
                  <span style={{ color: "#6b7280", fontSize: 11 }}>{tempoRelativo(a.created_at)}</span>
                </div>
                <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.mensagem}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{a.fila}</span>
                  <span style={{ background: a.atendente === "BOT" ? "#8b5cf622" : "#16a34a22", color: a.atendente === "BOT" ? "#8b5cf6" : "#16a34a", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>
                    {a.atendente === "BOT" ? "🤖 BOT" : "👤 " + a.atendente}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ÁREA DO CHAT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {atendimentoAtivo ? (
          <>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #1f2937", background: "#111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>{atendimentoAtivo.nome}</h3>
                <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>{atendimentoAtivo.fila} • {atendimentoAtivo.numero}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(atendimentoAtivo.atendente === "BOT" || atendimentoAtivo.status === "pendente") && (
                  <button onClick={() => assumirChat(atendimentoAtivo.numero)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>👤 Assumir</button>
                )}
                {atendimentoAtivo.atendente !== "BOT" && atendimentoAtivo.status !== "pendente" && (
                  <button onClick={() => devolverBot(atendimentoAtivo.numero)} style={{ background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>🤖 Devolver ao Bot</button>
                )}
                {(permissoes.vendas_proprio || permissoes.vendas_equipe) && atendimentoAtivo.atendente !== "BOT" && atendimentoAtivo.status !== "pendente" && (
                  <button onClick={() => window.open(`/proposta?nome=${encodeURIComponent(atendimentoAtivo.nome)}&numero=${encodeURIComponent(numeroSanitizado(atendimentoAtivo.numero))}`, "_blank")} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💰 Finalizar Venda</button>
                )}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowTransferir(!showTransferir)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>↗️ Transferir</button>
                  {showTransferir && (
                    <div style={{ position: "absolute", top: 40, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 12, padding: 16, zIndex: 100, width: 220 }}>
                      {(filas.length > 0 ? filas : ["Fila Principal", "Fila Suporte", "Fila Vendas"]).map(f => (
                        <button key={f} onClick={() => { alert(`Transferido para ${f}`); setShowTransferir(false); }} style={{ display: "block", width: "100%", background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>📋 {f}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => finalizarChat(atendimentoAtivo.numero)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>✓ Finalizar</button>
                {/* ✅ Botão abrir painel */}
                <button onClick={() => setShowPainelContato(!showPainelContato)} title="Dados do Contato"
                  style={{ background: showPainelContato ? "#8b5cf622" : "#1f2937", color: showPainelContato ? "#8b5cf6" : "#9ca3af", border: `1px solid ${showPainelContato ? "#8b5cf633" : "#374151"}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                  👤 {showPainelContato ? "Ocultar" : "Dados"}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20, background: "#0d0d0d", display: "flex", flexDirection: "column", gap: 10 }}>
              {historico.length === 0
                ? <div style={{ textAlign: "center", padding: 40 }}><p style={{ color: "#374151", fontSize: 13 }}>Nenhuma mensagem ainda</p></div>
                : historico.map((msg, i) => {
                    const isCliente = msg.de === "cliente"; const isBot = msg.de === "bot";
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: isCliente ? "flex-start" : "flex-end" }}>
                        <div style={{ maxWidth: "65%", padding: "10px 14px", borderRadius: isCliente ? "12px 12px 12px 2px" : "12px 12px 2px 12px", background: isCliente ? "#1f2937" : isBot ? "#1e3a2f" : "#1e2a4a" }}>
                          {!isCliente && <p style={{ color: isBot ? "#16a34a" : "#3b82f6", fontSize: 10, margin: "0 0 4px", fontWeight: "bold" }}>{isBot ? "🤖 BOT" : "👤 Você"}</p>}
                          <p style={{ color: "white", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{msg.mensagem}</p>
                          {msg.created_at && <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0", textAlign: "right" }}>{horaMsg(msg.created_at)}</p>}
                        </div>
                      </div>
                    );
                  })}
              <div ref={chatBottomRef} />
            </div>

            {showRespostas && permissoes.respostas_rapidas && (
              <div style={{ background: "#1f2937", borderTop: "1px solid #374151", padding: 12, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {respostasRapidas.map((r, i) => (
                  <button key={i} onClick={() => { setMensagem(r.mensagem); setShowRespostas(false); }} style={{ background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", gap: 10 }}>
                    <span style={{ color: "#3b82f6", fontWeight: "bold", minWidth: 60 }}>{r.atalho}</span>
                    <span style={{ color: "#9ca3af" }}>{r.mensagem}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid #1f2937", background: "#111", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              {permissoes.respostas_rapidas && (
                <button onClick={() => setShowRespostas(!showRespostas)} style={{ background: showRespostas ? "#3b82f622" : "#1f2937", color: showRespostas ? "#3b82f6" : "#6b7280", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>⚡</button>
              )}
              <input placeholder="Digite uma mensagem..." value={mensagem} onChange={e => { setMensagem(e.target.value); if (e.target.value === "/" && permissoes.respostas_rapidas) setShowRespostas(true); else if (!e.target.value) setShowRespostas(false); }} onKeyDown={e => e.key === "Enter" && enviarMensagem()} style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "10px 16px", color: "white", fontSize: 14 }} />
              <button onClick={() => setGravando(!gravando)} style={{ background: gravando ? "#dc262622" : "#1f2937", color: gravando ? "#dc2626" : "#6b7280", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>{gravando ? "⏹" : "🎤"}</button>
              <button onClick={enviarMensagem} disabled={enviandoMsg} style={{ background: enviandoMsg ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>{enviandoMsg ? "..." : "➤"}</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 64 }}>💬</span>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>Selecione um atendimento</h2>
            <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Clique em uma conversa para começar</p>
          </div>
        )}
      </div>

      {/* ═══════════════ PAINEL DADOS DO CONTATO ═══════════════ */}
      {atendimentoAtivo && showPainelContato && (
        <div style={{ width: 340, background: "#111", borderLeft: "1px solid #1f2937", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>👤 Dados do Contato</h3>
              <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>{salvandoContato ? "💾 Salvando..." : "Auto-salvo"}</p>
            </div>
            <button onClick={() => setShowPainelContato(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          {/* Abas */}
          <div style={{ display: "flex", borderBottom: "1px solid #1f2937", background: "#0d0d0d" }}>
            {[
              { key: "perfil", icon: "👤", title: "Perfil" },
              { key: "protocolo", icon: "📋", title: "Protocolo" },
              { key: "funil", icon: "🎯", title: "Funil" },
              { key: "ia", icon: "🤖", title: "IA" },
              { key: "utils", icon: "🔧", title: "Utilitários" },
            ].map(a => (
              <button key={a.key} onClick={() => setAbaPainel(a.key as any)} title={a.title}
                style={{ flex: 1, padding: "10px 4px", background: abaPainel === a.key ? "#1f2937" : "none", border: "none", borderBottom: abaPainel === a.key ? "2px solid #8b5cf6" : "2px solid transparent", color: abaPainel === a.key ? "#8b5cf6" : "#6b7280", fontSize: 16, cursor: "pointer" }}>
                {a.icon}
              </button>
            ))}
          </div>

          {/* Conteúdo das abas */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

            {/* ═══ ABA 1 — PERFIL ═══ */}
            {abaPainel === "perfil" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#3b82f622", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 10px" }}>👤</div>
                  <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{atendimentoAtivo.nome}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>Criado em {new Date(atendimentoAtivo.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label>
                  <input value={atendimentoAtivo.nome || ""}
                    onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, nome: e.target.value })}
                    onBlur={e => salvarCampoContato("nome", e.target.value)}
                    style={inputSm} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone</label>
                  <input value={atendimentoAtivo.numero || ""} disabled style={{ ...inputSm, opacity: 0.6 }} />
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0" }}>Sanitizado: {numeroSanitizado(atendimentoAtivo.numero)}</p>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail</label>
                  <input type="email" placeholder="contato@email.com" value={atendimentoAtivo.email || ""}
                    onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, email: e.target.value })}
                    onBlur={e => salvarCampoContato("email", e.target.value)}
                    style={inputSm} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label>
                  <input value={atendimentoAtivo.fila || ""} disabled style={{ ...inputSm, opacity: 0.6 }} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Atendente</label>
                  <input value={atendimentoAtivo.atendente || "—"} disabled style={{ ...inputSm, opacity: 0.6 }} />
                </div>
              </div>
            )}

            {/* ═══ ABA 2 — PROTOCOLO / AVALIAÇÃO / NOTAS ═══ */}
            {abaPainel === "protocolo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#1f2937", borderRadius: 8, padding: 12 }}>
                  <label style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase" }}>Número do Protocolo</label>
                  <p style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold", margin: "4px 0 0", fontFamily: "monospace" }}>#{String(atendimentoAtivo.id).padStart(6, "0")}</p>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Avaliação do Atendimento</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => salvarCampoContato("avaliacao", n)}
                        style={{ background: (atendimentoAtivo.avaliacao || 0) >= n ? "#f59e0b" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "8px 12px", fontSize: 16, cursor: "pointer", color: (atendimentoAtivo.avaliacao || 0) >= n ? "white" : "#6b7280" }}>⭐</button>
                    ))}
                    {(atendimentoAtivo.avaliacao || 0) > 0 && (
                      <button onClick={() => salvarCampoContato("avaliacao", 0)} style={{ background: "none", border: "1px solid #374151", borderRadius: 6, padding: "8px 10px", color: "#dc2626", cursor: "pointer", fontSize: 11 }}>✕</button>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Notas/Observações</label>
                  <textarea placeholder="Anotações internas sobre este contato..."
                    value={atendimentoAtivo.notas || ""}
                    onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, notas: e.target.value })}
                    onBlur={e => salvarCampoContato("notas", e.target.value)}
                    rows={8}
                    style={{ ...inputSm, resize: "vertical", fontFamily: "inherit", minHeight: 100 }} />
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0" }}>Salva ao sair do campo</p>
                </div>
              </div>
            )}

            {/* ═══ ABA 3 — FUNIL / KANBAN / VALOR / BLOQUEIOS ═══ */}
            {abaPainel === "funil" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Etapa do Funil</label>
                  <select value={atendimentoAtivo.funil_etapa || ""} onChange={e => salvarCampoContato("funil_etapa", e.target.value)} style={inputSm}>
                    <option value="">Sem etapa</option>
                    <option value="novo">🆕 Novo Lead</option>
                    <option value="contato">📞 Primeiro Contato</option>
                    <option value="qualificacao">🎯 Qualificação</option>
                    <option value="proposta">💰 Proposta Enviada</option>
                    <option value="negociacao">🤝 Negociação</option>
                    <option value="fechado_ganho">✅ Fechado Ganho</option>
                    <option value="fechado_perdido">❌ Fechado Perdido</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Coluna Kanban</label>
                  <input placeholder="Ex: Em andamento" value={atendimentoAtivo.kanban_coluna || ""}
                    onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, kanban_coluna: e.target.value })}
                    onBlur={e => salvarCampoContato("kanban_coluna", e.target.value)}
                    style={inputSm} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Demanda do Cliente</label>
                  <textarea placeholder="O que o cliente precisa..."
                    value={atendimentoAtivo.demanda || ""}
                    onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, demanda: e.target.value })}
                    onBlur={e => salvarCampoContato("demanda", e.target.value)}
                    rows={3}
                    style={{ ...inputSm, resize: "vertical", fontFamily: "inherit", minHeight: 60 }} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Valor do Negócio (R$)</label>
                  <input type="number" step="0.01" placeholder="0,00"
                    value={atendimentoAtivo.valor || 0}
                    onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, valor: parseFloat(e.target.value) || 0 })}
                    onBlur={e => salvarCampoContato("valor", parseFloat(e.target.value) || 0)}
                    style={inputSm} />
                </div>

                <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 12, marginTop: 6 }}>
                  <p style={{ color: "#dc2626", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>🚫 Bloqueios</p>
                  {[
                    { key: "bloqueado_contato", label: "Bloquear Contato", desc: "Ignora todas as mensagens deste número" },
                    { key: "bloqueado_fluxo", label: "Bloquear Fluxo", desc: "Não executa fluxos automáticos" },
                  ].map(b => {
                    const ativo = !!(atendimentoAtivo as any)[b.key];
                    return (
                      <div key={b.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <p style={{ color: "white", fontSize: 12, fontWeight: "bold", margin: 0 }}>{b.label}</p>
                          <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{b.desc}</p>
                        </div>
                        <button onClick={() => salvarCampoContato(b.key, !ativo)}
                          style={{ width: 40, height: 22, background: ativo ? "#dc2626" : "#374151", borderRadius: 11, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
                          <div style={{ width: 16, height: 16, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: ativo ? 21 : 3, transition: "left 0.2s" }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ ABA 4 — IA (ChatGPT/TypeBot) ═══ */}
            {abaPainel === "ia" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>Controla se a IA e o TypeBOT atuam neste contato específico.</p>
                {[
                  { key: "bloqueado_ia", label: "🤖 ChatGPT / IA", desc: "Se ligado, a IA NÃO responde este contato", cor: "#16a34a" },
                  { key: "bloqueado_typebot", label: "🔀 TypeBOT", desc: "Se ligado, o TypeBOT NÃO atua neste contato", cor: "#3b82f6" },
                ].map(item => {
                  const bloqueado = !!(atendimentoAtivo as any)[item.key];
                  return (
                    <div key={item.key} style={{ background: "#0d0d0d", borderRadius: 10, padding: 14, border: `1px solid ${bloqueado ? "#dc262633" : "#1f2937"}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{item.label}</p>
                        <button onClick={() => salvarCampoContato(item.key, !bloqueado)}
                          style={{ width: 44, height: 24, background: bloqueado ? "#dc2626" : item.cor, borderRadius: 12, cursor: "pointer", border: "none", position: "relative" }}>
                          <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: bloqueado ? 23 : 3, transition: "left 0.2s" }} />
                        </button>
                      </div>
                      <p style={{ color: bloqueado ? "#dc2626" : "#6b7280", fontSize: 11, margin: 0 }}>
                        Status: <b>{bloqueado ? "🚫 BLOQUEADO" : "✅ Ativo"}</b>
                      </p>
                      <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0" }}>{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ ABA 5 — UTILITÁRIOS (PDF/LID/Sanitizar) ═══ */}
            {abaPainel === "utils" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <button onClick={exportarPDF}
                  style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "12px", fontSize: 13, cursor: "pointer", fontWeight: "bold", textAlign: "left" }}>
                  📄 Exportar Histórico em PDF
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0", fontWeight: "normal" }}>Abre uma janela de impressão com toda a conversa</p>
                </button>

                <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 14 }}>
                  <p style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", fontWeight: "bold", margin: "0 0 8px" }}>🆔 LID do WhatsApp</p>
                  <div style={{ background: "#111", borderRadius: 6, padding: "8px 10px", fontFamily: "monospace", fontSize: 12, color: "white", wordBreak: "break-all" }}>
                    {atendimentoAtivo.numero.includes("@") ? atendimentoAtivo.numero : atendimentoAtivo.numero + "@c.us"}
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "6px 0 0" }}>Identificador único do WhatsApp</p>
                </div>

                <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 14 }}>
                  <p style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", fontWeight: "bold", margin: "0 0 8px" }}>📱 Número Sanitizado</p>
                  <div style={{ background: "#111", borderRadius: 6, padding: "8px 10px", fontFamily: "monospace", fontSize: 12, color: "#16a34a", wordBreak: "break-all" }}>
                    {numeroSanitizado(atendimentoAtivo.numero) || "(vazio)"}
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "6px 0 0" }}>Só dígitos — pronto pra APIs externas</p>
                </div>

                <button onClick={() => { navigator.clipboard.writeText(numeroSanitizado(atendimentoAtivo.numero)); alert("Copiado!"); }}
                  style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                  📋 Copiar número sanitizado
                </button>

                <button onClick={() => window.open(`https://wa.me/${numeroSanitizado(atendimentoAtivo.numero)}`, "_blank")}
                  style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                  📞 Abrir no WhatsApp Web
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}