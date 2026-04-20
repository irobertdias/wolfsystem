"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const ADMIN_EMAIL = "robert.dias@live.com";

export default function Configuracoes() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [limites, setLimites] = useState({ usuarios_liberados: 9999 });
  const [usuarios, setUsuarios] = useState<{ nome: string; email: string; perfil: string; fila: string; status: string }[]>([]);
  const [filas, setFilas] = useState([
    { nome: "Fila Principal", conexao: "WhatsApp 01", usuarios: 2 },
    { nome: "Fila Suporte", conexao: "WhatsApp 02", usuarios: 1 },
  ]);
  const [grupos, setGrupos] = useState([
    { nome: "Grupo Vendas", descricao: "Acesso às vendas e propostas" },
    { nome: "Grupo Suporte", descricao: "Acesso apenas ao suporte" },
  ]);
  const [showFormUsuario, setShowFormUsuario] = useState(false);
  const [showFormFila, setShowFormFila] = useState(false);
  const [showFormGrupo, setShowFormGrupo] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [roleta, setRoleta] = useState("balanceada");
  const [roletaAtiva, setRoletaAtiva] = useState(false);
  const [usuariosRoleta, setUsuariosRoleta] = useState<string[]>([]);
  const [showDropdownRoleta, setShowDropdownRoleta] = useState(false);
  const [formUsuario, setFormUsuario] = useState({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "" });
  const [formFila, setFormFila] = useState({ nome: "", conexao: "" });
  const [formGrupo, setFormGrupo] = useState({ nome: "", descricao: "" });

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };

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
  const toggleUsuarioRoleta = (nome: string) => setUsuariosRoleta(prev => prev.includes(nome) ? prev.filter(u => u !== nome) : [...prev, nome]);

  const adicionarUsuario = async () => {
    if (!formUsuario.nome || !formUsuario.email || !formUsuario.senha) { alert("Preencha Nome, E-mail e Senha!"); return; }
    if (limiteAtingido) { alert(`❌ Limite de ${limites.usuarios_liberados} usuário(s) atingido!`); return; }
    try {
      // 1. Cria no Supabase Auth via API
      const resp = await fetch("/api/criar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formUsuario.email,
          senha: formUsuario.senha,
          nome: formUsuario.nome,
          workspace_id: workspaceId,
          perfil: formUsuario.perfil,
          fila: formUsuario.fila,
        }),
      });
      const data = await resp.json();
      if (!data.success) { alert("Erro ao criar usuário: " + data.error); return; }
      await fetchUsuarios(workspaceId);
      setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "" });
      setShowFormUsuario(false);
      alert("✅ Usuário adicionado!");
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>⚙️ Configurações do Workspace</h1>

      {/* USUÁRIOS */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>👥 Usuários</h2>
            {!isAdmin && <p style={{ color: limiteAtingido ? "#dc2626" : "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>{usuarios.length}/{limites.usuarios_liberados} usuários utilizados{limiteAtingido && " — Limite atingido!"}</p>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {limiteAtingido && <span style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: "bold" }}>🔒 Limite atingido</span>}
            <button onClick={() => { if (limiteAtingido) { alert(`❌ Você atingiu o limite de ${limites.usuarios_liberados} usuário(s) do seu plano.\n\nEntre em contato com o suporte para aumentar seu limite:\n📱 WhatsApp: (62) 99999-9999`); return; } setShowFormUsuario(!showFormUsuario); }}
              style={{ background: limiteAtingido ? "#374151" : "#3b82f6", color: limiteAtingido ? "#6b7280" : "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: limiteAtingido ? "not-allowed" : "pointer", fontWeight: "bold" }}>
              {limiteAtingido ? "🔒 Limite Atingido" : "+ Adicionar Usuário"}
            </button>
          </div>
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
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formUsuario.nome} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail *</label><input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone</label><input placeholder="+55 (62) 99999-9999" value={formUsuario.telefone} onChange={e => setFormUsuario({ ...formUsuario, telefone: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Perfil</label><select value={formUsuario.perfil} onChange={e => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={inputStyle}><option value="Administrador">Administrador</option><option value="Supervisor">Supervisor</option><option value="Atendente">Atendente</option></select></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila / Grupo</label><select value={formUsuario.fila} onChange={e => setFormUsuario({ ...formUsuario, fila: e.target.value })} style={inputStyle}><option value="">Selecione...</option>{filas.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}{grupos.map(g => <option key={g.nome} value={g.nome}>{g.nome}</option>)}</select></div>
              <div style={{ position: "relative" }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha *</label><input type={showSenha ? "text" : "password"} placeholder="Senha" value={formUsuario.senha} onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...inputStyle, paddingRight: 40 }} /><button onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14 }}>{showSenha ? "🙈" : "👁️"}</button></div>
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
            <thead><tr style={{ background: "#0d0d0d" }}>{["Nome", "E-mail", "Perfil", "Fila/Grupo", "Status"].map(h => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
            <tbody>{usuarios.map((u, i) => (<tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{u.nome}</td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.email}</td><td style={{ padding: "14px 16px" }}><span style={{ background: u.perfil === "Administrador" ? "#f59e0b22" : u.perfil === "Supervisor" ? "#8b5cf622" : "#3b82f622", color: u.perfil === "Administrador" ? "#f59e0b" : u.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.perfil}</span></td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.fila || "—"}</td><td style={{ padding: "14px 16px" }}><span style={{ background: u.status === "online" ? "#16a34a22" : "#6b728022", color: u.status === "online" ? "#16a34a" : "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span></td></tr>))}</tbody>
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
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome da Fila</label><input placeholder="Ex: Fila Claro" value={formFila.nome} onChange={e => setFormFila({ ...formFila, nome: e.target.value })} style={inputStyle} /></div>
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Conexão WhatsApp</label><input placeholder="Ex: WhatsApp 01" value={formFila.conexao} onChange={e => setFormFila({ ...formFila, conexao: e.target.value })} style={inputStyle} /></div>
            <button onClick={() => { if (!formFila.nome) { alert("Digite o nome da fila!"); return; } setFilas([...filas, { nome: formFila.nome, conexao: formFila.conexao, usuarios: 0 }]); setFormFila({ nome: "", conexao: "" }); setShowFormFila(false); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
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
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome do Grupo</label><input placeholder="Ex: Grupo Claro" value={formGrupo.nome} onChange={e => setFormGrupo({ ...formGrupo, nome: e.target.value })} style={inputStyle} /></div>
            <div style={{ flex: 2 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Descrição</label><input placeholder="Ex: Acesso apenas aos leads da Claro" value={formGrupo.descricao} onChange={e => setFormGrupo({ ...formGrupo, descricao: e.target.value })} style={inputStyle} /></div>
            <button onClick={() => { if (!formGrupo.nome) { alert("Digite o nome do grupo!"); return; } setGrupos([...grupos, { nome: formGrupo.nome, descricao: formGrupo.descricao }]); setFormGrupo({ nome: "", descricao: "" }); setShowFormGrupo(false); }} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
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

      {/* ROLETA */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 24 }}>
        <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 20px 0" }}>🎯 Roleta de Distribuição</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Tipo de Distribuição</label>
            <div style={{ display: "flex", gap: 12 }}>
              {["balanceada", "ranqueada", "aleatoria"].map(tipo => (
                <label key={tipo} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: roleta === tipo ? "white" : "#9ca3af", fontSize: 13, background: roleta === tipo ? "#1f2937" : "none", padding: "8px 16px", borderRadius: 8, border: `1px solid ${roleta === tipo ? "#374151" : "transparent"}` }}>
                  <input type="radio" name="roleta" checked={roleta === tipo} onChange={() => setRoleta(tipo)} style={{ accentColor: "#16a34a" }} />
                  {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1f2937", borderRadius: 8, padding: "14px 20px" }}>
            <div>
              <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>Ativar Roleta</p>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0 0" }}>Distribuir leads automaticamente</p>
            </div>
            <button onClick={() => setRoletaAtiva(!roletaAtiva)} style={{ width: 48, height: 26, background: roletaAtiva ? "#16a34a" : "#374151", borderRadius: 13, cursor: "pointer", border: "none", position: "relative" }}>
              <div style={{ width: 20, height: 20, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: roletaAtiva ? 25 : 3, transition: "left 0.2s" }} />
            </button>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Usuários na Roleta</label>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowDropdownRoleta(!showDropdownRoleta)} style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: usuariosRoleta.length > 0 ? "white" : "#6b7280" }}>{usuariosRoleta.length > 0 ? `${usuariosRoleta.length} usuário(s) selecionado(s)` : "Selecione os usuários..."}</span>
                <span style={{ color: "#6b7280" }}>▼</span>
              </button>
              {showDropdownRoleta && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, zIndex: 100, marginTop: 4, overflow: "hidden" }}>
                  {usuarios.map(u => (
                    <label key={u.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #374151", background: usuariosRoleta.includes(u.nome) ? "#16a34a11" : "transparent" }}>
                      <input type="checkbox" checked={usuariosRoleta.includes(u.nome)} onChange={() => toggleUsuarioRoleta(u.nome)} style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
                      <div>
                        <p style={{ color: "white", fontSize: 13, margin: 0, fontWeight: "bold" }}>{u.nome}</p>
                        <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{u.fila || "Sem fila"}</p>
                      </div>
                    </label>
                  ))}
                  <div style={{ padding: "8px 14px" }}>
                    <button onClick={() => setShowDropdownRoleta(false)} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, cursor: "pointer", width: "100%", fontWeight: "bold" }}>Confirmar</button>
                  </div>
                </div>
              )}
            </div>
            {usuariosRoleta.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {usuariosRoleta.map(u => (<span key={u} style={{ background: "#16a34a22", color: "#16a34a", fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #16a34a33" }}>✓ {u}</span>))}
              </div>
            )}
          </div>
          <button style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar Configurações</button>
        </div>
      </div>
    </div>
  );
}