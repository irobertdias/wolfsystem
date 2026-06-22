"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";
import { useModulos } from "../../hooks/useModulos";
import { useWorkspace } from "../../hooks/useWorkspace";

// ═══════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURAÇÕES — Wolf CRM (multi-tenant, premium)
// ───────────────────────────────────────────────────────────────────────
// 🆕 v2: Cascade Equipe → Filas no formulário de usuário
// 5 abas em tabs visuais: Usuários · Equipes · Filas · Permissões · Geral
// Estado persistido em ?tab=...
// Real-time em tudo · Busca + filtros por aba · Cards visuais premium
// ═══════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

type Usuario = {
  id?: number;
  nome: string;
  email: string;
  perfil: "Administrador" | "Supervisor" | "Atendente";
  fila: string; // multi-fila separadas por vírgula (compat antigo)
  status: string;
  grupo_id?: number;
  equipe_id?: string | null;            // equipe primária
  equipes_acesso?: string[] | null;     // 🆕 múltiplas equipes que enxerga (UUID[])
  filas_acesso?: number[] | null;       // 🆕 múltiplas filas que atende (INT[])
  canais_acesso?: number[] | null;      // 🆕 canais (conexões) que pode usar (INT[])
  ramal?: string | null;                // 🆕 ramal VOIP
  telefone?: string | null;             // 🆕 telefone pessoal
  exige_selfie?: boolean | null;        // 🆕 exige selfie ao bater ponto (override por usuário)
  exige_ponto?: boolean | null;         // 🕐 precisa bater ponto pra acessar o sistema?
  created_at?: string;
};

type GrupoPermissao = {
  id: number;
  workspace_id?: string;
  nome: string;
  descricao: string;
  permissoes: Record<string, boolean>;
};

type Fila = {
  id: number;
  nome: string;
  conexao: string | null;
  workspace_id: string;
  equipe_id?: string | null;
  created_at?: string;
};

type Equipe = {
  id: string;
  workspace_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
};

type Aba = "usuarios" | "equipes" | "filas" | "permissoes" | "geral";

const CATEGORIAS_PERMISSAO = [
  { nome: "🎯 CRM", cor: "#16a34a", permissoes: [
    { key: "crm_acessar", label: "✅ Acessar o CRM" },
    { key: "dashboard", label: "Dashboard de vendas" },
    { key: "funil", label: "Ver funil de vendas" },
    { key: "vendas_proprio", label: "Ver próprias vendas" },
    { key: "vendas_equipe", label: "Ver vendas da equipe" },
    { key: "proposta_criar", label: "Criar propostas" },
    { key: "contatos_ver", label: "Ver contatos" },
    { key: "contatos_editar", label: "Editar cadastro de contatos" },
    { key: "etiquetas", label: "Gerenciar etiquetas" },
  ]},
  { nome: "💬 Chatbot", cor: "#3b82f6", permissoes: [
    { key: "chatbot_acessar", label: "✅ Acessar o Chatbot" },
    { key: "chat_proprio", label: "Ver próprios atendimentos" },
    { key: "chat_todos", label: "Ver todos atendimentos" },
    { key: "chat_interno", label: "Chat interno (conversar c/ equipe)" },
    { key: "respostas_rapidas", label: "Usar respostas rápidas" },
    { key: "transferir_chat", label: "Transferir conversas" },
    { key: "finalizar_chat", label: "Finalizar atendimentos" },
    { key: "disparo_enviar", label: "Enviar disparos em massa" },
    { key: "templates_waba", label: "Gerenciar templates WABA" },
  ]},
  { nome: "📞 Telefonia", cor: "#14b8a6", mod: "voip", permissoes: [
    { key: "telefonia_acessar", label: "✅ Acessar a Telefonia" },
    { key: "voip_usar", label: "Usar softphone (fazer ligações)" },
    { key: "voip_conexoes", label: "Gerenciar conexões VOIP" },
    { key: "voip_campanhas", label: "Criar campanhas VOIP" },
  ]},
  { nome: "💰 Cobrança", cor: "#dc2626", mod: "cobranca", permissoes: [
    { key: "cobranca", label: "✅ Acessar a Cobrança" },
  ]},
  { nome: "🧑‍💼 RH", cor: "#4f46e5", mod: "rh", permissoes: [
    { key: "rh", label: "✅ Acessar o RH" },
    { key: "rh_dashboard", label: "Dashboard" },
    { key: "rh_indicadores", label: "Indicadores" },
    { key: "rh_funcionarios", label: "Funcionários" },
    { key: "rh_departamentos", label: "Departamentos" },
    { key: "rh_cargos", label: "Cargos & Salários" },
    { key: "rh_folha", label: "Folha do Mês" },
    { key: "rh_holerites", label: "Holerites" },
    { key: "rh_encargos", label: "Encargos & Impostos" },
    { key: "rh_ponto", label: "Ponto / Frequência" },
    { key: "rh_ferias", label: "Férias" },
    { key: "rh_afastamentos", label: "Afastamentos" },
    { key: "rh_banco_horas", label: "Banco de Horas" },
    { key: "rh_beneficios", label: "Benefícios" },
    { key: "rh_vale_transporte", label: "Vale Transporte" },
    { key: "rh_vale_refeicao", label: "Vale Refeição" },
    { key: "rh_plano_saude", label: "Plano de Saúde" },
    { key: "rh_vagas", label: "Vagas" },
    { key: "rh_candidatos", label: "Candidatos" },
    { key: "rh_selecao", label: "Processos Seletivos" },
    { key: "rh_treinamentos", label: "Treinamentos" },
    { key: "rh_avaliacoes", label: "Avaliações de Desempenho" },
    { key: "rh_documentos", label: "Documentos" },
    { key: "rh_contratos", label: "Contratos" },
    { key: "rh_config", label: "Configurações (Geral)" },
  ]},
  { nome: "🕐 Bater Ponto", cor: "#0891b2", mod: "bater_ponto", permissoes: [
    { key: "bater_ponto", label: "✅ Acessar o Bater Ponto" },
  ]},
  { nome: "⚙️ Configurações", cor: "#64748b", permissoes: [
    { key: "conexoes", label: "Gerenciar conexões WhatsApp" },
    { key: "filas", label: "Gerenciar filas" },
    { key: "usuarios_gerenciar", label: "Gerenciar usuários" },
    { key: "grupos_permissao", label: "Gerenciar grupos de permissão" },
    { key: "roleta_gerenciar", label: "Gerenciar roleta de distribuição" },
    { key: "configuracoes_workspace", label: "Configurações do workspace" },
  ]},
  { nome: "📊 Relatórios", cor: "#8b5cf6", permissoes: [
    { key: "relatorios", label: "Relatórios de atendimento" },
    { key: "relatorios_voip", label: "Relatórios de telefonia" },
  ]},
  { nome: "👤 Pessoal", cor: "#6b7280", permissoes: [
    { key: "config_proprio", label: "Editar próprio perfil" },
  ]},
];

const TODAS_PERMISSOES = CATEGORIAS_PERMISSAO.flatMap(c => c.permissoes);
const PERMISSOES_PADRAO: Record<string, boolean> = TODAS_PERMISSOES.reduce((acc, p) => { acc[p.key] = false; return acc; }, {} as Record<string, boolean>);
const LABELS_MAP: Record<string, string> = TODAS_PERMISSOES.reduce((acc, p) => { acc[p.key] = p.label; return acc; }, {} as Record<string, string>);

// ═══ HELPERS VISUAIS ═══
const initialsFromName = (nome: string) =>
  nome.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "?";

const corHashFromString = (s: string) => {
  const cores = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#16a34a", "#06b6d4", "#6366f1", "#a855f7", "#0ea5e9", "#14b8a6", "#f97316"];
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return cores[Math.abs(h) % cores.length];
};

const iconeHashFromString = (s: string) => {
  const icones = ["👥", "🚀", "⚡", "🎯", "💼", "🏢", "🌐", "📞", "💰", "🛠️", "📊"];
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return icones[Math.abs(h) % icones.length];
};

const iconeFilaFromString = (s: string) => {
  const icones = ["🎯", "📞", "💬", "🛠️", "💰", "🌐", "📋", "🔔", "🚀", "⚡", "📨"];
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return icones[Math.abs(h) % icones.length];
};

const getToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

