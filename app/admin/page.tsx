"use client";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

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

  const inputStyle = {
    width: "100%", background: "#1f2937", border: "1px solid #374151",
    borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14,
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "Arial, sans-serif", padding: 32 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/logo1.png" alt="Wolf System" style={{ width: 60, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Painel Administrativo</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Wolf System — Gerencie os cadastros e usuários</p>
          </div>
        </div>
        <button onClick={() => setShowFormUsuario(true)} style={{
          background: "#3b82f6", color: "white", border: "none",
          borderRadius: 8, padding: "10px 20px", fontSize: 13,
          cursor: "pointer", fontWeight: "bold"
        }}>
          + Criar Usuário
        </button>
      </div>

      {/* Modal Criar Usuário */}
      {showFormUsuario && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000aa", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 520, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>👤 Criar Usuário</h2>
              <button onClick={() => setShowFormUsuario(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label>
                <input placeholder="Nome completo" value={formUsuario.nome} onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail *</label>
                <input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone</label>
                <input placeholder="+55 (62) 99999-9999" value={formUsuario.telefone} onChange={(e) => setFormUsuario({ ...formUsuario, telefone: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Perfil</label>
                <select value={formUsuario.perfil} onChange={(e) => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={inputStyle}>
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Atendente">Atendente</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Grupo de Permissão (Empresa)</label>
                <select value={formUsuario.grupo} onChange={(e) => setFormUsuario({ ...formUsuario, grupo: e.target.value })} style={inputStyle}>
                  <option value="">Selecione a empresa...</option>
                  {cadastros.filter(c => c.autorizado).map((c) => (
                    <option key={c.id} value={c.empresa}>{c.empresa} — {c.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{ position: "relative" }}>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha *</label>
                <input type={showSenha ? "text" : "password"} placeholder="Senha" value={formUsuario.senha} onChange={(e) => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...inputStyle, paddingRight: 40 }} />
                <button onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16 }}>{showSenha ? "🙈" : "👁️"}</button>
              </div>
              <div style={{ position: "relative" }}>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Confirmar Senha *</label>
                <input type={showConfirmar ? "text" : "password"} placeholder="Confirmar senha" value={formUsuario.confirmarSenha} onChange={(e) => setFormUsuario({ ...formUsuario, confirmarSenha: e.target.value })} style={{ ...inputStyle, paddingRight: 40 }} />
                <button onClick={() => setShowConfirmar(!showConfirmar)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16 }}>{showConfirmar ? "🙈" : "👁️"}</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setShowFormUsuario(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={criarUsuario} disabled={criandoUsuario} style={{ background: criandoUsuario ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: criandoUsuario ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                {criandoUsuario ? "Criando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total de cadastros", value: cadastros.length, color: "#16a34a" },
          { label: "Aguardando autorização", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b" },
          { label: "Autorizados", value: cadastros.filter(c => c.autorizado).length, color: "#3b82f6" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#111", borderRadius: 12, padding: "20px 24px", border: `1px solid ${stat.color}33`, flex: 1 }}>
            <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: 1 }}>{stat.label}</p>
            <p style={{ color: stat.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: 0 }}>Cadastros</h2>
          <button onClick={fetchCadastros} style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
            🔄 Atualizar
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#6b7280", padding: 24 }}>Carregando...</p>
        ) : cadastros.length === 0 ? (
          <p style={{ color: "#6b7280", padding: 24 }}>Nenhum cadastro ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d0d0d" }}>
                  {["Nome", "Empresa", "Email", "WhatsApp", "Plano", "IA", "Usuários", "Conexões", "Status", "Ações"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cadastros.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                    <td style={{ padding: "14px 16px", color: "white", fontSize: 13, whiteSpace: "nowrap" }}>{c.nome}</td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>{c.empresa}</td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>{c.email}</td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>{c.whatsapp}</td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>{c.plano}</td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>{c.ia}</td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>{c.usuarios}</td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>{c.conexoes}</td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span style={{
                        background: c.autorizado ? "#16a34a22" : "#f59e0b22",
                        color: c.autorizado ? "#16a34a" : "#f59e0b",
                        padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold"
                      }}>
                        {c.autorizado ? "✓ Autorizado" : "⏳ Pendente"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!c.autorizado && (
                          <button onClick={() => autorizar(c)} disabled={autorizando === c.id} style={{
                            background: autorizando === c.id ? "#15803d" : "#16a34a",
                            color: "white", border: "none", borderRadius: 8,
                            padding: "6px 12px", fontSize: 12,
                            cursor: autorizando === c.id ? "not-allowed" : "pointer",
                            fontWeight: "bold"
                          }}>
                            {autorizando === c.id ? "Autorizando..." : "Autorizar"}
                          </button>
                        )}
                        <button onClick={() => remover(c.id)} style={{
                          background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633",
                          borderRadius: 8, padding: "6px 12px", fontSize: 12,
                          cursor: "pointer", fontWeight: "bold"
                        }}>
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