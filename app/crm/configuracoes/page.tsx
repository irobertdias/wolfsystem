"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";
import { useWorkspace } from "../../hooks/useWorkspace";

const ADMIN_EMAIL = "robert.dias@live.com";

type Usuario = { id?: number; nome: string; email: string; perfil: string; fila: string; status: string; grupo_id?: number; };
type GrupoPermissao = { id: number; nome: string; descricao: string; permissoes: Record<string, boolean>; };
type Fila = { id: number; nome: string; conexao: string; workspace_id: string; };

// 🆕 Permissões organizadas em 8 categorias
const CATEGORIAS_PERMISSAO = [
  {
    nome: "💬 Atendimento",
    cor: "#3b82f6",
    permissoes: [
      { key: "chat_proprio", label: "Ver próprios atendimentos" },
      { key: "chat_todos", label: "Ver todos atendimentos" },
      { key: "chat_interno", label: "Chat interno (conversar c/ equipe)" },
      { key: "respostas_rapidas", label: "Usar respostas rápidas" },
      { key: "transferir_chat", label: "Transferir conversas" },
      { key: "finalizar_chat", label: "Finalizar atendimentos" },
    ]
  },
  {
    nome: "🏷️ Contatos & Etiquetas",
    cor: "#06b6d4",
    permissoes: [
      { key: "contatos_ver", label: "Ver contatos" },
      { key: "contatos_editar", label: "Editar cadastro de contatos" },
      { key: "etiquetas", label: "Gerenciar etiquetas" },
    ]
  },
  {
    nome: "💰 Vendas & CRM",
    cor: "#f59e0b",
    permissoes: [
      { key: "dashboard", label: "Dashboard de atendimentos" },
      { key: "vendas_proprio", label: "Ver próprias vendas" },
      { key: "vendas_equipe", label: "Ver vendas da equipe" },
      { key: "funil", label: "Ver funil de vendas" },
      { key: "proposta_criar", label: "Criar propostas" },
    ]
  },
  {
    nome: "📤 Marketing & Disparos",
    cor: "#ec4899",
    permissoes: [
      { key: "disparo_enviar", label: "Enviar disparos em massa" },
      { key: "templates_waba", label: "Gerenciar templates WABA" },
    ]
  },
  {
    nome: "📞 Telefonia VOIP",
    cor: "#16a34a",
    permissoes: [
      { key: "voip_usar", label: "Usar softphone (fazer ligações)" },
      { key: "voip_conexoes", label: "Gerenciar conexões VOIP" },
      { key: "voip_campanhas", label: "Criar campanhas VOIP" },
    ]
  },
  {
    nome: "⚙️ Administração",
    cor: "#dc2626",
    permissoes: [
      { key: "conexoes", label: "Gerenciar conexões WhatsApp" },
      { key: "filas", label: "Gerenciar filas" },
      { key: "usuarios_gerenciar", label: "Gerenciar usuários" },
      { key: "grupos_permissao", label: "Gerenciar grupos de permissão" },
      { key: "roleta_gerenciar", label: "Gerenciar roleta de distribuição" },
      { key: "configuracoes_workspace", label: "Configurações do workspace" },
    ]
  },
  {
    nome: "📊 Relatórios",
    cor: "#8b5cf6",
    permissoes: [
      { key: "relatorios", label: "Relatórios de atendimento" },
      { key: "relatorios_voip", label: "Relatórios de telefonia" },
    ]
  },
  {
    nome: "👤 Pessoal",
    cor: "#6b7280",
    permissoes: [
      { key: "config_proprio", label: "Editar próprio perfil" },
    ]
  },
];

const TODAS_PERMISSOES = CATEGORIAS_PERMISSAO.flatMap(c => c.permissoes);
const PERMISSOES_PADRAO: Record<string, boolean> = TODAS_PERMISSOES.reduce((acc, p) => {
  acc[p.key] = false;
  return acc;
}, {} as Record<string, boolean>);

const LABELS_MAP: Record<string, string> = TODAS_PERMISSOES.reduce((acc, p) => {
  acc[p.key] = p.label;
  return acc;
}, {} as Record<string, string>);

