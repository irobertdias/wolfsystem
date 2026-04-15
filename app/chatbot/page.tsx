"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Chatbot() {
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState<string | null>("atendimentos");
  const [aba, setAba] = useState("chat");
  const [gravando, setGravando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemInterna, setMensagemInterna] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [showFiltro, setShowFiltro] = useState(false);
  const [showChatInterno, setShowChatInterno] = useState(false);
  const [abaConversa, setAbaConversa] = useState("abertos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [busca, setBusca] = useState("");

  const respostasRapidas = [
    { atalho: "/oi", mensagem: "Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?" },
    { atalho: "/planos", mensagem: "Temos planos a partir de R$ 89,90. Posso te passar mais detalhes!" },
    { atalho: "/aguarda", mensagem: "Por favor, aguarde um momento que já vou te atender!" },
    { atalho: "/encerrar", mensagem: "Obrigado pelo contato! Tenha um ótimo dia!" },
    { atalho: "/preco", mensagem: "Posso te enviar uma proposta personalizada?" },
  ];

  const mensagensInternas = [
    { de: "Pedro Lima", texto: "Robert, o cliente João está perguntando sobre desconto", hora: "10:05" },
    { de: "Você", texto: "Pode oferecer 10% para ele!", hora: "10:06" },
    { de: "Ana Souza", texto: "Preciso de ajuda com o cliente Maria", hora: "10:08" },
  ];

  const menus = [
    { key: "atendimentos", icon: "💬", label: "Atendimentos", subitens: [{ key: "chat", label: "Conversas" }, { key: "dashboard_atendimentos", label: "Dashboard" }] },
    { key: "empresa_filas", icon: "🏢", label: "Empresas & Filas", subitens: [{ key: "empresas", label: "Empresas" }, { key: "filas", label: "Filas" }, { key: "conexoes", label: "Conexões" }] },
    { key: "automacao", icon: "🤖", label: "Automação", subitens: [{ key: "fluxos", label: "Chatbot / Fluxos" }, { key: "claude", label: "Integração Claude" }, { key: "gpt", label: "Integração GPT" }, { key: "typebot", label: "Integração Typebot" }] },
    { key: "cadastro", icon: "📋", label: "Cadastro", subitens: [{ key: "usuarios", label: "Usuários" }, { key: "departamentos", label: "Departamentos" }, { key: "etiquetas", label: "Etiquetas" }] },
    { key: "configuracoes", icon: "⚙️", label: "Configurações", subitens: [{ key: "roleta", label: "Roleta de Distribuição" }, { key: "relatorios", label: "Relatórios" }, { key: "respostas_rapidas", label: "Respostas Rápidas" }] },
  ];

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a" }}>

      {/* SIDEBAR */}
      <div style={{ width: 240, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 32, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "white", fontWeight: "bold", fontSize: 14 }}>Wolf Chatbot</span>
        </div>
        <div style={{ padding: "8px", flex: 1 }}>
          {menus.map((menu) => (
            <div key={menu.key}>
              <button onClick={() => setMenuAberto(menuAberto === menu.key ? null : menu.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: menuAberto === menu.key ? "#3b82f6" : "#9ca3af", fontSize: 13, fontWeight: "bold", textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span>{menu.icon}</span> {menu.label}</span>
                <span style={{ fontSize: 10 }}>{menuAberto === menu.key ? "▼" : "▶"}</span>
              </button>
              {menuAberto === menu.key && (
                <div style={{ paddingLeft: 12, marginBottom: 4 }}>
                  {menu.subitens.map((sub) => (
                    <button key={sub.key} onClick={() => setAba(sub.key)} style={{ display: "block", width: "100%", padding: "8px 12px", background: aba === sub.key ? "#3b82f622" : "none", border: "none", borderRadius: 8, cursor: "pointer", color: aba === sub.key ? "#3b82f6" : "#6b7280", fontSize: 12, textAlign: "left", fontWeight: aba === sub.key ? "bold" : "normal" }}>{sub.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "12px", borderTop: "1px solid #1f2937" }}>
          <button onClick={() => router.push("/crm")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#6b7280", fontSize: 12 }}>← Voltar ao CRM</button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* CHAT */}
        {aba === "chat" && (
          <div style={{ display: "flex", flex: 1, height: "100vh" }}>

            {/* Lista conversas */}
            <div style={{ width: 300, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column" }}>

              {/* Busca */}
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #1f2937" }}>
                <input placeholder="Buscar por nome, número..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...inputStyle, padding: "8px 12px", fontSize: 12 }} />
              </div>

              {/* Linha 1: Ferramentas */}
              <div style={{ padding: "6px 12px", borderBottom: "1px solid #1f2937", display: "flex", gap: 6, alignItems: "center" }}>
                <button title="Atualizar atendimentos" onClick={() => alert("Atendimentos atualizados!")} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>🔄</button>

                <div style={{ position: "relative" }}>
                  <button title="Filtros" onClick={() => setShowFiltro(!showFiltro)} style={{ background: showFiltro ? "#3b82f622" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: showFiltro ? "#3b82f6" : "#9ca3af", cursor: "pointer", fontSize: 14 }}>🔍</button>
                  {showFiltro && (
                    <div style={{ position: "absolute", top: 36, left: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: 16, zIndex: 100, width: 250, display: "flex", flexDirection: "column", gap: 12 }}>
                      <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>🔍 Filtros</p>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Etiqueta</label>
                        <select value={filtroEtiqueta} onChange={(e) => setFiltroEtiqueta(e.target.value)} style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }}>
                          <option value="">Todas</option>
                          <option>Lead Quente</option>
                          <option>Lead Frio</option>
                          <option>Agendado</option>
                          <option>Fechado</option>
                          <option>Retornar</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Usuário</label>
                        <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }}>
                          <option value="">Todos</option>
                          <option>Ana Souza</option>
                          <option>Pedro Lima</option>
                          <option>Carlos Silva</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label>
                        <select style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }}>
                          <option value="">Todas</option>
                          <option>Fila Claro</option>
                          <option>Fila Vivo</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setFiltroEtiqueta(""); setFiltroUsuario(""); setShowFiltro(false); }} style={{ flex: 1, background: "#374151", color: "#9ca3af", border: "none", borderRadius: 6, padding: "6px", fontSize: 12, cursor: "pointer" }}>Limpar</button>
                        <button onClick={() => setShowFiltro(false)} style={{ flex: 1, background: "#3b82f6", color: "white", border: "none", borderRadius: 6, padding: "6px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>Aplicar</button>
                      </div>
                    </div>
                  )}
                </div>

                <button title="Chat Interno" onClick={() => setShowChatInterno(!showChatInterno)} style={{ background: showChatInterno ? "#8b5cf622" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: showChatInterno ? "#8b5cf6" : "#9ca3af", cursor: "pointer", fontSize: 14 }}>💭</button>
              </div>

              {/* Linha 2: Abas Abertos/Pendentes/Resolvidos */}
              <div style={{ display: "flex", borderBottom: "1px solid #1f2937" }}>
                {[
                  { key: "abertos", label: "Abertos", count: 3, color: "#3b82f6" },
                  { key: "pendentes", label: "Pendentes", count: 1, color: "#f59e0b" },
                  { key: "resolvidos", label: "Resolvidos", count: 0, color: "#16a34a" },
                ].map((t) => (
                  <button key={t.key} onClick={() => setAbaConversa(t.key)} style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", color: abaConversa === t.key ? t.color : "#6b7280", fontSize: 11, fontWeight: "bold", cursor: "pointer", borderBottom: abaConversa === t.key ? `2px solid ${t.color}` : "2px solid transparent" }}>
                    {t.label}{t.count > 0 && <span style={{ background: t.color, color: "white", borderRadius: 8, padding: "0px 5px", fontSize: 9, marginLeft: 3 }}>{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* Lista de conversas ou Chat Interno */}
              {showChatInterno ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>💭 Chat Interno</span>
                    <span style={{ background: "#8b5cf622", color: "#8b5cf6", fontSize: 10, padding: "2px 6px", borderRadius: 8 }}>3 online</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {mensagensInternas.map((msg, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.de === "Você" ? "flex-end" : "flex-start" }}>
                        {msg.de !== "Você" && <span style={{ color: "#8b5cf6", fontSize: 10, marginBottom: 2, fontWeight: "bold" }}>{msg.de}</span>}
                        <div style={{ background: msg.de === "Você" ? "#8b5cf6" : "#1f2937", borderRadius: 10, padding: "8px 12px", maxWidth: "85%" }}>
                          <p style={{ color: "white", fontSize: 12, margin: 0 }}>{msg.texto}</p>
                          <p style={{ color: msg.de === "Você" ? "#ddd6fe" : "#6b7280", fontSize: 10, margin: "3px 0 0 0", textAlign: "right" }}>{msg.hora}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 10, borderTop: "1px solid #1f2937", display: "flex", gap: 8 }}>
                    <input placeholder="Mensagem interna..." value={mensagemInterna} onChange={(e) => setMensagemInterna(e.target.value)} style={{ flex: 1, background: "#1f2937", border: "none", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12 }} />
                    <button style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>➤</button>
                  </div>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {[
                    { nome: "João Silva", msg: "Quero saber sobre o plano", tempo: "2 min", fila: "Fila Claro", etiqueta: "Lead Quente" },
                    { nome: "Maria Costa", msg: "Preciso de suporte", tempo: "5 min", fila: "Fila Vivo", etiqueta: "Lead Frio" },
                    { nome: "Carlos Souza", msg: "Quanto custa o plano?", tempo: "10 min", fila: "Fila Claro", etiqueta: "Agendado" },
                  ].map((c, i) => (
                    <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937", cursor: "pointer", background: i === 0 ? "#1f2937" : "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{c.nome}</span>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>{c.tempo}</span>
                      </div>
                      <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 6px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.msg}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{c.fila}</span>
                        <span style={{ background: c.etiqueta === "Lead Quente" ? "#dc262622" : c.etiqueta === "Agendado" ? "#f59e0b22" : "#3b82f622", color: c.etiqueta === "Lead Quente" ? "#dc2626" : c.etiqueta === "Agendado" ? "#f59e0b" : "#3b82f6", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{c.etiqueta}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Área do chat */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

              {/* Header */}
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #1f2937", background: "#111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>João Silva</h3>
                  <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Fila Claro • +55 62 99999-1234</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => { setShowTransferir(!showTransferir); setShowRespostas(false); }} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>↗️ Transferir</button>
                    {showTransferir && (
                      <div style={{ position: "absolute", top: 40, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 12, padding: 16, zIndex: 100, width: 540, display: "flex", gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 8px 0" }}>Departamento</p>
                          {["Vendas", "Suporte", "Financeiro", "Técnico"].map((dep) => (
                            <button key={dep} onClick={() => { alert(`Transferido para ${dep}`); setShowTransferir(false); }} style={{ display: "block", width: "100%", background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>🏢 {dep}</button>
                          ))}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 8px 0" }}>Usuário</p>
                          {["Ana Souza", "Pedro Lima", "Carlos Silva"].map((u) => (
                            <button key={u} onClick={() => { alert(`Transferido para ${u}`); setShowTransferir(false); }} style={{ display: "block", width: "100%", background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>👤 {u}</button>
                          ))}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 8px 0" }}>Devolver à Fila</p>
                          {["Fila Claro", "Fila Vivo", "Fila Suporte"].map((f) => (
                            <button key={f} onClick={() => { alert(`Devolvido para ${f}`); setShowTransferir(false); }} style={{ display: "block", width: "100%", background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>📋 {f}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => alert("Devolvido para fila pendente!")} style={{ background: "#6b728022", color: "#9ca3af", border: "1px solid #6b728033", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>⏳ Fila Pendente</button>
                  <button onClick={() => alert("Atendimento finalizado!")} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>✓ Finalizar</button>
                </div>
              </div>

              {/* Mensagens */}
              <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12, background: "#0d0d0d" }}>
                {[
                  { de: "cliente", texto: "Olá! Quero saber sobre o plano", hora: "10:00" },
                  { de: "bot", texto: "Olá! Sou o assistente virtual. Como posso te ajudar?", hora: "10:00" },
                  { de: "cliente", texto: "Quanto custa o plano de internet?", hora: "10:01" },
                  { de: "atendente", texto: "Oi João! Temos planos a partir de R$ 89,90!", hora: "10:02" },
                ].map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.de === "cliente" ? "flex-start" : "flex-end" }}>
                    <div style={{ maxWidth: "60%", padding: "10px 14px", borderRadius: 12, background: msg.de === "cliente" ? "#1f2937" : msg.de === "bot" ? "#3b82f622" : "#16a34a", color: "white", fontSize: 13 }}>
                      {msg.de === "bot" && <p style={{ color: "#3b82f6", fontSize: 10, margin: "0 0 4px 0", fontWeight: "bold" }}>🤖 BOT</p>}
                      <p style={{ margin: 0 }}>{msg.texto}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 10, color: "#6b7280", textAlign: "right" }}>{msg.hora}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Popup respostas rápidas */}
              {showRespostas && (
                <div style={{ background: "#1f2937", borderTop: "1px solid #374151", padding: 12, display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 6px 0", textTransform: "uppercase" }}>⚡ Respostas Rápidas</p>
                  {respostasRapidas.map((r, i) => (
                    <button key={i} onClick={() => { setMensagem(r.mensagem); setShowRespostas(false); }} style={{ background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ color: "#3b82f6", fontWeight: "bold", minWidth: 60 }}>{r.atalho}</span>
                      <span style={{ color: "#9ca3af" }}>{r.mensagem}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Barra inferior */}
              <div style={{ borderTop: "1px solid #1f2937", background: "#111", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                <button title="Respostas Rápidas" onClick={() => { setShowRespostas(!showRespostas); setShowTransferir(false); }} style={{ background: showRespostas ? "#3b82f622" : "#1f2937", color: showRespostas ? "#3b82f6" : "#6b7280", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>⚡</button>
                <input placeholder="Digite uma mensagem ou / para respostas rápidas..." value={mensagem}
                  onChange={(e) => { setMensagem(e.target.value); if (e.target.value === "/") setShowRespostas(true); else if (!e.target.value) setShowRespostas(false); }}
                  style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "10px 16px", color: "white", fontSize: 14 }} />
                <button title="Gravar Áudio" onClick={() => setGravando(!gravando)} style={{ background: gravando ? "#dc262622" : "#1f2937", color: gravando ? "#dc2626" : "#6b7280", border: gravando ? "1px solid #dc262633" : "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>{gravando ? "⏹" : "🎤"}</button>
                {!gravando && <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>➤</button>}
                {gravando && <button onClick={() => setGravando(false)} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>⏹ Parar</button>}
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD ATENDIMENTOS */}
        {aba === "dashboard_atendimentos" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Dashboard de Atendimentos</h1>
            <div style={{ display: "flex", gap: 16 }}>
              {[{ label: "Em Atendimento", value: 14, color: "#3b82f6", icon: "💬" }, { label: "Aguardando", value: 47, color: "#f59e0b", icon: "⏳" }, { label: "Finalizados Hoje", value: 128, color: "#16a34a", icon: "✅" }, { label: "Fora de Hora", value: 7, color: "#dc2626", icon: "🕐" }].map((card) => (
                <div key={card.label} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px 0", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
                  <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
                </div>
              ))}
            </div>
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937" }}><h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>Ranking por Vendedor</h3></div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#0d0d0d" }}>{["Vendedor", "Em Atendimento", "Aguardando", "Finalizados", "Pendentes"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                <tbody>
                  {[{ nome: "Ana Souza", atendendo: 3, aguardando: 8, finalizados: 32, pendentes: 2 }, { nome: "Pedro Lima", atendendo: 5, aguardando: 12, finalizados: 28, pendentes: 4 }, { nome: "Carlos Silva", atendendo: 2, aguardando: 6, finalizados: 41, pendentes: 1 }].map((v, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                      <td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{v.nome}</td>
                      <td style={{ padding: "14px 16px", color: "#3b82f6", fontSize: 13, fontWeight: "bold" }}>{v.atendendo}</td>
                      <td style={{ padding: "14px 16px", color: "#f59e0b", fontSize: 13, fontWeight: "bold" }}>{v.aguardando}</td>
                      <td style={{ padding: "14px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>{v.finalizados}</td>
                      <td style={{ padding: "14px 16px", color: "#dc2626", fontSize: 13, fontWeight: "bold" }}>{v.pendentes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EMPRESAS */}
        {aba === "empresas" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Empresas</h1>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Empresa</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {[{ nome: "Claro FC", conexoes: 3, usuarios: 5, filas: 2 }, { nome: "Vivo FC", conexoes: 2, usuarios: 3, filas: 2 }].map((e, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
                  <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 12px 0" }}>{e.nome}</h3>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div><p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>CONEXÕES</p><p style={{ color: "#3b82f6", fontSize: 20, fontWeight: "bold", margin: 0 }}>{e.conexoes}</p></div>
                    <div><p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>USUÁRIOS</p><p style={{ color: "#8b5cf6", fontSize: 20, fontWeight: "bold", margin: 0 }}>{e.usuarios}</p></div>
                    <div><p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>FILAS</p><p style={{ color: "#f59e0b", fontSize: 20, fontWeight: "bold", margin: 0 }}>{e.filas}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FILAS */}
        {aba === "filas" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Filas</h1>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Fila</button>
            </div>
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#0d0d0d" }}>{["Fila", "Empresa", "Conexão", "Usuários", "Aguardando", "Status"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                <tbody>
                  {[{ nome: "Fila Claro", empresa: "Claro FC", conexao: "WhatsApp 01", usuarios: 5, aguardando: 12 }, { nome: "Fila Vivo", empresa: "Vivo FC", conexao: "WhatsApp 02", usuarios: 3, aguardando: 8 }].map((f, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                      <td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{f.nome}</td>
                      <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{f.empresa}</td>
                      <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{f.conexao}</td>
                      <td style={{ padding: "14px 16px", color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>{f.usuarios}</td>
                      <td style={{ padding: "14px 16px", color: "#f59e0b", fontSize: 13, fontWeight: "bold" }}>{f.aguardando}</td>
                      <td style={{ padding: "14px 16px" }}><span style={{ background: "#16a34a22", color: "#16a34a", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>✓ Ativa</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONEXÕES */}
        {aba === "conexoes" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Conexões WhatsApp</h1>
              <button style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Conexão</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {[{ nome: "WhatsApp Claro 01", numero: "+55 62 99999-0001", status: "conectado", tipo: "Baileys" }, { nome: "WhatsApp Vivo 01", numero: "+55 62 99999-0002", status: "desconectado", tipo: "Baileys" }, { nome: "API Meta Claro", numero: "WABA ID: 123456", status: "conectado", tipo: "Meta API" }].map((c, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 32 }}>📱</span>
                    <span style={{ background: c.status === "conectado" ? "#16a34a22" : "#dc262622", color: c.status === "conectado" ? "#16a34a" : "#dc2626", fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.status === "conectado" ? "✓ Conectado" : "✗ Desconectado"}</span>
                  </div>
                  <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 4px 0" }}>{c.nome}</h3>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 8px 0" }}>{c.numero}</p>
                  <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>{c.tipo}</span>
                  <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                    <button style={{ flex: 1, background: "#1f2937", color: "#9ca3af", border: "none", borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer" }}>QR Code</button>
                    <button style={{ flex: 1, background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer" }}>Desconectar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FLUXOS */}
        {aba === "fluxos" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Chatbot / Fluxos</h1>
              <button style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Fluxo</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {[{ nome: "Boas-vindas Claro", empresa: "Claro FC", disparos: 1240 }, { nome: "Qualificação Lead", empresa: "Vivo FC", disparos: 890 }].map((f, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><span style={{ fontSize: 28 }}>🤖</span><span style={{ background: "#16a34a22", color: "#16a34a", fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: "bold" }}>✓ Ativo</span></div>
                  <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 4px 0" }}>{f.nome}</h3>
                  <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 12px 0" }}>{f.empresa}</p>
                  <p style={{ color: "#8b5cf6", fontSize: 13, margin: "0 0 16px 0", fontWeight: "bold" }}>🚀 {f.disparos} disparos</p>
                  <button style={{ width: "100%", background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633", borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>✏️ Editar Fluxo</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INTEGRAÇÕES */}
        {(aba === "claude" || aba === "gpt" || aba === "typebot") && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>{aba === "claude" ? "🤖 Integração Claude AI" : aba === "gpt" ? "💬 Integração ChatGPT" : "🔗 Integração Typebot"}</h1>
            <div style={{ background: "#111", borderRadius: 12, padding: 32, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}>
              {aba === "claude" && (<><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key do Claude</label><input placeholder="sk-ant-..." style={inputStyle} /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prompt do Sistema</label><textarea placeholder="Você é um atendente virtual..." style={{ ...inputStyle, height: 120, resize: "vertical" as const }} /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label><select style={inputStyle}><option>Fila Claro</option><option>Fila Vivo</option></select></div></>)}
              {aba === "gpt" && (<><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key</label><input placeholder="sk-..." style={inputStyle} /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Modelo</label><select style={inputStyle}><option>gpt-4o</option><option>gpt-4o-mini</option><option>gpt-3.5-turbo</option></select></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prompt</label><textarea placeholder="Você é um atendente virtual..." style={{ ...inputStyle, height: 120, resize: "vertical" as const }} /></div></>)}
              {aba === "typebot" && (<><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>URL do Typebot</label><input placeholder="https://typebot.io/..." style={inputStyle} /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key</label><input placeholder="sua-api-key" style={inputStyle} /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>ID do Fluxo</label><input placeholder="ID do fluxo" style={inputStyle} /></div></>)}
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
            </div>
          </div>
        )}

        {/* USUÁRIOS */}
        {aba === "usuarios" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Usuários</h1>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Usuário</button>
            </div>
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#0d0d0d" }}>{["Nome", "E-mail", "Empresa", "Fila", "Perfil", "Status"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                <tbody>
                  {[{ nome: "Ana Souza", email: "ana@claro.com", empresa: "Claro FC", fila: "Fila Claro", perfil: "Atendente", status: "online" }, { nome: "Pedro Lima", email: "pedro@vivo.com", empresa: "Vivo FC", fila: "Fila Vivo", perfil: "Supervisor", status: "offline" }, { nome: "Robert Dias", email: "robert@wolf.com", empresa: "Todas", fila: "Todas", perfil: "Administrador", status: "online" }].map((u, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                      <td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{u.nome}</td>
                      <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.empresa}</td>
                      <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.fila}</td>
                      <td style={{ padding: "14px 16px" }}><span style={{ background: u.perfil === "Administrador" ? "#f59e0b22" : u.perfil === "Supervisor" ? "#8b5cf622" : "#3b82f622", color: u.perfil === "Administrador" ? "#f59e0b" : u.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.perfil}</span></td>
                      <td style={{ padding: "14px 16px" }}><span style={{ background: u.status === "online" ? "#16a34a22" : "#6b728022", color: u.status === "online" ? "#16a34a" : "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEPARTAMENTOS */}
        {aba === "departamentos" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Departamentos</h1>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Departamento</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {["Vendas", "Suporte", "Financeiro", "Técnico"].map((dep, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 12, padding: 20, border: "1px solid #1f2937", textAlign: "center" }}>
                  <p style={{ fontSize: 32, margin: "0 0 8px 0" }}>🏷️</p>
                  <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>{dep}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETIQUETAS */}
        {aba === "etiquetas" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Etiquetas</h1>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Etiqueta</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {[{ nome: "Lead Quente", cor: "#dc2626" }, { nome: "Lead Frio", cor: "#3b82f6" }, { nome: "Agendado", cor: "#f59e0b" }, { nome: "Fechado", cor: "#16a34a" }, { nome: "Sem Interesse", cor: "#6b7280" }, { nome: "Retornar", cor: "#8b5cf6" }].map((e, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 10, padding: "12px 20px", border: `2px solid ${e.cor}44`, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: e.cor }} />
                  <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{e.nome}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ROLETA */}
        {aba === "roleta" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Roleta de Distribuição</h1>
            <div style={{ background: "#111", borderRadius: 12, padding: 32, border: "1px solid #1f2937", maxWidth: 600, display: "flex", flexDirection: "column", gap: 20 }}>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Tipo de Distribuição</label>
                <div style={{ display: "flex", gap: 12 }}>{["Balanceada", "Ranqueada", "Aleatória"].map((tipo) => (<label key={tipo} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "white", fontSize: 13 }}><input type="radio" name="distribuicao" style={{ accentColor: "#3b82f6" }} /> {tipo}</label>))}</div>
              </div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Usuários na Roleta</label>
                {["Ana Souza", "Pedro Lima", "Carlos Silva"].map((u) => (<label key={u} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", color: "white", fontSize: 13 }}><input type="checkbox" style={{ accentColor: "#3b82f6" }} defaultChecked /> {u}</label>))}
              </div>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
            </div>
          </div>
        )}

        {/* RELATÓRIOS */}
        {aba === "relatorios" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Relatórios</h1>
            <div style={{ background: "#111", borderRadius: 12, padding: 32, border: "1px solid #1f2937", maxWidth: 700, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data Início</label><input type="date" style={inputStyle} /></div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data Fim</label><input type="date" style={inputStyle} /></div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Empresa</label><select style={inputStyle}><option>Todas</option><option>Claro FC</option><option>Vivo FC</option></select></div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label><select style={inputStyle}><option>Todas</option><option>Fila Claro</option><option>Fila Vivo</option></select></div>
              </div>
              <button style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>📥 Baixar Relatório (.xlsx)</button>
            </div>
          </div>
        )}

        {/* RESPOSTAS RÁPIDAS */}
        {aba === "respostas_rapidas" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Respostas Rápidas</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>Digite / no chat para usar</p></div>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Resposta</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {respostasRapidas.map((r, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 10, padding: "16px 20px", border: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "4px 12px", borderRadius: 8, fontWeight: "bold", whiteSpace: "nowrap" }}>{r.atalho}</span>
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: 0, flex: 1 }}>{r.mensagem}</p>
                  <button style={{ background: "none", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Remover</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}