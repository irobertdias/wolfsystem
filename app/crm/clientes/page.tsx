"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ⚠️ Só este email tem acesso à tela de clientes
const ADMIN_EMAIL = "robert.dias@live.com";

type Cadastro = {
  id: number; created_at: string; nome: string; empresa: string;
  email: string; whatsapp: string; plano: string; autorizado: boolean;
  username: string; workspace_id?: string;
  usuarios_liberados?: number; conexoes_liberadas?: number;
  permite_webjs?: boolean; permite_waba?: boolean; permite_instagram?: boolean;
  // 🆕 módulos por plano
  modulo_roleta?: boolean; modulo_disparos_web?: boolean; modulo_disparos_api?: boolean;
  modulo_voip?: boolean; modulo_api_integracao?: boolean; modulo_instagram?: boolean;
  ia?: string; senha?: string; user_id?: string;
};

type SubUsuario = {
  id: number; nome: string; email: string; perfil: string;
  fila: string; status: string; grupo_id?: number; workspace_id: string;
};

type Grupo = { id: number; nome: string; };

// ═══════════════════════════════════════════════════════════════════════
// 🆕 presets de plano — agora incluem os 6 módulos novos
// ═══════════════════════════════════════════════════════════════════════
// Básico (R$ 444,27): 5 users, 1 conexão — SEM roleta/disparos/voip/API/instagram
// Intermediário (R$ 744,27): 15 users, 3 conexões — COM roleta + disparos_web + api_integracao
// Ultra (R$ 1.044,27): 50 users, 10 conexões — TUDO
// ═══════════════════════════════════════════════════════════════════════
const planoPresets: Record<string, {
  usuarios: number; conexoes: number;
  webjs: boolean; waba: boolean; instagram: boolean;
  modulo_roleta: boolean; modulo_disparos_web: boolean; modulo_disparos_api: boolean;
  modulo_voip: boolean; modulo_api_integracao: boolean; modulo_instagram: boolean;
}> = {
  basico: {
    usuarios: 5, conexoes: 1,
    webjs: true, waba: false, instagram: false,
    modulo_roleta: false, modulo_disparos_web: false, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: false, modulo_instagram: false,
  },
  intermediario: {
    usuarios: 15, conexoes: 3,
    webjs: true, waba: true, instagram: false,
    modulo_roleta: true, modulo_disparos_web: true, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: true, modulo_instagram: false,
  },
  ultra: {
    usuarios: 50, conexoes: 10,
    webjs: true, waba: true, instagram: true,
    modulo_roleta: true, modulo_disparos_web: true, modulo_disparos_api: true,
    modulo_voip: true, modulo_api_integracao: true, modulo_instagram: true,
  },
};

