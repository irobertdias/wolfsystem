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

type Cadastro = {
  id: number;
  created_at: string;
  nome: string;
  empresa: string;
  email: string;
  whatsapp: string;
  plano: string;
  autorizado: boolean;
  workspace_id: string;
  usuarios_liberados?: number;
  conexoes_liberadas?: number;
  permite_webjs?: boolean;
  permite_waba?: boolean;
  permite_instagram?: boolean;
  ia?: string;
  senha?: string;
};

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

const statusColor: Record<string, string> = {
  PENDENTE: "#f59e0b",
  "AGUARDANDO AUDITORIA": "#3b82f6",
  CANCELADA: "#dc2626",
  INSTALADA: "#16a34a",
  GERADA: "#8b5cf6",
  REPROVADA: "#ef4444",
};

const ADMIN_EMAIL = "robertdias.ads@gmail.com";

const planoPresets: Record<string, { usuarios: number; conexoes: number; webjs: boolean; waba: boolean; instagram: boolean }> = {
  basico:        { usuarios: 7,  conexoes: 1,  webjs: true,  waba: false, instagram: false },
  intermediario: { usuarios: 15, conexoes: 3,  webjs: true,  waba: true,  instagram: false },
  ultra:         { usuarios: 50, conexoes: 10, webjs: true,  waba: true,  instagram: true  },
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
  const [isAdmin, setIsAdmin] = useState(false);

  // Limites do cliente logado
  const [limites, setLimites] = useState({
    usuarios_liberados: 9999,
    conexoes_liberadas: 9999,
    permite_webjs: true,
    permite_waba: true,
    permite_instagram: true,
  });

  const [showFormUsuario, setShowFormUsuario] = useState(false);
  const [showFormFila, setShowFormFila] = useState(false);
  const [showFormGrupo, setShowFormGrupo] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [roleta, setRoleta] = useState("balanceada");
  const [roletaAtiva, setRoletaAtiva] = useState(false);
  const [usuariosRoleta, setUsuariosRoleta] = useState<string[]>([]);
  const [showDropdownRoleta, setShowDropdownRoleta] = useState(false);

  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingCadastros, setLoadingCadastros] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaContato, setBuscaContato] = useState("");
  const [showModalCliente, setShowModalCliente] = useState(false);
  const [showModalDetalhe, setShowModalDetalhe] = useState(false);
  const [cadastroSelecionado, setCadastroSelecionado] = useState<Cadastro | null>(null);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [formCadastro, setFormCadastro] = useState<Partial<Cadastro>>({
    nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
    usuarios_liberados: 7, conexoes_liberadas: 1,
    permite_webjs: true, permite_waba: false, permite_instagram: false,
    ia: "gpt", autorizado: false, senha: "",
  });

  const [usuarios, setUsuarios] = useState<{ nome: string; email: string; perfil: string; fila: string; status: string }[]>([]);
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
      const admin = user.email === ADMIN_EMAIL;
      if (admin) setIsAdmin(true);

      // Busca limites do cliente logado
      if (!admin) {
        const { data: cadastro } = await supabase
          .from("cadastros")
          .select("usuarios_liberados, conexoes_liberadas, permite_webjs, permite_waba, permite_instagram")
          .eq("email", user.email)
          .single();
        if (cadastro) {
          setLimites({
            usuarios_liberados: cadastro.usuarios_liberados || 1,
            conexoes_liberadas: cadastro.conexoes_liberadas || 1,
            permite_webjs: cadastro.permite_webjs ?? true,
            permite_waba: cadastro.permite_waba ?? false,
            permite_instagram: cadastro.permite_instagram ?? false,
          });
        }
      }

      const { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).single();
      if (ws) {
        setWorkspaceNome(ws.nome);
        setWorkspaceId(ws.id.toString());
        fetchPropostas(ws.id.toString());
        fetchAtendimentos(ws.id.toString());
        fetchUsuarios(ws.id.toString());
      } else {
        setWorkspaceNome("Administrador");
        setLoading(false);
      }
      fetchCadastros();
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

  const fetchCadastros = async () => {
    setLoadingCadastros(true);
    const { data } = await supabase.from("cadastros").select("*").order("created_at", { ascending: false });
    setCadastros(data || []);
    setLoadingCadastros(false);
  };

  const fetchAtendimentos = async (wsId?: string) => {
    const id = wsId || workspaceId;
    if (!id) return;
    const { data } = await supabase.from("atendimentos").select("*").eq("workspace_id", id).order("created_at", { ascending: false });
    setAtendimentos(data || []);
  };

  const fetchUsuarios = async (wsId?: string) => {
    const id = wsId || workspaceId;
    if (!id) return;
    const { data } = await supabase.from("usuarios_workspace").select("*").eq("workspace_id", id).order("created_at", { ascending: false });
    if (data && data.length > 0) setUsuarios(data);
  };

  const adicionarUsuario = async () => {
    if (!formUsuario.nome || !formUsuario.email) { alert("Preencha Nome e E-mail!"); return; }

    // Verifica limite
    if (!isAdmin && usuarios.length >= limites.usuarios_liberados) {
      alert(`❌ Limite de ${limites.usuarios_liberados} usuário(s) atingido!\n\nEntre em contato com o suporte para aumentar seu limite.`);
      return;
    }

    try {
      const novoUsuario = {
        nome: formUsuario.nome,
        email: formUsuario.email,
        perfil: formUsuario.perfil,
        fila: formUsuario.fila,
        status: "offline",
        workspace_id: workspaceId,
      };

      // Tenta salvar no banco se a tabela existir
      const { error } = await supabase.from("usuarios_workspace").insert([novoUsuario]);
      if (!error) {
        setUsuarios([...usuarios, novoUsuario]);
      } else {
        // Fallback local se tabela não existir
        setUsuarios([...usuarios, novoUsuario]);
      }
    } catch {
      setUsuarios([...usuarios, { nome: formUsuario.nome, email: formUsuario.email, perfil: formUsuario.perfil, fila: formUsuario.fila, status: "offline" }]);
    }

    setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "" });
    setShowFormUsuario(false);
    alert("✅ Usuário adicionado!");
  };

  const autorizarCadastro = async (c: Cadastro) => {
    try {
      await supabase.from("cadastros").update({ autorizado: true }).eq("id", c.id);
      await fetchCadastros();
      alert(`✅ ${c.nome} autorizado!`);
    } catch { alert("Erro ao autorizar!"); }
  };

  const desautorizarCadastro = async (c: Cadastro) => {
    if (!confirm(`Desautorizar ${c.nome}?`)) return;
    await supabase.from("cadastros").update({ autorizado: false }).eq("id", c.id);
    await fetchCadastros();
  };

  const excluirCadastro = async (c: Cadastro) => {
    if (!confirm(`Excluir ${c.nome} permanentemente?`)) return;
    await supabase.from("cadastros").delete().eq("id", c.id);
    await fetchCadastros();
    setShowModalDetalhe(false);
    alert("✅ Cliente excluído!");
  };

  const abrirNovo = () => {
    setFormCadastro({
      nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
      usuarios_liberados: 7, conexoes_liberadas: 1,
      permite_webjs: true, permite_waba: false, permite_instagram: false,
      ia: "gpt", autorizado: false, senha: "",
    });
    setCadastroSelecionado(null);
    setShowModalCliente(true);
  };

  const abrirEditar = (c: Cadastro) => {
    setFormCadastro({ ...c });
    setCadastroSelecionado(c);
    setShowModalCliente(true);
    setShowModalDetalhe(false);
  };

  const aplicarPresetPlano = (plano: string) => {
    const preset = planoPresets[plano];
    if (preset) {
      setFormCadastro(prev => ({
        ...prev, plano,
        usuarios_liberados: preset.usuarios,
        conexoes_liberadas: preset.conexoes,
        permite_webjs: preset.webjs,
        permite_waba: preset.waba,
        permite_instagram: preset.instagram,
      }));
    } else {
      setFormCadastro(prev => ({ ...prev, plano }));
    }
  };

  const salvarCadastro = async () => {
    if (!formCadastro.nome || !formCadastro.email) { alert("Nome e email são obrigatórios!"); return; }
    setSalvandoCliente(true);
    try {
      const dadosSalvar = {
        nome: formCadastro.nome, empresa: formCadastro.empresa,
        email: formCadastro.email, whatsapp: formCadastro.whatsapp,
        plano: formCadastro.plano,
        usuarios_liberados: formCadastro.usuarios_liberados,
        conexoes_liberadas: formCadastro.conexoes_liberadas,
        permite_webjs: formCadastro.permite_webjs,
        permite_waba: formCadastro.permite_waba,
        permite_instagram: formCadastro.permite_instagram,
        ia: formCadastro.ia, autorizado: formCadastro.autorizado,
      };
      if (cadastroSelecionado) {
        await supabase.from("cadastros").update(dadosSalvar).eq("id", cadastroSelecionado.id);
        alert("✅ Cliente atualizado!");
      } else {
        await supabase.from("cadastros").insert([{ ...dadosSalvar, senha: formCadastro.senha }]);
        alert("✅ Cliente adicionado!");
      }
      await fetchCadastros();
      setShowModalCliente(false);
    } catch { alert("Erro ao salvar!"); }
    setSalvandoCliente(false);
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

  const cadastrosFiltrados = cadastros
    .filter(c => filtroStatus === "todos" || (filtroStatus === "ativos" ? c.autorizado : !c.autorizado))
    .filter(c => !buscaCliente || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.email?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.empresa?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.whatsapp?.includes(buscaCliente));

  const contatosFiltrados = atendimentos.filter(a => !buscaContato || a.nome?.toLowerCase().includes(buscaContato.toLowerCase()) || a.numero?.includes(buscaContato));

  const limiteAtingido = !isAdmin && usuarios.length >= limites.usuarios_liberados;

  const filtroLabel: Record<string, string> = { diario: "Hoje", semanal: "Esta Semana", mensal: "Este Mês" };
  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };
  const inputSm = { ...inputStyle, padding: "8px 12px", fontSize: 13 };

  const toggleUsuarioRoleta = (nome: string) => setUsuariosRoleta(prev => prev.includes(nome) ? prev.filter(u => u !== nome) : [...prev, nome]);

  const FiltroBotoes = () => (
    <div style={{ display: "flex", gap: 8 }}>
      {["diario", "semanal", "mensal"].map((f) => (
        <button key={f} onClick={() => setFiltro(f)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtro === f ? "#16a34a" : "#1f2937", color: filtro === f ? "white" : "#9ca3af" }}>{filtroLabel[f]}</button>
      ))}
    </div>
  );

  const Toggle = ({ value, onChange, label, desc, color = "#16a34a" }: { value: boolean; onChange: () => void; label: string; desc?: string; color?: string }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", borderRadius: 8, padding: "12px 16px", border: "1px solid #374151" }}>
      <div>
        <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{label}</p>
        {desc && <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0 0" }}>{desc}</p>}
      </div>
      <button onClick={onChange} style={{ width: 44, height: 24, background: value ? color : "#374151", borderRadius: 12, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s" }} />
      </button>
    </div>
  );

  const menuItems = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "funil", icon: "🎯", label: "Funil de Vendas" },
    { key: "vendas", icon: "💰", label: "Vendas" },
    ...(isAdmin ? [{ key: "clientes", icon: "👥", label: "Clientes Wolf" }] : [{ key: "contatos", icon: "👥", label: "Contatos" }]),
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
        {!isAdmin && (
          <div style={{ background: "#1f293788", borderRadius: 8, padding: "8px 12px", marginBottom: 4 }}>
            <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 2px 0" }}>Plano</p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold" }}>👥 {usuarios.length}/{limites.usuarios_liberados} usuários</span>
            </div>
          </div>
        )}
        {menuItems.map((item) => (
          <button key={item.key} onClick={() => setAba(item.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: aba === item.key ? "#16a34a22" : "none", border: "none", borderRadius: 8, cursor: "pointer", color: aba === item.key ? "#16a34a" : "#9ca3af", fontSize: 13, fontWeight: aba === item.key ? "bold" : "normal", textAlign: "left" }}>
            <span>{item.icon}</span> {item.label}
            {item.key === "clientes" && cadastros.length > 0 && <span style={{ background: "#16a34a", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: "auto" }}>{cadastros.length}</span>}
            {item.key === "contatos" && atendimentos.length > 0 && <span style={{ background: "#3b82f6", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: "auto" }}>{atendimentos.length}</span>}
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

        {/* CLIENTES WOLF - Só Admin */}
        {aba === "clientes" && isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {showModalCliente && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 680, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado ? "✏️ Editar Cliente" : "➕ Novo Cliente Wolf"}</h2>
                    <button onClick={() => setShowModalCliente(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                  </div>
                  <div>
                    <p style={{ color: "#16a34a", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>👤 Dados Pessoais</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formCadastro.nome || ""} onChange={(e) => setFormCadastro({ ...formCadastro, nome: e.target.value })} style={inputSm} /></div>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Empresa</label><input placeholder="Nome da empresa" value={formCadastro.empresa || ""} onChange={(e) => setFormCadastro({ ...formCadastro, empresa: e.target.value })} style={inputSm} /></div>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Email *</label><input placeholder="email@empresa.com" value={formCadastro.email || ""} onChange={(e) => setFormCadastro({ ...formCadastro, email: e.target.value })} style={inputSm} /></div>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>WhatsApp</label><input placeholder="(62) 99999-9999" value={formCadastro.whatsapp || ""} onChange={(e) => setFormCadastro({ ...formCadastro, whatsapp: e.target.value })} style={inputSm} /></div>
                      {!cadastroSelecionado && (<div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha</label><input type="password" placeholder="Senha de acesso" value={formCadastro.senha || ""} onChange={(e) => setFormCadastro({ ...formCadastro, senha: e.target.value })} style={inputSm} /></div>)}
                    </div>
                  </div>
                  <div>
                    <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>📦 Plano</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ key: "basico", label: "Básico", color: "#16a34a", usuarios: 7, conexoes: 1 }, { key: "intermediario", label: "Intermediário", color: "#3b82f6", usuarios: 15, conexoes: 3 }, { key: "ultra", label: "Ultra", color: "#8b5cf6", usuarios: 50, conexoes: 10 }].map((p) => (
                        <button key={p.key} onClick={() => aplicarPresetPlano(p.key)} style={{ flex: 1, background: formCadastro.plano === p.key ? `${p.color}22` : "#1f2937", border: `2px solid ${formCadastro.plano === p.key ? p.color : "#374151"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center" }}>
                          <p style={{ color: formCadastro.plano === p.key ? p.color : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>{p.label}</p>
                          <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{p.usuarios} usuários • {p.conexoes} conexões</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>⚙️ Limites Personalizados</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>👥 Usuários Liberados</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[1, 3, 5, 7, 10, 15, 20, 50].map(n => (
                            <button key={n} onClick={() => setFormCadastro({ ...formCadastro, usuarios_liberados: n })} style={{ background: formCadastro.usuarios_liberados === n ? "#f59e0b" : "#1f2937", color: formCadastro.usuarios_liberados === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{n}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>📱 Conexões Liberadas</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[1, 2, 3, 5, 10, 15, 20].map(n => (
                            <button key={n} onClick={() => setFormCadastro({ ...formCadastro, conexoes_liberadas: n })} style={{ background: formCadastro.conexoes_liberadas === n ? "#3b82f6" : "#1f2937", color: formCadastro.conexoes_liberadas === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{n}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>🔗 Tipos de Conexão Permitidos</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Toggle value={!!formCadastro.permite_webjs} onChange={() => setFormCadastro({ ...formCadastro, permite_webjs: !formCadastro.permite_webjs })} label="📱 WhatsApp Web (QR Code)" desc="Conexão via QR Code — gratuita" color="#16a34a" />
                      <Toggle value={!!formCadastro.permite_waba} onChange={() => setFormCadastro({ ...formCadastro, permite_waba: !formCadastro.permite_waba })} label="🔗 API Meta (WABA)" desc="API oficial do WhatsApp Business" color="#3b82f6" />
                      <Toggle value={!!formCadastro.permite_instagram} onChange={() => setFormCadastro({ ...formCadastro, permite_instagram: !formCadastro.permite_instagram })} label="📸 Instagram Direct" desc="Mensagens do Instagram Direct" color="#e1306c" />
                    </div>
                  </div>
                  <Toggle value={!!formCadastro.autorizado} onChange={() => setFormCadastro({ ...formCadastro, autorizado: !formCadastro.autorizado })} label="✅ Autorizado — Permitir acesso ao sistema" color="#16a34a" />
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowModalCliente(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={salvarCadastro} disabled={salvandoCliente} style={{ background: salvandoCliente ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{salvandoCliente ? "Salvando..." : "💾 Salvar"}</button>
                  </div>
                </div>
              </div>
            )}

            {showModalDetalhe && cadastroSelecionado && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 620, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 56, height: 56, borderRadius: "50%", background: cadastroSelecionado.autorizado ? "#16a34a22" : "#f59e0b22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏢</div>
                      <div>
                        <h2 style={{ color: "white", fontSize: 20, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado.nome}</h2>
                        <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>{cadastroSelecionado.empresa || "Sem empresa"}</p>
                        <span style={{ background: cadastroSelecionado.autorizado ? "#16a34a22" : "#f59e0b22", color: cadastroSelecionado.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{cadastroSelecionado.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span>
                      </div>
                    </div>
                    <button onClick={() => setShowModalDetalhe(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[{ label: "Email", value: cadastroSelecionado.email, icon: "✉️" }, { label: "WhatsApp", value: cadastroSelecionado.whatsapp, icon: "📱" }, { label: "Plano", value: cadastroSelecionado.plano, icon: "📦" }, { label: "IA", value: cadastroSelecionado.ia, icon: "🤖" }].filter(i => i.value).map((info) => (
                      <div key={info.label} style={{ background: "#1f2937", borderRadius: 8, padding: 12 }}>
                        <p style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", margin: "0 0 4px 0" }}>{info.icon} {info.label}</p>
                        <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{info.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#1f2937", borderRadius: 10, padding: 16 }}>
                    <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>⚙️ Limites do Plano</p>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ flex: 1, textAlign: "center", background: "#111", borderRadius: 8, padding: 12 }}>
                        <p style={{ color: "#f59e0b", fontSize: 28, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado.usuarios_liberados || 1}</p>
                        <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>👥 Usuários</p>
                      </div>
                      <div style={{ flex: 1, textAlign: "center", background: "#111", borderRadius: 8, padding: 12 }}>
                        <p style={{ color: "#3b82f6", fontSize: 28, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado.conexoes_liberadas || 1}</p>
                        <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>📱 Conexões</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#1f2937", borderRadius: 10, padding: 16 }}>
                    <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>🔗 Conexões Permitidas</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ key: "permite_webjs", label: "📱 WhatsApp Web", color: "#16a34a" }, { key: "permite_waba", label: "🔗 API Meta", color: "#3b82f6" }, { key: "permite_instagram", label: "📸 Instagram", color: "#e1306c" }].map((item) => (
                        <span key={item.key} style={{ background: (cadastroSelecionado as any)[item.key] ? `${item.color}22` : "#11111133", color: (cadastroSelecionado as any)[item.key] ? item.color : "#6b7280", border: `1px solid ${(cadastroSelecionado as any)[item.key] ? item.color + "44" : "#374151"}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: "bold" }}>
                          {(cadastroSelecionado as any)[item.key] ? "✓" : "✗"} {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {!cadastroSelecionado.autorizado ? (
                      <button onClick={() => { autorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✅ Autorizar Acesso</button>
                    ) : (
                      <button onClick={() => { desautorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }} style={{ flex: 1, background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🚫 Desautorizar</button>
                    )}
                    <button onClick={() => abrirEditar(cadastroSelecionado)} style={{ flex: 1, background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✏️ Editar</button>
                    <button onClick={() => excluirCadastro(cadastroSelecionado)} style={{ flex: 1, background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🗑️ Excluir</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🏢 Clientes Wolf System</h1>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>{cadastros.filter(c => c.autorizado).length} ativos • {cadastros.filter(c => !c.autorizado).length} pendentes • {cadastros.length} total</p>
              </div>
              <button onClick={abrirNovo} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Cliente</button>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[{ label: "Total", value: cadastros.length, color: "#8b5cf6", icon: "📊" }, { label: "Ativos", value: cadastros.filter(c => c.autorizado).length, color: "#16a34a", icon: "✅" }, { label: "Pendentes", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b", icon: "⏳" }].map((card) => (
                <div key={card.label} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px 0", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
                  <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input placeholder="🔍 Buscar por nome, email, empresa, WhatsApp..." value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} style={{ ...inputStyle, maxWidth: 380, padding: "8px 14px", fontSize: 13 }} />
              <div style={{ display: "flex", gap: 8 }}>
                {[{ key: "todos", label: "Todos", color: "#8b5cf6" }, { key: "ativos", label: "✅ Ativos", color: "#16a34a" }, { key: "pendentes", label: "⏳ Pendentes", color: "#f59e0b" }].map((f) => (
                  <button key={f.key} onClick={() => setFiltroStatus(f.key)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtroStatus === f.key ? f.color : "#1f2937", color: filtroStatus === f.key ? "white" : "#9ca3af" }}>{f.label}</button>
                ))}
              </div>
            </div>
            {loadingCadastros ? <p style={{ color: "#6b7280" }}>Carregando...</p> : cadastrosFiltrados.length === 0 ? (
              <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
                <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>🏢</p>
                <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>Nenhum cliente encontrado</h3>
                <button onClick={abrirNovo} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold", marginTop: 12 }}>+ Novo Cliente</button>
              </div>
            ) : (
              <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0d0d0d" }}>
                      {["Cliente", "Email", "Plano", "👥 Usuários", "📱 Conexões", "Permite", "Status", "Ações"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cadastrosFiltrados.map((c, i) => (
                      <tr key={c.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                        <td style={{ padding: "14px 16px" }}><div><p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{c.nome}</p>{c.empresa && <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{c.empresa}</p>}</div></td>
                        <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 12 }}>{c.email}</td>
                        <td style={{ padding: "14px 16px" }}><span style={{ background: c.plano === "ultra" ? "#8b5cf622" : c.plano === "intermediario" ? "#3b82f622" : "#16a34a22", color: c.plano === "ultra" ? "#8b5cf6" : c.plano === "intermediario" ? "#3b82f6" : "#16a34a", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.plano === "intermediario" ? "Intermediário" : c.plano === "ultra" ? "Ultra" : "Básico"}</span></td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.usuarios_liberados || 1}</span></td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.conexoes_liberadas || 1}</span></td>
                        <td style={{ padding: "14px 16px" }}><div style={{ display: "flex", gap: 4 }}>{c.permite_webjs && <span style={{ fontSize: 14 }} title="WhatsApp Web">📱</span>}{c.permite_waba && <span style={{ fontSize: 14 }} title="API Meta">🔗</span>}{c.permite_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}</div></td>
                        <td style={{ padding: "14px 16px" }}><span style={{ background: c.autorizado ? "#16a34a22" : "#f59e0b22", color: c.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span></td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setCadastroSelecionado(c); setShowModalDetalhe(true); }} style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }} title="Ver detalhes">👁️</button>
                            {!c.autorizado ? <button onClick={() => autorizarCadastro(c)} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }} title="Autorizar">✅</button> : <button onClick={() => desautorizarCadastro(c)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }} title="Desautorizar">🚫</button>}
                            <button onClick={() => abrirEditar(c)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }} title="Editar">✏️</button>
                            <button onClick={() => excluirCadastro(c)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }} title="Excluir">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CONTATOS */}
        {aba === "contatos" && !isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>👥 Meus Contatos</h1>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>Leads que chegaram pelo WhatsApp — {atendimentos.length} contato(s)</p>
              </div>
            </div>
            <input placeholder="🔍 Buscar por nome ou número..." value={buscaContato} onChange={(e) => setBuscaContato(e.target.value)} style={{ ...inputStyle, maxWidth: 380, padding: "8px 14px", fontSize: 13 }} />
            {atendimentos.length === 0 ? (
              <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
                <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>👥</p>
                <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>Nenhum contato ainda</h3>
                <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Os leads que chegarem pelo WhatsApp aparecerão aqui automaticamente!</p>
              </div>
            ) : (
              <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#0d0d0d" }}>{["Contato", "Número", "Última Mensagem", "Fila", "Atendente", "Status"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                  <tbody>{contatosFiltrados.map((a, i) => (<tr key={a.id} onClick={() => router.push("/chatbot")} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d", cursor: "pointer" }}><td style={{ padding: "14px 16px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "#3b82f622", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div><span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{a.nome}</span></div></td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>📱 {a.numero}</td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.mensagem}</td><td style={{ padding: "14px 16px" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 8px", borderRadius: 10 }}>{a.fila}</span></td><td style={{ padding: "14px 16px" }}><span style={{ background: a.atendente === "BOT" ? "#8b5cf622" : "#16a34a22", color: a.atendente === "BOT" ? "#8b5cf6" : "#16a34a", fontSize: 11, padding: "3px 8px", borderRadius: 10 }}>{a.atendente === "BOT" ? "🤖 BOT" : "👤 " + a.atendente}</span></td><td style={{ padding: "14px 16px" }}><span style={{ background: a.status === "resolvido" ? "#16a34a22" : a.status === "em_atendimento" ? "#f59e0b22" : "#3b82f622", color: a.status === "resolvido" ? "#16a34a" : a.status === "em_atendimento" ? "#f59e0b" : "#3b82f6", fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: "bold" }}>{a.status}</span></td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CONFIGURAÇÕES */}
        {aba === "configuracoes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>⚙️ Configurações do Workspace</h1>

            {/* USUÁRIOS COM TRAVA */}
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>👥 Usuários</h2>
                  {!isAdmin && (
                    <p style={{ color: limiteAtingido ? "#dc2626" : "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>
                      {usuarios.length}/{limites.usuarios_liberados} usuários utilizados
                      {limiteAtingido && " — Limite atingido!"}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {limiteAtingido && (
                    <span style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: "bold" }}>
                      🔒 Limite atingido
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (limiteAtingido) {
                        alert(`❌ Você atingiu o limite de ${limites.usuarios_liberados} usuário(s) do seu plano.\n\nEntre em contato com o suporte para aumentar seu limite:\n📱 WhatsApp: (62) 99999-9999`);
                        return;
                      }
                      setShowFormUsuario(!showFormUsuario);
                    }}
                    style={{ background: limiteAtingido ? "#374151" : "#3b82f6", color: limiteAtingido ? "#6b7280" : "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: limiteAtingido ? "not-allowed" : "pointer", fontWeight: "bold" }}
                  >
                    {limiteAtingido ? "🔒 Limite Atingido" : "+ Adicionar Usuário"}
                  </button>
                </div>
              </div>

              {/* Barra de progresso */}
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
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formUsuario.nome} onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail *</label><input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone</label><input placeholder="+55 (62) 99999-9999" value={formUsuario.telefone} onChange={(e) => setFormUsuario({ ...formUsuario, telefone: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Perfil</label><select value={formUsuario.perfil} onChange={(e) => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={inputStyle}><option value="Administrador">Administrador</option><option value="Supervisor">Supervisor</option><option value="Atendente">Atendente</option></select></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila / Grupo</label><select value={formUsuario.fila} onChange={(e) => setFormUsuario({ ...formUsuario, fila: e.target.value })} style={inputStyle}><option value="">Selecione...</option>{filas.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}{grupos.map(g => <option key={g.nome} value={g.nome}>{g.nome}</option>)}</select></div>
                    <div style={{ position: "relative" }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha *</label><input type={showSenha ? "text" : "password"} placeholder="Senha" value={formUsuario.senha} onChange={(e) => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...inputStyle, paddingRight: 40 }} /><button onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14 }}>{showSenha ? "🙈" : "👁️"}</button></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowFormUsuario(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={adicionarUsuario} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
                  </div>
                </div>
              )}

              {usuarios.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum usuário cadastrado ainda</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#0d0d0d" }}>{["Nome", "E-mail", "Perfil", "Fila/Grupo", "Status"].map((h) => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
                  <tbody>{usuarios.map((u, i) => (<tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}><td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{u.nome}</td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.email}</td><td style={{ padding: "14px 16px" }}><span style={{ background: u.perfil === "Administrador" ? "#f59e0b22" : u.perfil === "Supervisor" ? "#8b5cf622" : "#3b82f622", color: u.perfil === "Administrador" ? "#f59e0b" : u.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.perfil}</span></td><td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.fila || "—"}</td><td style={{ padding: "14px 16px" }}><span style={{ background: u.status === "online" ? "#16a34a22" : "#6b728022", color: u.status === "online" ? "#16a34a" : "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span></td></tr>))}</tbody>
                </table>
              )}
            </div>

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

            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 24 }}>
              <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: "0 0 20px 0" }}>🎯 Roleta de Distribuição</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
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
                      {usuariosRoleta.map((u) => (<span key={u} style={{ background: "#16a34a22", color: "#16a34a", fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #16a34a33" }}>✓ {u}</span>))}
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