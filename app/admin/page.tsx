"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Cadastro = {
  id: number;
  created_at: string;
  nome: string;
  empresa: string;
  cnpj: string;
  cpf: string;
  email: string;
  whatsapp: string;
  usuarios: string;
  conexoes: string;
  ia: string;
  plano: string;
  senha: string;
  autorizado: boolean;
};

type Usuario = {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  perfil: string;
  grupo: string;
  workspace_id: string;
  ativo: boolean;
};

export default function Admin() {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [autorizando, setAutorizando] = useState<number | null>(null);
  const [abaAdmin, setAbaAdmin] = useState("cadastros");
  const [showFormUsuario, setShowFormUsuario] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    confirmarSenha: "",
    perfil: "Atendente",
    grupo: "",
    workspace_id: "",
  });

  const fetchCadastros = async () => {
    const { data } = await supabase.from("cadastros").select("*").order("created_at", { ascending: false });
    setCadastros(data || []);
    setLoading(false);
  };

  const autorizar = async (cadastro: Cadastro) => {
    setAutorizando(cadastro.id);
    try {
      const response = await fetch("/api/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cadastro.id,
          email: cadastro.email,
          senha: cadastro.senha,
          nome: cadastro.nome,
          empresa: cadastro.empresa,
          plano: cadastro.plano,
          ia: cadastro.ia,
          usuarios: cadastro.usuarios,
          conexoes: cadastro.conexoes,
          username: (cadastro as any).username,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`✅ ${cadastro.nome} foi autorizado com sucesso!`);
        fetchCadastros();
      } else {
        if (result.error?.includes("already been registered")) {
          await supabase.from("cadastros").update({ autorizado: true }).eq("id", cadastro.id);
          alert(`✅ ${cadastro.nome} foi autorizado!`);
          fetchCadastros();
        } else {
          alert("Erro ao autorizar: " + result.error);
        }
      }
    } catch (error) {
      alert("Erro ao autorizar usuário!");
    }
    setAutorizando(null);
  };

  const remover = async (id: number) => {
    if (confirm("Tem certeza que deseja remover esse cadastro?")) {
      await supabase.from("cadastros").delete().eq("id", id);
      fetchCadastros();
    }
  };

  const criarUsuario = async () => {
    if (!formUsuario.nome || !formUsuario.email || !formUsuario.senha) {
      alert("Preencha Nome, E-mail e Senha!");
      return;
    }
    if (formUsuario.senha !== formUsuario.confirmarSenha) {
      alert("As senhas não coincidem!");
      return;
    }
    setCriandoUsuario(true);
    try {
      const response = await fetch("/api/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 0,
          email: formUsuario.email,
          senha: formUsuario.senha,
          nome: formUsuario.nome,
          empresa: formUsuario.grupo || formUsuario.nome,
          plano: formUsuario.perfil,
          ia: "",
          usuarios: "1",
          conexoes: "1",
          skipCadastro: true,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`✅ Usuário ${formUsuario.nome} criado com sucesso!`);
        setShowFormUsuario(false);
        setFormUsuario({ nome: "", email: "", telefone: "", senha: "", confirmarSenha: "", perfil: "Atendente", grupo: "", workspace_id: "" });
      } else {
        alert("Erro ao criar usuário: " + result.error);
      }
    } catch (error) {
      alert("Erro ao criar usuário!");
    }
    setCriandoUsuario(false);
  };

  useEffect(() => { fetchCadastros(); }, []);

  // 🎨 ESTILOS LIGHT TECH
  const inputStyle = {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#1f2937",
    fontSize: 14,
    boxSizing: "border-box" as const,
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Arial, sans-serif", padding: 32 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px rgba(31,41,55,0.25)",
            overflow: "hidden",
          }}>
            <img src="/logo1.png" alt="Wolf System" style={{ width: 40, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Painel Administrativo</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "2px 0 0" }}>Wolf System — Gerencie os cadastros e usuários</p>
          </div>
        </div>
        <button onClick={() => setShowFormUsuario(true)}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}>
          + Criar Usuário
        </button>
      </div>

      {/* ═══ MODAL CRIAR USUÁRIO ═══ */}
      {showFormUsuario && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{ ...cardStyle, padding: 28, width: "100%", maxWidth: 540, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
                }}>
                  <span style={{ filter: "saturate(0) brightness(2)" }}>👤</span>
                </div>
                <h2 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: 0 }}>Criar Usuário</h2>
              </div>
              <button onClick={() => setShowFormUsuario(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Nome *</label>
                <input placeholder="Nome completo" value={formUsuario.nome} onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>E-mail *</label>
                <input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Telefone</label>
                <input placeholder="+55 (62) 99999-9999" value={formUsuario.telefone} onChange={(e) => setFormUsuario({ ...formUsuario, telefone: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Perfil</label>
                <select value={formUsuario.perfil} onChange={(e) => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={inputStyle}>
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Atendente">Atendente</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Grupo de Permissão (Empresa)</label>
                <select value={formUsuario.grupo} onChange={(e) => setFormUsuario({ ...formUsuario, grupo: e.target.value })} style={inputStyle}>
                  <option value="">Selecione a empresa...</option>
                  {cadastros.filter(c => c.autorizado).map((c) => (
                    <option key={c.id} value={c.empresa}>{c.empresa} — {c.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{ position: "relative" }}>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Senha *</label>
                <input type={showSenha ? "text" : "password"} placeholder="Senha" value={formUsuario.senha} onChange={(e) => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...inputStyle, paddingRight: 40 }} />
                <button onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: 10, top: 32, background: "#f3f4f6", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>{showSenha ? "🙈" : "👁️"}</button>
              </div>
              <div style={{ position: "relative" }}>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Confirmar Senha *</label>
                <input type={showConfirmar ? "text" : "password"} placeholder="Confirmar senha" value={formUsuario.confirmarSenha} onChange={(e) => setFormUsuario({ ...formUsuario, confirmarSenha: e.target.value })} style={{ ...inputStyle, paddingRight: 40 }} />
                <button onClick={() => setShowConfirmar(!showConfirmar)} style={{ position: "absolute", right: 10, top: 32, background: "#f3f4f6", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>{showConfirmar ? "🙈" : "👁️"}</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setShowFormUsuario(false)}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={criarUsuario} disabled={criandoUsuario}
                style={{
                  background: criandoUsuario ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 24px", fontSize: 13,
                  cursor: criandoUsuario ? "not-allowed" : "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                }}>
                {criandoUsuario ? "Criando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STATS ═══ */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Total de cadastros", value: cadastros.length, color: "#16a34a", icon: "📊", gradient: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)" },
          { label: "Aguardando autorização", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b", icon: "⏳", gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)" },
          { label: "Autorizados", value: cadastros.filter(c => c.autorizado).length, color: "#3b82f6", icon: "✓", gradient: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" },
        ].map((stat) => (
          <div key={stat.label}
            style={{
              ...cardStyle,
              padding: 22,
              borderTop: `3px solid ${stat.color}`,
              flex: "1 1 220px",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 20px ${stat.color}20`; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: stat.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 4px 10px ${stat.color}30` }}>
                <span style={{ filter: "saturate(0) brightness(2)" }}>{stat.icon}</span>
              </div>
              <p style={{ color: "#6b7280", fontSize: 12, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{stat.label}</p>
            </div>
            <p style={{ color: stat.color, fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ TABELA ═══ */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: 0 }}>Cadastros</h2>
          <button onClick={fetchCadastros}
            style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 10, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
            🔄 Atualizar
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#6b7280", padding: 24 }}>Carregando...</p>
        ) : cadastros.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 10px" }}>📭</p>
            <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum cadastro ainda.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Nome", "Empresa", "Email", "WhatsApp", "Plano", "IA", "Usuários", "Conexões", "Status", "Ações"].map((h) => (
                    <th key={h} style={{
                      padding: "13px 16px", color: "#6b7280", fontSize: 11,
                      textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5,
                      whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #e5e7eb",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cadastros.map((c, i) => (
                  <tr key={c.id}
                    style={{
                      borderTop: "1px solid #f3f4f6",
                      background: i % 2 === 0 ? "#ffffff" : "#fafbfc",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                  >
                    <td style={{ padding: "14px 16px", color: "#1f2937", fontSize: 13, whiteSpace: "nowrap", fontWeight: 600 }}>{c.nome}</td>
                    <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: 13, whiteSpace: "nowrap" }}>{c.empresa}</td>
                    <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: 13, whiteSpace: "nowrap" }}>{c.email}</td>
                    <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: 13, whiteSpace: "nowrap", fontFamily: "monospace" }}>{c.whatsapp}</td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", fontSize: 11, padding: "3px 10px", borderRadius: 10, fontWeight: 600 }}>
                        {c.plano}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: 13, whiteSpace: "nowrap" }}>{c.ia || "—"}</td>
                    <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: 13, whiteSpace: "nowrap", textAlign: "center" }}>{c.usuarios}</td>
                    <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: 13, whiteSpace: "nowrap", textAlign: "center" }}>{c.conexoes}</td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span style={{
                        background: c.autorizado ? "#f0fdf4" : "#fffbeb",
                        color: c.autorizado ? "#16a34a" : "#f59e0b",
                        border: `1px solid ${c.autorizado ? "#bbf7d0" : "#fde68a"}`,
                        padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                      }}>
                        {c.autorizado ? "✓ Autorizado" : "⏳ Pendente"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!c.autorizado && (
                          <button onClick={() => autorizar(c)} disabled={autorizando === c.id}
                            style={{
                              background: autorizando === c.id ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                              color: "white", border: "none", borderRadius: 8,
                              padding: "6px 14px", fontSize: 12,
                              cursor: autorizando === c.id ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              boxShadow: autorizando === c.id ? "none" : "0 2px 8px rgba(22,163,74,0.25)",
                            }}>
                            {autorizando === c.id ? "Autorizando..." : "Autorizar"}
                          </button>
                        )}
                        <button onClick={() => remover(c.id)}
                          style={{
                            background: "#fef2f2", color: "#dc2626",
                            border: "1px solid #fecaca", borderRadius: 8,
                            padding: "6px 14px", fontSize: 12,
                            cursor: "pointer", fontWeight: 600,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#fee2e2"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#fef2f2"}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}