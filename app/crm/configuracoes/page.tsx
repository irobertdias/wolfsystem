"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Usuario = { nome: string; email: string; perfil: string; fila: string; status: string; };

export default function Configuracoes() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filas, setFilas] = useState([
    { nome: "Fila Principal", conexao: "WhatsApp 01", usuarios: 2 },
    { nome: "Fila Suporte", conexao: "WhatsApp 02", usuarios: 1 },
  ]);
  const [grupos, setGrupos] = useState([
    { nome: "Grupo Vendas", descricao: "Acesso às vendas e propostas" },
    { nome: "Grupo Suporte", descricao: "Acesso apenas ao suporte" },
  ]);
  const [limites, setLimites] = useState({ usuarios_liberados: 9999 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFormUsuario, setShowFormUsuario] = useState(false);
  const [showFormFila, setShowFormFila] = useState(false);
  const [showFormGrupo, setShowFormGrupo] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [formUsuario, setFormUsuario] = useState({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "" });
  const [formFila, setFormFila] = useState({ nome: "", conexao: "" });
  const [formGrupo, setFormGrupo] = useState({ nome: "", descricao: "" });

  const ADMIN_EMAIL = "robert.dias@live.com";
  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const admin = user.email === ADMIN_EMAIL;
      setIsAdmin(admin);
      const { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).single();
      if (ws) {
        const wsId = ws.username || ws.id.toString();
        setWorkspaceId(wsId);
        const { data: u } = await supabase.from("usuarios_workspace").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
        if (u && u.length > 0) setUsuarios(u);
      }
      if (!admin) {
        const { data: cadastro } = await supabase.from("cadastros").select("usuarios_liberados").eq("email", user.email).single();
        if (cadastro) setLimites({ usuarios_liberados: cadastro.usuarios_liberados || 1 });
      }
    };
    init();
  }, []);

  const limiteAtingido = !isAdmin && usuarios.length >= limites.usuarios_liberados;

  const adicionarUsuario = async () => {
    if (!formUsuario.nome || !formUsuario.email) { alert("Preencha Nome e E-mail!"); return; }
    if (limiteAtingido) { alert(`❌ Limite de ${limites.usuarios_liberados} usuário(s) atingido!`); return; }
    const novoUsuario = { nome: formUsuario.nome, email: formUsuario.email, perfil: formUsuario.perfil, fila: formUsuario.fila, status: "offline", workspace_id: workspaceId };
    const { error } = await supabase.from("usuarios_workspace").insert([novoUsuario]);
    if (!error) setUsuarios([...usuarios, novoUsuario]);
    setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "" });
    setShowFormUsuario(false);
    alert("✅ Usuário adicionado!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>⚙️ Configurações do Workspace</h1>

      {/* USUÁRIOS */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>👥 Usuários</h2>
            {!isAdmin && <p style={{ color: limiteAtingido ? "#dc2626" : "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{usuarios.length}/{limites.usuarios_liberados} utilizados{limiteAtingido && " — Limite atingido!"}</p>}
          </div>
          <button onClick={() => { if (limiteAtingido) { alert(`❌ Limite de ${limites.usuarios_liberados} usuário(s) atingido!`); return; } setShowFormUsuario(!showFormUsuario); }}
            style={{ background: limiteAtingido ? "#374151" : "#3b82f6", color: limiteAtingido ? "#6b7280" : "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: limiteAtingido ? "not-allowed" : "pointer", fontWeight: "bold" }}>
            {limiteAtingido ? "🔒 Limite Atingido" : "+ Adicionar Usuário"}
          </button>
        </div>

        {!isAdmin && (
          <div style={{ padding: "8px 24px", background: "#0d0d0d", borderBottom: "1px solid #1f2937" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#9ca3af", fontSize: 11 }}>Usuários cadastrados</span>
              <span style={{ color: limiteAtingido ? "#dc2626" : "#16a34a", fontSize: 11, fontWeight: "bold" }}>{usuarios.length}/{limites.usuarios_liberados}</span>
            </div>
            <div style={{ background: "#1f2937", borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{ background: limiteAtingido ? "#dc2626" : "#16a34a", height: "100%", width: `${Math.min((usuarios.length / limites.usuarios_liberados) * 100, 100)}%`, transition: "width 0.3s", borderRadius: 4 }} />
            </div>
          </div>
        )}

        {showFormUsuario && !limiteAtingido && (
          <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formUsuario.nome} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail *</label><input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Perfil</label><select value={formUsuario.perfil} onChange={e => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={IS}><option value="Administrador">Administrador</option><option value="Supervisor">Supervisor</option><option value="Atendente">Atendente</option></select></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label><select value={formUsuario.fila} onChange={e => setFormUsuario({ ...formUsuario, fila: e.target.value })} style={IS}><option value="">Selecione...</option>{filas.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}</select></div>
              <div style={{ position: "relative" }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha</label><input type={showSenha ? "text" : "password"} placeholder="Senha" value={formUsuario.senha} onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...IS, paddingRight: 40 }} /><button onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14 }}>{showSenha ? "🙈" : "👁️"}</button></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowFormUsuario(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={adicionarUsuario} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
            </div>
          </div>
        )}

        {usuarios.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}><p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum usuário cadastrado ainda</p></div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#0d0d0d" }}>{["Nome", "E-mail", "Perfil", "Fila", "Status"].map(h => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
            <tbody>{usuarios.map((u, i) => (
              <tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                <td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{u.nome}</td>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.email}</td>
                <td style={{ padding: "14px 16px" }}><span style={{ background: u.perfil === "Administrador" ? "#f59e0b22" : u.perfil === "Supervisor" ? "#8b5cf622" : "#3b82f622", color: u.perfil === "Administrador" ? "#f59e0b" : u.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.perfil}</span></td>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.fila || "—"}</td>
                <td style={{ padding: "14px 16px" }}><span style={{ background: u.status === "online" ? "#16a34a22" : "#6b728022", color: u.status === "online" ? "#16a34a" : "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* FILAS */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>📋 Filas</h2>
          <button onClick={() => setShowFormFila(!showFormFila)} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Nova Fila</button>
        </div>
        {showFormFila && (
          <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d", display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome da Fila</label><input placeholder="Ex: Fila Vendas" value={formFila.nome} onChange={e => setFormFila({ ...formFila, nome: e.target.value })} style={IS} /></div>
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Conexão WhatsApp</label><input placeholder="Ex: WhatsApp 01" value={formFila.conexao} onChange={e => setFormFila({ ...formFila, conexao: e.target.value })} style={IS} /></div>
            <button onClick={() => { if (!formFila.nome) { alert("Digite o nome!"); return; } setFilas([...filas, { nome: formFila.nome, conexao: formFila.conexao, usuarios: 0 }]); setFormFila({ nome: "", conexao: "" }); setShowFormFila(false); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#0d0d0d" }}>{["Fila", "Conexão", "Usuários"].map(h => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
          <tbody>{filas.map((f, i) => (<tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{f.nome}</td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{f.conexao || "—"}</td><td style={{ padding: "14px 16px", color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>{f.usuarios}</td></tr>))}</tbody>
        </table>
      </div>

      {/* GRUPOS */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>🔒 Grupos de Permissão</h2>
          <button onClick={() => setShowFormGrupo(!showFormGrupo)} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Novo Grupo</button>
        </div>
        {showFormGrupo && (
          <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d", display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome</label><input placeholder="Ex: Grupo Vendas" value={formGrupo.nome} onChange={e => setFormGrupo({ ...formGrupo, nome: e.target.value })} style={IS} /></div>
            <div style={{ flex: 2 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Descrição</label><input placeholder="Ex: Acesso às vendas" value={formGrupo.descricao} onChange={e => setFormGrupo({ ...formGrupo, descricao: e.target.value })} style={IS} /></div>
            <button onClick={() => { if (!formGrupo.nome) { alert("Digite o nome!"); return; } setGrupos([...grupos, { nome: formGrupo.nome, descricao: formGrupo.descricao }]); setFormGrupo({ nome: "", descricao: "" }); setShowFormGrupo(false); }} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
          </div>
        )}
        <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {grupos.map((g, i) => (
            <div key={i} style={{ background: "#0d0d0d", borderRadius: 10, padding: "12px 20px", border: "1px solid #8b5cf633", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#8b5cf6" }} />
              <div>
                <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{g.nome}</p>
                <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{g.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}