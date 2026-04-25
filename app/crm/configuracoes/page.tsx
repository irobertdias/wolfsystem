"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";

const ADMIN_EMAIL = "robert.dias@live.com";

type Usuario = { id?: number; nome: string; email: string; perfil: string; fila: string; status: string; grupo_id?: number; };
type GrupoPermissao = { id: number; nome: string; descricao: string; permissoes: Record<string, boolean>; };
type Fila = { id: number; nome: string; conexao: string; workspace_id: string; };

// 🆕 Permissões organizadas em 8 categorias (pra UI não ficar uma avalanche de checkboxes)
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

// Lista plana pra hidratar defaults (todas em FALSE, só as que o dono marcar ficam true)
const TODAS_PERMISSOES = CATEGORIAS_PERMISSAO.flatMap(c => c.permissoes);
const PERMISSOES_PADRAO: Record<string, boolean> = TODAS_PERMISSOES.reduce((acc, p) => {
  acc[p.key] = false;
  return acc;
}, {} as Record<string, boolean>);

// Labels planos pra exibir nos cards de grupo (abaixo do form)
const LABELS_MAP: Record<string, string> = TODAS_PERMISSOES.reduce((acc, p) => {
  acc[p.key] = p.label;
  return acc;
}, {} as Record<string, string>);

