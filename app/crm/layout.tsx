"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { usePermissao } from "../hooks/usePermissao";
import { useModulos } from "../hooks/useModulos";
import AuthGuard from "../components/AuthGuard";

const ADMIN_EMAIL = "robert.dias@live.com";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { permissoes, isDono, isSuperAdmin, perfil } = usePermissao();
  const { modulos, carregado: modulosCarregados } = useModulos();

  const [userEmail, setUserEmail] = useState("");
  const [userNome, setUserNome] = useState("");
  const [userFotoUrl, setUserFotoUrl] = useState("");
  const [workspaceNome, setWorkspaceNome] = useState("");
  const [cadastrosCount, setCadastrosCount] = useState(0);
  const [usuariosCount, setUsuariosCount] = useState(0);
  const [limiteUsuarios, setLimiteUsuarios] = useState(9999);

  const [isMobile, setIsMobile] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [menuRecolhido, setMenuRecolhido] = useState(false);

  const sidebarCompacta = !isMobile && menuRecolhido;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();

    const saved = localStorage.getItem("wolf_crm_sidebar_recolhida");
    if (saved === "true") setMenuRecolhido(true);

    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const alternarMenuRecolhido = () => {
    setMenuRecolhido((atual) => {
      const novo = !atual;
      localStorage.setItem("wolf_crm_sidebar_recolhida", String(novo));
      return novo;
    });
  };

  const navegarPara = (path: string) => {
    router.push(path);
    if (isMobile) setMenuMobileAberto(false);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      setUserEmail(user.email || "");
      setUserNome((user.user_metadata as any)?.nome || "");
      setUserFotoUrl((user.user_metadata as any)?.foto_url || "");

      let wsId: string | null = null;
      let ownerEmail: string | null = null;
      let workspaceNomeLocal: string | null = null;

      const { data: wsDono } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (wsDono) {
        workspaceNomeLocal = wsDono.nome;
        wsId = wsDono.username;
        ownerEmail = wsDono.owner_email;
      } else {
        const { data: usuarioWs } = await supabase
          .from("usuarios_workspace")
          .select("workspace_id, nome, foto_url")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (usuarioWs?.workspace_id) {
          if (usuarioWs.nome) setUserNome(usuarioWs.nome);
          if (usuarioWs.foto_url) setUserFotoUrl(usuarioWs.foto_url);

          const { data: wsData } = await supabase
            .from("workspaces")
            .select("nome, username, owner_email")
            .eq("username", usuarioWs.workspace_id)
            .maybeSingle();

          if (wsData) {
            workspaceNomeLocal = wsData.nome;
            wsId = wsData.username;
            ownerEmail = wsData.owner_email;
          } else if (/^\d+$/.test(usuarioWs.workspace_id)) {
            const { data: wsLegado } = await supabase
              .from("workspaces")
              .select("nome, username, owner_email")
              .eq("id", parseInt(usuarioWs.workspace_id))
              .maybeSingle();

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
        const { count } = await supabase
          .from("usuarios_workspace")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId);

        setUsuariosCount(count || 0);
      }

      if (!isSuperAdmin && ownerEmail) {
        const { data: cadastro } = await supabase
          .from("cadastros")
          .select("usuarios_liberados")
          .eq("email", ownerEmail)
          .maybeSingle();

        if (cadastro) setLimiteUsuarios(cadastro.usuarios_liberados || 1);
      }

      if (isSuperAdmin) {
        const { count } = await supabase
          .from("cadastros")
          .select("*", { count: "exact", head: true });

        setCadastrosCount(count || 0);
      }
    };

    init();
  }, [isSuperAdmin, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

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

  const menuItems = [
    ...(isSuperAdmin
      ? [{ path: "/crm/clientes", icon: "👥", label: "Clientes Wolf", badge: cadastrosCount }]
      : []),
    { path: "/crm/visao", icon: "📊", label: "Visão Geral", badge: 0 },
  ];

  const crmItems = [
    ...((isSuperAdmin || isDono || permissoes.dashboard)
      ? [{ path: "/crm/dashboard", icon: "📈", label: "Dashboard de Vendas" }]
      : []),
    ...((isSuperAdmin || isDono || permissoes.funil || permissoes.vendas_proprio || permissoes.vendas_equipe)
      ? [{ path: "/crm/funil", icon: "🎯", label: "Funil de Vendas" }]
      : []),
    ...((isSuperAdmin || isDono || permissoes.vendas_proprio || permissoes.vendas_equipe)
      ? [{ path: "/crm/vendas", icon: "💰", label: "Vendas" }]
      : []),
    ...(!isSuperAdmin && (isDono || permissoes.contatos_ver || permissoes.chat_proprio || permissoes.chat_todos)
      ? [{ path: "/crm/contatos", icon: "👥", label: "Contatos" }]
      : []),
  ];

  const podeVerCRM = isSuperAdmin || isDono || (permissoes as any).crm_acessar;
  const podeVerConfig = isSuperAdmin || isDono || permissoes.configuracoes_workspace;

  const isActive = (path: string) => pathname === path;

  const podeVerTelefonia = podeVerComHierarquia(modulos.voip, "telefonia_acessar" as any);
  const podeVerChatbot = isSuperAdmin || isDono || (permissoes as any).chatbot_acessar;
  const podeVerCobranca = podeVerComHierarquia(modulos.cobranca, "cobranca" as any);
  const podeVerRH = podeVerComHierarquia(modulos.rh, "rh" as any);
  const podeVerFinanceiro = podeVerComHierarquia(modulos.financeiro, "financeiro_acessar" as any);
  const podeBaterPonto = podeVerComHierarquia(modulos.bater_ponto, "bater_ponto" as any);

  const crmRotaAtiva = crmItems.some((i) => isActive(i.path));

  const perfilLabel = isSuperAdmin
    ? "👑 Super Admin Wolf"
    : isDono
      ? "🏢 Dono do Workspace"
      : perfil === "Supervisor"
        ? "🔍 Supervisor"
        : perfil === "Administrador"
          ? "👔 Administrador"
          : "👤 Atendente";

  const renderTexto = (texto: string) => (!sidebarCompacta ? texto : null);

  const estiloBotaoModulo = (
    ativo: boolean,
    bg: string,
    bgAtivo: string,
    border: string,
    borderAtivo: string,
    color: string
  ): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: sidebarCompacta ? "center" : "flex-start",
    gap: 10,
    padding: sidebarCompacta ? "10px 0" : "10px 14px",
    background: ativo ? bgAtivo : bg,
    border: `1px solid ${ativo ? borderAtivo : border}`,
    borderRadius: 10,
    cursor: "pointer",
    color,
    fontSize: 13,
    fontWeight: 700,
    textAlign: "left",
    width: "100%",
    transition: "all 0.15s",
    minHeight: 40,
  });

  return (
    <AuthGuard>
      <div
        style={{
          display: "flex",
          height: "100vh",
          fontFamily: "Arial, sans-serif",
          background: "#f8fafc",
          position: "relative",
        }}
      >
        {isMobile && !menuMobileAberto && (
          <button
            onClick={() => setMenuMobileAberto(true)}
            title="Abrir menu"
            style={{
              position: "fixed",
              top: 8,
              left: 8,
              zIndex: 999,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              color: "#1f2937",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
              fontWeight: 700,
            }}
          >
            ☰
          </button>
        )}

        {isMobile && menuMobileAberto && (
          <div
            onClick={() => setMenuMobileAberto(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.5)",
              backdropFilter: "blur(4px)",
              zIndex: 999,
            }}
          />
        )}

        <div
          style={{
            width: isMobile ? 280 : sidebarCompacta ? 76 : 220,
            background: "#ffffff",
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            padding: sidebarCompacta ? 10 : 16,
            gap: 6,
            flexShrink: 0,
            overflowY: "auto",
            overflowX: "hidden",
            position: isMobile ? "fixed" : "relative",
            top: isMobile ? 0 : "auto",
            left: isMobile ? 0 : "auto",
            bottom: isMobile ? 0 : "auto",
            height: isMobile ? "100vh" : "auto",
            zIndex: isMobile ? 1000 : "auto",
            transform: isMobile && !menuMobileAberto ? "translateX(-100%)" : "translateX(0)",
            transition: "width 0.2s ease, transform 0.25s ease",
            boxShadow: isMobile ? "4px 0 16px rgba(0,0,0,0.08)" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCompacta ? "center" : "space-between",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCompacta ? "center" : "flex-start",
                gap: 10,
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(31,41,55,0.2)",
                  padding: 5,
                  flexShrink: 0,
                }}
              >
                <img
                  src="/logo1.png"
                  alt="Wolf"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    filter: "brightness(0) invert(1)",
                  }}
                />
              </div>

              {!sidebarCompacta && (
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      color: "#1f2937",
                      fontWeight: 700,
                      fontSize: 13,
                      display: "block",
                      letterSpacing: -0.2,
                    }}
                  >
                    Wolf CRM
                  </span>
                  <span
                    style={{
                      color: "#16a34a",
                      fontSize: 10,
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                    }}
                  >
                    {workspaceNome || "Carregando..."}
                  </span>
                </div>
              )}
            </div>

            {!isMobile && (
              <button
                onClick={alternarMenuRecolhido}
                title={sidebarCompacta ? "Expandir menu" : "Recolher menu"}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  color: "#475569",
                  fontSize: 18,
                  cursor: "pointer",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {sidebarCompacta ? "›" : "‹"}
              </button>
            )}

            {isMobile && (
              <button
                onClick={() => setMenuMobileAberto(false)}
                title="Fechar menu"
                style={{
                  background: "#f3f4f6",
                  border: "none",
                  color: "#6b7280",
                  fontSize: 16,
                  cursor: "pointer",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {!sidebarCompacta && (
            <button
              onClick={() => navegarPara("/meu-perfil")}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
                e.currentTarget.style.borderColor = "#6366f1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.borderColor = "#e5e7eb";
              }}
              title="Clique pra editar seu perfil"
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "9px 12px",
                marginBottom: 6,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
              }}
            >
              {(() => {
                const iniciais = (userNome || userEmail || "?")
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                let h = 0;
                for (let i = 0; i < userEmail.length; i++) {
                  h = userEmail.charCodeAt(i) + ((h << 5) - h);
                }

                const cores = [
                  "#3b82f6",
                  "#8b5cf6",
                  "#ec4899",
                  "#f59e0b",
                  "#10b981",
                  "#ef4444",
                  "#0ea5e9",
                  "#a855f7",
                ];
                const cor = cores[Math.abs(h) % cores.length];

                return (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: userFotoUrl
                        ? `url(${userFotoUrl}) center/cover`
                        : `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 800,
                      flexShrink: 0,
                      boxShadow: `0 2px 6px ${cor}40`,
                    }}
                  >
                    {!userFotoUrl && iniciais}
                  </div>
                );
              })()}

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    color: "#9ca3af",
                    fontSize: 9,
                    margin: "0 0 1px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  }}
                >
                  Logado como
                </p>
                <p
                  style={{
                    color: "#1f2937",
                    fontSize: 12,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 700,
                  }}
                >
                  {userNome || userEmail.split("@")[0]}
                </p>
                <p style={{ color: "#6b7280", fontSize: 10, margin: "1px 0 0", fontWeight: 500 }}>
                  {perfilLabel}
                </p>
              </div>

              <span style={{ color: "#9ca3af", fontSize: 12, flexShrink: 0 }}>✏️</span>
            </button>
          )}

          {!sidebarCompacta && ehDonoOuAdmin && !isSuperAdmin && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderLeft: "3px solid #f59e0b",
                borderRadius: 10,
                padding: "9px 12px",
                marginBottom: 6,
              }}
            >
              <p
                style={{
                  color: "#92400e",
                  fontSize: 10,
                  margin: "0 0 2px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                Plano
              </p>
              <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>
                👥 {usuariosCount}/{limiteUsuarios} usuários
              </span>
            </div>
          )}

          {menuItems.map((item) => {
            const ativo = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navegarPara(item.path)}
                title={sidebarCompacta ? item.label : undefined}
                onMouseEnter={(e) => {
                  if (!ativo) e.currentTarget.style.background = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  if (!ativo) e.currentTarget.style.background = "transparent";
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCompacta ? "center" : "flex-start",
                  gap: 10,
                  padding: sidebarCompacta ? "10px 0" : "9px 14px",
                  background: ativo ? "#f0fdf4" : "transparent",
                  border: "none",
                  borderLeft: ativo && !sidebarCompacta ? "3px solid #16a34a" : "3px solid transparent",
                  borderRadius: ativo && !sidebarCompacta ? "0 8px 8px 0" : 8,
                  cursor: "pointer",
                  color: ativo ? "#16a34a" : "#4b5563",
                  fontSize: 13,
                  fontWeight: ativo ? 700 : 500,
                  textAlign: "left",
                  transition: "background 0.1s",
                  marginLeft: ativo && !sidebarCompacta ? -3 : 0,
                  minHeight: 40,
                }}
              >
                <span>{item.icon}</span>
                {renderTexto(item.label)}
                {!sidebarCompacta && (item as any).badge > 0 && (
                  <span
                    style={{
                      background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                      color: "white",
                      borderRadius: 10,
                      padding: "1px 8px",
                      fontSize: 10,
                      marginLeft: "auto",
                      fontWeight: 700,
                      boxShadow: "0 2px 4px rgba(22,163,74,0.25)",
                    }}
                  >
                    {(item as any).badge}
                  </span>
                )}
              </button>
            );
          })}

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              marginTop: 10,
              paddingTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {podeVerCRM && (
              <button
                onClick={() => navegarPara(crmItems[0]?.path || "/crm/dashboard")}
                title={sidebarCompacta ? "CRM" : undefined}
                style={estiloBotaoModulo(crmRotaAtiva, "#f0fdf4", "#dcfce7", "#bbf7d0", "#16a34a", "#16a34a")}
              >
                <span>🎯</span>
                {renderTexto("CRM")}
              </button>
            )}

            {podeVerChatbot && (
              <button
                onClick={() => navegarPara("/chatbot")}
                title={sidebarCompacta ? "Chatbot" : undefined}
                style={estiloBotaoModulo(false, "#eff6ff", "#dbeafe", "#bfdbfe", "#3b82f6", "#3b82f6")}
              >
                <span>💬</span>
                {renderTexto("Chatbot")}
              </button>
            )}

            {modulosCarregados && podeVerTelefonia && (
              <button
                onClick={() => navegarPara("/crm/telefonia")}
                title={sidebarCompacta ? "Telefonia" : undefined}
                style={estiloBotaoModulo(isActive("/crm/telefonia"), "#f0fdfa", "#ccfbf1", "#99f6e4", "#0d9488", "#0d9488")}
              >
                <span>📞</span>
                {renderTexto("Telefonia")}
              </button>
            )}

            {modulosCarregados && podeVerCobranca && (
              <button
                onClick={() => navegarPara("/crm/cobranca")}
                title={sidebarCompacta ? "Cobrança" : undefined}
                style={estiloBotaoModulo(isActive("/crm/cobranca"), "#fef2f2", "#fee2e2", "#fecaca", "#dc2626", "#dc2626")}
              >
                <span>💰</span>
                {renderTexto("Cobrança")}
              </button>
            )}

            {modulosCarregados && podeVerRH && (
              <button
                onClick={() => navegarPara("/crm/rh")}
                title={sidebarCompacta ? "RH" : undefined}
                style={estiloBotaoModulo(isActive("/crm/rh"), "#eef2ff", "#e0e7ff", "#c7d2fe", "#4f46e5", "#4f46e5")}
              >
                <span>🧑‍💼</span>
                {renderTexto("RH")}
              </button>
            )}

            {modulosCarregados && podeBaterPonto && (
              <button
                onClick={() => navegarPara("/crm/ponto")}
                title={sidebarCompacta ? "Bater Ponto" : undefined}
                style={estiloBotaoModulo(isActive("/crm/ponto"), "#fdf2f8", "#fce7f3", "#f9a8d4", "#db2777", "#db2777")}
              >
                <span>🕐</span>
                {renderTexto("Bater Ponto")}
              </button>
            )}

            {modulosCarregados && podeVerFinanceiro && (
              <button
                onClick={() => navegarPara("/crm/financeiro")}
                title={sidebarCompacta ? "Financeiro" : undefined}
                style={estiloBotaoModulo(isActive("/crm/financeiro"), "#fffbeb", "#fef3c7", "#fcd34d", "#d97706", "#d97706")}
              >
                <span>💰</span>
                {renderTexto("Financeiro")}
              </button>
            )}

            {podeVerConfig && (
              <button
                onClick={() => navegarPara("/crm/configuracoes")}
                title={sidebarCompacta ? "Configurações" : undefined}
                style={estiloBotaoModulo(isActive("/crm/configuracoes"), "#f8fafc", "#f1f5f9", "#e2e8f0", "#64748b", "#475569")}
              >
                <span>⚙️</span>
                {renderTexto("Configurações")}
              </button>
            )}
          </div>

          <div style={{ marginTop: "auto", borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
            <button
              onClick={signOut}
              title={sidebarCompacta ? "Sair" : undefined}
              style={estiloBotaoModulo(false, "#fef2f2", "#fee2e2", "#fecaca", "#dc2626", "#dc2626")}
            >
              <span>🚪</span>
              {renderTexto("Sair")}
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "56px 12px 16px" : 32,
            width: isMobile ? "100%" : "auto",
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}