export default function Configuracoes() {
  const router = useRouter();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const [workspaceId, setWorkspaceId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [limites, setLimites] = useState({ usuarios_liberados: 9999 });
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [gruposPermissao, setGruposPermissao] = useState<GrupoPermissao[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [showFormUsuario, setShowFormUsuario] = useState(false);
  const [showFormFila, setShowFormFila] = useState(false);
  const [showFormGrupo, setShowFormGrupo] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showDropdownFilas, setShowDropdownFilas] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null);
  const [editandoGrupo, setEditandoGrupo] = useState<GrupoPermissao | null>(null);
  const [formUsuario, setFormUsuario] = useState({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "", grupo_id: "" });
  const [formFila, setFormFila] = useState({ nome: "", conexao: "" });
  const [formGrupo, setFormGrupo] = useState({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } });
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [salvandoFila, setSalvandoFila] = useState(false);
  const [catsAbertas, setCatsAbertas] = useState<Record<string, boolean>>(
    CATEGORIAS_PERMISSAO.reduce((acc, c) => { acc[c.nome] = true; return acc; }, {} as Record<string, boolean>)
  );

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🎨 ESTILOS LIGHT TECH
  const IS = { width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", color: "#1f2937", fontSize: 14, boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const fetchUsuarios = async (wsId: string) => {
    const { data } = await supabase.from("usuarios_workspace").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
    if (data) setUsuarios(data);
  };

  const fetchGrupos = async (wsId: string) => {
    const { data } = await supabase.from("grupos_permissao").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
    if (data) setGruposPermissao(data);
  };

  const fetchFilas = async (wsId: string) => {
    const { data } = await supabase.from("filas").select("*").eq("workspace_id", wsId).order("created_at", { ascending: true });
    if (data) setFilas(data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const admin = user.email === ADMIN_EMAIL;
      setIsAdmin(admin);

      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono) {
        setAutorizado(true);
        const wsId = wsDono.username;
        if (!wsId) { alert("Erro: workspace sem username."); return; }
        setWorkspaceId(wsId);
        fetchUsuarios(wsId); fetchGrupos(wsId); fetchFilas(wsId);
        if (!admin) {
          const { data: cadastro } = await supabase.from("cadastros").select("usuarios_liberados").eq("email", user.email).maybeSingle();
          if (cadastro) setLimites({ usuarios_liberados: cadastro.usuarios_liberados || 1 });
        }
        return;
      }

      const { data: usuarioWs } = await supabase.from("usuarios_workspace")
        .select("workspace_id, grupo_id, perfil")
        .eq("email", user.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!usuarioWs) { router.push("/crm/dashboard"); return; }

      let temPermissao = false;
      if (usuarioWs.grupo_id) {
        const { data: grupo } = await supabase.from("grupos_permissao").select("permissoes").eq("id", usuarioWs.grupo_id).maybeSingle();
        if (grupo?.permissoes?.configuracoes_workspace) temPermissao = true;
      }
      if (usuarioWs.perfil === "Administrador") temPermissao = true;
      if (!temPermissao) { router.push("/crm/dashboard"); return; }

      const wsId = usuarioWs.workspace_id;
      setWorkspaceId(wsId);
      fetchUsuarios(wsId); fetchGrupos(wsId); fetchFilas(wsId);

      const { data: wsSub } = await supabase.from("workspaces").select("owner_email").eq("username", wsId).maybeSingle();
      if (wsSub?.owner_email) {
        const { data: cadastroDono } = await supabase.from("cadastros").select("usuarios_liberados").eq("email", wsSub.owner_email).maybeSingle();
        if (cadastroDono) setLimites({ usuarios_liberados: cadastroDono.usuarios_liberados || 1 });
      }
      setAutorizado(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase.channel("ws_rt_" + workspaceId)
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${workspaceId}` }, () => fetchUsuarios(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "grupos_permissao", filter: `workspace_id=eq.${workspaceId}` }, () => fetchGrupos(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "filas", filter: `workspace_id=eq.${workspaceId}` }, () => fetchFilas(workspaceId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  if (!autorizado) return null;
  const limiteAtingido = !isAdmin && usuarios.length >= limites.usuarios_liberados;

  const abrirEditarUsuario = (u: Usuario) => {
    setEditandoUsuario(u);
    setFormUsuario({ nome: u.nome, email: u.email, telefone: "", senha: "", perfil: u.perfil, fila: u.fila || "", grupo_id: u.grupo_id?.toString() || "" });
    setShowFormUsuario(true);
  };

  const excluirUsuario = async (u: Usuario) => {
    if (!isDono && !isSuperAdmin && !permissoes.usuarios_gerenciar) {
      alert("❌ Você não tem permissão para excluir usuários.");
      return;
    }
    if (!confirm(`Excluir ${u.nome}? Isso vai apagar o login dele também.`)) return;
    const token = await getToken();
    if (!token) { alert("Sessão expirou."); return; }
    try {
      const resp = await fetch("/api/deletar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: u.email, workspace_id: workspaceId }),
      });
      const data = await resp.json();
      if (!data.success) { alert("Erro: " + data.error); return; }
      await fetchUsuarios(workspaceId);
      alert("✅ Usuário excluído!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  const salvarUsuario = async () => {
    if (!isDono && !isSuperAdmin && !permissoes.usuarios_gerenciar) {
      alert("❌ Você não tem permissão para gerenciar usuários.");
      return;
    }
    if (!formUsuario.nome || !formUsuario.email) { alert("Preencha Nome e E-mail!"); return; }
    setSalvandoUsuario(true);
    try {
      if (editandoUsuario) {
        await supabase.from("usuarios_workspace")
          .update({ nome: formUsuario.nome, perfil: formUsuario.perfil, fila: formUsuario.fila, grupo_id: formUsuario.grupo_id ? parseInt(formUsuario.grupo_id) : null })
          .eq("email", editandoUsuario.email).eq("workspace_id", workspaceId);
        await fetchUsuarios(workspaceId);
        setEditandoUsuario(null); setShowFormUsuario(false);
        setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "", grupo_id: "" });
        alert("✅ Usuário atualizado!"); setSalvandoUsuario(false); return;
      }
      if (!formUsuario.senha) { alert("Preencha a Senha!"); setSalvandoUsuario(false); return; }
      if (formUsuario.senha.length < 6) { alert("Senha deve ter no mínimo 6 caracteres!"); setSalvandoUsuario(false); return; }
      if (limiteAtingido) { alert(`❌ Limite de ${limites.usuarios_liberados} usuário(s) atingido!`); setSalvandoUsuario(false); return; }
      const token = await getToken();
      if (!token) { alert("Sessão expirou."); setSalvandoUsuario(false); return; }
      const resp = await fetch("/api/criar-usuario", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          email: formUsuario.email, senha: formUsuario.senha, nome: formUsuario.nome,
          workspace_id: workspaceId, perfil: formUsuario.perfil, fila: formUsuario.fila,
          grupo_id: formUsuario.grupo_id ? parseInt(formUsuario.grupo_id) : null,
        }),
      });
      const data = await resp.json();
      if (!data.success) {
        if (data.error === "email_exists") alert("❌ E-mail já cadastrado!");
        else if (data.error === "limite_atingido") alert("❌ " + (data.detalhes || "Limite atingido!"));
        else alert("Erro: " + data.error);
        setSalvandoUsuario(false); return;
      }
      await fetchUsuarios(workspaceId);
      setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "", grupo_id: "" });
      setShowFormUsuario(false); alert("✅ Usuário adicionado!");
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoUsuario(false);
  };

  const salvarFila = async () => {
    if (!isDono && !isSuperAdmin && !permissoes.filas) {
      alert("❌ Você não tem permissão para gerenciar filas.");
      return;
    }
    if (!formFila.nome.trim()) { alert("Digite o nome da fila!"); return; }
    setSalvandoFila(true);
    try {
      const { error } = await supabase.from("filas").insert([{
        nome: formFila.nome.trim(), conexao: formFila.conexao.trim() || null, workspace_id: workspaceId,
      }]);
      if (error) {
        if (error.code === "23505") alert("❌ Já existe uma fila com esse nome neste workspace!");
        else alert("Erro ao criar fila: " + error.message);
        setSalvandoFila(false); return;
      }
      await fetchFilas(workspaceId);
      setFormFila({ nome: "", conexao: "" }); setShowFormFila(false);
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoFila(false);
  };

  const excluirFila = async (f: Fila) => {
    if (!isDono && !isSuperAdmin && !permissoes.filas) {
      alert("❌ Você não tem permissão para excluir filas.");
      return;
    }
    if (!confirm(`Excluir a fila "${f.nome}"?`)) return;
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    // 🔒 MULTI-TENANT CRÍTICO
    const { error } = await supabase.from("filas").delete()
      .eq("id", f.id)
      .eq("workspace_id", workspaceId);
    if (error) { alert("Erro ao excluir: " + error.message); return; }
    await fetchFilas(workspaceId);
  };

  const toggleCategoriaToda = (catNome: string, marcar: boolean) => {
    const cat = CATEGORIAS_PERMISSAO.find(c => c.nome === catNome);
    if (!cat) return;
    const novo = { ...formGrupo.permissoes };
    cat.permissoes.forEach(p => { novo[p.key] = marcar; });
    setFormGrupo({ ...formGrupo, permissoes: novo });
  };

  const salvarGrupo = async () => {
    if (!isDono && !isSuperAdmin && !permissoes.grupos_permissao) {
      alert("❌ Você não tem permissão para gerenciar grupos de permissão.");
      return;
    }
    if (!formGrupo.nome) { alert("Digite o nome do grupo!"); return; }
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    if (editandoGrupo) {
      // 🔒 MULTI-TENANT
      await supabase.from("grupos_permissao")
        .update({ nome: formGrupo.nome, descricao: formGrupo.descricao, permissoes: formGrupo.permissoes })
        .eq("id", editandoGrupo.id)
        .eq("workspace_id", workspaceId);
    } else {
      await supabase.from("grupos_permissao").insert([{ workspace_id: workspaceId, nome: formGrupo.nome, descricao: formGrupo.descricao, permissoes: formGrupo.permissoes }]);
    }
    await fetchGrupos(workspaceId);
    setShowFormGrupo(false); setEditandoGrupo(null);
    setFormGrupo({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } });
    alert("✅ Grupo salvo!");
  };

  const abrirEditarGrupo = (g: GrupoPermissao) => {
    setEditandoGrupo(g);
    setFormGrupo({ nome: g.nome, descricao: g.descricao || "", permissoes: { ...PERMISSOES_PADRAO, ...g.permissoes } });
    setShowFormGrupo(true);
  };

  const excluirGrupo = async (id: number) => {
    if (!isDono && !isSuperAdmin && !permissoes.grupos_permissao) {
      alert("❌ Você não tem permissão para excluir grupos de permissão.");
      return;
    }
    if (!confirm("Excluir este grupo?")) return;
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    // 🔒 MULTI-TENANT CRÍTICO
    await supabase.from("grupos_permissao").delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    await fetchGrupos(workspaceId);
  };

  const contarUsuariosPorFila = (nomeFila: string) => usuarios.filter(u => {
    if (!u.fila) return false;
    return u.fila.split(",").map(s => s.trim()).includes(nomeFila);
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 20 : 28 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, boxShadow: "0 8px 20px rgba(107,114,128,0.25)",
        }}>
          <span style={{ filter: "saturate(0) brightness(2)" }}>⚙️</span>
        </div>
        <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Configurações do Workspace</h1>
      </div>

      {/* 🔒 Fallback */}
      {!isDono && !isSuperAdmin && !permissoes.usuarios_gerenciar && !permissoes.filas && !permissoes.grupos_permissao && !permissoes.configuracoes_workspace && (
        <div style={{ ...cardStyle, padding: 32, textAlign: "center", borderLeft: "4px solid #dc2626", background: "#fef2f2", borderColor: "#fecaca" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, margin: "0 auto 14px",
            boxShadow: "0 8px 20px rgba(239,68,68,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>
          <p style={{ color: "#991b1b", fontSize: 15, fontWeight: 700, margin: 0 }}>Acesso restrito</p>
          <p style={{ color: "#7f1d1d", fontSize: 13, margin: "8px 0 0" }}>Você não tem permissão para acessar as configurações do workspace. Entre em contato com o administrador.</p>
        </div>
      )}

      {/* ═══ USUÁRIOS ═══ */}
      {(isDono || isSuperAdmin || permissoes.usuarios_gerenciar) && (
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👥</div>
            <div>
              <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0 }}>Usuários</h2>
              {!isAdmin && <p style={{ color: limiteAtingido ? "#dc2626" : "#6b7280", fontSize: 12, margin: "3px 0 0" }}>{usuarios.length}/{limites.usuarios_liberados} usuários utilizados{limiteAtingido && " — Limite atingido!"}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {limiteAtingido && <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>🔒 Limite atingido</span>}
            <button onClick={() => {
              if (limiteAtingido) { alert(`❌ Você atingiu o limite de ${limites.usuarios_liberados} usuário(s).`); return; }
              setEditandoUsuario(null);
              setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "", grupo_id: "" });
              setShowFormUsuario(!showFormUsuario);
            }}
              style={{
                background: limiteAtingido ? "#f3f4f6" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: limiteAtingido ? "#9ca3af" : "white",
                border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12,
                cursor: limiteAtingido ? "not-allowed" : "pointer", fontWeight: 700,
                boxShadow: limiteAtingido ? "none" : "0 4px 12px rgba(59,130,246,0.3)",
              }}>
              {limiteAtingido ? "🔒 Limite Atingido" : "+ Adicionar Usuário"}
            </button>
          </div>
        </div>

        {!isAdmin && (
          <div style={{ padding: "10px 24px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>Usuários cadastrados</span>
              <span style={{ color: limiteAtingido ? "#dc2626" : "#16a34a", fontSize: 11, fontWeight: 700 }}>{usuarios.length}/{limites.usuarios_liberados}</span>
            </div>
            <div style={{ background: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{
                background: limiteAtingido ? "linear-gradient(90deg, #dc2626, #ef4444)" : "linear-gradient(90deg, #16a34a, #22c55e)",
                height: "100%", width: `${Math.min((usuarios.length / limites.usuarios_liberados) * 100, 100)}%`,
                transition: "width 0.3s", borderRadius: 4,
              }} />
            </div>
          </div>
        )}

        {showFormUsuario && (
          <div style={{ padding: 22, borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>{editandoUsuario ? "✏️ Editar Usuário" : "➕ Novo Usuário"}</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Nome *</label>
                <input placeholder="Nome completo" value={formUsuario.nome} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={IS} />
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>E-mail *</label>
                <input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} disabled={!!editandoUsuario}
                  style={{ ...IS, background: editandoUsuario ? "#f3f4f6" : "#ffffff", color: editandoUsuario ? "#6b7280" : "#1f2937", opacity: editandoUsuario ? 0.6 : 1 }} />
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Perfil</label>
                <select value={formUsuario.perfil} onChange={e => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={IS}>
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Atendente">Atendente</option>
                </select>
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Filas</label>
                {(() => {
                  const filasSelecionadas = (formUsuario.fila || "").split(",").map(s => s.trim()).filter(Boolean);
                  const labelBotao = filasSelecionadas.length === 0
                    ? "Selecione..."
                    : filasSelecionadas.length === 1
                      ? filasSelecionadas[0]
                      : `${filasSelecionadas.length} filas selecionadas`;
                  const toggleFila = (nome: string) => {
                    const novas = filasSelecionadas.includes(nome)
                      ? filasSelecionadas.filter(f => f !== nome)
                      : [...filasSelecionadas, nome];
                    setFormUsuario({ ...formUsuario, fila: novas.join(",") });
                  };
                  return (
                    <div style={{ position: "relative" }}>
                      <button type="button" onClick={() => setShowDropdownFilas(!showDropdownFilas)}
                        style={{ ...IS, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: filasSelecionadas.length === 0 ? "#9ca3af" : "#1f2937", fontWeight: filasSelecionadas.length > 0 ? 600 : 400 }}>{labelBotao}</span>
                        <span style={{ color: "#9ca3af", fontSize: 10 }}>{showDropdownFilas ? "▲" : "▼"}</span>
                      </button>
                      {showDropdownFilas && (
                        <>
                          <div onClick={() => setShowDropdownFilas(false)}
                            style={{ position: "fixed", inset: 0, zIndex: 100 }} />
                          <div style={{
                            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                            background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
                            maxHeight: 260, overflowY: "auto", zIndex: 101,
                            boxShadow: "0 10px 25px rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.04)",
                          }}>
                            {filas.length === 0 ? (
                              <p style={{ color: "#9ca3af", fontSize: 12, padding: 14, textAlign: "center", margin: 0 }}>
                                Nenhuma fila criada ainda. Crie uma fila primeiro abaixo.
                              </p>
                            ) : (
                              <>
                                {filas.map(f => {
                                  const marcada = filasSelecionadas.includes(f.nome);
                                  return (
                                    <label key={f.id} style={{
                                      display: "flex", alignItems: "center", gap: 10,
                                      padding: "11px 14px", cursor: "pointer",
                                      borderBottom: "1px solid #f3f4f6",
                                      background: marcada ? "#eff6ff" : "transparent",
                                      transition: "background 0.1s",
                                    }}
                                      onMouseEnter={(e) => { if (!marcada) e.currentTarget.style.background = "#f9fafb"; }}
                                      onMouseLeave={(e) => { if (!marcada) e.currentTarget.style.background = "transparent"; }}
                                    >
                                      <input type="checkbox" checked={marcada}
                                        onChange={() => toggleFila(f.nome)}
                                        style={{ accentColor: "#3b82f6", cursor: "pointer", width: 16, height: 16 }} />
                                      <span style={{ color: marcada ? "#3b82f6" : "#1f2937", fontSize: 13, fontWeight: marcada ? 700 : 500 }}>
                                        {f.nome}
                                      </span>
                                    </label>
                                  );
                                })}
                                {filasSelecionadas.length > 0 && (
                                  <div style={{ padding: "8px 14px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
                                    <button type="button" onClick={() => setFormUsuario({ ...formUsuario, fila: "" })}
                                      style={{ background: "none", border: "none", color: "#dc2626", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                      ✕ Limpar seleção
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                      {filasSelecionadas.length > 1 && (
                        <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0", lineHeight: 1.3 }}>
                          ℹ️ Atende {filasSelecionadas.length} filas: <b>{filasSelecionadas.join(", ")}</b>
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Grupo de Permissão</label>
                <select value={formUsuario.grupo_id} onChange={e => setFormUsuario({ ...formUsuario, grupo_id: e.target.value })} style={IS}>
                  <option value="">Sem grupo (usa padrão do perfil)</option>
                  {gruposPermissao.map(g => <option key={g.id} value={g.id.toString()}>{g.nome}</option>)}
                </select>
              </div>
              {!editandoUsuario && (
                <div style={{ position: "relative" }}>
                  <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Senha *</label>
                  <input type={showSenha ? "text" : "password"} placeholder="Senha (mín 6)" value={formUsuario.senha} onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...IS, paddingRight: 40 }} />
                  <button onClick={() => setShowSenha(!showSenha)}
                    style={{ position: "absolute", right: 8, top: 32, background: "#f3f4f6", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {showSenha ? "🙈" : "👁️"}
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowFormUsuario(false); setEditandoUsuario(null); }}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvarUsuario} disabled={salvandoUsuario}
                style={{
                  background: salvandoUsuario ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "9px 22px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                }}>
                {salvandoUsuario ? "Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        )}

        {usuarios.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 8px" }}>👥</p>
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Nenhum usuário cadastrado ainda</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 720 : "auto" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Nome", "E-mail", "Perfil", "Fila", "Grupo Permissão", "Status", "Ações"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc", transition: "background 0.1s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                  >
                    <td style={{ padding: "14px 16px", color: "#1f2937", fontSize: 13, fontWeight: 600 }}>{u.nome}</td>
                    <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 13 }}>{u.email}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        background: u.perfil === "Administrador" ? "#fffbeb" : u.perfil === "Supervisor" ? "#f3e8ff" : "#eff6ff",
                        color: u.perfil === "Administrador" ? "#f59e0b" : u.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6",
                        border: `1px solid ${u.perfil === "Administrador" ? "#fde68a" : u.perfil === "Supervisor" ? "#ddd6fe" : "#bfdbfe"}`,
                        padding: "3px 12px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                      }}>{u.perfil}</span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 13 }}>{u.fila || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                    <td style={{ padding: "14px 16px" }}>
                      {u.grupo_id ? (
                        <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", padding: "3px 12px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                          {gruposPermissao.find(g => g.id === u.grupo_id)?.nome || "—"}
                        </span>
                      ) : <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        background: u.status === "online" ? "#f0fdf4" : "#f3f4f6",
                        color: u.status === "online" ? "#16a34a" : "#6b7280",
                        border: `1px solid ${u.status === "online" ? "#bbf7d0" : "#e5e7eb"}`,
                        padding: "3px 12px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                      }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => abrirEditarUsuario(u)}
                          style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                        <button onClick={() => excluirUsuario(u)}
                          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
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

      {/* ═══ FILAS ═══ */}
      {(isDono || isSuperAdmin || permissoes.filas) && (
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
            <div>
              <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0 }}>Filas</h2>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0" }}>{filas.length} fila(s) cadastrada(s)</p>
            </div>
          </div>
          <button onClick={() => { setFormFila({ nome: "", conexao: "" }); setShowFormFila(!showFormFila); }}
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 700,
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}>
            + Nova Fila
          </button>
        </div>
        {showFormFila && (
          <div style={{ padding: 22, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Nome da Fila *</label>
              <input placeholder="Ex: Fila Vendas" value={formFila.nome} onChange={e => setFormFila({ ...formFila, nome: e.target.value })} style={IS} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Conexão (opcional)</label>
              <input placeholder="Ex: WhatsApp 01" value={formFila.conexao} onChange={e => setFormFila({ ...formFila, conexao: e.target.value })} style={IS} />
            </div>
            <button onClick={() => { setShowFormFila(false); setFormFila({ nome: "", conexao: "" }); }}
              style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 16px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvarFila} disabled={salvandoFila}
              style={{
                background: salvandoFila ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "10px 20px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
              }}>
              {salvandoFila ? "Salvando..." : "💾 Salvar"}
            </button>
          </div>
        )}
        {filas.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 8px" }}>📋</p>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Nenhuma fila cadastrada ainda</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 520 : "auto" }}>
              <thead><tr style={{ background: "#f9fafb" }}>{["Fila", "Conexão", "Usuários", "Ações"].map(h => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>))}</tr></thead>
              <tbody>{filas.map((f, i) => (
                <tr key={f.id} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc", transition: "background 0.1s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                  onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                >
                  <td style={{ padding: "14px 16px", color: "#1f2937", fontSize: 13, fontWeight: 600 }}>{f.nome}</td>
                  <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 13 }}>{f.conexao || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", padding: "3px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                      {contarUsuariosPorFila(f.nome)}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button onClick={() => excluirFila(f)}
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* ═══ GRUPOS DE PERMISSÃO ═══ */}
      {(isDono || isSuperAdmin || permissoes.grupos_permissao) && (
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔒</div>
            <div>
              <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0 }}>Grupos de Permissão</h2>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0" }}>Defina o que cada grupo pode ver e fazer — 30 permissões em 8 categorias</p>
            </div>
          </div>
          <button onClick={() => { setEditandoGrupo(null); setFormGrupo({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } }); setShowFormGrupo(!showFormGrupo); }}
            style={{
              background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 700,
              boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
            }}>
            + Novo Grupo
          </button>
        </div>

        {showFormGrupo && (
          <div style={{ padding: 26, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", flexDirection: "column", gap: 22 }}>
            <p style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>{editandoGrupo ? "✏️ Editar Grupo" : "➕ Novo Grupo"}</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div><label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Nome *</label><input placeholder="Ex: Atendente Vendas" value={formGrupo.nome} onChange={e => setFormGrupo({ ...formGrupo, nome: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Descrição</label><input placeholder="Ex: Acesso às vendas e chat" value={formGrupo.descricao} onChange={e => setFormGrupo({ ...formGrupo, descricao: e.target.value })} style={IS} /></div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {CATEGORIAS_PERMISSAO.map(cat => {
                const todasMarcadas = cat.permissoes.every(p => formGrupo.permissoes[p.key]);
                const algumaMarcada = cat.permissoes.some(p => formGrupo.permissoes[p.key]);
                const aberta = catsAbertas[cat.nome] !== false;
                return (
                  <div key={cat.nome} style={{
                    background: "#ffffff",
                    border: `1px solid ${cat.cor}30`,
                    borderRadius: 12, overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 16px",
                      background: `${cat.cor}08`,
                      cursor: "pointer",
                      borderLeft: `4px solid ${cat.cor}`,
                    }}
                      onClick={() => setCatsAbertas({ ...catsAbertas, [cat.nome]: !aberta })}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: cat.cor, fontSize: 13, fontWeight: 700 }}>{aberta ? "▼" : "▶"} {cat.nome}</span>
                        <span style={{
                          background: `${cat.cor}15`, color: cat.cor,
                          fontSize: 10, padding: "2px 8px", borderRadius: 8,
                          fontWeight: 700, border: `1px solid ${cat.cor}30`,
                        }}>
                          {cat.permissoes.filter(p => formGrupo.permissoes[p.key]).length}/{cat.permissoes.length}
                        </span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleCategoriaToda(cat.nome, !todasMarcadas); }}
                        style={{
                          background: todasMarcadas ? `${cat.cor}20` : algumaMarcada ? `${cat.cor}10` : "#ffffff",
                          color: algumaMarcada || todasMarcadas ? cat.cor : "#6b7280",
                          border: `1px solid ${cat.cor}40`,
                          borderRadius: 8, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700,
                        }}>
                        {todasMarcadas ? "✓ Desmarcar todos" : "+ Marcar todos"}
                      </button>
                    </div>
                    {aberta && (
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6, padding: 12 }}>
                        {cat.permissoes.map(p => (
                          <label key={p.key}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              background: formGrupo.permissoes[p.key] ? `${cat.cor}10` : "#f9fafb",
                              borderRadius: 8, padding: "9px 12px", cursor: "pointer",
                              border: `1px solid ${formGrupo.permissoes[p.key] ? `${cat.cor}50` : "#e5e7eb"}`,
                              transition: "all 0.15s",
                            }}>
                            <input type="checkbox" checked={!!formGrupo.permissoes[p.key]}
                              onChange={e => setFormGrupo({ ...formGrupo, permissoes: { ...formGrupo.permissoes, [p.key]: e.target.checked } })}
                              style={{ accentColor: cat.cor, width: 16, height: 16 }} />
                            <span style={{ color: formGrupo.permissoes[p.key] ? "#1f2937" : "#6b7280", fontSize: 12, fontWeight: formGrupo.permissoes[p.key] ? 600 : 500 }}>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowFormGrupo(false); setEditandoGrupo(null); }}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvarGrupo}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "9px 22px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                }}>
                💾 Salvar Grupo
              </button>
            </div>
          </div>
        )}

        {gruposPermissao.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 8px" }}>🔒</p>
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Nenhum grupo criado ainda</p>
          </div>
        ) : (
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {gruposPermissao.map(g => {
              const qtdMarcadas = Object.values(g.permissoes || {}).filter(Boolean).length;
              return (
                <div key={g.id} style={{
                  background: "#ffffff",
                  borderRadius: 12, padding: "16px 20px",
                  border: "1px solid #e5e7eb",
                  borderLeft: "4px solid #8b5cf6",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(139,92,246,0.10)"}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>{g.nome}</p>
                      {g.descricao && <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{g.descricao}</p>}
                      <p style={{ color: "#8b5cf6", fontSize: 11, margin: "5px 0 0", fontWeight: 700 }}>{qtdMarcadas}/30 permissões ativas</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => abrirEditarGrupo(g)}
                        style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                      <button onClick={() => excluirGrupo(g.id)}
                        style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(g.permissoes || {}).filter(([_, v]) => v).slice(0, 8).map(([k]) => (
                      <span key={k} style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", fontSize: 10, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{LABELS_MAP[k] || k}</span>
                    ))}
                    {qtdMarcadas > 8 && <span style={{ color: "#9ca3af", fontSize: 10, padding: "3px 6px", fontStyle: "italic" }}>+{qtdMarcadas - 8} outras</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ═══ CONFIGURAÇÕES GERAIS ═══ */}
      {(isDono || isSuperAdmin || permissoes.configuracoes_workspace) && (
        <ConfigGeraisWorkspace />
      )}

      {/* 🚫 Roleta foi removida — vai pra Chatbot */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderLeft: "4px solid #3b82f6", borderRadius: 12, padding: "14px 18px" }}>
        <p style={{ color: "#1e40af", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          💡 <b>A Roleta de Distribuição</b> agora fica em <b>Chatbot → Configurações → Roleta</b>, já que está mais relacionada ao fluxo de atendimento do que à configuração do workspace.
        </p>
      </div>
    </div>
  );
}

// 🆕 ═══════════════════════════════════════════════════════════════════════
// COMPONENTE: ConfigGeraisWorkspace
// ═══════════════════════════════════════════════════════════════════════
function ConfigGeraisWorkspace() {
  const { workspace, wsId } = useWorkspace();
  const [horasBloqueio, setHorasBloqueio] = useState<number>(24);
  const [salvando, setSalvando] = useState(false);
  const [editado, setEditado] = useState(false);

  useEffect(() => {
    if (workspace && (workspace as any).bloqueio_pos_finalizacao_horas !== undefined) {
      const valor = (workspace as any).bloqueio_pos_finalizacao_horas;
      setHorasBloqueio(valor === null ? 24 : valor);
    }
  }, [workspace]);

  const salvar = async () => {
    if (!wsId) return;
    setSalvando(true);
    const { error } = await supabase.from("workspaces")
      .update({ bloqueio_pos_finalizacao_horas: horasBloqueio })
      .eq("username", wsId);
    setSalvando(false);
    if (error) {
      alert("❌ Erro ao salvar: " + error.message);
    } else {
      setEditado(false);
      alert("✅ Configuração salva!");
    }
  };

  return (
    <div style={{
      background: "#ffffff",
      borderRadius: 14, border: "1px solid #e5e7eb",
      padding: 24,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚙️</div>
          <div>
            <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0 }}>Configurações Gerais</h2>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0" }}>Comportamento do atendimento neste workspace</p>
          </div>
        </div>
      </div>

      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
        <label style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
          🔒 Bloqueio pós-finalização (horas)
        </label>
        <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 14px", lineHeight: 1.5 }}>
          Quando um atendente finaliza um chat, o cliente fica bloqueado de reabrir por essa quantidade de horas.
          Mensagens dele nesse período são registradas mas o atendimento NÃO volta pra "Aguardando".
          <br />
          <b>0 = desativa o bloqueio</b> (cliente pode reabrir imediatamente após finalização).
          <br />
          <b>Recomendado: 24h.</b> Aplica só em finalização manual humana — fechamento por inatividade ou bot NÃO bloqueia.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            min="0"
            max="720"
            value={horasBloqueio}
            onChange={e => { setHorasBloqueio(Math.max(0, Math.min(720, parseInt(e.target.value) || 0))); setEditado(true); }}
            style={{
              background: "#ffffff", border: "1px solid #e5e7eb",
              color: "#1f2937", borderRadius: 10,
              padding: "10px 14px", fontSize: 14, width: 100,
              outline: "none", fontWeight: 600,
            }}
          />
          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>
            {horasBloqueio === 0 ? "(desativado)" : horasBloqueio === 24 ? "(1 dia)" : horasBloqueio === 48 ? "(2 dias)" : horasBloqueio === 168 ? "(1 semana)" : `(${horasBloqueio}h)`}
          </span>
          <div style={{ flex: 1 }} />
          {editado && (
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "10px 18px", fontSize: 13, fontWeight: 700,
                cursor: salvando ? "wait" : "pointer",
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}>
              {salvando ? "Salvando..." : "💾 Salvar"}
            </button>
          )}
        </div>
        {/* Atalhos rápidos */}
        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          {[0, 12, 24, 48, 72, 168].map(h => {
            const ativo = horasBloqueio === h;
            return (
              <button key={h} type="button" onClick={() => { setHorasBloqueio(h); setEditado(true); }}
                style={{
                  background: ativo ? "#3b82f6" : "#ffffff",
                  color: ativo ? "white" : "#6b7280",
                  border: `1px solid ${ativo ? "#3b82f6" : "#e5e7eb"}`,
                  borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700,
                  boxShadow: ativo ? "0 2px 6px rgba(59,130,246,0.25)" : "none",
                }}>
                {h === 0 ? "Off" : h < 24 ? `${h}h` : h === 24 ? "1d" : h === 48 ? "2d" : h === 72 ? "3d" : "1sem"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}