// ═══════════════════════════════════════════════════════════════════════
// 🏛️ COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
export default function Configuracoes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const { modulos, carregado: modulosCarregados } = useModulos();

  const [workspaceId, setWorkspaceId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [carregandoInit, setCarregandoInit] = useState(true);
  const [limites, setLimites] = useState({ usuarios_liberados: 9999 });

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [gruposPermissao, setGruposPermissao] = useState<GrupoPermissao[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [conexoes, setConexoes] = useState<any[]>([]);  // 🆕 canais que o usuário pode atender

  const podeGerenciarUsuarios = isDono || isSuperAdmin || !!permissoes?.usuarios_gerenciar;
  const podeGerenciarFilas = isDono || isSuperAdmin || !!permissoes?.filas;
  const podeGerenciarGrupos = isDono || isSuperAdmin || !!permissoes?.grupos_permissao;
  const podeConfigSistema = isDono || isSuperAdmin || !!permissoes?.configuracoes_workspace;

  // ═══ Aba atual (persistida em URL) ═══
  const abaUrl = (searchParams.get("tab") as Aba) || "usuarios";
  const [abaAtiva, setAbaAtiva] = useState<Aba>(abaUrl);
  const trocarAba = (a: Aba) => {
    setAbaAtiva(a);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", a);
    router.replace(`/crm/configuracoes?${sp.toString()}`);
  };

  // Mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Estilos compartilhados
  const IS = {
    width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
    padding: "10px 14px", color: "#1f2937", fontSize: 14, boxSizing: "border-box" as const,
    outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const cardStyle = {
    background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };
  const labelStyle = {
    color: "#6b7280", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: 0.5,
    display: "block" as const, marginBottom: 6,
  };

  // ═══ FETCHES ═══
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
  const fetchEquipes = async (wsId: string) => {
    const { data } = await supabase.from("equipes").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome", { ascending: true });
    if (data) setEquipes(data);
  };
  // 🆕 Canais (conexões WhatsApp/Instagram) que o usuário pode atender
  const fetchConexoes = async (wsId: string) => {
    const { data } = await supabase.from("conexoes")
      .select("id, nome, tipo, status")
      .eq("workspace_id", wsId)
      .order("nome", { ascending: true });
    if (data) setConexoes(data);
  };

  // ═══ INIT ═══
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
        if (!wsId) { alert("Erro: workspace sem username."); setCarregandoInit(false); return; }
        setWorkspaceId(wsId);
        await Promise.all([fetchUsuarios(wsId), fetchGrupos(wsId), fetchFilas(wsId), fetchEquipes(wsId), fetchConexoes(wsId)]);
        if (!admin) {
          const { data: cadastro } = await supabase.from("cadastros").select("usuarios_liberados").eq("email", user.email).maybeSingle();
          if (cadastro) setLimites({ usuarios_liberados: cadastro.usuarios_liberados || 1 });
        }
        setCarregandoInit(false);
        return;
      }

      // Sub-usuário
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
      await Promise.all([fetchUsuarios(wsId), fetchGrupos(wsId), fetchFilas(wsId), fetchEquipes(wsId), fetchConexoes(wsId)]);

      const { data: wsSub } = await supabase.from("workspaces").select("owner_email").eq("username", wsId).maybeSingle();
      if (wsSub?.owner_email) {
        const { data: cadastroDono } = await supabase.from("cadastros").select("usuarios_liberados").eq("email", wsSub.owner_email).maybeSingle();
        if (cadastroDono) setLimites({ usuarios_liberados: cadastroDono.usuarios_liberados || 1 });
      }
      setAutorizado(true);
      setCarregandoInit(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══ REAL-TIME ═══
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase.channel("ws_rt_" + workspaceId)
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${workspaceId}` }, () => fetchUsuarios(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "grupos_permissao", filter: `workspace_id=eq.${workspaceId}` }, () => fetchGrupos(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "filas", filter: `workspace_id=eq.${workspaceId}` }, () => fetchFilas(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "equipes", filter: `workspace_id=eq.${workspaceId}` }, () => fetchEquipes(workspaceId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  // ═══ LOOKUPS ═══
  const equipeById = useMemo(() => {
    const m = new Map<string, Equipe>();
    equipes.forEach(e => m.set(e.id, e));
    return m;
  }, [equipes]);

  const usuariosPorEquipe = useMemo(() => {
    const m = new Map<string, number>();
    usuarios.forEach(u => {
      if (u.equipe_id) m.set(u.equipe_id, (m.get(u.equipe_id) || 0) + 1);
    });
    return m;
  }, [usuarios]);

  const filasPorEquipe = useMemo(() => {
    const m = new Map<string, number>();
    filas.forEach(f => {
      if (f.equipe_id) m.set(f.equipe_id, (m.get(f.equipe_id) || 0) + 1);
    });
    return m;
  }, [filas]);

  const limiteAtingido = !isAdmin && usuarios.length >= limites.usuarios_liberados;

  // ═══ ABAS ═══
  const abas: { id: Aba; nome: string; icone: string; cor: string; count: number; podeVer: boolean }[] = [
    { id: "usuarios",   nome: "Usuários",   icone: "👥", cor: "#3b82f6", count: usuarios.length,        podeVer: podeGerenciarUsuarios },
    { id: "equipes",    nome: "Equipes",    icone: "🏢", cor: "#a855f7", count: equipes.length,         podeVer: podeGerenciarUsuarios },
    { id: "filas",      nome: "Filas",      icone: "📋", cor: "#16a34a", count: filas.length,           podeVer: podeGerenciarFilas },
    { id: "permissoes", nome: "Permissões", icone: "🔐", cor: "#8b5cf6", count: gruposPermissao.length, podeVer: podeGerenciarGrupos },
    { id: "geral",      nome: "Geral",      icone: "⚙️", cor: "#f59e0b", count: 0,                      podeVer: podeConfigSistema },
  ];
  const abasVisiveis = abas.filter(a => a.podeVer);
  if (!carregandoInit && abasVisiveis.length > 0 && !abasVisiveis.some(a => a.id === abaAtiva)) {
    setTimeout(() => setAbaAtiva(abasVisiveis[0].id), 0);
  }

  // ═══ Loading inicial ═══
  if (carregandoInit) {
    return (
      <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "#6b7280" }}>
        ⏳ Carregando configurações...
      </div>
    );
  }

  // ═══ Sem permissão ═══
  if (!autorizado || (abasVisiveis.length === 0)) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480, borderLeft: "4px solid #dc2626", background: "#fef2f2", borderColor: "#fecaca" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(239,68,68,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>
          <h1 style={{ color: "#991b1b", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#7f1d1d", fontSize: 13, margin: "0 0 22px", lineHeight: 1.5 }}>
            Você não tem permissão para acessar as configurações do workspace. Fale com o administrador.
          </p>
          <button onClick={() => router.back()}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
            }}>← Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 22 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, boxShadow: "0 8px 20px rgba(59,130,246,0.30)",
          flexShrink: 0,
        }}>
          <span style={{ filter: "saturate(0) brightness(2)" }}>⚙️</span>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Configurações do Workspace</h1>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0" }}>
            Wolf CRM · Gerenciamento completo · {usuarios.length} usuário(s) · {equipes.length} equipe(s) · {filas.length} fila(s)
          </p>
        </div>
        {!isAdmin && limites.usuarios_liberados < 9999 && (
          <div style={{
            background: limiteAtingido ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${limiteAtingido ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: 12,
            padding: "10px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}>
            <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Seu plano</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: limiteAtingido ? "#dc2626" : "#16a34a", marginTop: 2 }}>
              {usuarios.length}/{limites.usuarios_liberados} usuários
            </span>
          </div>
        )}
      </div>

      {/* ═══ TABS ═══ */}
      <div style={{ ...cardStyle, padding: isMobile ? 6 : 8, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 4, minWidth: "fit-content" }}>
          {abasVisiveis.map(aba => {
            const ativo = abaAtiva === aba.id;
            return (
              <button key={aba.id} onClick={() => trocarAba(aba.id)}
                style={{
                  background: ativo ? `linear-gradient(135deg, ${aba.cor}15, ${aba.cor}08)` : "transparent",
                  color: ativo ? aba.cor : "#6b7280",
                  border: ativo ? `1px solid ${aba.cor}40` : "1px solid transparent",
                  borderRadius: 10,
                  padding: isMobile ? "9px 12px" : "10px 18px",
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                  boxShadow: ativo ? `0 2px 8px ${aba.cor}15` : "none",
                }}>
                <span style={{ fontSize: 16 }}>{aba.icone}</span>
                <span>{aba.nome}</span>
                {aba.count > 0 && (
                  <span style={{
                    background: ativo ? aba.cor : "#e5e7eb",
                    color: ativo ? "white" : "#6b7280",
                    fontSize: 10,
                    padding: "1px 7px",
                    borderRadius: 8,
                    fontWeight: 800,
                    minWidth: 18,
                    textAlign: "center",
                  }}>{aba.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ CONTEÚDO DA ABA ═══ */}
      {abaAtiva === "usuarios" && (
        <AbaUsuarios
          usuarios={usuarios}
          equipes={equipes}
          filas={filas}
          conexoes={conexoes}
          gruposPermissao={gruposPermissao}
          equipeById={equipeById}
          workspaceId={workspaceId}
          isAdmin={isAdmin}
          limites={limites}
          limiteAtingido={limiteAtingido}
          podeGerenciar={podeGerenciarUsuarios}
          isMobile={isMobile}
          IS={IS} cardStyle={cardStyle} labelStyle={labelStyle}
          modulos={modulos}
          modulosCarregados={modulosCarregados}
          onRefetch={() => fetchUsuarios(workspaceId)}
        />
      )}
      {abaAtiva === "equipes" && (
        <AbaEquipes
          equipes={equipes}
          usuarios={usuarios}
          filas={filas}
          usuariosPorEquipe={usuariosPorEquipe}
          filasPorEquipe={filasPorEquipe}
          workspaceId={workspaceId}
          podeGerenciar={podeGerenciarUsuarios}
          isMobile={isMobile}
          IS={IS} cardStyle={cardStyle} labelStyle={labelStyle}
          onRefetch={async () => { await fetchEquipes(workspaceId); await fetchUsuarios(workspaceId); await fetchFilas(workspaceId); }}
        />
      )}
      {abaAtiva === "filas" && (
        <AbaFilas
          filas={filas}
          equipes={equipes}
          usuarios={usuarios}
          equipeById={equipeById}
          workspaceId={workspaceId}
          podeGerenciar={podeGerenciarFilas}
          isMobile={isMobile}
          IS={IS} cardStyle={cardStyle} labelStyle={labelStyle}
          onRefetch={() => fetchFilas(workspaceId)}
        />
      )}
      {abaAtiva === "permissoes" && (
        <AbaPermissoes
          gruposPermissao={gruposPermissao}
          workspaceId={workspaceId}
          podeGerenciar={podeGerenciarGrupos}
          modulos={modulos}
          modulosCarregados={modulosCarregados}
          isMobile={isMobile}
          IS={IS} cardStyle={cardStyle} labelStyle={labelStyle}
          onRefetch={() => fetchGrupos(workspaceId)}
        />
      )}
      {abaAtiva === "geral" && (
        <AbaGeral
          workspaceId={workspaceId}
          usuarios={usuarios}
          isAdmin={isAdmin}
          limites={limites}
          limiteAtingido={limiteAtingido}
          podeGerenciar={podeConfigSistema}
          isMobile={isMobile}
          IS={IS} cardStyle={cardStyle} labelStyle={labelStyle}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 👥 ABA USUÁRIOS — 🆕 v2 com cascade Equipe → Filas
// ═══════════════════════════════════════════════════════════════════════
function AbaUsuarios({ usuarios, equipes, filas, conexoes, gruposPermissao, equipeById, workspaceId, isAdmin, limites, limiteAtingido, podeGerenciar, isMobile, IS, cardStyle, labelStyle, modulos, modulosCarregados, onRefetch }: any) {
  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<"todos" | "Administrador" | "Supervisor" | "Atendente">("todos");
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todas");
  const [showForm, setShowForm] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null);
  const [formUsuario, setFormUsuario] = useState({
    nome: "", email: "", telefone: "", senha: "",
    perfil: "Atendente" as "Administrador" | "Supervisor" | "Atendente",
    fila: "", grupo_id: "", equipe_id: "",
    equipes_acesso: [] as string[],     // 🆕 UUID[]
    filas_acesso: [] as number[],       // 🆕 INT[]
    canais_acesso: [] as number[],      // 🆕 INT[]
    ramal: "",                          // 🆕
    exige_ponto: true,
    exige_selfie: true,                 // 🆕
  });
  const [showSenha, setShowSenha] = useState(false);
  const [showDropdownFilas, setShowDropdownFilas] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const usuariosFiltrados = useMemo(() => {
    let l: Usuario[] = usuarios;
    if (busca) {
      const b = busca.toLowerCase();
      l = l.filter((u: Usuario) => u.nome.toLowerCase().includes(b) || u.email.toLowerCase().includes(b));
    }
    if (filtroPerfil !== "todos") l = l.filter((u: Usuario) => u.perfil === filtroPerfil);
    if (filtroEquipe !== "todas") {
      if (filtroEquipe === "sem") l = l.filter((u: Usuario) => !u.equipe_id);
      else l = l.filter((u: Usuario) => u.equipe_id === filtroEquipe);
    }
    return l;
  }, [usuarios, busca, filtroPerfil, filtroEquipe]);

  // 🆕 v2: Filtra filas pela equipe selecionada no form
  // - Sem equipe selecionada → mostra TODAS as filas (filas globais + filas de qualquer equipe)
  // - Com equipe selecionada → mostra só filas da equipe + filas globais (sem equipe atribuída)
  const filasDisponiveis = useMemo(() => {
    if (!formUsuario.equipe_id) return filas;
    return filas.filter((f: Fila) => f.equipe_id === formUsuario.equipe_id || f.equipe_id == null);
  }, [filas, formUsuario.equipe_id]);

  const abrirNovo = () => {
    if (!podeGerenciar) { alert("Sem permissão."); return; }
    if (limiteAtingido) { alert(`❌ Limite de ${limites.usuarios_liberados} usuário(s) atingido!`); return; }
    setEditandoUsuario(null);
    setFormUsuario({
      nome: "", email: "", telefone: "", senha: "",
      perfil: "Atendente", fila: "", grupo_id: "", equipe_id: "",
      equipes_acesso: [], filas_acesso: [], canais_acesso: [],
      ramal: "",
      exige_ponto: true, exige_selfie: true,
    });
    setShowForm(true);
  };

  const abrirEditar = (u: Usuario) => {
    if (!podeGerenciar) { alert("Sem permissão."); return; }
    setEditandoUsuario(u);
    setFormUsuario({
      nome: u.nome, email: u.email,
      telefone: u.telefone || "",
      senha: "",
      perfil: u.perfil, fila: u.fila || "",
      grupo_id: u.grupo_id?.toString() || "",
      equipe_id: u.equipe_id || "",
      equipes_acesso: Array.isArray(u.equipes_acesso) ? u.equipes_acesso : [],   // 🆕
      filas_acesso: Array.isArray(u.filas_acesso) ? u.filas_acesso : [],         // 🆕
      canais_acesso: Array.isArray(u.canais_acesso) ? u.canais_acesso : [],      // 🆕
      ramal: u.ramal || "",                                                       // 🆕
      exige_ponto: u.exige_ponto !== false,
      exige_selfie: u.exige_selfie !== false,                                     // 🆕
    });
    setShowForm(true);
  };

  // 🆕 v2: Ao mudar a equipe, reseta as filas selecionadas que não pertencem à nova equipe
  const mudarEquipe = (novaEquipeId: string) => {
    if (!novaEquipeId) {
      // Sem equipe → mantém todas as filas que já estavam (são globais ou de qualquer equipe)
      setFormUsuario({ ...formUsuario, equipe_id: "" });
      return;
    }
    // Com equipe → filtra das filas selecionadas só as que pertencem a essa equipe (ou são globais)
    const filasAtuais = (formUsuario.fila || "").split(",").map(s => s.trim()).filter(Boolean);
    const filasValidasNaNovaEquipe = filas
      .filter((f: Fila) => f.equipe_id === novaEquipeId || f.equipe_id == null)
      .map((f: Fila) => f.nome);
    const filasMantidas = filasAtuais.filter(nome => filasValidasNaNovaEquipe.includes(nome));
    setFormUsuario({ ...formUsuario, equipe_id: novaEquipeId, fila: filasMantidas.join(",") });
  };

  const salvarUsuario = async () => {
    if (!podeGerenciar) { alert("Sem permissão."); return; }
    if (!formUsuario.nome || !formUsuario.email) { alert("Preencha Nome e E-mail!"); return; }
    setSalvando(true);
    try {
      if (editandoUsuario) {
        await supabase.from("usuarios_workspace")
          .update({
            nome: formUsuario.nome,
            perfil: formUsuario.perfil,
            fila: formUsuario.fila,
            grupo_id: formUsuario.grupo_id ? parseInt(formUsuario.grupo_id) : null,
            equipe_id: formUsuario.equipe_id || null,
            equipes_acesso: formUsuario.equipes_acesso,    // 🆕
            filas_acesso: formUsuario.filas_acesso,        // 🆕
            canais_acesso: formUsuario.canais_acesso,      // 🆕
            ramal: formUsuario.ramal || null,              // 🆕
            telefone: formUsuario.telefone || null,        // 🆕
            exige_ponto: formUsuario.exige_ponto,
            exige_selfie: formUsuario.exige_selfie,        // 🆕
          })
          .eq("email", editandoUsuario.email)
          .eq("workspace_id", workspaceId);
        await onRefetch();
        setEditandoUsuario(null);
        setShowForm(false);
        alert("✅ Usuário atualizado!");
        setSalvando(false);
        return;
      }
      if (!formUsuario.senha) { alert("Preencha a Senha!"); setSalvando(false); return; }
      if (formUsuario.senha.length < 6) { alert("Senha deve ter no mínimo 6 caracteres!"); setSalvando(false); return; }
      if (limiteAtingido) { alert(`❌ Limite de ${limites.usuarios_liberados} usuário(s) atingido!`); setSalvando(false); return; }

      const token = await getToken();
      if (!token) { alert("Sessão expirou."); setSalvando(false); return; }
      const resp = await fetch("/api/criar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          email: formUsuario.email,
          senha: formUsuario.senha,
          nome: formUsuario.nome,
          workspace_id: workspaceId,
          perfil: formUsuario.perfil,
          fila: formUsuario.fila,
          grupo_id: formUsuario.grupo_id ? parseInt(formUsuario.grupo_id) : null,
          equipe_id: formUsuario.equipe_id || null,
          equipes_acesso: formUsuario.equipes_acesso,   // 🆕
          filas_acesso: formUsuario.filas_acesso,       // 🆕
          canais_acesso: formUsuario.canais_acesso,     // 🆕
          ramal: formUsuario.ramal || null,             // 🆕
          telefone: formUsuario.telefone || null,       // 🆕
          exige_ponto: formUsuario.exige_ponto,
          exige_selfie: formUsuario.exige_selfie,       // 🆕
        }),
      });
      const data = await resp.json();
      if (!data.success) {
        if (data.error === "email_exists") alert("❌ E-mail já cadastrado!");
        else if (data.error === "limite_atingido") alert("❌ " + (data.detalhes || "Limite atingido!"));
        else alert("Erro: " + data.error);
        setSalvando(false);
        return;
      }
      if (formUsuario.equipe_id) {
        await supabase.from("usuarios_workspace")
          .update({ equipe_id: formUsuario.equipe_id })
          .eq("email", formUsuario.email).eq("workspace_id", workspaceId);
      }
      await onRefetch();
      setShowForm(false);
      alert("✅ Usuário adicionado!");
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
    setSalvando(false);
  };

  const excluirUsuario = async (u: Usuario) => {
    if (!podeGerenciar) { alert("Sem permissão."); return; }
    if (!confirm(`Excluir ${u.nome}?\n\nIsso vai apagar o login dele também.`)) return;
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
      await onRefetch();
      alert("✅ Usuário excluído!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Barra de uso de plano (não admin) */}
      {!isAdmin && limites.usuarios_liberados < 9999 && (
        <div style={{ ...cardStyle, padding: "12px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
            <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>📊 Uso do plano</span>
            <span style={{ color: limiteAtingido ? "#dc2626" : "#16a34a", fontSize: 12, fontWeight: 800 }}>
              {usuarios.length}/{limites.usuarios_liberados} usuários ({Math.round(usuarios.length / limites.usuarios_liberados * 100)}%)
            </span>
          </div>
          <div style={{ background: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{
              background: limiteAtingido
                ? "linear-gradient(90deg, #dc2626, #ef4444)"
                : usuarios.length / limites.usuarios_liberados >= 0.8
                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(90deg, #16a34a, #22c55e)",
              height: "100%",
              width: `${Math.min((usuarios.length / limites.usuarios_liberados) * 100, 100)}%`,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ ...cardStyle, padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar por nome ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...IS, flex: "1 1 240px", maxWidth: 400, borderRadius: 20 }} />
        <select value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value as any)} style={{ ...IS, maxWidth: 180 }}>
          <option value="todos">Perfil: Todos</option>
          <option value="Administrador">👑 Administrador</option>
          <option value="Supervisor">🎖️ Supervisor</option>
          <option value="Atendente">👤 Atendente</option>
        </select>
        <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} style={{ ...IS, maxWidth: 200 }}>
          <option value="todas">Equipe: Todas</option>
          <option value="sem">Sem equipe</option>
          {equipes.map((eq: Equipe) => (
            <option key={eq.id} value={eq.id}>{iconeHashFromString(eq.nome)} {eq.nome}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={abrirNovo} disabled={limiteAtingido}
          style={{
            background: limiteAtingido ? "#f3f4f6" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: limiteAtingido ? "#9ca3af" : "white",
            border: "none", borderRadius: 10,
            padding: "10px 18px", fontSize: 13, fontWeight: 700,
            cursor: limiteAtingido ? "not-allowed" : "pointer",
            boxShadow: limiteAtingido ? "none" : "0 4px 12px rgba(59,130,246,0.3)",
            whiteSpace: "nowrap",
          }}>
          {limiteAtingido ? "🔒 Limite Atingido" : "+ Novo Usuário"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ ...cardStyle, padding: 22, borderTop: "3px solid #3b82f6" }}>
          <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>
            {editandoUsuario ? "✏️ Editar Usuário" : "➕ Novo Usuário"}
          </p>

          {/* ─── LINHA 1: Nome + E-mail ─── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Nome Completo *</label>
              <input placeholder="Nome completo" value={formUsuario.nome} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} style={IS} />
            </div>
            <div>
              <label style={labelStyle}>E-mail *</label>
              <input type="email" placeholder="email@exemplo.com" value={formUsuario.email}
                onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })}
                disabled={!!editandoUsuario}
                style={{ ...IS, background: editandoUsuario ? "#f3f4f6" : "#ffffff", opacity: editandoUsuario ? 0.6 : 1 }} />
            </div>
          </div>

          {/* ─── LINHA 2: Grupo de Permissão (largura total) ─── */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...labelStyle, color: "#8b5cf6" }}>🔐 Cargo / Grupo de Permissão *</label>
            <select value={formUsuario.grupo_id} onChange={e => setFormUsuario({ ...formUsuario, grupo_id: e.target.value })}
              style={{ ...IS, borderColor: formUsuario.grupo_id ? "#8b5cf6" : "#e5e7eb" }}>
              <option value="">— Sem grupo (usa padrão do perfil) —</option>
              {gruposPermissao.map((g: GrupoPermissao) => (
                <option key={g.id} value={g.id.toString()}>👥 {g.nome}</option>
              ))}
            </select>
            <p style={{ color: "#f59e0b", fontSize: 10.5, margin: "5px 0 0", fontStyle: "italic" }}>
              💡 É o GRUPO que define todas as permissões do usuário (configuráveis em <b>Permissões</b>).
            </p>
          </div>

          {/* ─── LINHA 3: Perfil (Administrador/Supervisor/Atendente) ─── */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>👔 Perfil do Sistema</label>
            <select value={formUsuario.perfil} onChange={e => setFormUsuario({ ...formUsuario, perfil: e.target.value as any })} style={IS}>
              <option value="Administrador">👑 Administrador — poder total no workspace</option>
              <option value="Supervisor">🎖️ Supervisor — gerencia equipes/filas</option>
              <option value="Atendente">👤 Atendente — usa o sistema</option>
            </select>
          </div>

          {/* ─── LINHA 4: EQUIPES (botões multi-seleção) ─── */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              🏢 Equipes (clique pra selecionar — libera as filas abaixo)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {equipes.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0 }}>
                  Nenhuma equipe ainda — crie na aba "Equipes".
                </p>
              ) : equipes.map((eq: Equipe) => {
                const ativa = formUsuario.equipes_acesso.includes(eq.id);
                const toggleEq = () => {
                  const novas = ativa
                    ? formUsuario.equipes_acesso.filter(id => id !== eq.id)
                    : [...formUsuario.equipes_acesso, eq.id];
                  // Se desmarcou uma equipe, remove suas filas do filas_acesso
                  const filasDessaEquipe = filas.filter((f: Fila) => f.equipe_id === eq.id).map((f: Fila) => f.id);
                  const novasFilas = ativa
                    ? formUsuario.filas_acesso.filter(id => !filasDessaEquipe.includes(id))
                    : formUsuario.filas_acesso;
                  setFormUsuario({ ...formUsuario, equipes_acesso: novas, filas_acesso: novasFilas });
                };
                return (
                  <button key={eq.id} type="button" onClick={toggleEq}
                    style={{
                      background: ativa ? "#eff6ff" : "#ffffff",
                      color: ativa ? "#2563eb" : "#6b7280",
                      border: "1.5px solid " + (ativa ? "#3b82f6" : "#e5e7eb"),
                      borderRadius: 10, padding: "9px 16px",
                      fontSize: 12.5, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                    }}>
                    {ativa && <span>✓</span>}
                    {iconeHashFromString(eq.nome)} {eq.nome.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <p style={{ color: "#9ca3af", fontSize: 10.5, margin: "5px 0 0", fontStyle: "italic" }}>
              Marque as equipes deste usuário. As vendas dessas equipes ficam visíveis pra ele (útil pra BKO e gerentes).
            </p>
          </div>

          {/* ─── LINHA 5: FILAS DE ATENDIMENTO (botões multi-seleção, baseadas nas equipes marcadas) ─── */}
          {(() => {
            // Filas disponíveis = das equipes selecionadas + filas globais (sem equipe)
            const filasDisp = filas.filter((f: Fila) =>
              !f.equipe_id || formUsuario.equipes_acesso.includes(f.equipe_id)
            );
            return (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>
                  🎯 Filas de Atendimento (pode marcar várias)
                  <span style={{ color: "#9ca3af", marginLeft: 8, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                    · {filasDisp.length} disponíve{filasDisp.length !== 1 ? "is" : "l"}
                  </span>
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {/* Botão "Todas as filas" */}
                  <button type="button" onClick={() => {
                    const todasIds = filasDisp.map((f: Fila) => f.id);
                    const jaTudo = todasIds.length > 0 && todasIds.every((id: number) => formUsuario.filas_acesso.includes(id));
                    setFormUsuario({ ...formUsuario, filas_acesso: jaTudo ? [] : todasIds });
                  }}
                    style={{
                      background: "#ffffff", color: "#6b7280",
                      border: "1.5px dashed #d1d5db",
                      borderRadius: 10, padding: "9px 14px",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>
                    📞 Todas as filas
                  </button>
                  {filasDisp.length === 0 ? (
                    <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0, alignSelf: "center" }}>
                      Selecione uma equipe acima pra ver as filas.
                    </p>
                  ) : filasDisp.map((f: Fila) => {
                    const ativa = formUsuario.filas_acesso.includes(f.id);
                    const toggleF = () => {
                      const novas = ativa
                        ? formUsuario.filas_acesso.filter(id => id !== f.id)
                        : [...formUsuario.filas_acesso, f.id];
                      setFormUsuario({ ...formUsuario, filas_acesso: novas });
                    };
                    return (
                      <button key={f.id} type="button" onClick={toggleF}
                        style={{
                          background: ativa ? "#fff7ed" : "#ffffff",
                          color: ativa ? "#ea580c" : "#6b7280",
                          border: "1.5px solid " + (ativa ? "#fb923c" : "#e5e7eb"),
                          borderRadius: 10, padding: "9px 14px",
                          fontSize: 12, fontWeight: 700, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                        {ativa && <span>✓</span>}
                        {iconeFilaFromString(f.nome)} {f.nome.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                {formUsuario.filas_acesso.length > 0 && (
                  <p style={{ color: "#10b981", fontSize: 10.5, margin: "5px 0 0", fontWeight: 600 }}>
                    ✅ Usuário verá {formUsuario.filas_acesso.length} fila(s) selecionada(s)
                  </p>
                )}
              </div>
            );
          })()}

          {/* ─── LINHA 6: Ramal VOIP + Telefone ─── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ ...labelStyle, color: "#dc2626" }}>📞 Ramal VOIP</label>
              <input placeholder="Ex: 1001" value={formUsuario.ramal}
                onChange={e => setFormUsuario({ ...formUsuario, ramal: e.target.value })}
                style={IS} />
            </div>
            <div>
              <label style={labelStyle}>📱 Telefone</label>
              <input placeholder="(62) 99999-9999" value={formUsuario.telefone}
                onChange={e => setFormUsuario({ ...formUsuario, telefone: e.target.value })}
                style={IS} />
            </div>
          </div>

          {/* ─── LINHA 7: Canais que pode atender + Selfie ao bater ponto (lado a lado) ─── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {/* Canais (conexões) */}
            <div>
              <label style={labelStyle}>📡 Canais que pode atender</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {conexoes.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0 }}>
                    Nenhum canal cadastrado — vá em <b>Conexões</b>.
                  </p>
                ) : conexoes.map((c: any) => {
                  const ativo = formUsuario.canais_acesso.includes(c.id);
                  const toggleC = () => {
                    const novos = ativo
                      ? formUsuario.canais_acesso.filter(id => id !== c.id)
                      : [...formUsuario.canais_acesso, c.id];
                    setFormUsuario({ ...formUsuario, canais_acesso: novos });
                  };
                  const iconeCanal = c.tipo === "instagram" ? "📸" : c.tipo === "waba" ? "✅" : "💬";
                  return (
                    <button key={c.id} type="button" onClick={toggleC}
                      style={{
                        background: ativo ? "#f0fdf4" : "#ffffff",
                        color: ativo ? "#16a34a" : "#6b7280",
                        border: "1.5px solid " + (ativo ? "#22c55e" : "#e5e7eb"),
                        borderRadius: 10, padding: "8px 12px",
                        fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                      {ativo && <span>✓</span>}
                      {iconeCanal} {c.nome}
                    </button>
                  );
                })}
              </div>
              <p style={{ color: "#9ca3af", fontSize: 10.5, margin: "5px 0 0", fontStyle: "italic" }}>
                Marque os canais que esse usuário pode ver no chat. Soma com os canais do grupo dele.
              </p>
            </div>

            {/* Selfie ao bater ponto (só se módulo bater_ponto liberado) */}
            {modulosCarregados && modulos?.bater_ponto && (
              <div>
                <label style={labelStyle}>🤳 Selfie ao bater ponto</label>
                <div
                  onClick={() => setFormUsuario({ ...formUsuario, exige_selfie: !formUsuario.exige_selfie })}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 14px",
                    background: formUsuario.exige_selfie ? "#eff6ff" : "#f9fafb",
                    border: "1px solid " + (formUsuario.exige_selfie ? "#bfdbfe" : "#e5e7eb"),
                    borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                  }}>
                  <div style={{
                    width: 40, height: 22, borderRadius: 999,
                    background: formUsuario.exige_selfie ? "#2563eb" : "#cbd5e1",
                    position: "relative", flexShrink: 0, transition: "background 0.15s",
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 2,
                      left: formUsuario.exige_selfie ? 20 : 2,
                      transition: "left 0.15s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </div>
                  <span style={{
                    color: formUsuario.exige_selfie ? "#1d4ed8" : "#6b7280",
                    fontSize: 12.5, fontWeight: 700,
                  }}>
                    {formUsuario.exige_selfie ? "Sim — exige selfie + GPS" : "Não — só localização (GPS)"}
                  </span>
                </div>
                <p style={{ color: "#9ca3af", fontSize: 10.5, margin: "5px 0 0", fontStyle: "italic" }}>
                  Funcionários internos podem bater só com localização.
                </p>
              </div>
            )}
          </div>

          {/* ─── LINHA 8: Bater Ponto pra Acessar (largura total — só se módulo liberado) ─── */}
          {modulosCarregados && modulos?.bater_ponto && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>🕐 Bater Ponto para Acessar</label>
              <div
                onClick={() => setFormUsuario({ ...formUsuario, exige_ponto: !formUsuario.exige_ponto })}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px",
                  background: formUsuario.exige_ponto ? "#fdf2f8" : "#f9fafb",
                  border: "1px solid " + (formUsuario.exige_ponto ? "#fbcfe8" : "#e5e7eb"),
                  borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                }}>
                <div style={{
                  width: 40, height: 22, borderRadius: 999,
                  background: formUsuario.exige_ponto ? "#db2777" : "#cbd5e1",
                  position: "relative", flexShrink: 0, transition: "background 0.15s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2,
                    left: formUsuario.exige_ponto ? 20 : 2,
                    transition: "left 0.15s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
                <span style={{
                  color: formUsuario.exige_ponto ? "#be185d" : "#6b7280",
                  fontSize: 12.5, fontWeight: 700,
                }}>
                  {formUsuario.exige_ponto ? "Sim — precisa bater ponto pra entrar" : "Não — entra direto, sem bater ponto"}
                </span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 10.5, margin: "5px 0 0", fontStyle: "italic" }}>
                Logins administrativos (sócios, gerentes, freelancers) podem acessar sem bater ponto.
              </p>
            </div>
          )}

          {/* ─── LINHA 9: Senha (só ao criar) ─── */}
          {!editandoUsuario && (
            <div style={{ position: "relative", marginBottom: 14 }}>
              <label style={labelStyle}>Senha *</label>
              <input type={showSenha ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={formUsuario.senha}
                onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })}
                style={{ ...IS, paddingRight: 40 }} />
              <button onClick={() => setShowSenha(!showSenha)} type="button"
                style={{ position: "absolute", right: 8, top: 32, background: "#f3f4f6", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, width: 28, height: 28, borderRadius: 6 }}>
                {showSenha ? "🙈" : "👁️"}
              </button>
            </div>
          )}

          {/* ─── BOTÕES ─── */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowForm(false); setEditandoUsuario(null); }}
              style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvarUsuario} disabled={salvando}
              style={{
                background: salvando ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 22px", fontSize: 12, cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}>{salvando ? "Salvando..." : "💾 Salvar"}</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {usuariosFiltrados.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 8px" }}>{busca || filtroPerfil !== "todos" || filtroEquipe !== "todas" ? "🔍" : "👥"}</p>
          <p style={{ color: "#9ca3af", fontSize: 13 }}>
            {busca || filtroPerfil !== "todos" || filtroEquipe !== "todas" ? "Nenhum usuário com esses filtros" : "Nenhum usuário cadastrado ainda"}
          </p>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 800 : "auto" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Nome", "Perfil", "Equipe", "Filas", "Grupo", "Status", "Ações"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u: Usuario, i: number) => {
                  const equipe = u.equipe_id ? equipeById.get(u.equipe_id) : null;
                  const corEquipe = equipe ? corHashFromString(equipe.nome) : "#9ca3af";
                  const grupo = u.grupo_id ? gruposPermissao.find((g: GrupoPermissao) => g.id === u.grupo_id) : null;
                  const corAvatar = corHashFromString(u.email || u.nome);
                  const filasUser = (u.fila || "").split(",").map(s => s.trim()).filter(Boolean);
                  return (
                    <tr key={u.id || i}
                      style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc", transition: "background 0.1s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: `linear-gradient(135deg, ${corAvatar} 0%, ${corAvatar}cc 100%)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white", fontSize: 12, fontWeight: 800,
                            flexShrink: 0,
                            boxShadow: `0 2px 6px ${corAvatar}40`,
                          }}>
                            {initialsFromName(u.nome)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</p>
                            <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {u.perfil === "Administrador" ? (
                          <span style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>👑 Admin</span>
                        ) : u.perfil === "Supervisor" ? (
                          <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>🎖️ Supervisor</span>
                        ) : (
                          <span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>👤 Atendente</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {equipe ? (
                          <span style={{ background: `${corEquipe}15`, color: corEquipe, border: `1px solid ${corEquipe}40`, padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {iconeHashFromString(equipe.nome)} {equipe.nome}
                          </span>
                        ) : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {filasUser.length === 0 ? <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span> : filasUser.length === 1 ? (
                          <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{iconeFilaFromString(filasUser[0])} {filasUser[0]}</span>
                        ) : (
                          <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }} title={filasUser.join(", ")}>📋 {filasUser.length} filas</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {grupo ? (
                          <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{grupo.nome}</span>
                        ) : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          background: u.status === "online" ? "#f0fdf4" : "#f3f4f6",
                          color: u.status === "online" ? "#16a34a" : "#6b7280",
                          border: `1px solid ${u.status === "online" ? "#bbf7d0" : "#e5e7eb"}`,
                          padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                        }}>{u.status === "online" ? "🟢 Online" : "⚫ Offline"}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => abrirEditar(u)}
                            style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                          <button onClick={() => excluirUsuario(u)}
                            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 🏢 ABA EQUIPES (sem mudanças)
// ═══════════════════════════════════════════════════════════════════════
function AbaEquipes({ equipes, usuarios, filas, usuariosPorEquipe, filasPorEquipe, workspaceId, podeGerenciar, isMobile, IS, cardStyle, labelStyle, onRefetch }: any) {
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Equipe | null>(null);
  const [formEquipe, setFormEquipe] = useState({ nome: "", descricao: "" });
  const [salvando, setSalvando] = useState(false);

  const equipesFiltradas = useMemo(() => {
    if (!busca) return equipes;
    const b = busca.toLowerCase();
    return equipes.filter((e: Equipe) => e.nome.toLowerCase().includes(b) || (e.descricao || "").toLowerCase().includes(b));
  }, [equipes, busca]);

  const abrirNova = () => {
    if (!podeGerenciar) return alert("Sem permissão.");
    setEditando(null);
    setFormEquipe({ nome: "", descricao: "" });
    setShowForm(true);
  };
  const abrirEditar = (e: Equipe) => {
    if (!podeGerenciar) return alert("Sem permissão.");
    setEditando(e);
    setFormEquipe({ nome: e.nome, descricao: e.descricao || "" });
    setShowForm(true);
  };
  const salvar = async () => {
    if (!formEquipe.nome.trim()) return alert("Nome obrigatório.");
    if (!workspaceId) return alert("Workspace não carregado.");
    setSalvando(true);
    try {
      if (editando) {
        const { error } = await supabase.from("equipes")
          .update({ nome: formEquipe.nome.trim(), descricao: formEquipe.descricao.trim() || null })
          .eq("id", editando.id).eq("workspace_id", workspaceId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipes").insert([{
          workspace_id: workspaceId,
          nome: formEquipe.nome.trim(),
          descricao: formEquipe.descricao.trim() || null,
        }]);
        if (error) throw error;
      }
      await onRefetch();
      setShowForm(false);
      setEditando(null);
      setFormEquipe({ nome: "", descricao: "" });
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
    setSalvando(false);
  };
  const excluir = async (eq: Equipe) => {
    if (!podeGerenciar) return alert("Sem permissão.");
    const qtdU = usuariosPorEquipe.get(eq.id) || 0;
    const qtdF = filasPorEquipe.get(eq.id) || 0;
    const aviso = (qtdU > 0 || qtdF > 0)
      ? `\n\nEla tem ${qtdU} usuário(s) e ${qtdF} fila(s) atrelada(s). Eles serão desassociados (ficarão "Sem equipe") mas não serão apagados.`
      : "";
    if (!confirm(`Desativar a equipe "${eq.nome}"?${aviso}`)) return;
    try {
      await supabase.from("usuarios_workspace").update({ equipe_id: null })
        .eq("equipe_id", eq.id).eq("workspace_id", workspaceId);
      await supabase.from("filas").update({ equipe_id: null })
        .eq("equipe_id", eq.id).eq("workspace_id", workspaceId);
      await supabase.from("equipes").update({ ativo: false })
        .eq("id", eq.id).eq("workspace_id", workspaceId);
      await onRefetch();
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Info card explicativo */}
      <div style={{
        background: "linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)",
        border: "1px solid #ddd6fe",
        borderLeft: "4px solid #a855f7",
        borderRadius: 12,
        padding: "14px 18px",
      }}>
        <p style={{ color: "#6b21a8", fontSize: 13, margin: 0, fontWeight: 700 }}>🏢 Como funciona</p>
        <p style={{ color: "#7c3aed", fontSize: 12, margin: "3px 0 0", lineHeight: 1.5 }}>
          Organize seu workspace em <b>equipes/empresas/filiais</b>. Cada usuário ou fila pode ser atribuído a uma equipe — assim você filtra a visão por equipe e cada uma trabalha de forma isolada nos relatórios e dashboards.
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ ...cardStyle, padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar equipes..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...IS, flex: "1 1 240px", maxWidth: 400, borderRadius: 20 }} />
        <div style={{ flex: 1 }} />
        <button onClick={abrirNova}
          style={{
            background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
            color: "white", border: "none", borderRadius: 10,
            padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
          }}>+ Nova Equipe</button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ ...cardStyle, padding: 22, borderTop: "3px solid #a855f7" }}>
          <p style={{ color: "#a855f7", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>
            {editando ? "✏️ Editar Equipe" : "➕ Nova Equipe"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Nome *</label>
              <input autoFocus placeholder='Ex: "Filial Centro"' value={formEquipe.nome} onChange={e => setFormEquipe({ ...formEquipe, nome: e.target.value })} style={IS} />
            </div>
            <div>
              <label style={labelStyle}>Descrição</label>
              <input placeholder="Quem coordena, onde fica, etc." value={formEquipe.descricao} onChange={e => setFormEquipe({ ...formEquipe, descricao: e.target.value })} style={IS} />
            </div>
          </div>
          {/* Preview */}
          {formEquipe.nome && (
            <div style={{ marginBottom: 14, padding: 14, background: "#f9fafb", borderRadius: 10, border: "1px dashed #e5e7eb" }}>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>PREVIEW (cor e ícone gerados automaticamente)</p>
              <span style={{
                background: `${corHashFromString(formEquipe.nome)}15`,
                color: corHashFromString(formEquipe.nome),
                border: `1px solid ${corHashFromString(formEquipe.nome)}40`,
                padding: "5px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <span style={{ fontSize: 16 }}>{iconeHashFromString(formEquipe.nome)}</span>
                <span>{formEquipe.nome}</span>
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowForm(false); setEditando(null); }}
              style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#7e22ce" : "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 22px", fontSize: 12, cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
              }}>{salvando ? "Salvando..." : "💾 Salvar"}</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {equipesFiltradas.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 8px" }}>{busca ? "🔍" : "🏢"}</p>
          <p style={{ color: "#9ca3af", fontSize: 13 }}>{busca ? "Nenhuma equipe encontrada" : "Nenhuma equipe cadastrada"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {equipesFiltradas.map((eq: Equipe) => {
            const cor = corHashFromString(eq.nome);
            const icone = iconeHashFromString(eq.nome);
            const qtdU = usuariosPorEquipe.get(eq.id) || 0;
            const qtdF = filasPorEquipe.get(eq.id) || 0;
            return (
              <div key={eq.id} style={{
                ...cardStyle,
                padding: 0,
                overflow: "hidden",
                transition: "all 0.15s",
                borderTop: `4px solid ${cor}`,
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 20px ${cor}20`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; }}>
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                      boxShadow: `0 4px 10px ${cor}40`,
                      flexShrink: 0,
                    }}><span style={{ filter: "saturate(0) brightness(2)" }}>{icone}</span></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0, wordBreak: "break-word" }}>{eq.nome}</p>
                      {eq.descricao && <p style={{ color: "#6b7280", fontSize: 11, margin: "3px 0 0", lineHeight: 1.3 }}>{eq.descricao}</p>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    <div style={{ flex: 1, background: `${cor}10`, border: `1px solid ${cor}30`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <p style={{ color: cor, fontSize: 9, margin: 0, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Usuários</p>
                      <p style={{ color: cor, fontSize: 18, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.3 }}>{qtdU}</p>
                    </div>
                    <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <p style={{ color: "#15803d", fontSize: 9, margin: 0, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Filas</p>
                      <p style={{ color: "#16a34a", fontSize: 18, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.3 }}>{qtdF}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
                    <button onClick={() => abrirEditar(eq)}
                      style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️ Editar</button>
                    <button onClick={() => excluir(eq)}
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 📋 ABA FILAS (sem mudanças)
// ═══════════════════════════════════════════════════════════════════════
function AbaFilas({ filas, equipes, usuarios, equipeById, workspaceId, podeGerenciar, isMobile, IS, cardStyle, labelStyle, onRefetch }: any) {
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formFila, setFormFila] = useState({ nome: "", conexao: "", equipe_id: "" });
  const [salvando, setSalvando] = useState(false);

  const filasFiltradas = useMemo(() => {
    if (!busca) return filas;
    const b = busca.toLowerCase();
    return filas.filter((f: Fila) => f.nome.toLowerCase().includes(b) || (f.conexao || "").toLowerCase().includes(b));
  }, [filas, busca]);

  const contarUsuariosPorFila = (nomeFila: string) => usuarios.filter((u: Usuario) => {
    if (!u.fila) return false;
    return u.fila.split(",").map(s => s.trim()).includes(nomeFila);
  }).length;

  const abrirNova = () => {
    if (!podeGerenciar) return alert("Sem permissão.");
    setFormFila({ nome: "", conexao: "", equipe_id: "" });
    setShowForm(true);
  };
  const salvar = async () => {
    if (!formFila.nome.trim()) return alert("Digite o nome da fila!");
    setSalvando(true);
    try {
      const { error } = await supabase.from("filas").insert([{
        nome: formFila.nome.trim(),
        conexao: formFila.conexao.trim() || null,
        workspace_id: workspaceId,
        equipe_id: formFila.equipe_id || null,
      }]);
      if (error) {
        if (error.code === "23505") alert("❌ Já existe uma fila com esse nome neste workspace!");
        else alert("Erro: " + error.message);
        setSalvando(false); return;
      }
      await onRefetch();
      setShowForm(false);
      setFormFila({ nome: "", conexao: "", equipe_id: "" });
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvando(false);
  };
  const excluir = async (f: Fila) => {
    if (!podeGerenciar) return alert("Sem permissão.");
    if (!confirm(`Excluir a fila "${f.nome}"?`)) return;
    const { error } = await supabase.from("filas").delete()
      .eq("id", f.id).eq("workspace_id", workspaceId);
    if (error) { alert("Erro: " + error.message); return; }
    await onRefetch();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ ...cardStyle, padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar filas..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...IS, flex: "1 1 240px", maxWidth: 400, borderRadius: 20 }} />
        <div style={{ flex: 1 }} />
        <button onClick={abrirNova}
          style={{
            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            color: "white", border: "none", borderRadius: 10,
            padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
          }}>+ Nova Fila</button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, padding: 22, borderTop: "3px solid #16a34a" }}>
          <p style={{ color: "#16a34a", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>
            ➕ Nova Fila
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Nome *</label>
              <input autoFocus placeholder='Ex: "Vendas Fibra"' value={formFila.nome} onChange={e => setFormFila({ ...formFila, nome: e.target.value })} style={IS} />
            </div>
            <div>
              <label style={labelStyle}>🏢 Equipe responsável</label>
              <select value={formFila.equipe_id} onChange={e => setFormFila({ ...formFila, equipe_id: e.target.value })} style={IS}>
                <option value="">Sem equipe (global)</option>
                {equipes.map((eq: Equipe) => <option key={eq.id} value={eq.id}>{iconeHashFromString(eq.nome)} {eq.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Conexão (opcional)</label>
              <input placeholder='Ex: "WhatsApp 01"' value={formFila.conexao} onChange={e => setFormFila({ ...formFila, conexao: e.target.value })} style={IS} />
            </div>
          </div>
          {formFila.nome && (
            <div style={{ marginBottom: 14, padding: 14, background: "#f9fafb", borderRadius: 10, border: "1px dashed #e5e7eb" }}>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>PREVIEW</p>
              <span style={{
                background: `${corHashFromString(formFila.nome)}15`,
                color: corHashFromString(formFila.nome),
                border: `1px solid ${corHashFromString(formFila.nome)}40`,
                padding: "5px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <span style={{ fontSize: 16 }}>{iconeFilaFromString(formFila.nome)}</span>
                <span>{formFila.nome}</span>
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowForm(false); setFormFila({ nome: "", conexao: "", equipe_id: "" }); }}
              style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 22px", fontSize: 12, cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
              }}>{salvando ? "Salvando..." : "💾 Salvar"}</button>
          </div>
        </div>
      )}

      {filasFiltradas.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 8px" }}>{busca ? "🔍" : "📋"}</p>
          <p style={{ color: "#9ca3af", fontSize: 13 }}>{busca ? "Nenhuma fila encontrada" : "Nenhuma fila cadastrada"}</p>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 600 : "auto" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Fila", "Equipe", "Conexão", "Usuários", "Ações"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((f: Fila, i: number) => {
                  const cor = corHashFromString(f.nome);
                  const icone = iconeFilaFromString(f.nome);
                  const equipe = f.equipe_id ? equipeById.get(f.equipe_id) : null;
                  const corEquipe = equipe ? corHashFromString(equipe.nome) : "#9ca3af";
                  return (
                    <tr key={f.id}
                      style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 8,
                            background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, flexShrink: 0,
                            boxShadow: `0 2px 6px ${cor}40`,
                          }}><span style={{ filter: "saturate(0) brightness(2)" }}>{icone}</span></div>
                          <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{f.nome}</p>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {equipe ? (
                          <span style={{ background: `${corEquipe}15`, color: corEquipe, border: `1px solid ${corEquipe}40`, padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {iconeHashFromString(equipe.nome)} {equipe.nome}
                          </span>
                        ) : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 13 }}>
                        {f.conexao || <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                          {contarUsuariosPorFila(f.nome)}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button onClick={() => excluir(f)}
                          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 🔐 ABA PERMISSÕES (sem mudanças)
// ═══════════════════════════════════════════════════════════════════════
function AbaPermissoes({ gruposPermissao, workspaceId, podeGerenciar, isMobile, IS, cardStyle, labelStyle, onRefetch, modulos, modulosCarregados }: any) {
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<GrupoPermissao | null>(null);
  const [formGrupo, setFormGrupo] = useState({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } });
  const [catsAbertas, setCatsAbertas] = useState<Record<string, boolean>>(
    CATEGORIAS_PERMISSAO.reduce((acc, c) => { acc[c.nome] = true; return acc; }, {} as Record<string, boolean>)
  );
  const [salvando, setSalvando] = useState(false);

  const gruposFiltrados = useMemo(() => {
    if (!busca) return gruposPermissao;
    const b = busca.toLowerCase();
    return gruposPermissao.filter((g: GrupoPermissao) => g.nome.toLowerCase().includes(b) || (g.descricao || "").toLowerCase().includes(b));
  }, [gruposPermissao, busca]);

  const abrirNovo = () => {
    if (!podeGerenciar) return alert("Sem permissão.");
    setEditando(null);
    setFormGrupo({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } });
    setShowForm(true);
  };
  const abrirEditar = (g: GrupoPermissao) => {
    if (!podeGerenciar) return alert("Sem permissão.");
    setEditando(g);
    setFormGrupo({ nome: g.nome, descricao: g.descricao || "", permissoes: { ...PERMISSOES_PADRAO, ...g.permissoes } });
    setShowForm(true);
  };
  const toggleCategoriaToda = (catNome: string, marcar: boolean) => {
    const cat = CATEGORIAS_PERMISSAO.find(c => c.nome === catNome);
    if (!cat) return;
    const novo = { ...formGrupo.permissoes };
    cat.permissoes.forEach(p => { novo[p.key] = marcar; });
    setFormGrupo({ ...formGrupo, permissoes: novo });
  };
  const salvar = async () => {
    if (!formGrupo.nome) return alert("Nome obrigatório.");
    if (!workspaceId) return alert("Workspace não carregado.");
    setSalvando(true);
    try {
      if (editando) {
        await supabase.from("grupos_permissao")
          .update({ nome: formGrupo.nome, descricao: formGrupo.descricao, permissoes: formGrupo.permissoes })
          .eq("id", editando.id).eq("workspace_id", workspaceId);
      } else {
        await supabase.from("grupos_permissao").insert([{
          workspace_id: workspaceId,
          nome: formGrupo.nome,
          descricao: formGrupo.descricao,
          permissoes: formGrupo.permissoes
        }]);
      }
      await onRefetch();
      setShowForm(false);
      setEditando(null);
      setFormGrupo({ nome: "", descricao: "", permissoes: { ...PERMISSOES_PADRAO } });
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
    setSalvando(false);
  };
  const excluir = async (g: GrupoPermissao) => {
    if (!podeGerenciar) return alert("Sem permissão.");
    if (!confirm(`Excluir o grupo "${g.nome}"?\n\nUsuários que usavam esse grupo passam a usar o padrão do perfil.`)) return;
    await supabase.from("grupos_permissao").delete().eq("id", g.id).eq("workspace_id", workspaceId);
    await onRefetch();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Info card */}
      <div style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
        border: "1px solid #bfdbfe",
        borderLeft: "4px solid #3b82f6",
        borderRadius: 12,
        padding: "14px 18px",
      }}>
        <p style={{ color: "#1e40af", fontSize: 13, margin: 0, fontWeight: 700 }}>💡 Como funciona</p>
        <p style={{ color: "#3b82f6", fontSize: 12, margin: "3px 0 0", lineHeight: 1.5 }}>
          Cada usuário tem um <b>perfil</b> (Administrador / Supervisor / Atendente) que define os padrões. Os grupos abaixo são <b>permissões granulares opcionais</b> — vincule um grupo a um usuário pra dar acesso específico além do padrão do perfil. Útil quando um atendente precisa acessar relatórios, ou um supervisor não pode mexer em conexões.
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ ...cardStyle, padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar grupos..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...IS, flex: "1 1 240px", maxWidth: 400, borderRadius: 20 }} />
        <div style={{ flex: 1 }} />
        <button onClick={abrirNovo}
          style={{
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color: "white", border: "none", borderRadius: 10,
            padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
          }}>+ Novo Grupo</button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ ...cardStyle, padding: 22, borderTop: "3px solid #8b5cf6" }}>
          <p style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>
            {editando ? "✏️ Editar Grupo" : "➕ Novo Grupo"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Nome *</label>
              <input placeholder="Ex: Atendente Vendas" value={formGrupo.nome} onChange={e => setFormGrupo({ ...formGrupo, nome: e.target.value })} style={IS} />
            </div>
            <div>
              <label style={labelStyle}>Descrição</label>
              <input placeholder="Ex: Acesso às vendas e chat" value={formGrupo.descricao} onChange={e => setFormGrupo({ ...formGrupo, descricao: e.target.value })} style={IS} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CATEGORIAS_PERMISSAO.filter((c: any) => !c.mod || (modulosCarregados && modulos && modulos[c.mod])).map(cat => {
              const todasMarcadas = cat.permissoes.every(p => formGrupo.permissoes[p.key]);
              const algumaMarcada = cat.permissoes.some(p => formGrupo.permissoes[p.key]);
              const aberta = catsAbertas[cat.nome] !== false;
              return (
                <div key={cat.nome} style={{ background: "#ffffff", border: `1px solid ${cat.cor}30`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: `${cat.cor}08`, cursor: "pointer", borderLeft: `4px solid ${cat.cor}` }}
                    onClick={() => setCatsAbertas({ ...catsAbertas, [cat.nome]: !aberta })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: cat.cor, fontSize: 13, fontWeight: 700 }}>{aberta ? "▼" : "▶"} {cat.nome}</span>
                      <span style={{ background: `${cat.cor}15`, color: cat.cor, fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, border: `1px solid ${cat.cor}30` }}>
                        {cat.permissoes.filter(p => formGrupo.permissoes[p.key]).length}/{cat.permissoes.length}
                      </span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleCategoriaToda(cat.nome, !todasMarcadas); }}
                      style={{
                        background: todasMarcadas ? `${cat.cor}20` : algumaMarcada ? `${cat.cor}10` : "#ffffff",
                        color: algumaMarcada || todasMarcadas ? cat.cor : "#6b7280",
                        border: `1px solid ${cat.cor}40`,
                        borderRadius: 8, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700,
                      }}>{todasMarcadas ? "✓ Todos" : "+ Todos"}</button>
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

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
            <button onClick={() => { setShowForm(false); setEditando(null); }}
              style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#6d28d9" : "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 22px", fontSize: 12, cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
              }}>{salvando ? "Salvando..." : "💾 Salvar Grupo"}</button>
          </div>
        </div>
      )}

      {gruposFiltrados.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 8px" }}>{busca ? "🔍" : "🔐"}</p>
          <p style={{ color: "#9ca3af", fontSize: 13 }}>{busca ? "Nenhum grupo encontrado" : "Nenhum grupo criado ainda"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {gruposFiltrados.map((g: GrupoPermissao) => {
            const qtdMarcadas = Object.values(g.permissoes || {}).filter(Boolean).length;
            const total = TODAS_PERMISSOES.length;
            const pct = Math.round((qtdMarcadas / total) * 100);
            return (
              <div key={g.id} style={{ ...cardStyle, padding: "16px 20px", borderLeft: "4px solid #8b5cf6", transition: "all 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(139,92,246,0.10)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>{g.nome}</p>
                    {g.descricao && <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{g.descricao}</p>}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <div style={{ flex: 1, maxWidth: 120, background: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
                        <div style={{ background: "linear-gradient(90deg, #8b5cf6, #6366f1)", height: "100%", width: `${pct}%`, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 700 }}>{qtdMarcadas}/{total} permissões ({pct}%)</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => abrirEditar(g)}
                      style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                    <button onClick={() => excluir(g)}
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {Object.entries(g.permissoes || {}).filter(([_, v]) => v).slice(0, 10).map(([k]) => (
                    <span key={k} style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", fontSize: 10, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{LABELS_MAP[k] || k}</span>
                  ))}
                  {qtdMarcadas > 10 && <span style={{ color: "#9ca3af", fontSize: 10, padding: "3px 6px", fontStyle: "italic" }}>+{qtdMarcadas - 10} outras</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ⚙️ ABA GERAL (sem mudanças)
// ═══════════════════════════════════════════════════════════════════════
function AbaGeral({ workspaceId, usuarios, isAdmin, limites, limiteAtingido, podeGerenciar, isMobile, IS, cardStyle, labelStyle }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Info cards top */}
      <div style={{ ...cardStyle, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚙️</div>
          <div>
            <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0 }}>Visão Geral do Workspace</h2>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0" }}>Estatísticas e configurações de comportamento</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <InfoCard
            titulo="Plano atual"
            valor={isAdmin ? "Sem limite" : `${usuarios.length}/${limites.usuarios_liberados}`}
            detalhe={isAdmin ? "Você é Super Admin (Wolf)" : limiteAtingido ? "⚠️ Limite atingido — Upgrade necessário" : `${limites.usuarios_liberados - usuarios.length} usuário(s) disponíveis`}
            cor={isAdmin ? "#a855f7" : limiteAtingido ? "#dc2626" : "#16a34a"}
            icone={isAdmin ? "⭐" : "📊"}
          />
          <InfoCard titulo="Banco de dados" valor="Supabase" detalhe="PostgreSQL · Realtime ativo" cor="#16a34a" icone="🗄️" />
          <InfoCard titulo="Auth" valor="Email + Senha" detalhe="JWT · Multi-workspace" cor="#3b82f6" icone="🔐" />
          <InfoCard titulo="Versão" valor="Wolf CRM 2.0" detalhe="SaaS Multi-tenant" cor="#f59e0b" icone="🏷️" />
        </div>
      </div>

      {/* Bloqueio pós-finalização */}
      <BloqueioPosFinalizacao workspaceId={workspaceId} podeGerenciar={podeGerenciar} IS={IS} cardStyle={cardStyle} labelStyle={labelStyle} />

      {/* 🤳 Bater Ponto — com/sem selfie (só aparece se o módulo estiver liberado) */}
      <ConfigPontoSelfie podeGerenciar={podeGerenciar} IS={IS} cardStyle={cardStyle} />

      {/* Dica roleta */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderLeft: "4px solid #3b82f6", borderRadius: 12, padding: "14px 18px" }}>
        <p style={{ color: "#1e40af", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          💡 <b>A Roleta de Distribuição</b> agora fica em <b>Chatbot → Configurações → Roleta</b>, já que está mais relacionada ao fluxo de atendimento do que à configuração do workspace.
        </p>
      </div>
    </div>
  );
}

function InfoCard({ titulo, valor, detalhe, cor, icone }: any) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${cor}08 0%, ${cor}03 100%)`,
      border: `1px solid ${cor}30`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
        boxShadow: `0 4px 10px ${cor}40`,
      }}><span style={{ filter: "saturate(0) brightness(2)" }}>{icone}</span></div>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: "#6b7280", fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{titulo}</p>
        <p style={{ color: "#1f2937", fontSize: 15, margin: "2px 0 0", fontWeight: 800, letterSpacing: -0.3 }}>{valor}</p>
        <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>{detalhe}</p>
      </div>
    </div>
  );
}

function BloqueioPosFinalizacao({ workspaceId, podeGerenciar, IS, cardStyle, labelStyle }: any) {
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
    if (!error && horasBloqueio === 0) {
      await supabase.from("atendimentos")
        .update({ bloqueado_ate: null, atendente_finalizou: null })
        .eq("workspace_id", wsId)
        .not("bloqueado_ate", "is", null);
    }
    setSalvando(false);
    if (error) {
      alert("❌ Erro ao salvar: " + error.message);
    } else {
      setEditado(false);
      alert(horasBloqueio === 0
        ? "✅ Bloqueio desativado! Todos os contatos bloqueados foram liberados."
        : "✅ Configuração salva!"
      );
    }
  };

  return (
    <div style={{ ...cardStyle, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔒</div>
        <div>
          <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0 }}>Bloqueio Pós-Finalização</h2>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0" }}>Quanto tempo um cliente fica bloqueado de reabrir após finalização</p>
        </div>
      </div>

      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
        <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 14px", lineHeight: 1.5 }}>
          Quando um atendente finaliza um chat, o cliente fica bloqueado de reabrir por essa quantidade de horas.
          Mensagens nesse período são registradas mas o atendimento <b>NÃO</b> volta pra "Aguardando".
          <br /><b>0 = desativa o bloqueio</b>. Recomendado: <b>24h</b>. Aplica só em finalização manual humana.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="number" min={0} max={720} value={horasBloqueio}
            onChange={e => { setHorasBloqueio(Math.max(0, Math.min(720, parseInt(e.target.value) || 0))); setEditado(true); }}
            disabled={!podeGerenciar}
            style={{ ...IS, width: 110, fontWeight: 700 }} />
          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>
            {horasBloqueio === 0 ? "(desativado)" : horasBloqueio === 24 ? "(1 dia)" : horasBloqueio === 48 ? "(2 dias)" : horasBloqueio === 168 ? "(1 semana)" : `(${horasBloqueio}h)`}
          </span>
          <div style={{ flex: 1 }} />
          {editado && podeGerenciar && (
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: salvando ? "wait" : "pointer",
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}>{salvando ? "Salvando..." : "💾 Salvar"}</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          {[0, 12, 24, 48, 72, 168].map(h => {
            const ativo = horasBloqueio === h;
            return (
              <button key={h} disabled={!podeGerenciar} onClick={() => { setHorasBloqueio(h); setEditado(true); }}
                style={{
                  background: ativo ? "#3b82f6" : "#ffffff",
                  color: ativo ? "white" : "#6b7280",
                  border: `1px solid ${ativo ? "#3b82f6" : "#e5e7eb"}`,
                  borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: podeGerenciar ? "pointer" : "not-allowed", fontWeight: 700,
                  boxShadow: ativo ? "0 2px 6px rgba(59,130,246,0.25)" : "none",
                  opacity: podeGerenciar ? 1 : 0.5,
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

// \u2550\u2550\u2550 CONFIG PONTO \u2014 selfie obrigat\u00f3ria ou n\u00e3o (escolha do dono) \u2550\u2550\u2550
// S\u00f3 aparece se o m\u00f3dulo "bater_ponto" estiver liberado pro workspace.
// Grava em workspaces.ponto_selfie_obrigatoria (default true = com selfie).
function ConfigPontoSelfie({ podeGerenciar, IS, cardStyle }: any) {
  const { workspace, wsId } = useWorkspace();
  const { modulos, carregado } = useModulos();
  const [selfie, setSelfie] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editado, setEditado] = useState(false);

  useEffect(() => {
    if (workspace && (workspace as any).ponto_selfie_obrigatoria != null) {
      setSelfie(!!(workspace as any).ponto_selfie_obrigatoria);
    }
  }, [workspace]);

  // S\u00f3 mostra se o m\u00f3dulo Bater Ponto estiver liberado pra este workspace
  if (carregado && modulos && !modulos.bater_ponto) return null;

  const salvar = async () => {
    if (!wsId) return;
    setSalvando(true);
    const { error } = await supabase.from("workspaces")
      .update({ ponto_selfie_obrigatoria: selfie })
      .eq("username", wsId);
    setSalvando(false);
    if (error) { alert("\u274c Erro ao salvar: " + error.message); return; }
    setEditado(false);
    alert("\u2705 Configura\u00e7\u00e3o do ponto salva!");
  };

  const opcoes = [
    { v: true, t: "\ud83e\udd33 Com selfie", d: "Exige foto + GPS a cada batida" },
    { v: false, t: "\ud83d\udccd Sem selfie", d: "Registra s\u00f3 com GPS, sem c\u00e2mera" },
  ];

  return (
    <div style={{ ...cardStyle, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ecfeff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{"\ud83e\udd33"}</div>
        <div>
          <h2 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0 }}>Bater Ponto — Selfie</h2>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0" }}>Escolha se o funcionário precisa tirar selfie ao registrar o ponto</p>
        </div>
      </div>
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {opcoes.map(op => {
            const ativo = selfie === op.v;
            return (
              <button key={String(op.v)} disabled={!podeGerenciar}
                onClick={() => { setSelfie(op.v); setEditado(true); }}
                style={{
                  flex: "1 1 200px", textAlign: "left",
                  background: ativo ? "#ecfeff" : "#ffffff",
                  border: "1px solid " + (ativo ? "#0891b2" : "#e5e7eb"),
                  borderRadius: 10, padding: "12px 14px",
                  cursor: podeGerenciar ? "pointer" : "not-allowed",
                  boxShadow: ativo ? "0 2px 8px rgba(8,145,178,0.15)" : "none",
                  opacity: podeGerenciar ? 1 : 0.6,
                }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ativo ? "#0891b2" : "#1f2937" }}>{op.t}</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7280" }}>{op.d}</p>
              </button>
            );
          })}
        </div>
        {editado && podeGerenciar && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#0e7490" : "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: salvando ? "wait" : "pointer",
                boxShadow: "0 4px 12px rgba(8,145,178,0.3)",
              }}>{salvando ? "Salvando..." : "\ud83d\udcbe Salvar"}</button>
          </div>
        )}
      </div>
    </div>
  );
}