export default function Configuracoes() {
  const router = useRouter();
  const { isDono } = usePermissao();
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
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null);
  const [editandoGrupo, setEditandoGrupo] = useState<GrupoPermissao | null>(null);
  const [formUsuario, setFormUsuario] = useState({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "", grupo_id: "" });
  const [formFila, setFormFila] = useState({ nome: "", conexao: "" });
  const [formGrupo, setFormGrupo] = useState({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } });
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [salvandoFila, setSalvandoFila] = useState(false);
  // 🆕 controle de categorias expandidas (todas abertas por padrão)
  const [catsAbertas, setCatsAbertas] = useState<Record<string, boolean>>(
    CATEGORIAS_PERMISSAO.reduce((acc, c) => { acc[c.nome] = true; return acc; }, {} as Record<string, boolean>)
  );

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };

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
    if (!confirm(`Excluir a fila "${f.nome}"?`)) return;
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    // 🔒 MULTI-TENANT CRÍTICO: confere workspace_id no WHERE.
    // Antes, qualquer admin de qualquer workspace que descobrisse o id de uma fila
    // de outro workspace podia deletar via DevTools. Filas estão ligadas a atendentes
    // e roleta — apagar fila alheia quebra distribuição de leads do outro workspace.
    const { error } = await supabase.from("filas").delete()
      .eq("id", f.id)
      .eq("workspace_id", workspaceId);
    if (error) { alert("Erro ao excluir: " + error.message); return; }
    await fetchFilas(workspaceId);
  };

  // 🆕 Marca/desmarca categoria inteira de uma vez
  const toggleCategoriaToda = (catNome: string, marcar: boolean) => {
    const cat = CATEGORIAS_PERMISSAO.find(c => c.nome === catNome);
    if (!cat) return;
    const novo = { ...formGrupo.permissoes };
    cat.permissoes.forEach(p => { novo[p.key] = marcar; });
    setFormGrupo({ ...formGrupo, permissoes: novo });
  };

  const salvarGrupo = async () => {
    if (!formGrupo.nome) { alert("Digite o nome do grupo!"); return; }
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    if (editandoGrupo) {
      // 🔒 MULTI-TENANT: defesa em profundidade — só edita grupo se for deste workspace.
      // Antes, com o id do grupo em mãos, dava pra editar nome/descrição/permissoes
      // de grupos de outros workspaces via DevTools.
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
    // Mescla com PERMISSOES_PADRAO pra garantir que grupos antigos (sem permissões novas) sejam compatíveis
    setFormGrupo({ nome: g.nome, descricao: g.descricao || "", permissoes: { ...PERMISSOES_PADRAO, ...g.permissoes } });
    setShowFormGrupo(true);
  };

  const excluirGrupo = async (id: number) => {
    if (!confirm("Excluir este grupo?")) return;
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    // 🔒 MULTI-TENANT CRÍTICO: confere workspace_id no WHERE.
    // Antes, com o id de um grupo de outro workspace, dava pra deletá-lo via DevTools.
    // Grupos contêm permissões — deletar deixa todos os usuários daquele grupo sem
    // permissões corretas (cai no fallback do perfil), o que pode dar acesso indevido.
    await supabase.from("grupos_permissao").delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    await fetchGrupos(workspaceId);
  };

  const contarUsuariosPorFila = (nomeFila: string) => usuarios.filter(u => u.fila === nomeFila).length;

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
            <button onClick={() => {
              if (limiteAtingido) { alert(`❌ Você atingiu o limite de ${limites.usuarios_liberados} usuário(s).`); return; }
              setEditandoUsuario(null);
              setFormUsuario({ nome: "", email: "", telefone: "", senha: "", perfil: "Atendente", fila: "", grupo_id: "" });
              setShowFormUsuario(!showFormUsuario);
            }} style={{ background: limiteAtingido ? "#374151" : "#3b82f6", color: limiteAtingido ? "#6b7280" : "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: limiteAtingido ? "not-allowed" : "pointer", fontWeight: "bold" }}>
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

        {showFormUsuario && (
          <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d" }}>
            <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px" }}>{editandoUsuario ? "✏️ Editar Usuário" : "➕ Novo Usuário"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formUsuario.nome} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail *</label><input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} disabled={!!editandoUsuario} style={{ ...IS, opacity: editandoUsuario ? 0.5 : 1 }} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Perfil</label>
                <select value={formUsuario.perfil} onChange={e => setFormUsuario({ ...formUsuario, perfil: e.target.value })} style={IS}>
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Atendente">Atendente</option>
                </select>
              </div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label>
                <select value={formUsuario.fila} onChange={e => setFormUsuario({ ...formUsuario, fila: e.target.value })} style={IS}>
                  <option value="">Selecione...</option>
                  {filas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </select>
              </div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Grupo de Permissão</label>
                <select value={formUsuario.grupo_id} onChange={e => setFormUsuario({ ...formUsuario, grupo_id: e.target.value })} style={IS}>
                  <option value="">Sem grupo (usa padrão do perfil)</option>
                  {gruposPermissao.map(g => <option key={g.id} value={g.id.toString()}>{g.nome}</option>)}
                </select>
              </div>
              {!editandoUsuario && (
                <div style={{ position: "relative" }}>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha *</label>
                  <input type={showSenha ? "text" : "password"} placeholder="Senha (mín 6)" value={formUsuario.senha} onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })} style={{ ...IS, paddingRight: 40 }} />
                  <button onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14 }}>{showSenha ? "🙈" : "👁️"}</button>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowFormUsuario(false); setEditandoUsuario(null); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvarUsuario} disabled={salvandoUsuario} style={{ background: salvandoUsuario ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{salvandoUsuario ? "Salvando..." : "💾 Salvar"}</button>
            </div>
          </div>
        )}

        {usuarios.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}><p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum usuário cadastrado ainda</p></div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0d0d0d" }}>
                {["Nome", "E-mail", "Perfil", "Fila", "Grupo Permissão", "Status", "Ações"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr key={i} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                  <td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{u.nome}</td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: u.perfil === "Administrador" ? "#f59e0b22" : u.perfil === "Supervisor" ? "#8b5cf622" : "#3b82f622", color: u.perfil === "Administrador" ? "#f59e0b" : u.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.perfil}</span>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{u.fila || "—"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {u.grupo_id ? (
                      <span style={{ background: "#8b5cf622", color: "#8b5cf6", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>
                        {gruposPermissao.find(g => g.id === u.grupo_id)?.nome || "—"}
                      </span>
                    ) : <span style={{ color: "#6b7280", fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: u.status === "online" ? "#16a34a22" : "#6b728022", color: u.status === "online" ? "#16a34a" : "#6b7280", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold" }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => abrirEditarUsuario(u)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => excluirUsuario(u)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* FILAS */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>📋 Filas</h2>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{filas.length} fila(s) cadastrada(s)</p>
          </div>
          <button onClick={() => { setFormFila({ nome: "", conexao: "" }); setShowFormFila(!showFormFila); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Nova Fila</button>
        </div>
        {showFormFila && (
          <div style={{ padding: 20, borderBottom: "1px solid #1f2937", background: "#0d0d0d", display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome da Fila *</label><input placeholder="Ex: Fila Vendas" value={formFila.nome} onChange={e => setFormFila({ ...formFila, nome: e.target.value })} style={IS} /></div>
            <div style={{ flex: 1 }}><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Conexão (opcional)</label><input placeholder="Ex: WhatsApp 01" value={formFila.conexao} onChange={e => setFormFila({ ...formFila, conexao: e.target.value })} style={IS} /></div>
            <button onClick={() => { setShowFormFila(false); setFormFila({ nome: "", conexao: "" }); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
            <button onClick={salvarFila} disabled={salvandoFila} style={{ background: salvandoFila ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{salvandoFila ? "Salvando..." : "💾 Salvar"}</button>
          </div>
        )}
        {filas.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>📋</p>
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Nenhuma fila cadastrada ainda</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#0d0d0d" }}>{["Fila", "Conexão", "Usuários", "Ações"].map(h => (<th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>))}</tr></thead>
            <tbody>{filas.map((f, i) => (
              <tr key={f.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                <td style={{ padding: "14px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{f.nome}</td>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>{f.conexao || "—"}</td>
                <td style={{ padding: "14px 16px", color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>{contarUsuariosPorFila(f.nome)}</td>
                <td style={{ padding: "14px 16px" }}>
                  <button onClick={() => excluirFila(f)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* GRUPOS DE PERMISSÃO — agora com 30 permissões em 8 categorias */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>🔒 Grupos de Permissão</h2>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>Defina o que cada grupo pode ver e fazer — 30 permissões em 8 categorias</p>
          </div>
          <button onClick={() => { setEditandoGrupo(null); setFormGrupo({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } }); setShowFormGrupo(!showFormGrupo); }} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Novo Grupo</button>
        </div>

        {showFormGrupo && (
          <div style={{ padding: 24, borderBottom: "1px solid #1f2937", background: "#0d0d0d", display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ color: "#8b5cf6", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>{editandoGrupo ? "✏️ Editar Grupo" : "➕ Novo Grupo"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Ex: Atendente Vendas" value={formGrupo.nome} onChange={e => setFormGrupo({ ...formGrupo, nome: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Descrição</label><input placeholder="Ex: Acesso às vendas e chat" value={formGrupo.descricao} onChange={e => setFormGrupo({ ...formGrupo, descricao: e.target.value })} style={IS} /></div>
            </div>

            {/* Categorias de permissões */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {CATEGORIAS_PERMISSAO.map(cat => {
                const todasMarcadas = cat.permissoes.every(p => formGrupo.permissoes[p.key]);
                const algumaMarcada = cat.permissoes.some(p => formGrupo.permissoes[p.key]);
                const aberta = catsAbertas[cat.nome] !== false;
                return (
                  <div key={cat.nome} style={{ background: "#111", border: `1px solid ${cat.cor}33`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: `${cat.cor}11`, cursor: "pointer" }}
                      onClick={() => setCatsAbertas({ ...catsAbertas, [cat.nome]: !aberta })}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: cat.cor, fontSize: 13, fontWeight: "bold" }}>{aberta ? "▼" : "▶"} {cat.nome}</span>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>
                          {cat.permissoes.filter(p => formGrupo.permissoes[p.key]).length}/{cat.permissoes.length}
                        </span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleCategoriaToda(cat.nome, !todasMarcadas); }}
                        style={{ background: todasMarcadas ? `${cat.cor}44` : algumaMarcada ? `${cat.cor}22` : "#1f2937", color: algumaMarcada || todasMarcadas ? cat.cor : "#9ca3af", border: `1px solid ${cat.cor}44`, borderRadius: 6, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontWeight: "bold" }}>
                        {todasMarcadas ? "✓ Desmarcar todos" : "+ Marcar todos"}
                      </button>
                    </div>
                    {aberta && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 10 }}>
                        {cat.permissoes.map(p => (
                          <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d0d0d", borderRadius: 6, padding: "8px 12px", cursor: "pointer", border: `1px solid ${formGrupo.permissoes[p.key] ? cat.cor + "55" : "#1f2937"}` }}>
                            <input type="checkbox" checked={!!formGrupo.permissoes[p.key]}
                              onChange={e => setFormGrupo({ ...formGrupo, permissoes: { ...formGrupo.permissoes, [p.key]: e.target.checked } })}
                              style={{ accentColor: cat.cor, width: 16, height: 16 }} />
                            <span style={{ color: formGrupo.permissoes[p.key] ? "white" : "#6b7280", fontSize: 12 }}>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowFormGrupo(false); setEditandoGrupo(null); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvarGrupo} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar Grupo</button>
            </div>
          </div>
        )}

        {gruposPermissao.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}><p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum grupo criado ainda</p></div>
        ) : (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {gruposPermissao.map(g => {
              const qtdMarcadas = Object.values(g.permissoes || {}).filter(Boolean).length;
              return (
                <div key={g.id} style={{ background: "#0d0d0d", borderRadius: 10, padding: "16px 20px", border: "1px solid #8b5cf633" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{g.nome}</p>
                      {g.descricao && <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{g.descricao}</p>}
                      <p style={{ color: "#8b5cf6", fontSize: 11, margin: "4px 0 0", fontWeight: "bold" }}>{qtdMarcadas}/30 permissões ativas</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => abrirEditarGrupo(g)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => excluirGrupo(g.id)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(g.permissoes || {}).filter(([_, v]) => v).slice(0, 8).map(([k]) => (
                      <span key={k} style={{ background: "#8b5cf622", color: "#8b5cf6", fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>{LABELS_MAP[k] || k}</span>
                    ))}
                    {qtdMarcadas > 8 && <span style={{ color: "#6b7280", fontSize: 10, padding: "2px 4px" }}>+{qtdMarcadas - 8} outras</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🚫 A seção Roleta foi REMOVIDA daqui. Agora ela fica no Chatbot → Configurações → Roleta de Distribuição */}
      <div style={{ background: "#3b82f611", border: "1px solid #3b82f633", borderRadius: 10, padding: 16 }}>
        <p style={{ color: "#3b82f6", fontSize: 13, margin: 0 }}>
          💡 <b>A Roleta de Distribuição</b> agora fica em <b>Chatbot → Configurações → Roleta</b>, já que está mais relacionada ao fluxo de atendimento do que à configuração do workspace.
        </p>
      </div>
    </div>
  );
}