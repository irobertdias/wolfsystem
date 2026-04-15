"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";

type Proposta = {
  id: number;
  created_at: string;
  data_proposta: string;
  nome: string;
  vendedor: string;
  valor_plano: number;
  status_venda: string;
  operadora: string;
  plano: string;
  workspace_id: string;
};

const statusColor: Record<string, string> = {
  PENDENTE: "#f59e0b",
  "AGUARDANDO AUDITORIA": "#3b82f6",
  CANCELADA: "#dc2626",
  INSTALADA: "#16a34a",
  GERADA: "#8b5cf6",
  REPROVADA: "#ef4444",
};

export default function CRM() {
  const router = useRouter();
  const [aba, setAba] = useState("dashboard");
  const [filtro, setFiltro] = useState("diario");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [workspaceNome, setWorkspaceNome] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");

  const [showFormUsuario, setShowFormUsuario] = useState(false);
  const [showFormFila, setShowFormFila] = useState(false);
  const [showFormGrupo, setShowFormGrupo] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [roleta, setRoleta] = useState("balanceada");
  const [roletaAtiva, setRoletaAtiva] = useState(false);
  const [usuariosRoleta, setUsuariosRoleta] = useState<string[]>([]);
  const [showDropdownRoleta, setShowDropdownRoleta] = useState(false);

  const [usuarios, setUsuarios] = useState([
    { nome: "Ana Souza", email: "ana@empresa.com", perfil: "Atendente", fila: "Fila Principal", status: "online" },
    { nome: "Pedro Lima", email: "pedro@empresa.com", perfil: "Supervisor", fila: "Fila Suporte", status: "offline" },
  ]);

  const [filas, setFilas] = useState([
    { nome: "Fila Principal", conexao: "WhatsApp 01", usuarios: 2 },
    { nome: "Fila Suporte", conexao: "WhatsApp 02", usuarios: 1 },
  ]);

  const [grupos, setGrupos] = useState([
    { nome: "Grupo Vendas", descricao: "Acesso às vendas e propostas" },
    { nome: "Grupo Suporte", descricao: "Acesso apenas ao suporte" },
  ]);

  const [formUsuario, setFormUsuario] = useState({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "" });
  const [formFila, setFormFila] = useState({ nome: "", conexao: "" });
  const [formGrupo, setFormGrupo] = useState({ nome: "", descricao: "" });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUserEmail(user.email || "");
      const { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).single();
      if (ws) { setWorkspaceNome(ws.nome); setWorkspaceId(ws.id.toString()); fetchPropostas(ws.id.toString()); }
      else { setWorkspaceNome("Administrador"); setLoading(false); }
    };
    init();
  }, []);

  const fetchPropostas = async (wsId?: string) => {
    setLoading(true);
    const id = wsId || workspaceId;
    if (!id) { setLoading(false); return; }
    const { data } = await supabase.from("proposta").select("*").eq("workspace_id", id).order("created_at", { ascending: false });
    setPropostas(data || []);
    setLoading(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push("/"); };

  const hoje = new Date();
  const filtrarPorPeriodo = (lista: Proposta[]) => lista.filter(p => {
    const data = new Date(p.created_at);
    if (filtro === "diario") return data.toDateString() === hoje.toDateString();
    else if (filtro === "semanal") return (hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    else return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  });

  const propostasFiltradas = filtrarPorPeriodo(propostas);
  const totalReceita = propostasFiltradas.reduce((acc, p) => acc + (p.valor_plano || 0), 0);
  const totalInstaladas = propostasFiltradas.filter(p => p.status_venda === "INSTALADA").length;
  const totalGeradas = propostasFiltradas.filter(p => p.status_venda === "GERADA").length;
  const totalCanceladas = propostasFiltradas.filter(p => p.status_venda === "CANCELADA").length;
  const totalPendentes = propostasFiltradas.filter(p => p.status_venda === "PENDENTE").length;
  const totalAuditoria = propostasFiltradas.filter(p => p.status_venda === "AGUARDANDO AUDITORIA").length;

  const rankingVendedores = Object.entries(propostasFiltradas.reduce((acc: Record<string, number>, p) => { if (p.vendedor) acc[p.vendedor] = (acc[p.vendedor] || 0) + (p.valor_plano || 0); return acc; }, {})).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  const funilVendedores = Object.entries(propostasFiltradas.reduce((acc: Record<string, Record<string, number>>, p) => { if (!p.vendedor) return acc; if (!acc[p.vendedor]) acc[p.vendedor] = { INSTALADA: 0, GERADA: 0, CANCELADA: 0, PENDENTE: 0 }; if (acc[p.vendedor][p.status_venda] !== undefined) acc[p.vendedor][p.status_venda]++; return acc; }, {})).map(([vendedor, status]) => ({ vendedor, ...status }));

  const filtroLabel: Record<string, string> = { diario: "Hoje", semanal: "Esta Semana", mensal: "Este Mês" };
  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };

  const toggleUsuarioRoleta = (nome: string) => {
    setUsuariosRoleta(prev => prev.includes(nome) ? prev.filter(u => u !== nome) : [...prev, nome]);
  };

  const FiltroBotoes = () => (
    <div style={{ display: "flex", gap: 8 }}>
      {["diario", "semanal", "mensal"].map((f) => (
        <button key={f} onClick={() => setFiltro(f)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtro === f ? "#16a34a" : "#1f2937", color: filtro === f ? "white" : "#9ca3af" }}>{filtroLabel[f]}</button>
      ))}
    </div>
  );

  const menuItems = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "funil", icon: "🎯", label: "Funil de Vendas" },
    { key: "vendas", icon: "💰", label: "Vendas" },
    { key: "clientes", icon: "👥", label: "Clientes" },
    { key: "configuracoes", icon: "⚙️", label: "Configurações" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a" }}>

      {/* SIDEBAR */}
      <div style={{ width: 220, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", padding: 16, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 36, filter: "brightness(0) invert(1)" }} />
          <div>
            <span style={{ color: "white", fontWeight: "bold", fontSize: 13, display: "block" }}>Wolf CRM</span>
            <span style={{ color: "#16a34a", fontSize: 10 }}>{workspaceNome}</span>
          </div>
        </div>
        <div style={{ background: "#1f2937", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
          <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 2px 0" }}>Logado como</p>
          <p style={{ color: "white", fontSize: 11, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</p>
        </div>
        {menuItems.map((item) => (
          <button key={item.key} onClick={() => setAba(item.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: aba === item.key ? "#16a34a22" : "none", border: "none", borderRadius: 8, cursor: "pointer", color: aba === item.key ? "#16a34a" : "#9ca3af", fontSize: 13, fontWeight: aba === item.key ? "bold" : "normal", textAlign: "left" }}>
            <span>{item.icon}</span> {item.label}
          </button>
        ))}
        <div style={{ borderTop: "1px solid #1f2937", marginTop: 8, paddingTop: 8 }}>
          <button onClick={() => router.push("/chatbot")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#3b82f622", border: "1px solid #3b82f633", borderRadius: 8, cursor: "pointer", color: "#3b82f6", fontSize: 13, fontWeight: "bold", textAlign: "left", width: "100%" }}>
            <span>💬</span> Chatbot
          </button>
        </div>
        <div style={{ marginTop: "auto", borderTop: "1px solid #1f2937", paddingTop: 8 }}>
          <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#dc262622", border: "1px solid #dc262633", borderRadius: 8, cursor: "pointer", color: "#dc2626", fontSize: 13, fontWeight: "bold", textAlign: "left", width: "100%" }}>
            <span>🚪</span> Sair
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>

        {/* DASHBOARD */}
        {aba === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Dashboard</h1>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>Workspace: {workspaceNome}</p>
              </div>
              <FiltroBotoes />
            </div>
            {loading ? <p style={{ color: "#6b7280" }}>Carregando dados...</p> : (
              <>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "Total Receita", value: `R$ ${totalReceita.toLocaleString("pt-BR")}`, color: "#16a34a", icon: "💰" },
                    { label: "Instaladas", value: totalInstaladas, color: "#16a34a", icon: "✅" },
                    { label: "Geradas", value: totalGeradas, color: "#8b5cf6", icon: "📄" },
                    { label: "Pendentes", value: totalPendentes, color: "#f59e0b", icon: "⏳" },
                    { label: "Auditoria", value: totalAuditoria, color: "#3b82f6", icon: "🔍" },
                    { label: "Canceladas", value: totalCanceladas, color: "#dc2626", icon: "❌" },
                  ].map((card) => (
                    <div key={card.label} style={{ flex: "1 1 140px", background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px 0", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
                      <p style={{ color: card.color, fontSize: 26, fontWeight: "bold", margin: 0 }}>{card.value}</p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0 0" }}>{filtroLabel[filtro]}</p>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
                  <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 20px 0" }}>🏆 Ranking de Receita por Vendedor — {filtroLabel[filtro]}</h3>
                  {rankingVendedores.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhuma proposta neste período.</p> : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={rankingVendedores}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="nome" stroke="#6b7280" fontSize={12} />
                          <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                          <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8, color: "white" }} formatter={(value: any) => [`R$ ${value.toLocaleString("pt-BR")}`, "Receita"]} />
                          <Bar dataKey="valor" fill="#16a34a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                        {rankingVendedores.map((v, i) => (
                          <div key={v.nome} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d0d", borderRadius: 8, padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontWeight: "bold", fontSize: 16 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                              <span style={{ color: "white", fontSize: 14, fontWeight: "bold" }}>{v.nome}</span>
                            </div>
                            <span style={{ color: "#16a34a", fontSize: 14, fontWeight: "bold" }}>R$ {v.valor.toLocaleString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
                  <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 20px 0" }}>🎯 Funil por Vendedor — {filtroLabel[filtro]}</h3>
                  {funilVendedores.length === 0 ? <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhuma proposta neste período.</p> : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr style={{ background: "#0d0d0d" }}>{["Vendedor", "✅ Instaladas", "📄 Geradas", "⏳ Pendentes", "❌ Canceladas"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                      <tbody>{funilVendedores.map((v, i) => (<tr key={v.vendedor} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{v.vendedor}</td><td style={{ padding: "14px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>{(v as any).INSTALADA || 0}</td><td style={{ padding: "14px 16px", color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>{(v as any).GERADA || 0}</td><td style={{ padding: "14px 16px", color: "#f59e0b", fontSize: 13, fontWeight: "bold" }}>{(v as any).PENDENTE || 0}</td><td style={{ padding: "14px 16px", color: "#dc2626", fontSize: 13, fontWeight: "bold" }}>{(v as any).CANCELADA || 0}</td></tr>))}</tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* FUNIL */}
        {aba === "funil" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Funil de Vendas</h1>
              <FiltroBotoes />
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[{ stage: "Instaladas", count: totalInstaladas, color: "#16a34a" }, { stage: "Geradas", count: totalGeradas, color: "#8b5cf6" }, { stage: "Pendentes", count: totalPendentes, color: "#f59e0b" }, { stage: "Canceladas", count: totalCanceladas, color: "#dc2626" }].map((f) => (
                <div key={f.stage} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 24, border: `1px solid ${f.color}33`, textAlign: "center" }}>
                  <p style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", margin: "0 0 12px 0" }}>{f.stage}</p>
                  <p style={{ color: f.color, fontSize: 40, fontWeight: "bold", margin: 0 }}>{f.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VENDAS */}
        {aba === "vendas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Vendas</h1>
              <button onClick={() => router.push("/proposta")} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>📋 Nova Proposta</button>
            </div>
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#0d0d0d" }}>{["Cliente", "Vendedor", "Valor do Plano", "Status", "Data"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                <tbody>{loading ? <tr><td colSpan={5} style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>Carregando...</td></tr> : propostas.map((v, i) => (<tr key={v.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13 }}>{v.nome}</td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{v.vendedor}</td><td style={{ padding: "14px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>R$ {(v.valor_plano || 0).toLocaleString("pt-BR")}</td><td style={{ padding: "14px 16px" }}><span style={{ background: `${statusColor[v.status_venda] || "#6b7280"}22`, color: statusColor[v.status_venda] || "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{v.status_venda}</span></td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{v.data_proposta}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {aba === "clientes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Clientes</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {[...new Set(propostas.map(v => v.nome))].map((cliente) => {
                const vendasCliente = propostas.filter(v => v.nome === cliente);
                const total = vendasCliente.reduce((acc, v) => acc + (v.valor_plano || 0), 0);
                return (
                  <div key={cliente} style={{ background: "#111", borderRadius: 12, padding: 20, border: "1px solid #1f2937", width: 200 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#16a34a22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 12 }}>👤</div>
                    <p style={{ color: "white", fontWeight: "bold", fontSize: 14, margin: "0 0 4px 0" }}>{cliente}</p>
                    <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 8px 0" }}>{vendasCliente.length} proposta(s)</p>
                    <p style={{ color: "#16a34a", fontSize: 13, fontWeight: "bold", margin: 0 }}>R$ {total.toLocaleString("pt-BR")}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CONFIGURAÇÕES */}
        {aba === "configuracoes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>⚙️ Configurações do Workspace</h1>

            {/* USUÁRIOS */}
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>👥 Usuários</h2>
                <button onClick={() => setShowFormUsuario(!showFormUsuario)} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Adicionar Usuário</button>
              </div>
              {showFormUsuario && (
                <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formUsuario.nome} onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail *</label><input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone</label><input placeholder="+55 (62) 99999-9999" value={formUsuario.telefone} onChange={(e) => setFormUsuario({ ...formUsuario, telefone: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Perfil</label><select value={formUsuario.perfil} onChange={(e) => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={inputStyle}><option value="Administrador">Administrador</option><option value="Supervisor">Supervisor</option><option value="Atendente">Atendente</option></select></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila / Grupo</label><select value={formUsuario.fila} onChange={(e) => setFormUsuario({ ...formUsuario, fila: e.target.value })} style={inputStyle}><option value="">Selecione...</option>{filas.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}{grupos.map(g => <option key={g.nome} value={g.nome}>{g.nome}</option>)}</select></div>
                    <div style={{ position: "relative" }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha *</label><input type={showSenha ? "text" : "password"} placeholder="Senha" value={formUsuario.senha} onChange={(e) => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...inputStyle, paddingRight: 40 }} /><button onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14 }}>{showSenha ? "🙈" : "👁️"}</button></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowFormUsuario(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={() => { if (!formUsuario.nome || !formUsuario.email) { alert("Preencha Nome e E-mail!"); return; } setUsuarios([...usuarios, { nome: formUsuario.nome, email: formUsuario.email, perfil: formUsuario.perfil, fila: formUsuario.fila, status: "offline" }]); setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "" }); setShowFormUsuario(false); alert("✅ Usuário adicionado!"); }} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
                  </div>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#0d0d0d" }}>{["Nome", "E-mail", "Perfil", "Fila/Grupo", "Status"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                <tbody>{usuarios.map((u, i) => (<tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{u.nome}</td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.email}</td><td style={{ padding: "14px 16px" }}><span style={{ background: u.perfil === "Administrador" ? "#f59e0b22" : u.perfil === "Supervisor" ? "#8b5cf622" : "#3b82f622", color: u.perfil === "Administrador" ? "#f59e0b" : u.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.perfil}</span></td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.fila || "—"}</td><td style={{ padding: "14px 16px" }}><span style={{ background: u.status === "online" ? "#16a34a22" : "#6b728022", color: u.status === "online" ? "#16a34a" : "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span></td></tr>))}</tbody>
              </table>
            </div>

            {/* FILAS */}
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>📋 Filas</h2>
                <button onClick={() => setShowFormFila(!showFormFila)} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Nova Fila</button>
              </div>
              {showFormFila && (
                <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d", display: "flex", gap: 12, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome da Fila</label><input placeholder="Ex: Fila Claro" value={formFila.nome} onChange={(e) => setFormFila({ ...formFila, nome: e.target.value })} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Conexão WhatsApp</label><input placeholder="Ex: WhatsApp 01" value={formFila.conexao} onChange={(e) => setFormFila({ ...formFila, conexao: e.target.value })} style={inputStyle} /></div>
                  <button onClick={() => { if (!formFila.nome) { alert("Digite o nome da fila!"); return; } setFilas([...filas, { nome: formFila.nome, conexao: formFila.conexao, usuarios: 0 }]); setFormFila({ nome: "", conexao: "" }); setShowFormFila(false); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#0d0d0d" }}>{["Fila", "Conexão", "Usuários"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                <tbody>{filas.map((f, i) => (<tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{f.nome}</td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{f.conexao || "—"}</td><td style={{ padding: "14px 16px", color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>{f.usuarios}</td></tr>))}</tbody>
              </table>
            </div>

            {/* GRUPOS DE PERMISSÃO */}
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>🔒 Grupos de Permissão</h2>
                <button onClick={() => setShowFormGrupo(!showFormGrupo)} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Novo Grupo</button>
              </div>
              {showFormGrupo && (
                <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d", display: "flex", gap: 12, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome do Grupo</label><input placeholder="Ex: Grupo Claro" value={formGrupo.nome} onChange={(e) => setFormGrupo({ ...formGrupo, nome: e.target.value })} style={inputStyle} /></div>
                  <div style={{ flex: 2 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Descrição</label><input placeholder="Ex: Acesso apenas aos leads da Claro" value={formGrupo.descricao} onChange={(e) => setFormGrupo({ ...formGrupo, descricao: e.target.value })} style={inputStyle} /></div>
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

            {/* ROLETA DE DISTRIBUIÇÃO */}
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 24 }}>
              <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 20px 0" }}>🎯 Roleta de Distribuição</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>

                {/* Tipo */}
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Tipo de Distribuição</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {["balanceada", "ranqueada", "aleatoria"].map((tipo) => (
                      <label key={tipo} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: roleta === tipo ? "white" : "#9ca3af", fontSize: 13, background: roleta === tipo ? "#1f2937" : "none", padding: "8px 16px", borderRadius: 8, border: `1px solid ${roleta === tipo ? "#374151" : "transparent"}` }}>
                        <input type="radio" name="roleta" checked={roleta === tipo} onChange={() => setRoleta(tipo)} style={{ accentColor: "#16a34a" }} />
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Toggle ativar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1f2937", borderRadius: 8, padding: "14px 20px" }}>
                  <div>
                    <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>Ativar Roleta</p>
                    <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0 0" }}>Distribuir leads automaticamente</p>
                  </div>
                  <button onClick={() => setRoletaAtiva(!roletaAtiva)} style={{ width: 48, height: 26, background: roletaAtiva ? "#16a34a" : "#374151", borderRadius: 13, cursor: "pointer", border: "none", position: "relative" }}>
                    <div style={{ width: 20, height: 20, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: roletaAtiva ? 25 : 3, transition: "left 0.2s" }} />
                  </button>
                </div>

                {/* Dropdown usuários */}
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Usuários na Roleta</label>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setShowDropdownRoleta(!showDropdownRoleta)} style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: usuariosRoleta.length > 0 ? "white" : "#6b7280" }}>
                        {usuariosRoleta.length > 0 ? `${usuariosRoleta.length} usuário(s) selecionado(s)` : "Selecione os usuários..."}
                      </span>
                      <span style={{ color: "#6b7280" }}>▼</span>
                    </button>
                    {showDropdownRoleta && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, zIndex: 100, marginTop: 4, overflow: "hidden" }}>
                        {usuarios.map((u) => (
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
                      {usuariosRoleta.map((u) => (
                        <span key={u} style={{ background: "#16a34a22", color: "#16a34a", fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #16a34a33" }}>✓ {u}</span>
                      ))}
                    </div>
                  )}
                </div>

                <button style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar Configurações</button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}