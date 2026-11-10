"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePermissao } from "../../hooks/usePermissao";
import { useWorkspace } from "../../hooks/useWorkspace";
import { ehRevisional } from "../../lib/vertical-workspace";
import Icone from "../../components/a2/Icone";

const COR = "#059669";
const COR_TEXTO = "#047857";
const COR_BG = "#ECFDF5";

type Item = {
  path: string;
  icon: string;
  label: string;
};

export default function CRMModuloLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const { wsId } = useWorkspace();

  const [isMobile, setIsMobile] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [shellRecolhido, setShellRecolhido] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);

    const syncShell = () => {
      setShellRecolhido(localStorage.getItem("wolf_crm_sidebar_recolhida") === "true");
    };

    check();
    syncShell();

    window.addEventListener("resize", check);
    window.addEventListener("storage", syncShell);
    window.addEventListener("wolf-crm-sidebar-toggle", syncShell);

    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("storage", syncShell);
      window.removeEventListener("wolf-crm-sidebar-toggle", syncShell);
    };
  }, []);

  const revisional = ehRevisional(wsId);

  const itensTodos: Item[] = [
    ...((isSuperAdmin || isDono || permissoes.dashboard)
      ? [{ path: "/crm/dashboard", icon: "grafico", label: "Dashboard de Vendas" }]
      : []),
    ...((isSuperAdmin || isDono || permissoes.funil || permissoes.vendas_proprio || permissoes.vendas_equipe)
      ? [{ path: "/crm/funil", icon: "funil", label: "Funil de Vendas" }]
      : []),
    ...((isSuperAdmin || isDono || permissoes.vendas_proprio || permissoes.vendas_equipe)
      ? [{ path: "/crm/vendas", icon: "dinheiro", label: "Vendas" }]
      : []),
    ...(!isSuperAdmin && (isDono || permissoes.contatos_ver || permissoes.chat_proprio || permissoes.chat_todos)
      ? [{ path: "/crm/contatos", icon: "usuarios", label: "Contatos" }]
      : []),
  ];
  // Workspace revisional: nada de vendas aqui, só a lista de contatos.
  const itens = revisional ? itensTodos.filter((i) => i.path === "/crm/contatos") : itensTodos;

  const ativo = (path: string) => pathname === path;

  const ir = (path: string) => {
    router.push(path);
    if (isMobile) setMenuAberto(false);
  };

  const esconderSubmenuDesktop = !isMobile && shellRecolhido;

  return (
    <div
      className="wolf-commercial-shell"
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        fontFamily: "var(--font-wolf), system-ui, sans-serif",
        background: "#F3F6F5",
        position: "relative",
      }}
    >
      {isMobile && !menuAberto && (
        <button
          onClick={() => setMenuAberto(true)}
          title="Abrir seções do CRM"
          style={{
            position: "fixed",
            top: 8,
            right: 8,
            zIndex: 65,
            background: COR_BG,
            border: `1px solid ${COR}`,
            color: COR_TEXTO,
            borderRadius: 10,
            padding: "7px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
          }}
        >
          <Icone nome="menu" tamanho={15} /> Seções
        </button>
      )}

      {isMobile && menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.4)",
            backdropFilter: "blur(2px)",
            zIndex: 1090,
          }}
        />
      )}

      {!esconderSubmenuDesktop && (
        <div
          className={`wolf-commercial-navigation ${menuAberto ? "open" : ""}`}
          style={{
            width: isMobile ? 260 : 224,
            background: "#ffffff",
            borderRight: "1px solid #E6ECEA",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            flexShrink: 0,
            position: isMobile ? "fixed" : "relative",
            top: isMobile ? 0 : "auto",
            left: isMobile ? 0 : "auto",
            bottom: isMobile ? 0 : "auto",
            height: isMobile ? "100vh" : "auto",
            zIndex: isMobile ? 1100 : "auto",
            transform: isMobile && !menuAberto ? "translateX(-100%)" : "translateX(0)",
            transition: "transform 0.25s ease",
            boxShadow: isMobile ? "4px 0 16px rgba(0,0,0,0.1)" : "none",
          }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid #E6ECEA",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(140deg, #059669 0%, #065F46 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                boxShadow: "0 6px 14px -4px rgba(5,150,105,.55)",
                flexShrink: 0,
              }}
            >
              <Icone nome="alvo" tamanho={19} cor="#fff" />
            </div>

            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  color: "#0F172A",
                  fontWeight: 800,
                  fontSize: 14,
                  display: "block",
                  letterSpacing: -0.3,
                }}
              >
                CRM
              </span>
              <span
                style={{
                  color: COR_TEXTO,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}
              >
                {revisional ? "Contatos dos clientes" : "Comercial & Vendas"}
              </span>
            </div>
          </div>

          <div className="wolf-commercial-tabs" style={{ padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            {itens.map((item) => {
              const selecionado = ativo(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => ir(item.path)}
                  onMouseEnter={(e) => {
                    if (!selecionado) e.currentTarget.style.background = "#F3F6F5";
                  }}
                  onMouseLeave={(e) => {
                    if (!selecionado) e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: isMobile ? "100%" : "auto",
                    whiteSpace: "nowrap",
                    height: 40,
                    padding: "0 14px",
                    background: selecionado ? COR_BG : "transparent",
                    border: "none",
                    borderRadius: 11,
                    cursor: "pointer",
                    color: selecionado ? COR_TEXTO : "#475569",
                    fontFamily: "inherit",
                    fontSize: 13.5,
                    fontWeight: selecionado ? 700 : 600,
                    textAlign: "left",
                    boxShadow: selecionado ? "inset 0 0 0 1px #A7F3D0" : "none",
                    transition: "background .12s",
                  }}
                >
                  <Icone nome={item.icon} tamanho={17} cor={selecionado ? COR : "#94A3B8"} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="wolf-commercial-content"
        style={{
          flex: 1,
          overflowY: "auto",
          minWidth: 0,
          padding: isMobile ? "56px 12px 16px" : esconderSubmenuDesktop ? 0 : 28,
        }}
      >
        {children}
      </div>
    </div>
  );
}