export default function Clientes() {
  const router = useRouter();
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [loadingCadastros, setLoadingCadastros] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [showModalCliente, setShowModalCliente] = useState(false);
  const [showModalDetalhe, setShowModalDetalhe] = useState(false);
  const [cadastroSelecionado, setCadastroSelecionado] = useState<Cadastro | null>(null);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // 🔒 Controle de acesso
  const [permissaoLoading, setPermissaoLoading] = useState(true);
  const [temAcesso, setTemAcesso] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState("");

  // 🔽 Estado das linhas expandidas
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [subUsuariosMap, setSubUsuariosMap] = useState<Record<string, SubUsuario[]>>({});
  const [gruposMap, setGruposMap] = useState<Record<string, Grupo[]>>({});
  const [carregandoSubs, setCarregandoSubs] = useState<Set<string>>(new Set());

  const [formCadastro, setFormCadastro] = useState<Partial<Cadastro>>({
    nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
    username: "",
    usuarios_liberados: 5, conexoes_liberadas: 1,
    permite_webjs: true, permite_waba: false, permite_instagram: false,
    modulo_roleta: false, modulo_disparos_web: false, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: false, modulo_instagram: false,
    ia: "gpt", autorizado: false, senha: "",
  });

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };
  const inputSm = { ...inputStyle, padding: "8px 12px", fontSize: 13 };

  // ═══ Controle de acesso ═══
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setEmailUsuario(user.email || "");
      const admin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setTemAcesso(!!admin);
      setPermissaoLoading(false);
    })();
  }, []);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const fetchCadastros = async () => {
    setLoadingCadastros(true);
    const { data } = await supabase.from("cadastros").select("*").order("created_at", { ascending: false });
    setCadastros(data || []);
    setLoadingCadastros(false);
  };

  useEffect(() => {
    if (!temAcesso) return;
    fetchCadastros();
    const ch = supabase.channel("cadastros_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "cadastros" }, () => fetchCadastros())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, () => fetchCadastros())
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace" }, () => {
        expandidas.forEach(username => carregarSubUsuarios(username));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [temAcesso, expandidas]);

  const carregarSubUsuarios = async (username: string) => {
    if (!username) return;
    setCarregandoSubs(prev => new Set(prev).add(username));
    try {
      const [resSubs, resGrupos] = await Promise.all([
        supabase.from("usuarios_workspace").select("*").eq("workspace_id", username).order("created_at", { ascending: false }),
        supabase.from("grupos_permissao").select("id, nome").eq("workspace_id", username),
      ]);
      setSubUsuariosMap(prev => ({ ...prev, [username]: resSubs.data || [] }));
      setGruposMap(prev => ({ ...prev, [username]: resGrupos.data || [] }));
    } catch (e) { console.error(e); }
    setCarregandoSubs(prev => { const n = new Set(prev); n.delete(username); return n; });
  };

  const toggleExpandir = (username: string) => {
    if (!username) { alert("Este cliente não tem workspace configurado."); return; }
    setExpandidas(prev => {
      const n = new Set(prev);
      if (n.has(username)) n.delete(username);
      else { n.add(username); if (!subUsuariosMap[username]) carregarSubUsuarios(username); }
      return n;
    });
  };

  const autorizarCadastro = async (c: Cadastro) => {
    try {
      await supabase.from("cadastros").update({ autorizado: true }).eq("id", c.id);
      await fetchCadastros();
    } catch { alert("Erro ao autorizar!"); }
  };

  const desautorizarCadastro = async (c: Cadastro) => {
    if (!confirm(`Desautorizar ${c.nome}?`)) return;
    await supabase.from("cadastros").update({ autorizado: false }).eq("id", c.id);
    await fetchCadastros();
  };

  const excluirCadastro = async (c: Cadastro) => {
    if (!confirm(`⚠️ ATENÇÃO: Isso vai apagar PERMANENTEMENTE:\n\n• A conta de login de ${c.email}\n• O workspace "${c.empresa || c.nome}"\n• Todas as conexões, fluxos, atendimentos e mensagens\n\nEsta ação NÃO pode ser desfeita.\n\nTem certeza?`)) return;
    const token = await getToken();
    if (!token) { alert("Sessão expirou. Faça login novamente."); return; }
    try {
      const resp = await fetch("/api/admin/cliente", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: c.email }),
      });
      const result = await resp.json();
      if (!result.success) { alert("Erro ao excluir: " + (result.error || "desconhecido")); return; }
      await fetchCadastros();
      setShowModalDetalhe(false);
      alert("✅ Cliente excluído completamente!");
    } catch (e: any) { alert("Erro ao excluir: " + e.message); }
  };

  const abrirNovo = () => {
    setFormCadastro({
      nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
      username: "",
      usuarios_liberados: 5, conexoes_liberadas: 1,
      permite_webjs: true, permite_waba: false, permite_instagram: false,
      modulo_roleta: false, modulo_disparos_web: false, modulo_disparos_api: false,
      modulo_voip: false, modulo_api_integracao: false, modulo_instagram: false,
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

  // 🆕 Aplica TODAS as flags do preset (incluindo os 6 módulos)
  const aplicarPresetPlano = (plano: string) => {
    const preset = planoPresets[plano];
    if (preset) {
      setFormCadastro(prev => ({
        ...prev,
        plano,
        usuarios_liberados: preset.usuarios,
        conexoes_liberadas: preset.conexoes,
        permite_webjs: preset.webjs,
        permite_waba: preset.waba,
        permite_instagram: preset.instagram,
        modulo_roleta: preset.modulo_roleta,
        modulo_disparos_web: preset.modulo_disparos_web,
        modulo_disparos_api: preset.modulo_disparos_api,
        modulo_voip: preset.modulo_voip,
        modulo_api_integracao: preset.modulo_api_integracao,
        modulo_instagram: preset.modulo_instagram,
      }));
    } else {
      setFormCadastro(prev => ({ ...prev, plano }));
    }
  };

  const salvarCadastro = async () => {
    if (!formCadastro.nome || !formCadastro.email) { alert("Nome e email são obrigatórios!"); return; }
    setSalvandoCliente(true);
    try {
      if (cadastroSelecionado) {
        const { error } = await supabase.from("cadastros").update({
          nome: formCadastro.nome, empresa: formCadastro.empresa,
          whatsapp: formCadastro.whatsapp, plano: formCadastro.plano,
          usuarios_liberados: formCadastro.usuarios_liberados,
          conexoes_liberadas: formCadastro.conexoes_liberadas,
          permite_webjs: formCadastro.permite_webjs,
          permite_waba: formCadastro.permite_waba,
          permite_instagram: formCadastro.permite_instagram,
          // 🆕 módulos
          modulo_roleta: !!formCadastro.modulo_roleta,
          modulo_disparos_web: !!formCadastro.modulo_disparos_web,
          modulo_disparos_api: !!formCadastro.modulo_disparos_api,
          modulo_voip: !!formCadastro.modulo_voip,
          modulo_api_integracao: !!formCadastro.modulo_api_integracao,
          modulo_instagram: !!formCadastro.modulo_instagram,
          ia: formCadastro.ia, autorizado: formCadastro.autorizado,
        }).eq("id", cadastroSelecionado.id);
        if (error) { alert("Erro ao salvar: " + error.message); setSalvandoCliente(false); return; }
        alert("✅ Cliente atualizado!");
      } else {
        if (!formCadastro.senha || formCadastro.senha.length < 6) { alert("Senha obrigatória (mínimo 6 caracteres)"); setSalvandoCliente(false); return; }
        if (!formCadastro.username || !/^[a-z0-9_]{3,30}$/.test(formCadastro.username)) {
          alert("Username inválido. Use letras minúsculas, números e _ (3 a 30 caracteres)");
          setSalvandoCliente(false); return;
        }
        const token = await getToken();
        if (!token) { alert("Sessão expirou."); setSalvandoCliente(false); return; }
        const resp = await fetch("/api/admin/cliente", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(formCadastro),
        });
        const result = await resp.json();
        if (!result.success) {
          if (result.error === "email_exists") alert("❌ Este e-mail já está cadastrado!");
          else if (result.error === "username_exists") alert("❌ Este username já está em uso!");
          else alert("Erro: " + result.error);
          setSalvandoCliente(false);
          return;
        }
        alert("✅ Cliente criado! O cliente já pode fazer login com o email e senha.");
      }
      await fetchCadastros();
      setShowModalCliente(false);
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoCliente(false);
  };

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

  // 🆕 Mini badge pra mostrar módulos liberados (na tabela e no detalhe)
  const BadgeModulo = ({ ativo, icone, label, cor }: { ativo: boolean; icone: string; label: string; cor: string }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: ativo ? `${cor}22` : "#1f293733",
      color: ativo ? cor : "#4b5563",
      fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: "bold",
      opacity: ativo ? 1 : 0.4,
    }} title={label}>
      {icone} {label}
    </span>
  );

  const cadastrosFiltrados = cadastros
    .filter(c => filtroStatus === "todos" || (filtroStatus === "ativos" ? c.autorizado : !c.autorizado))
    .filter(c => !buscaCliente || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.email?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.empresa?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.whatsapp?.includes(buscaCliente));

  if (permissaoLoading) {
    return <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>Carregando...</div>;
  }

  if (!temAcesso) {
    return (
      <div style={{ padding: 48, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 64 }}>🔒</span>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: "bold", margin: 0 }}>Acesso Restrito</h2>
        <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>Esta área é exclusiva do administrador master do sistema.</p>
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Logado como: {emailUsuario}</p>
        <button onClick={() => router.push("/crm")} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold", marginTop: 12 }}>← Voltar ao CRM</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL CRIAR/EDITAR
      ═══════════════════════════════════════════════════════════════ */}
      {showModalCliente && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 720, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado ? "✏️ Editar Cliente" : "➕ Novo Cliente Wolf"}</h2>
              <button onClick={() => setShowModalCliente(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            {/* Dados pessoais */}
            <div>
              <p style={{ color: "#16a34a", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>👤 Dados Pessoais</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formCadastro.nome || ""} onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })} style={inputSm} /></div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Empresa</label><input placeholder="Nome da empresa" value={formCadastro.empresa || ""} onChange={e => setFormCadastro({ ...formCadastro, empresa: e.target.value })} style={inputSm} /></div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Email * {cadastroSelecionado && <span style={{ color: "#6b7280", textTransform: "none" }}>(não pode mudar)</span>}
                  </label>
                  <input placeholder="email@empresa.com" value={formCadastro.email || ""} onChange={e => setFormCadastro({ ...formCadastro, email: e.target.value })} style={inputSm} disabled={!!cadastroSelecionado} />
                </div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>WhatsApp</label><input placeholder="(62) 99999-9999" value={formCadastro.whatsapp || ""} onChange={e => setFormCadastro({ ...formCadastro, whatsapp: e.target.value })} style={inputSm} /></div>
                {!cadastroSelecionado && (
                  <>
                    <div>
                      <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Username *</label>
                      <input placeholder="ex: abc_company" value={formCadastro.username || ""}
                        onChange={e => setFormCadastro({ ...formCadastro, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                        style={inputSm} maxLength={30} />
                      <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>a-z, 0-9, _ — 3 a 30 chars</p>
                    </div>
                    <div>
                      <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha *</label>
                      <input type="password" placeholder="Senha de acesso (mín 6)" value={formCadastro.senha || ""} onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })} style={inputSm} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Plano — com valores atualizados */}
            <div>
              <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>📦 Plano</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { key: "basico", label: "Básico", color: "#16a34a", usuarios: 5, conexoes: 1, preco: "R$ 444,27" },
                  { key: "intermediario", label: "Intermediário", color: "#3b82f6", usuarios: 15, conexoes: 3, preco: "R$ 744,27" },
                  { key: "ultra", label: "Ultra", color: "#8b5cf6", usuarios: 50, conexoes: 10, preco: "R$ 1.044,27" },
                ].map(p => (
                  <button key={p.key} onClick={() => aplicarPresetPlano(p.key)} style={{ flex: 1, background: formCadastro.plano === p.key ? `${p.color}22` : "#1f2937", border: `2px solid ${formCadastro.plano === p.key ? p.color : "#374151"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center" }}>
                    <p style={{ color: formCadastro.plano === p.key ? p.color : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>{p.label}</p>
                    <p style={{ color: formCadastro.plano === p.key ? p.color : "#6b7280", fontSize: 11, margin: "0 0 2px 0", fontWeight: "bold" }}>{p.preco}</p>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{p.usuarios} usuários • {p.conexoes} conexões</p>
                  </button>
                ))}
              </div>
              <p style={{ color: "#6b7280", fontSize: 10, margin: "8px 0 0", fontStyle: "italic" }}>
                💡 Ao selecionar o plano, os limites e módulos abaixo são preenchidos automaticamente. Você pode ajustar individualmente.
              </p>
            </div>

            {/* Limites Personalizados */}
            <div>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>⚙️ Limites Personalizados</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>👥 Usuários Liberados</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 3, 5, 7, 10, 15, 20, 50].map(n => <button key={n} onClick={() => setFormCadastro({ ...formCadastro, usuarios_liberados: n })} style={{ background: formCadastro.usuarios_liberados === n ? "#f59e0b" : "#1f2937", color: formCadastro.usuarios_liberados === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{n}</button>)}
                  </div>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>📱 Conexões Liberadas</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 2, 3, 5, 10, 15, 20].map(n => <button key={n} onClick={() => setFormCadastro({ ...formCadastro, conexoes_liberadas: n })} style={{ background: formCadastro.conexoes_liberadas === n ? "#3b82f6" : "#1f2937", color: formCadastro.conexoes_liberadas === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{n}</button>)}
                  </div>
                </div>
              </div>
            </div>

            {/* Tipos de Conexão permitidos */}
            <div>
              <p style={{ color: "#e1306c", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>🔌 Tipos de Conexão Permitidos</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Toggle value={!!formCadastro.permite_webjs} onChange={() => setFormCadastro({ ...formCadastro, permite_webjs: !formCadastro.permite_webjs })} label="📱 WhatsApp Web (QR Code)" desc="Conexão via QR Code — gratuita" color="#16a34a" />
                <Toggle value={!!formCadastro.permite_waba} onChange={() => setFormCadastro({ ...formCadastro, permite_waba: !formCadastro.permite_waba })} label="🔗 API Meta (WABA)" desc="API oficial do WhatsApp Business" color="#3b82f6" />
                <Toggle value={!!formCadastro.permite_instagram} onChange={() => setFormCadastro({ ...formCadastro, permite_instagram: !formCadastro.permite_instagram })} label="📸 Instagram Direct" desc="Mensagens do Instagram Direct" color="#e1306c" />
              </div>
            </div>

            {/* 🆕 MÓDULOS LIBERADOS */}
            <div>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>🎁 Módulos Liberados</p>
              <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 12px 0", fontStyle: "italic" }}>
                Controle quais módulos o cliente pode acessar. Módulos não liberados aparecem no menu mas mostram tela de upsell ao clicar.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Toggle value={!!formCadastro.modulo_roleta} onChange={() => setFormCadastro({ ...formCadastro, modulo_roleta: !formCadastro.modulo_roleta })} label="🎯 Roleta de Distribuição" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_disparos_web} onChange={() => setFormCadastro({ ...formCadastro, modulo_disparos_web: !formCadastro.modulo_disparos_web })} label="📤 Disparos Web" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_disparos_api} onChange={() => setFormCadastro({ ...formCadastro, modulo_disparos_api: !formCadastro.modulo_disparos_api })} label="📨 Disparos API" desc="Apenas Ultra" color="#8b5cf6" />
                <Toggle value={!!formCadastro.modulo_voip} onChange={() => setFormCadastro({ ...formCadastro, modulo_voip: !formCadastro.modulo_voip })} label="📞 Ligações VOIP" desc="Apenas Ultra" color="#8b5cf6" />
                <Toggle value={!!formCadastro.modulo_api_integracao} onChange={() => setFormCadastro({ ...formCadastro, modulo_api_integracao: !formCadastro.modulo_api_integracao })} label="🔌 API de Integração" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_instagram} onChange={() => setFormCadastro({ ...formCadastro, modulo_instagram: !formCadastro.modulo_instagram })} label="📸 Instagram Direct (Módulo)" desc="Apenas Ultra" color="#e1306c" />
              </div>
            </div>

            {/* Autorização final */}
            <Toggle value={!!formCadastro.autorizado} onChange={() => setFormCadastro({ ...formCadastro, autorizado: !formCadastro.autorizado })} label="✅ Autorizado — Permitir acesso ao sistema" color="#16a34a" />

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModalCliente(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvarCadastro} disabled={salvandoCliente} style={{ background: salvandoCliente ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{salvandoCliente ? "Salvando..." : cadastroSelecionado ? "💾 Salvar" : "➕ Criar Cliente"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL DETALHE
      ═══════════════════════════════════════════════════════════════ */}
      {showModalDetalhe && cadastroSelecionado && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 640, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: cadastroSelecionado.autorizado ? "#16a34a22" : "#f59e0b22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏢</div>
                <div>
                  <h2 style={{ color: "white", fontSize: 20, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado.nome}</h2>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>{cadastroSelecionado.empresa || "Sem empresa"}{cadastroSelecionado.username && ` • @${cadastroSelecionado.username}`}</p>
                  <span style={{ background: cadastroSelecionado.autorizado ? "#16a34a22" : "#f59e0b22", color: cadastroSelecionado.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{cadastroSelecionado.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span>
                </div>
              </div>
              <button onClick={() => setShowModalDetalhe(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ label: "Email", value: cadastroSelecionado.email, icon: "✉️" }, { label: "WhatsApp", value: cadastroSelecionado.whatsapp, icon: "📱" }, { label: "Plano", value: cadastroSelecionado.plano, icon: "📦" }, { label: "IA", value: cadastroSelecionado.ia, icon: "🤖" }].filter(i => i.value).map(info => (
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

            {/* 🆕 Módulos no detalhe */}
            <div style={{ background: "#1f2937", borderRadius: 10, padding: 16 }}>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>🎁 Módulos Liberados</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_roleta} icone="🎯" label="Roleta" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_disparos_web} icone="📤" label="Disparos Web" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_disparos_api} icone="📨" label="Disparos API" cor="#8b5cf6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_voip} icone="📞" label="VOIP" cor="#8b5cf6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_api_integracao} icone="🔌" label="API Integração" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_instagram} icone="📸" label="Instagram" cor="#e1306c" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!cadastroSelecionado.autorizado
                ? <button onClick={() => { autorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✅ Autorizar Acesso</button>
                : <button onClick={() => { desautorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }} style={{ flex: 1, background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🚫 Desautorizar</button>
              }
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
        {[{ label: "Total", value: cadastros.length, color: "#8b5cf6", icon: "📊" }, { label: "Ativos", value: cadastros.filter(c => c.autorizado).length, color: "#16a34a", icon: "✅" }, { label: "Pendentes", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b", icon: "⏳" }].map(card => (
          <div key={card.label} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px 0", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
            <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar por nome, email, empresa, WhatsApp..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} style={{ ...inputStyle, maxWidth: 380, padding: "8px 14px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {[{ key: "todos", label: "Todos", color: "#8b5cf6" }, { key: "ativos", label: "✅ Ativos", color: "#16a34a" }, { key: "pendentes", label: "⏳ Pendentes", color: "#f59e0b" }].map(f => (
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
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "#0d0d0d" }}>
                {["", "Cliente", "Plano", "👥", "📱", "Conexões", "🎁 Módulos", "Status", "Ações"].map((h, i) => (
                  <th key={i} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cadastrosFiltrados.map((c, i) => {
                const username = c.username || "";
                const expandida = expandidas.has(username);
                const subs = subUsuariosMap[username] || [];
                const grupos = gruposMap[username] || [];
                const carregando = carregandoSubs.has(username);

                return (
                  <>
                    <tr key={c.id} style={{ borderTop: "1px solid #1f2937", background: expandida ? "#0d1a10" : (i % 2 === 0 ? "#111" : "#0d0d0d") }}>
                      <td style={{ padding: "14px 10px 14px 16px", width: 30 }}>
                        <button onClick={() => toggleExpandir(username)} disabled={!username}
                          style={{ background: "none", border: "none", color: expandida ? "#16a34a" : "#6b7280", cursor: username ? "pointer" : "not-allowed", fontSize: 14, opacity: username ? 1 : 0.3 }}
                          title={username ? (expandida ? "Ocultar sub-usuários" : "Ver sub-usuários") : "Cliente sem workspace"}>
                          {expandida ? "▼" : "▶"}
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div>
                          <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{c.nome}</p>
                          <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>{c.email}</p>
                          {c.empresa && <p style={{ color: "#4b5563", fontSize: 10, margin: 0 }}>{c.empresa}{c.username && ` • @${c.username}`}</p>}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}><span style={{ background: c.plano === "ultra" ? "#8b5cf622" : c.plano === "intermediario" ? "#3b82f622" : "#16a34a22", color: c.plano === "ultra" ? "#8b5cf6" : c.plano === "intermediario" ? "#3b82f6" : "#16a34a", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.plano === "intermediario" ? "Intermediário" : c.plano === "ultra" ? "Ultra" : "Básico"}</span></td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.usuarios_liberados || 1}</span></td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.conexoes_liberadas || 1}</span></td>
                      <td style={{ padding: "14px 16px" }}><div style={{ display: "flex", gap: 4 }}>{c.permite_webjs && <span style={{ fontSize: 14 }} title="WhatsApp Web">📱</span>}{c.permite_waba && <span style={{ fontSize: 14 }} title="API Meta">🔗</span>}{c.permite_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}</div></td>

                      {/* 🆕 Coluna de módulos */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {c.modulo_roleta && <span style={{ fontSize: 14 }} title="Roleta">🎯</span>}
                          {c.modulo_disparos_web && <span style={{ fontSize: 14 }} title="Disparos Web">📤</span>}
                          {c.modulo_disparos_api && <span style={{ fontSize: 14 }} title="Disparos API">📨</span>}
                          {c.modulo_voip && <span style={{ fontSize: 14 }} title="Ligações VOIP">📞</span>}
                          {c.modulo_api_integracao && <span style={{ fontSize: 14 }} title="API Integração">🔌</span>}
                          {c.modulo_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}
                          {!c.modulo_roleta && !c.modulo_disparos_web && !c.modulo_disparos_api && !c.modulo_voip && !c.modulo_api_integracao && !c.modulo_instagram && <span style={{ color: "#4b5563", fontSize: 11, fontStyle: "italic" }}>nenhum</span>}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}><span style={{ background: c.autorizado ? "#16a34a22" : "#f59e0b22", color: c.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span></td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setCadastroSelecionado(c); setShowModalDetalhe(true); }} style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>👁️</button>
                          {!c.autorizado ? <button onClick={() => autorizarCadastro(c)} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>✅</button> : <button onClick={() => desautorizarCadastro(c)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🚫</button>}
                          <button onClick={() => abrirEditar(c)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                          <button onClick={() => excluirCadastro(c)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                        </div>
                      </td>
                    </tr>

                    {/* LINHA EXPANDIDA — SUB-USUÁRIOS */}
                    {expandida && (
                      <tr key={`${c.id}-expandido`} style={{ background: "#0a1510" }}>
                        <td colSpan={9} style={{ padding: "0 24px 16px 50px" }}>
                          <div style={{ borderLeft: "2px solid #16a34a44", paddingLeft: 16, paddingTop: 8 }}>
                            <p style={{ color: "#16a34a", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px" }}>
                              👥 Sub-usuários do workspace @{username}
                            </p>

                            {carregando ? (
                              <p style={{ color: "#6b7280", fontSize: 12, fontStyle: "italic", margin: "8px 0" }}>Carregando...</p>
                            ) : subs.length === 0 ? (
                              <p style={{ color: "#6b7280", fontSize: 12, fontStyle: "italic", margin: "8px 0" }}>
                                Nenhum sub-usuário cadastrado neste workspace ainda
                              </p>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                                <thead>
                                  <tr style={{ background: "#0d0d0d" }}>
                                    {["Nome", "Email", "Perfil", "Fila", "Grupo", "Status"].map(h => (
                                      <th key={h} style={{ padding: "8px 12px", color: "#6b7280", fontSize: 10, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {subs.map(s => (
                                    <tr key={s.id} style={{ borderTop: "1px solid #1f2937" }}>
                                      <td style={{ padding: "8px 12px", color: "white", fontSize: 12, fontWeight: "bold" }}>{s.nome}</td>
                                      <td style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 12 }}>{s.email}</td>
                                      <td style={{ padding: "8px 12px" }}>
                                        <span style={{ background: s.perfil === "Administrador" ? "#f59e0b22" : s.perfil === "Supervisor" ? "#8b5cf622" : "#3b82f622", color: s.perfil === "Administrador" ? "#f59e0b" : s.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: "bold" }}>{s.perfil}</span>
                                      </td>
                                      <td style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 12 }}>{s.fila || "—"}</td>
                                      <td style={{ padding: "8px 12px" }}>
                                        {s.grupo_id ? (
                                          <span style={{ background: "#8b5cf622", color: "#8b5cf6", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: "bold" }}>
                                            {grupos.find(g => g.id === s.grupo_id)?.nome || "—"}
                                          </span>
                                        ) : <span style={{ color: "#6b7280", fontSize: 11 }}>—</span>}
                                      </td>
                                      <td style={{ padding: "8px 12px" }}>
                                        <span style={{ background: s.status === "online" ? "#16a34a22" : "#6b728022", color: s.status === "online" ? "#16a34a" : "#6b7280", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: "bold" }}>
                                          {s.status === "online" ? "🟢 Online" : "⚫ Offline"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}