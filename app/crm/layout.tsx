"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { usePermissao } from "../hooks/usePermissao";
import { useModulos } from "../hooks/useModulos";
import AuthGuard from "../components/AuthGuard";
import PontoGuard from "../components/PontoGuard";

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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();

    if (localStorage.getItem("wolf_crm_sidebar_recolhida") === "true") {
      setMenuRecolhido(true);
    }

    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const alternarMenuRecolhido = () => {
    setMenuRecolhido((atual) => {
      const novo = !atual;
      localStorage.setItem("wolf_crm_sidebar_recolhida", String(novo));
      window.dispatchEvent(new Event("wolf-crm-sidebar-toggle"));
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

  const podeVerComHierarquia = (moduloAtivo: boolean, permissaoKey: keyof typeof permissoes): boolean => {
    if (isSuperAdmin) return true;
    if (!moduloAtivo) return false;
    if (isDono) return true;
    if (perfil === "Administrador") return true;
    return !!permissoes[permissaoKey];
  };

  const ehDonoOuAdmin = isDono || perfil === "Administrador";
  const isActive = (path: string) => pathname === path;

  const menuItems = [
    ...(isSuperAdmin ? [{ path: "/crm/clientes", icon: "👥", label: "Clientes Wolf", badge: cadastrosCount }] : []),
    { path: "/crm/visao", icon: "📊", label: "Visão Geral", badge: 0 },
  ];

  const crmItems = [
    ...((isSuperAdmin || isDono || permissoes.dashboard) ? [{ path: "/crm/dashboard", icon: "📈", label: "Dashboard de Vendas" }] : []),
    ...((isSuperAdmin || isDono || permissoes.funil || permissoes.vendas_proprio || permissoes.vendas_equipe) ? [{ path: "/crm/funil", icon: "🎯", label: "Funil de Vendas" }] : []),
    ...((isSuperAdmin || isDono || permissoes.vendas_proprio || permissoes.vendas_equipe) ? [{ path: "/crm/vendas", icon: "💰", label: "Vendas" }] : []),
    ...(!isSuperAdmin && (isDono || permissoes.contatos_ver || permissoes.chat_proprio || permissoes.chat_todos) ? [{ path: "/crm/contatos", icon: "👥", label: "Contatos" }] : []),
  ];

  const podeVerCRM = isSuperAdmin || isDono || (permissoes as any).crm_acessar;
  const podeVerContratos = isSuperAdmin || (modulos.contratos_assinaturas && (isDono || perfil === "Administrador" || (permissoes as any).contratos_acessar));
  const podeVerConfig = isSuperAdmin || isDono || permissoes.configuracoes_workspace;
  const podeVerTelefonia = podeVerComHierarquia(modulos.voip, "telefonia_acessar" as any);
  const podeVerChatbot = isSuperAdmin || isDono || (permissoes as any).chatbot_acessar;
  const podeVerMetaAds = isSuperAdmin || (modulos.meta_ads && (isDono || perfil === "Administrador"));
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

  const botaoMenu = (ativo: boolean, bg: string, bgAtivo: string, border: string, borderAtivo: string, color: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
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
  });

  const launchers = [
    ...(isSuperAdmin ? [{ path: "/crm/clientes", label: "Clientes", icon: "👥", visivel: true }] : []),
    { path: "/crm/visao", label: "Visão", icon: "📊", visivel: true },
    { path: crmItems[0]?.path || "/crm/dashboard", label: "CRM", icon: "🎯", visivel: podeVerCRM },
    { path: "/chatbot", label: "Atendimento", icon: "💬", visivel: podeVerChatbot },
    { path: "/crm/contratos", label: "Contratos", icon: "📄", visivel: podeVerContratos },
    { path: "/crm/meta-ads", label: "Central Ads", icon: "📣", visivel: podeVerMetaAds },
    { path: "/crm/telefonia", label: "Telefonia", icon: "📞", visivel: modulosCarregados && podeVerTelefonia },
    { path: "/crm/cobranca", label: "Cobrança", icon: "💳", visivel: modulosCarregados && podeVerCobranca },
    { path: "/crm/rh", label: "Pessoas", icon: "👥", visivel: modulosCarregados && podeVerRH },
    { path: "/crm/ponto", label: "Ponto", icon: "🕐", visivel: modulosCarregados && podeBaterPonto },
    { path: "/crm/financeiro", label: "Financeiro", icon: "💰", visivel: modulosCarregados && podeVerFinanceiro },
    { path: "/crm/configuracoes", label: "Ajustes", icon: "⚙️", visivel: podeVerConfig },
  ].filter((item) => item.visivel);

  const launcherAtivo = (path: string) => {
    if (path === "/crm/visao" || path === "/chatbot" || path === "/crm/clientes") {
      return pathname === path || (path === "/chatbot" && pathname.startsWith("/chatbot/"));
    }
    if (path === (crmItems[0]?.path || "/crm/dashboard")) {
      return crmItems.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const paginaAtual = launchers.find((item) => launcherAtivo(item.path))?.label
    || pathname.split("/").filter(Boolean).slice(-1)[0]?.replaceAll("-", " ")
    || "Visão geral";

  const iniciaisUsuario = (userNome || userEmail || "W")
    .split(" ")
    .map((parte) => parte[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AuthGuard>
      <div className="wolf-premium-shell">
        <header className="wolf-premium-header">
          <button className="wolf-premium-brand" onClick={() => navegarPara("/crm/visao")}>
            <span className="wolf-premium-brand-mark">
              <img src="/logo1.png" alt="Wolf System" />
            </span>
            <span className="wolf-premium-brand-copy">
              <b>WOLF SYSTEM</b>
              <small>{workspaceNome || "GESTÃO COMPLETA"}</small>
            </span>
          </button>

          <nav className="wolf-premium-launcher" aria-label="Módulos do sistema">
            {launchers.map((item) => (
              <button
                key={item.path}
                className={launcherAtivo(item.path) ? "active" : ""}
                onClick={() => navegarPara(item.path)}
                title={item.label}
              >
                <i>{item.icon}</i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="wolf-premium-user">
            <button className="wolf-premium-profile" onClick={() => navegarPara("/meu-perfil")} title="Editar perfil">
              <span
                className="avatar"
                style={userFotoUrl ? { backgroundImage: `url(${userFotoUrl})` } : undefined}
              >
                {!userFotoUrl && iniciaisUsuario}
              </span>
              <span className="identity">
                <b>{userNome || userEmail.split("@")[0] || "Usuário"}</b>
                <small>{perfilLabel.replace(/^\S+\s*/, "")}</small>
              </span>
            </button>
            <button className="logout" onClick={signOut} title="Sair">↗</button>
          </div>
        </header>

        <div className="wolf-premium-context">
          <div className="wolf-premium-context-title">
            <span>{workspaceNome || "WOLF SYSTEM"}</span>
            <b>{paginaAtual}</b>
          </div>
          <div className="context-actions">
            {ehDonoOuAdmin && !isSuperAdmin && (
              <span className="plan-info">👥 {usuariosCount}/{limiteUsuarios} usuários</span>
            )}
            <span className="system-status"><i /> Sistema operacional</span>
            <button onClick={() => navegarPara("/crm/visao")}>Visão executiva</button>
          </div>
        </div>

        <main className="wolf-premium-content">
          <PontoGuard ativo={modulosCarregados ? modulos.bater_ponto : undefined}>{children}</PontoGuard>
        </main>
      </div>
    </AuthGuard>
  );
}