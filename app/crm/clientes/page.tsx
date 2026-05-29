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
  modulo_roleta?: boolean; modulo_disparos_web?: boolean; modulo_disparos_api?: boolean;
  modulo_voip?: boolean; modulo_api_integracao?: boolean; modulo_instagram?: boolean;
  // 🆕 3 módulos novos
  modulo_cobranca?: boolean;        // 💰 Cobrança Automatizada (Ultra)
  modulo_equipes?: boolean;          // 👥 Equipes Multi-time (Intermediário, Ultra)
  modulo_funil_avancado?: boolean;   // 📊 Funil Avançado com etiquetas (Intermediário, Ultra)
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
  // 🆕 novos
  modulo_cobranca: boolean; modulo_equipes: boolean; modulo_funil_avancado: boolean;
}> = {
  basico: {
    usuarios: 5, conexoes: 1,
    webjs: true, waba: false, instagram: false,
    modulo_roleta: false, modulo_disparos_web: false, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: false, modulo_instagram: false,
    modulo_cobranca: false, modulo_equipes: false, modulo_funil_avancado: false,
  },
  intermediario: {
    usuarios: 15, conexoes: 3,
    webjs: true, waba: true, instagram: false,
    modulo_roleta: true, modulo_disparos_web: true, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: true, modulo_instagram: false,
    // Intermediário: Equipes + Funil Avançado (Cobrança fica só no Ultra)
    modulo_cobranca: false, modulo_equipes: true, modulo_funil_avancado: true,
  },
  ultra: {
    usuarios: 50, conexoes: 10,
    webjs: true, waba: true, instagram: true,
    modulo_roleta: true, modulo_disparos_web: true, modulo_disparos_api: true,
    modulo_voip: true, modulo_api_integracao: true, modulo_instagram: true,
    // Ultra: TUDO ligado
    modulo_cobranca: true, modulo_equipes: true, modulo_funil_avancado: true,
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

  // 🆕 FASE 3 MOBILE
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🔒 Controle de acesso
  const [permissaoLoading, setPermissaoLoading] = useState(true);
  const [temAcesso, setTemAcesso] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState("");

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
    // 🆕 novos módulos: começam desligados, presets/escolha manual ligam
    modulo_cobranca: false, modulo_equipes: false, modulo_funil_avancado: false,
    ia: "gpt", autorizado: false, senha: "",
  });

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
  const inputSm = { ...inputStyle, padding: "9px 12px", fontSize: 13 };
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

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
      // 🆕 novos
      modulo_cobranca: false, modulo_equipes: false, modulo_funil_avancado: false,
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
        // 🆕 novos
        modulo_cobranca: preset.modulo_cobranca,
        modulo_equipes: preset.modulo_equipes,
        modulo_funil_avancado: preset.modulo_funil_avancado,
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
          modulo_roleta: !!formCadastro.modulo_roleta,
          modulo_disparos_web: !!formCadastro.modulo_disparos_web,
          modulo_disparos_api: !!formCadastro.modulo_disparos_api,
          modulo_voip: !!formCadastro.modulo_voip,
          modulo_api_integracao: !!formCadastro.modulo_api_integracao,
          modulo_instagram: !!formCadastro.modulo_instagram,
          // 🆕 novos
          modulo_cobranca: !!formCadastro.modulo_cobranca,
          modulo_equipes: !!formCadastro.modulo_equipes,
          modulo_funil_avancado: !!formCadastro.modulo_funil_avancado,
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

  // 🎨 TOGGLE LIGHT TECH
  const Toggle = ({ value, onChange, label, desc, color = "#16a34a" }: { value: boolean; onChange: () => void; label: string; desc?: string; color?: string }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: value ? `${color}10` : "#f9fafb",
      borderRadius: 10, padding: "12px 16px",
      border: `1px solid ${value ? `${color}40` : "#e5e7eb"}`,
      transition: "all 0.15s",
    }}>
      <div>
        <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{label}</p>
        {desc && <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0 0" }}>{desc}</p>}
      </div>
      <button onClick={onChange}
        style={{
          width: 44, height: 24,
          background: value ? color : "#d1d5db",
          borderRadius: 12, cursor: "pointer", border: "none",
          position: "relative", flexShrink: 0, transition: "background 0.2s",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
        }}>
        <div style={{
          width: 18, height: 18, background: "white", borderRadius: "50%",
          position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );

  const BadgeModulo = ({ ativo, icone, label, cor }: { ativo: boolean; icone: string; label: string; cor: string }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: ativo ? `${cor}15` : "#f3f4f6",
      color: ativo ? cor : "#9ca3af",
      border: `1px solid ${ativo ? `${cor}40` : "#e5e7eb"}`,
      fontSize: 10, padding: "3px 10px", borderRadius: 10, fontWeight: 700,
      opacity: ativo ? 1 : 0.5,
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
      <div style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, boxShadow: "0 12px 24px rgba(239,68,68,0.25)",
        }}>
          <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
        </div>
        <h2 style={{ color: "#1f2937", fontSize: 20, fontWeight: 700, margin: 0 }}>Acesso Restrito</h2>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0, textAlign: "center" }}>Esta área é exclusiva do administrador master do sistema.</p>
        <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>Logado como: <b>{emailUsuario}</b></p>
        <button onClick={() => router.push("/crm")}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700, marginTop: 8,
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}>
          ← Voltar ao CRM
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL CRIAR/EDITAR
      ═══════════════════════════════════════════════════════════════ */}
      {showModalCliente && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, padding: 28, width: "100%", maxWidth: 740, display: "flex", flexDirection: "column", gap: 20, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: 0 }}>{cadastroSelecionado ? "✏️ Editar Cliente" : "➕ Novo Cliente Wolf"}</h2>
              <button onClick={() => setShowModalCliente(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Dados pessoais */}
            <div>
              <p style={{ color: "#16a34a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>👤 Dados Pessoais</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div><label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Nome *</label><input placeholder="Nome completo" value={formCadastro.nome || ""} onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })} style={inputSm} /></div>
                <div><label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Empresa</label><input placeholder="Nome da empresa" value={formCadastro.empresa || ""} onChange={e => setFormCadastro({ ...formCadastro, empresa: e.target.value })} style={inputSm} /></div>
                <div>
                  <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                    Email * {cadastroSelecionado && <span style={{ color: "#9ca3af", textTransform: "none", fontWeight: 500 }}>(não pode mudar)</span>}
                  </label>
                  <input placeholder="email@empresa.com" value={formCadastro.email || ""} onChange={e => setFormCadastro({ ...formCadastro, email: e.target.value })} style={{ ...inputSm, background: cadastroSelecionado ? "#f3f4f6" : "#ffffff", color: cadastroSelecionado ? "#6b7280" : "#1f2937" }} disabled={!!cadastroSelecionado} />
                </div>
                <div><label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>WhatsApp</label><input placeholder="(62) 99999-9999" value={formCadastro.whatsapp || ""} onChange={e => setFormCadastro({ ...formCadastro, whatsapp: e.target.value })} style={inputSm} /></div>
                {!cadastroSelecionado && (
                  <>
                    <div>
                      <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Username *</label>
                      <input placeholder="ex: abc_company" value={formCadastro.username || ""}
                        onChange={e => setFormCadastro({ ...formCadastro, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                        style={{ ...inputSm, fontFamily: "monospace" }} maxLength={30} />
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0" }}>a-z, 0-9, _ — 3 a 30 chars</p>
                    </div>
                    <div>
                      <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Senha *</label>
                      <input type="password" placeholder="Senha de acesso (mín 6)" value={formCadastro.senha || ""} onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })} style={inputSm} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Plano */}
            <div>
              <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>📦 Plano</p>
              <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
                {[
                  { key: "basico", label: "Básico", color: "#16a34a", usuarios: 5, conexoes: 1, preco: "R$ 444,27" },
                  { key: "intermediario", label: "Intermediário", color: "#3b82f6", usuarios: 15, conexoes: 3, preco: "R$ 744,27" },
                  { key: "ultra", label: "Ultra", color: "#8b5cf6", usuarios: 50, conexoes: 10, preco: "R$ 1.044,27" },
                ].map(p => {
                  const ativo = formCadastro.plano === p.key;
                  return (
                    <button key={p.key} onClick={() => aplicarPresetPlano(p.key)}
                      style={{
                        flex: 1,
                        background: ativo ? `${p.color}10` : "#f9fafb",
                        border: `2px solid ${ativo ? p.color : "#e5e7eb"}`,
                        borderRadius: 12, padding: "14px 10px",
                        cursor: "pointer", textAlign: "center",
                        transition: "all 0.15s",
                        boxShadow: ativo ? `0 4px 12px ${p.color}25` : "none",
                      }}>
                      <p style={{ color: ativo ? p.color : "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>{p.label}</p>
                      <p style={{ color: ativo ? p.color : "#374151", fontSize: 12, margin: "0 0 4px", fontWeight: 700 }}>{p.preco}</p>
                      <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{p.usuarios} usuários · {p.conexoes} conexões</p>
                    </button>
                  );
                })}
              </div>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "10px 0 0", fontStyle: "italic" }}>
                💡 Ao selecionar o plano, os limites e módulos abaixo são preenchidos automaticamente. Você pode ajustar individualmente.
              </p>
            </div>

            {/* Limites Personalizados */}
            <div>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>⚙️ Limites Personalizados</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>👥 Usuários Liberados</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 3, 5, 7, 10, 15, 20, 50].map(n => {
                      const ativo = formCadastro.usuarios_liberados === n;
                      return (
                        <button key={n} onClick={() => setFormCadastro({ ...formCadastro, usuarios_liberados: n })}
                          style={{
                            background: ativo ? "#f59e0b" : "#f9fafb",
                            color: ativo ? "white" : "#6b7280",
                            border: `1px solid ${ativo ? "#f59e0b" : "#e5e7eb"}`,
                            borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                            boxShadow: ativo ? "0 2px 6px rgba(245,158,11,0.3)" : "none",
                          }}>{n}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>📱 Conexões Liberadas</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 2, 3, 5, 10, 15, 20].map(n => {
                      const ativo = formCadastro.conexoes_liberadas === n;
                      return (
                        <button key={n} onClick={() => setFormCadastro({ ...formCadastro, conexoes_liberadas: n })}
                          style={{
                            background: ativo ? "#3b82f6" : "#f9fafb",
                            color: ativo ? "white" : "#6b7280",
                            border: `1px solid ${ativo ? "#3b82f6" : "#e5e7eb"}`,
                            borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                            boxShadow: ativo ? "0 2px 6px rgba(59,130,246,0.3)" : "none",
                          }}>{n}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Tipos de Conexão permitidos */}
            <div>
              <p style={{ color: "#ec4899", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>🔌 Tipos de Conexão Permitidos</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Toggle value={!!formCadastro.permite_webjs} onChange={() => setFormCadastro({ ...formCadastro, permite_webjs: !formCadastro.permite_webjs })} label="📱 WhatsApp Web (QR Code)" desc="Conexão via QR Code — gratuita" color="#16a34a" />
                <Toggle value={!!formCadastro.permite_waba} onChange={() => setFormCadastro({ ...formCadastro, permite_waba: !formCadastro.permite_waba })} label="🔗 API Meta (WABA)" desc="API oficial do WhatsApp Business" color="#3b82f6" />
                <Toggle value={!!formCadastro.permite_instagram} onChange={() => setFormCadastro({ ...formCadastro, permite_instagram: !formCadastro.permite_instagram })} label="📸 Instagram Direct" desc="Mensagens do Instagram Direct" color="#ec4899" />
              </div>
            </div>

            {/* 🆕 MÓDULOS LIBERADOS */}
            <div>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" }}>🎁 Módulos Liberados</p>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 12px", fontStyle: "italic" }}>
                Controle quais módulos o cliente pode acessar. Módulos não liberados aparecem no menu mas mostram tela de upsell ao clicar.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                <Toggle value={!!formCadastro.modulo_roleta} onChange={() => setFormCadastro({ ...formCadastro, modulo_roleta: !formCadastro.modulo_roleta })} label="🎯 Roleta de Distribuição" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_disparos_web} onChange={() => setFormCadastro({ ...formCadastro, modulo_disparos_web: !formCadastro.modulo_disparos_web })} label="📤 Disparos Web" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_disparos_api} onChange={() => setFormCadastro({ ...formCadastro, modulo_disparos_api: !formCadastro.modulo_disparos_api })} label="📨 Disparos API" desc="Apenas Ultra" color="#8b5cf6" />
                <Toggle value={!!formCadastro.modulo_voip} onChange={() => setFormCadastro({ ...formCadastro, modulo_voip: !formCadastro.modulo_voip })} label="📞 Ligações VOIP" desc="Apenas Ultra" color="#8b5cf6" />
                <Toggle value={!!formCadastro.modulo_api_integracao} onChange={() => setFormCadastro({ ...formCadastro, modulo_api_integracao: !formCadastro.modulo_api_integracao })} label="🔌 API de Integração" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_instagram} onChange={() => setFormCadastro({ ...formCadastro, modulo_instagram: !formCadastro.modulo_instagram })} label="📸 Instagram Direct (Módulo)" desc="Apenas Ultra" color="#ec4899" />
                {/* 🆕 3 módulos novos */}
                <Toggle value={!!formCadastro.modulo_equipes} onChange={() => setFormCadastro({ ...formCadastro, modulo_equipes: !formCadastro.modulo_equipes })} label="👥 Equipes Multi-time" desc="Intermediário, Ultra" color="#a855f7" />
                <Toggle value={!!formCadastro.modulo_funil_avancado} onChange={() => setFormCadastro({ ...formCadastro, modulo_funil_avancado: !formCadastro.modulo_funil_avancado })} label="📊 Funil Avançado" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_cobranca} onChange={() => setFormCadastro({ ...formCadastro, modulo_cobranca: !formCadastro.modulo_cobranca })} label="💰 Cobrança Automatizada" desc="Apenas Ultra" color="#dc2626" />
              </div>
            </div>

            {/* Autorização final */}
            <Toggle value={!!formCadastro.autorizado} onChange={() => setFormCadastro({ ...formCadastro, autorizado: !formCadastro.autorizado })} label="✅ Autorizado — Permitir acesso ao sistema" color="#16a34a" />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setShowModalCliente(false)}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvarCadastro} disabled={salvandoCliente}
                style={{
                  background: salvandoCliente ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}>
                {salvandoCliente ? "Salvando..." : cadastroSelecionado ? "💾 Salvar" : "➕ Criar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL DETALHE
      ═══════════════════════════════════════════════════════════════ */}
      {showModalDetalhe && cadastroSelecionado && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, padding: 28, width: "100%", maxWidth: 660, display: "flex", flexDirection: "column", gap: 18, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: cadastroSelecionado.autorizado
                    ? "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
                    : "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                  boxShadow: cadastroSelecionado.autorizado ? "0 8px 20px rgba(22,163,74,0.25)" : "0 8px 20px rgba(245,158,11,0.25)",
                }}>
                  <span style={{ filter: "saturate(0) brightness(2)" }}>🏢</span>
                </div>
                <div>
                  <h2 style={{ color: "#1f2937", fontSize: 20, fontWeight: 700, margin: 0 }}>{cadastroSelecionado.nome}</h2>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 6px 0" }}>{cadastroSelecionado.empresa || "Sem empresa"}{cadastroSelecionado.username && ` · @${cadastroSelecionado.username}`}</p>
                  <span style={{
                    background: cadastroSelecionado.autorizado ? "#f0fdf4" : "#fffbeb",
                    color: cadastroSelecionado.autorizado ? "#16a34a" : "#f59e0b",
                    border: `1px solid ${cadastroSelecionado.autorizado ? "#bbf7d0" : "#fde68a"}`,
                    fontSize: 11, padding: "3px 12px", borderRadius: 20, fontWeight: 700,
                  }}>{cadastroSelecionado.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span>
                </div>
              </div>
              <button onClick={() => setShowModalDetalhe(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {[{ label: "Email", value: cadastroSelecionado.email, icon: "✉️" }, { label: "WhatsApp", value: cadastroSelecionado.whatsapp, icon: "📱" }, { label: "Plano", value: cadastroSelecionado.plano, icon: "📦" }, { label: "IA", value: cadastroSelecionado.ia, icon: "🤖" }].filter(i => i.value).map(info => (
                <div key={info.label} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                  <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px 0" }}>{info.icon} {info.label}</p>
                  <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>{info.value}</p>
                </div>
              ))}
            </div>

            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>⚙️ Limites do Plano</p>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1, textAlign: "center", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, borderTop: "3px solid #f59e0b" }}>
                  <p style={{ color: "#f59e0b", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{cadastroSelecionado.usuarios_liberados || 1}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>👥 Usuários</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, borderTop: "3px solid #3b82f6" }}>
                  <p style={{ color: "#3b82f6", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{cadastroSelecionado.conexoes_liberadas || 1}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>📱 Conexões</p>
                </div>
              </div>
            </div>

            {/* 🆕 Módulos no detalhe */}
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>🎁 Módulos Liberados</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_roleta} icone="🎯" label="Roleta" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_disparos_web} icone="📤" label="Disparos Web" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_disparos_api} icone="📨" label="Disparos API" cor="#8b5cf6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_voip} icone="📞" label="VOIP" cor="#8b5cf6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_api_integracao} icone="🔌" label="API Integração" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_instagram} icone="📸" label="Instagram" cor="#ec4899" />
                {/* 🆕 novos */}
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_equipes} icone="👥" label="Equipes" cor="#a855f7" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_funil_avancado} icone="📊" label="Funil Avançado" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_cobranca} icone="💰" label="Cobrança" cor="#dc2626" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!cadastroSelecionado.autorizado
                ? <button onClick={() => { autorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }}
                    style={{ flex: 1, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>
                    ✅ Autorizar Acesso
                  </button>
                : <button onClick={() => { desautorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }}
                    style={{ flex: 1, background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                    🚫 Desautorizar
                  </button>
              }
              <button onClick={() => abrirEditar(cadastroSelecionado)}
                style={{ flex: 1, background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                ✏️ Editar
              </button>
              <button onClick={() => excluirCadastro(cadastroSelecionado)}
                style={{ flex: 1, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                🗑️ Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(139,92,246,0.25)",
            flexShrink: 0,
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🏢</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Clientes Wolf System</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0 0" }}>
              <b style={{ color: "#16a34a" }}>{cadastros.filter(c => c.autorizado).length}</b> ativos · <b style={{ color: "#f59e0b" }}>{cadastros.filter(c => !c.autorizado).length}</b> pendentes · <b>{cadastros.length}</b> total
            </p>
          </div>
        </div>
        <button onClick={abrirNovo}
          style={{
            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
          }}>
          + Novo Cliente
        </button>
      </div>

      {/* ═══ STATS ═══ */}
      <div style={{ display: "flex", gap: isMobile ? 10 : 16, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: cadastros.length, color: "#8b5cf6", icon: "📊" },
          { label: "Ativos", value: cadastros.filter(c => c.autorizado).length, color: "#16a34a", icon: "✅" },
          { label: "Pendentes", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b", icon: "⏳" },
        ].map(card => (
          <div key={card.label}
            style={{
              flex: isMobile ? "1 1 calc(33% - 7px)" : 1, minWidth: isMobile ? 0 : 120,
              ...cardStyle,
              padding: isMobile ? 14 : 20,
              borderTop: `3px solid ${card.color}`,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 20px ${card.color}20`; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                {card.icon}
              </div>
              <p style={{ color: "#6b7280", fontSize: isMobile ? 10 : 11, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.label}</p>
            </div>
            <p style={{ color: card.color, fontSize: isMobile ? 26 : 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ BUSCA E FILTROS ═══ */}
      <div style={{ display: "flex", gap: 12, alignItems: isMobile ? "stretch" : "center", flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
        <input placeholder="🔍 Buscar por nome, email, empresa, WhatsApp..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
          style={{ ...inputStyle, maxWidth: isMobile ? "100%" : 400, padding: "9px 14px", fontSize: 13, borderRadius: 20 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ key: "todos", label: "Todos", color: "#8b5cf6" }, { key: "ativos", label: "✅ Ativos", color: "#16a34a" }, { key: "pendentes", label: "⏳ Pendentes", color: "#f59e0b" }].map(f => {
            const ativo = filtroStatus === f.key;
            return (
              <button key={f.key} onClick={() => setFiltroStatus(f.key)}
                style={{
                  flex: isMobile ? 1 : "0 0 auto", padding: "8px 18px",
                  borderRadius: 10, border: `1px solid ${ativo ? `${f.color}50` : "#e5e7eb"}`,
                  cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: ativo ? `${f.color}15` : "#ffffff",
                  color: ativo ? f.color : "#6b7280",
                  boxShadow: ativo ? `0 2px 8px ${f.color}25` : "none",
                  transition: "all 0.15s",
                }}>{f.label}</button>
            );
          })}
        </div>
      </div>

      {/* ═══ LISTA / TABELA ═══ */}
      {loadingCadastros ? <p style={{ color: "#6b7280" }}>Carregando...</p> : cadastrosFiltrados.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(139,92,246,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🏢</span>
          </div>
          <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px 0" }}>Nenhum cliente encontrado</h3>
          <button onClick={abrirNovo}
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "12px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700, marginTop: 12,
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}>
            + Novo Cliente
          </button>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["", "Cliente", "Plano", "👥", "📱", "Conexões", "🎁 Módulos", "Status", "Ações"].map((h, i) => (
                  <th key={i} style={{ padding: "13px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
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
                    <tr key={c.id}
                      style={{
                        borderTop: "1px solid #f3f4f6",
                        background: expandida ? "#f0fdf4" : (i % 2 === 0 ? "#ffffff" : "#fafbfc"),
                        transition: "background 0.1s",
                      }}>
                      <td style={{ padding: "14px 10px 14px 16px", width: 30 }}>
                        <button onClick={() => toggleExpandir(username)} disabled={!username}
                          style={{ background: "none", border: "none", color: expandida ? "#16a34a" : "#9ca3af", cursor: username ? "pointer" : "not-allowed", fontSize: 14, opacity: username ? 1 : 0.3, fontWeight: 700 }}
                          title={username ? (expandida ? "Ocultar sub-usuários" : "Ver sub-usuários") : "Cliente sem workspace"}>
                          {expandida ? "▼" : "▶"}
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div>
                          <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{c.nome}</p>
                          <p style={{ color: "#6b7280", fontSize: 11, margin: "3px 0 0" }}>{c.email}</p>
                          {c.empresa && <p style={{ color: "#9ca3af", fontSize: 10, margin: "2px 0 0" }}>{c.empresa}{c.username && ` · @${c.username}`}</p>}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: c.plano === "ultra" ? "#f3e8ff" : c.plano === "intermediario" ? "#eff6ff" : "#f0fdf4",
                          color: c.plano === "ultra" ? "#8b5cf6" : c.plano === "intermediario" ? "#3b82f6" : "#16a34a",
                          border: `1px solid ${c.plano === "ultra" ? "#ddd6fe" : c.plano === "intermediario" ? "#bfdbfe" : "#bbf7d0"}`,
                          fontSize: 11, padding: "3px 12px", borderRadius: 10, fontWeight: 700,
                        }}>
                          {c.plano === "intermediario" ? "Intermediário" : c.plano === "ultra" ? "Ultra" : "Básico"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", fontSize: 12, padding: "3px 12px", borderRadius: 10, fontWeight: 700 }}>{c.usuarios_liberados || 1}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", fontSize: 12, padding: "3px 12px", borderRadius: 10, fontWeight: 700 }}>{c.conexoes_liberadas || 1}</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {c.permite_webjs && <span style={{ fontSize: 14 }} title="WhatsApp Web">📱</span>}
                          {c.permite_waba && <span style={{ fontSize: 14 }} title="API Meta">🔗</span>}
                          {c.permite_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}
                        </div>
                      </td>

                      {/* 🆕 Coluna de módulos */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {c.modulo_roleta && <span style={{ fontSize: 14 }} title="Roleta">🎯</span>}
                          {c.modulo_disparos_web && <span style={{ fontSize: 14 }} title="Disparos Web">📤</span>}
                          {c.modulo_disparos_api && <span style={{ fontSize: 14 }} title="Disparos API">📨</span>}
                          {c.modulo_voip && <span style={{ fontSize: 14 }} title="Ligações VOIP">📞</span>}
                          {c.modulo_api_integracao && <span style={{ fontSize: 14 }} title="API Integração">🔌</span>}
                          {c.modulo_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}
                          {/* 🆕 novos */}
                          {c.modulo_equipes && <span style={{ fontSize: 14 }} title="Equipes Multi-time">👥</span>}
                          {c.modulo_funil_avancado && <span style={{ fontSize: 14 }} title="Funil Avançado">📊</span>}
                          {c.modulo_cobranca && <span style={{ fontSize: 14 }} title="Cobrança">💰</span>}
                          {!c.modulo_roleta && !c.modulo_disparos_web && !c.modulo_disparos_api && !c.modulo_voip && !c.modulo_api_integracao && !c.modulo_instagram && !c.modulo_equipes && !c.modulo_funil_avancado && !c.modulo_cobranca && <span style={{ color: "#d1d5db", fontSize: 11, fontStyle: "italic" }}>nenhum</span>}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: c.autorizado ? "#f0fdf4" : "#fffbeb",
                          color: c.autorizado ? "#16a34a" : "#f59e0b",
                          border: `1px solid ${c.autorizado ? "#bbf7d0" : "#fde68a"}`,
                          fontSize: 11, padding: "3px 12px", borderRadius: 12, fontWeight: 700,
                        }}>
                          {c.autorizado ? "✅ Ativo" : "⏳ Pendente"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setCadastroSelecionado(c); setShowModalDetalhe(true); }}
                            style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>👁️</button>
                          {!c.autorizado
                            ? <button onClick={() => autorizarCadastro(c)}
                                style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>✅</button>
                            : <button onClick={() => desautorizarCadastro(c)}
                                style={{ background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🚫</button>
                          }
                          <button onClick={() => abrirEditar(c)}
                            style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                          <button onClick={() => excluirCadastro(c)}
                            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>

                    {/* LINHA EXPANDIDA — SUB-USUÁRIOS */}
                    {expandida && (
                      <tr key={`${c.id}-expandido`} style={{ background: "#f0fdf4" }}>
                        <td colSpan={9} style={{ padding: "0 24px 18px 50px" }}>
                          <div style={{ borderLeft: "3px solid #16a34a", paddingLeft: 18, paddingTop: 10 }}>
                            <p style={{ color: "#16a34a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
                              👥 Sub-usuários do workspace <span style={{ fontFamily: "monospace" }}>@{username}</span>
                            </p>

                            {carregando ? (
                              <p style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic", margin: "8px 0" }}>Carregando...</p>
                            ) : subs.length === 0 ? (
                              <p style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic", margin: "8px 0" }}>
                                Nenhum sub-usuário cadastrado neste workspace ainda
                              </p>
                            ) : (
                              <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginTop: 6 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ background: "#f9fafb" }}>
                                      {["Nome", "Email", "Perfil", "Fila", "Grupo", "Status"].map(h => (
                                        <th key={h} style={{ padding: "9px 12px", color: "#6b7280", fontSize: 10, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subs.map(s => (
                                      <tr key={s.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                        <td style={{ padding: "9px 12px", color: "#1f2937", fontSize: 12, fontWeight: 600 }}>{s.nome}</td>
                                        <td style={{ padding: "9px 12px", color: "#6b7280", fontSize: 12 }}>{s.email}</td>
                                        <td style={{ padding: "9px 12px" }}>
                                          <span style={{
                                            background: s.perfil === "Administrador" ? "#fffbeb" : s.perfil === "Supervisor" ? "#f3e8ff" : "#eff6ff",
                                            color: s.perfil === "Administrador" ? "#f59e0b" : s.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6",
                                            border: `1px solid ${s.perfil === "Administrador" ? "#fde68a" : s.perfil === "Supervisor" ? "#ddd6fe" : "#bfdbfe"}`,
                                            padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                                          }}>{s.perfil}</span>
                                        </td>
                                        <td style={{ padding: "9px 12px", color: "#6b7280", fontSize: 12 }}>{s.fila || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                                        <td style={{ padding: "9px 12px" }}>
                                          {s.grupo_id ? (
                                            <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                                              {grupos.find(g => g.id === s.grupo_id)?.nome || "—"}
                                            </span>
                                          ) : <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>}
                                        </td>
                                        <td style={{ padding: "9px 12px" }}>
                                          <span style={{
                                            background: s.status === "online" ? "#f0fdf4" : "#f3f4f6",
                                            color: s.status === "online" ? "#16a34a" : "#6b7280",
                                            border: `1px solid ${s.status === "online" ? "#bbf7d0" : "#e5e7eb"}`,
                                            padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                                          }}>
                                            {s.status === "online" ? "🟢 Online" : "⚫ Offline"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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