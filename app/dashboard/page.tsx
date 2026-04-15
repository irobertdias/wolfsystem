"use client";
import { useState } from "react";

const conversas = [
  { id: 1, nome: "João Silva", telefone: "62981234567", ultima: "Olá! Tenho interesse no produto", tempo: "2 min", status: "aberto", tag: "CLARO - BUSINESS", mensagens: [
    { de: "cliente", texto: "Olá! Tenho interesse no produto", hora: "10:00" },
    { de: "atendente", texto: "Olá João! Como posso te ajudar?", hora: "10:01" },
    { de: "cliente", texto: "Quero saber sobre os planos", hora: "10:02" },
  ]},
  { id: 2, nome: "Maria Costa", telefone: "62987654321", ultima: "Preciso de suporte técnico", tempo: "5 min", status: "pendente", tag: "SUPORTE", mensagens: [
    { de: "cliente", texto: "Preciso de suporte técnico", hora: "09:55" },
    { de: "cliente", texto: "Meu sistema não está funcionando", hora: "09:56" },
  ]},
  { id: 3, nome: "Carlos Souza", telefone: "62991234567", ultima: "Obrigado pelo atendimento!", tempo: "15 min", status: "resolvido", tag: "VENDAS", mensagens: [
    { de: "cliente", texto: "Quero fechar o plano premium", hora: "09:40" },
    { de: "atendente", texto: "Perfeito! Vou te passar os detalhes", hora: "09:41" },
    { de: "cliente", texto: "Obrigado pelo atendimento!", hora: "09:45" },
  ]},
];

export default function Dashboard() {
  const [abaSelecionada, setAbaSelecionada] = useState("aberto");
  const [conversaSelecionada, setConversaSelecionada] = useState(conversas[0]);
  const [mensagem, setMensagem] = useState("");

  const conversasFiltradas = conversas.filter(c => c.status === abaSelecionada);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a" }}>

      {/* SIDEBAR */}
      <div style={{ width: 72, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 24 }}>
        <img src="/logo1.png" alt="Wolf" style={{ width: 40, filter: "brightness(0) invert(1)" }} />
        {[
          { icon: "💬", label: "Conversas" },
          { icon: "👥", label: "Contatos" },
          { icon: "📊", label: "Relatórios" },
          { icon: "🤖", label: "Chatbot" },
          { icon: "⚙️", label: "Config" },
        ].map((item) => (
          <button key={item.label} title={item.label} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 22, padding: 10, borderRadius: 10,
            transition: "background 0.2s"
          }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#1f2937")}
            onMouseOut={(e) => (e.currentTarget.style.background = "none")}
          >{item.icon}</button>
        ))}
      </div>

      {/* LISTA DE CONVERSAS */}
      <div style={{ width: 300, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column" }}>
        
        {/* Header */}
        <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: 0 }}>Conversas</h2>
          </div>
          <input placeholder="Buscar por nome ou número..." style={{
            width: "100%", background: "#1f2937", border: "none", borderRadius: 8,
            padding: "8px 12px", color: "white", fontSize: 13, boxSizing: "border-box"
          }} />
        </div>

        {/* Abas */}
        <div style={{ display: "flex", borderBottom: "1px solid #1f2937" }}>
          {[
            { key: "aberto", label: "Abertos", count: conversas.filter(c => c.status === "aberto").length },
            { key: "pendente", label: "Pendentes", count: conversas.filter(c => c.status === "pendente").length },
            { key: "resolvido", label: "Resolvidos", count: conversas.filter(c => c.status === "resolvido").length },
          ].map((aba) => (
            <button key={aba.key} onClick={() => setAbaSelecionada(aba.key)} style={{
              flex: 1, padding: "10px 4px", background: "none", border: "none",
              borderBottom: abaSelecionada === aba.key ? "2px solid #16a34a" : "2px solid transparent",
              color: abaSelecionada === aba.key ? "#16a34a" : "#6b7280",
              fontSize: 11, fontWeight: "bold", cursor: "pointer", textTransform: "uppercase"
            }}>
              {aba.label} {aba.count > 0 && <span style={{ background: "#16a34a", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>{aba.count}</span>}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {conversasFiltradas.length === 0 ? (
            <p style={{ color: "#6b7280", padding: 16, fontSize: 13 }}>Nenhuma conversa.</p>
          ) : conversasFiltradas.map((c) => (
            <div key={c.id} onClick={() => setConversaSelecionada(c)} style={{
              padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #1f2937",
              background: conversaSelecionada?.id === c.id ? "#1f2937" : "transparent",
              transition: "background 0.2s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{c.nome}</span>
                <span style={{ color: "#6b7280", fontSize: 11 }}>{c.tempo}</span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 6px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultima}</p>
              <span style={{ background: "#16a34a22", color: "#16a34a", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: "bold" }}>{c.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ÁREA DO CHAT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header do chat */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #1f2937", background: "#111", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>{conversaSelecionada?.nome}</h3>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>📱 {conversaSelecionada?.telefone}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>✓ Resolver</button>
            <button style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>⏳ Pendente</button>
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 12, background: "#0d0d0d" }}>
          {conversaSelecionada?.mensagens.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.de === "atendente" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "60%", padding: "10px 14px", borderRadius: 12,
                background: msg.de === "atendente" ? "#16a34a" : "#1f2937",
                color: "white", fontSize: 13, lineHeight: 1.5
              }}>
                <p style={{ margin: 0 }}>{msg.texto}</p>
                <p style={{ margin: "4px 0 0", fontSize: 10, color: msg.de === "atendente" ? "#bbf7d0" : "#6b7280", textAlign: "right" }}>{msg.hora}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input de mensagem */}
        <div style={{ padding: 16, borderTop: "1px solid #1f2937", background: "#111", display: "flex", gap: 12, alignItems: "center" }}>
          <input
            placeholder="Digite uma mensagem..."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            style={{
              flex: 1, background: "#1f2937", border: "none", borderRadius: 10,
              padding: "12px 16px", color: "white", fontSize: 14
            }}
          />
          <button onClick={() => setMensagem("")} style={{
            background: "#16a34a", color: "white", border: "none",
            borderRadius: 10, padding: "12px 20px", fontSize: 14,
            cursor: "pointer", fontWeight: "bold"
          }}>➤</button>
        </div>
      </div>

    </div>
  );
}