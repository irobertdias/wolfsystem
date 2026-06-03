"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { usePermissao } from "../hooks/usePermissao";
import { useModulos } from "../hooks/useModulos";
import AuthGuard from "../components/AuthGuard";  // 🔒 protege todo /crm/*

// ═══════════════════════════════════════════════════════════════════════
// 🏛️ HIERARQUIA:
//   👑 Super Admin Wolf → bypass total
//   🏢 Dono → respeita plano
//   👔 Admin sub-usuário → respeita plano (igual Dono)
//   👤 Sub-usuário comum → respeita plano E grupo de permissão
// ═══════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { permissoes, isDono, isSuperAdmin, perfil } = usePermissao();
  const { modulos, carregado: modulosCarregados } = useModulos();
  const [userEmail, setUserEmail] = useState("");
  const [workspaceNome, setWorkspaceNome] = useState("");
  const [cadastrosCount, setCadastrosCount] = useState(0);
  const [usuariosCount, setUsuariosCount] = useState(0);
  const [limiteUsuarios, setLimiteUsuarios] = useState(9999);

  const [isMobile, setIsMobile] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const navegarPara = (path: string) => {
    router.push(path);
    if (isMobile) setMenuMobileAberto(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUserEmail(user.email || "");

      let wsId: string | null = null;
      let ownerEmail: string | null = null;
      let workspaceNomeLocal: string | null = null;

      const { data: wsDono } = await supabase
        .from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();

      if (wsDono) {
        workspaceNomeLocal = wsDono.nome;
        wsId = wsDono.username;
        ownerEmail = wsDono.owner_email;
      } else {
        const { data: usuarioWs } = await supabase
          .from("usuarios_workspace").select("workspace_id")
          .eq("email", user.email)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();

        if (usuarioWs?.workspace_id) {
          const { data: wsData } = await supabase
            .from("workspaces").select("nome, username, owner_email")
            .eq("username", usuarioWs.workspace_id).maybeSingle();

          if (wsData) {
            workspaceNomeLocal = wsData.nome;
            wsId = wsData.username;
            ownerEmail = wsData.owner_email;
          } else if (/^\d+$/.test(usuarioWs.workspace_id)) {
            const { data: wsLegado } = await supabase
              .from("workspaces").select("nome, username, owner_email")
              .eq("id", parseInt(usuarioWs.workspace_id)).maybeSingle();
            if (wsLegado) {
              workspaceNomeLocal = wsLegado.nome;
              wsId = wsLegado.username;
              ownerEmail = wsLegado.owner_email;
            }
          }
        }
      }

      if (workspaceNomeLocal) setWorkspaceNome(workspaceNomeLocal);

      if (wsId) {
        const { count } = await supabase.from("usuarios_workspace")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId);
        setUsuariosCount(count || 0);
      }

      if (!isSuperAdmin && ownerEmail) {
        const { data: cadastro } = await supabase.from("cadastros")
          .select("usuarios_liberados").eq("email", ownerEmail).maybeSingle();
        if (cadastro) setLimiteUsuarios(cadastro.usuarios_liberados || 1);
      }

      if (isSuperAdmin) {
        const { count } = await supabase.from("cadastros").select("*", { count: "exact", head: true });
        setCadastrosCount(count || 0);
      }
    };
    init();
  }, [isSuperAdmin]);

  const signOut = async () => { await supabase.auth.signOut(); router.push("/"); };

  const podeVerComHierarquia = (
    moduloAtivo: boolean,
    permissaoKey: keyof typeof permissoes
  ): boolean => {
    if (isSuperAdmin) return true;
    if (!moduloAtivo) return false;
    if (isDono) return true;
    if (perfil === "Administrador") return true;
    return !!permissoes[permissaoKey];
  };

  const ehDonoOuAdmin = isDono || perfil === "Administrador";

  // 🏠 Menu principal: só a Visão Geral (dashboard global, landing do login).
  const menuItems = [
    ...(isSuperAdmin ? [{ path: "/crm/clientes", icon: "👥", label: "Clientes Wolf", badge: cadastrosCount }] : []),
    { path: "/crm/visao", icon: "📊", label: "Visão Geral", badge: 0 },
  ];

  // 🎯 CRM vira um grupo expansível nos atalhos (mesma gating de antes).
  const crmItems = [
    ...((isSuperAdmin || isDono || permissoes.dashboard) ? [{ path: "/crm/dashboard", icon: "📈", label: "Dashboard de Vendas" }] : []),
    ...((isSuperAdmin || isDono || permissoes.funil || permissoes.vendas_proprio || permissoes.vendas_equipe) ? [{ path: "/crm/funil", icon: "🎯", label: "Funil de Vendas" }] : []),
    ...((isSuperAdmin || isDono || permissoes.vendas_proprio || permissoes.vendas_equipe) ? [{ path: "/crm/vendas", icon: "💰", label: "Vendas" }] : []),
    ...(!isSuperAdmin && (isDono || permissoes.contatos_ver || permissoes.chat_proprio || permissoes.chat_todos) ? [{ path: "/crm/contatos", icon: "👥", label: "Contatos" }] : []),
  ];
  const podeVerCRM = isSuperAdmin || isDono || (permissoes as any).crm_acessar;
  const podeVerConfig = isSuperAdmin || isDono || permissoes.configuracoes_workspace;

  const isActive = (path: string) => pathname === path;

  const podeVerTelefonia = podeVerComHierarquia(modulos.voip, "telefonia_acessar" as any);
  const podeVerChatbot = isSuperAdmin || isDono || (permissoes as any).chatbot_acessar;
  // 🆕 Cobrança: por enquanto só dono/admin. Quando criar permissão granular `cobranca` em permissoes_perfis, troca aqui.
  const podeVerCobranca = podeVerComHierarquia(modulos.cobranca, "cobranca" as any);
  const crmRotaAtiva = crmItems.some((i) => isActive(i.path));
  // 🆕 RH: por enquanto dono/admin. Quando criar permissão granular `rh`, ela passa a valer aqui.
  const podeVerRH = podeVerComHierarquia(modulos.rh, "rh" as any);
  // 🆕 Bater Ponto: liberado pra qualquer usuário logado (colaborador bate o próprio ponto).
  const podeBaterPonto = podeVerComHierarquia(modulos.bater_ponto, "bater_ponto" as any);

  const perfilLabel = isSuperAdmin ? "👑 Super Admin Wolf"
    : isDono ? "🏢 Dono do Workspace"
    : perfil === "Supervisor" ? "🔍 Supervisor"
    : perfil === "Administrador" ? "👔 Administrador"
    : "👤 Atendente";

  return (
    <AuthGuard>
    <div style={{
      display: "flex", height: "100vh", fontFamily: "Arial, sans-serif",
      background: "#f8fafc", position: "relative",
    }}>

      {/* ═══ BOTÃO HAMBÚRGUER (mobile) ═══ */}
      {isMobile && !menuMobileAberto && (
        <button
          onClick={() => setMenuMobileAberto(true)}
          title="Abrir menu"
          style={{
            position: "fixed", top: 8, left: 8, zIndex: 999,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            color: "#1f2937",
            borderRadius: 10, padding: "8px 14px",
            fontSize: 18, cursor: "pointer", lineHeight: 1,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
            fontWeight: 700,
          }}
        >☰</button>
      )}

      {/* ═══ OVERLAY (mobile) ═══ */}
      {isMobile && menuMobileAberto && (
        <div
          onClick={() => setMenuMobileAberto(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
          }}
        />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <div style={{
        width: isMobile ? 280 : 220,
        background: "#ffffff",
        borderRight: "1px solid #e5e7eb",
        display: "flex", flexDirection: "column",
        padding: 16, gap: 6, flexShrink: 0, overflowY: "auto",
        position: isMobile ? "fixed" : "relative",
        top: isMobile ? 0 : "auto",
        left: isMobile ? 0 : "auto",
        bottom: isMobile ? 0 : "auto",
        height: isMobile ? "100vh" : "auto",
        zIndex: isMobile ? 1000 : "auto",
        transform: isMobile && !menuMobileAberto ? "translateX(-100%)" : "translateX(0)",
        transition: "transform 0.25s ease",
        boxShadow: isMobile ? "4px 0 16px rgba(0,0,0,0.08)" : "none",
      }}>
        {/* Logo + nome workspace */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(31,41,55,0.2)",
              padding: 5, flexShrink: 0,
            }}>
              <img src="/logo1.png" alt="Wolf"
                style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ color: "#1f2937", fontWeight: 700, fontSize: 13, display: "block", letterSpacing: -0.2 }}>Wolf CRM</span>
              <span style={{ color: "#16a34a", fontSize: 10, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                {workspaceNome || "Carregando..."}
              </span>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setMenuMobileAberto(false)}
              title="Fechar menu"
              style={{
                background: "#f3f4f6", border: "none", color: "#6b7280",
                fontSize: 16, cursor: "pointer", width: 30, height: 30,
                borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >✕</button>
          )}
        </div>

        {/* Card "Logado como" */}
        <div style={{
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 10, padding: "9px 12px", marginBottom: 6,
        }}>
          <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>Logado como</p>
          <p style={{ color: "#1f2937", fontSize: 11, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{userEmail}</p>
          <p style={{ color: "#6b7280", fontSize: 10, margin: "3px 0 0", fontWeight: 500 }}>{perfilLabel}</p>
        </div>

        {/* Card do Plano */}
        {ehDonoOuAdmin && !isSuperAdmin && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a",
            borderLeft: "3px solid #f59e0b",
            borderRadius: 10, padding: "9px 12px", marginBottom: 6,
          }}>
            <p style={{ color: "#92400e", fontSize: 10, margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>Plano</p>
            <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>👥 {usuariosCount}/{limiteUsuarios} usuários</span>
          </div>
        )}

        {/* Itens do menu */}
        {menuItems.map(item => {
          const ativo = isActive(item.path);
          return (
            <button key={item.path} onClick={() => navegarPara(item.path)}
              onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = "#f3f4f6"; }}
              onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = "transparent"; }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px",
                background: ativo ? "#f0fdf4" : "transparent",
                border: "none",
                borderLeft: ativo ? "3px solid #16a34a" : "3px solid transparent",
                borderRadius: ativo ? "0 8px 8px 0" : 8,
                cursor: "pointer",
                color: ativo ? "#16a34a" : "#4b5563",
                fontSize: 13, fontWeight: ativo ? 700 : 500,
                textAlign: "left",
                transition: "background 0.1s",
                marginLeft: ativo ? -3 : 0,
              }}>
              <span>{item.icon}</span>
              {item.label}
              {(item as any).badge > 0 && (
                <span style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  color: "white",
                  borderRadius: 10, padding: "1px 8px", fontSize: 10,
                  marginLeft: "auto", fontWeight: 700,
                  boxShadow: "0 2px 4px rgba(22,163,74,0.25)",
                }}>{(item as any).badge}</span>
              )}
            </button>
          );
        })}

        {/* Separador + atalhos (CRM, Chatbot, Telefonia, Cobrança, RH, Bater Ponto, Configurações) */}
        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 10, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {/* 🎯 CRM — botão do módulo (sub-barra vive dentro de (crm)/layout) */}
          {podeVerCRM && (
            <button onClick={() => navegarPara(crmItems[0]?.path || "/crm/dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: crmRotaAtiva ? "#dcfce7" : "#f0fdf4",
                border: `1px solid ${crmRotaAtiva ? "#16a34a" : "#bbf7d0"}`,
                borderRadius: 10, cursor: "pointer",
                color: "#16a34a", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!crmRotaAtiva) { e.currentTarget.style.background = "#dcfce7"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(22,163,74,0.15)"; } }}
              onMouseLeave={(e) => { if (!crmRotaAtiva) { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.boxShadow = "none"; } }}
            >
              <span>🎯</span> CRM
            </button>
          )}

          {podeVerChatbot && (
            <button onClick={() => navegarPara("/chatbot")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 10, cursor: "pointer",
                color: "#3b82f6", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(59,130,246,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <span>💬</span> Chatbot
            </button>
          )}

          {modulosCarregados && podeVerTelefonia && (
            <button onClick={() => navegarPara("/crm/telefonia")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: isActive("/crm/telefonia") ? "#dcfce7" : "#f0fdf4",
                border: `1px solid ${isActive("/crm/telefonia") ? "#16a34a" : "#bbf7d0"}`,
                borderRadius: 10, cursor: "pointer",
                color: "#16a34a", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive("/crm/telefonia")) { e.currentTarget.style.background = "#dcfce7"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(22,163,74,0.15)"; } }}
              onMouseLeave={(e) => { if (!isActive("/crm/telefonia")) { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.boxShadow = "none"; } }}
            >
              <span>📞</span> Telefonia
            </button>
          )}

          {modulosCarregados && podeVerCobranca && (
            <button onClick={() => navegarPara("/crm/cobranca")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: isActive("/crm/cobranca") ? "#fee2e2" : "#fef2f2",
                border: `1px solid ${isActive("/crm/cobranca") ? "#dc2626" : "#fecaca"}`,
                borderRadius: 10, cursor: "pointer",
                color: "#dc2626", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive("/crm/cobranca")) { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(220,38,38,0.15)"; } }}
              onMouseLeave={(e) => { if (!isActive("/crm/cobranca")) { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.boxShadow = "none"; } }}
            >
              <span>💰</span> Cobrança
            </button>
          )}

          {modulosCarregados && podeVerRH && (
            <button onClick={() => navegarPara("/crm/rh")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: isActive("/crm/rh") ? "#e0e7ff" : "#eef2ff",
                border: `1px solid ${isActive("/crm/rh") ? "#4f46e5" : "#c7d2fe"}`,
                borderRadius: 10, cursor: "pointer",
                color: "#4f46e5", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive("/crm/rh")) { e.currentTarget.style.background = "#e0e7ff"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(79,70,229,0.15)"; } }}
              onMouseLeave={(e) => { if (!isActive("/crm/rh")) { e.currentTarget.style.background = "#eef2ff"; e.currentTarget.style.boxShadow = "none"; } }}
            >
              <span>🧑‍💼</span> RH
            </button>
          )}

          {modulosCarregados && podeBaterPonto && (
            <button onClick={() => navegarPara("/crm/ponto")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: isActive("/crm/ponto") ? "#cffafe" : "#ecfeff",
                border: `1px solid ${isActive("/crm/ponto") ? "#0891b2" : "#a5f3fc"}`,
                borderRadius: 10, cursor: "pointer",
                color: "#0891b2", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive("/crm/ponto")) { e.currentTarget.style.background = "#cffafe"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(8,145,178,0.15)"; } }}
              onMouseLeave={(e) => { if (!isActive("/crm/ponto")) { e.currentTarget.style.background = "#ecfeff"; e.currentTarget.style.boxShadow = "none"; } }}
            >
              <span>🕐</span> Bater Ponto
            </button>
          )}

          {/* ⚙️ Configurações — botão separado */}
          {podeVerConfig && (
            <button onClick={() => navegarPara("/crm/configuracoes")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: isActive("/crm/configuracoes") ? "#f1f5f9" : "#f8fafc",
                border: `1px solid ${isActive("/crm/configuracoes") ? "#64748b" : "#e2e8f0"}`,
                borderRadius: 10, cursor: "pointer",
                color: "#475569", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive("/crm/configuracoes")) e.currentTarget.style.background = "#f1f5f9"; }}
              onMouseLeave={(e) => { if (!isActive("/crm/configuracoes")) e.currentTarget.style.background = "#f8fafc"; }}
            >
              <span>⚙️</span> Configurações
            </button>
          )}
        </div>

        {/* Botão Sair (fundo) */}
        <div style={{ marginTop: "auto", borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
          <button onClick={signOut}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10, cursor: "pointer",
              color: "#dc2626", fontSize: 13, fontWeight: 700, textAlign: "left", width: "100%",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(220,38,38,0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </div>

      {/* ═══ CONTEÚDO ═══ */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: isMobile ? "56px 12px 16px" : 32,
        width: isMobile ? "100%" : "auto",
        minWidth: 0,
      }}>
        {children}
      </div>
    </div>
    </AuthGuard>
  );
}