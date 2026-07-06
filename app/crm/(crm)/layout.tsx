"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePermissao } from "../../hooks/usePermissao";

const COR = "#16a34a";
const COR_TEXTO = "#15803d";
const COR_BG = "#f0fdf4";

type Item = {
  path: string;
  icon: string;
  label: string;
};

export default function CRMModuloLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();

  const [isMobile, setIsMobile] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [submenuRecolhido, setSubmenuRecolhido] = useState(false);

  const submenuCompacto = !isMobile && submenuRecolhido;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();

    const salvo = localStorage.getItem("wolf_crm_submenu_recolhido");
    if (salvo === "true") setSubmenuRecolhido(true);

    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const alternarSubmenu = () => {
    setSubmenuRecolhido((atual) => {
      const novo = !atual;
      localStorage.setItem("wolf_crm_submenu_recolhido", String(novo));
      return novo;
    });
  };

  const itens: Item[] = [
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

  const ativo = (path: string) => pathname === path;

  const ir = (path: string) => {
    router.push(path);
    if (isMobile) setMenuAberto(false);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
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
            boxShadow: "0 4px 12px rgba(22,163,74,0.18)",
          }}
        >
          ☰ Seções
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

      <div
        style={{
          width: isMobile ? 260 : submenuCompacto ? 72 : 224,
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          flexShrink: 0,
          position: isMobile ? "fixed" : "relative",
          top: isMobile ? 0 : "auto",
          left: isMobile ? 0 : "auto",
          bottom: isMobile ? 0 : "auto",
          height: isMobile ? "100vh" : "auto",
          zIndex: isMobile ? 1100 : "auto",
          transform: isMobile && !menuAberto ? "translateX(-100%)" : "translateX(0)",
          transition: "width 0.2s ease, transform 0.25s ease",
          boxShadow: isMobile ? "4px 0 16px rgba(0,0,0,0.1)" : "none",
        }}
      >
        <div
          style={{
            padding: submenuCompacto ? "16px 10px" : 16,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: submenuCompacto ? "center" : "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: submenuCompacto ? "center" : "flex-start",
              gap: 10,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COR} 0%, #22c55e 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                boxShadow: `0 4px 10px ${COR}40`,
                flexShrink: 0,
              }}
            >
              <span style={{ filter: "saturate(0) brightness(2)" }}>🎯</span>
            </div>

            {!submenuCompacto && (
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    color: "#1f2937",
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
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  Comercial &amp; Vendas
                </span>
              </div>
            )}
          </div>

          {!isMobile && (
            <button
              onClick={alternarSubmenu}
              title={submenuCompacto ? "Expandir submenu" : "Recolher submenu"}
              style={{
                background: COR_BG,
                border: `1px solid ${COR}`,
                color: COR_TEXTO,
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
              {submenuCompacto ? "›" : "‹"}
            </button>
          )}
        </div>

        <div
          style={{
            padding: submenuCompacto ? "10px 8px" : 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {itens.map((item) => {
            const selecionado = ativo(item.path);

            return (
              <button
                key={item.path}
                onClick={() => ir(item.path)}
                title={submenuCompacto ? item.label : undefined}
                onMouseEnter={(e) => {
                  if (!selecionado) e.currentTarget.style.background = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  if (!selecionado) e.currentTarget.style.background = "transparent";
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: submenuCompacto ? "center" : "flex-start",
                  gap: 10,
                  width: "100%",
                  minHeight: 46,
                  padding: submenuCompacto ? "10px 0" : "10px 12px",
                  background: selecionado ? COR_BG : "transparent",
                  border: "none",
                  borderLeft: selecionado && !submenuCompacto ? `3px solid ${COR}` : "3px solid transparent",
                  borderRadius: selecionado && !submenuCompacto ? "0 8px 8px 0" : 8,
                  cursor: "pointer",
                  color: selecionado ? COR_TEXTO : "#374151",
                  fontSize: 13,
                  fontWeight: selecionado ? 700 : 500,
                  textAlign: "left",
                  transition: "background .12s",
                  marginLeft: selecionado && !submenuCompacto ? -3 : 0,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: selecionado ? COR : COR_BG,
                    fontSize: 13,
                    filter: selecionado ? "saturate(0) brightness(2)" : "none",
                    boxShadow: selecionado ? `0 2px 6px ${COR}40` : "none",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>

                {!submenuCompacto && item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          minWidth: 0,
          padding: isMobile ? "56px 12px 16px" : 28,
        }}
      >
        {children}
      </div>
    </div>
  );
}