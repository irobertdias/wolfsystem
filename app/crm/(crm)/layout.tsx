"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { usePermissao } from "../../hooks/usePermissao";

// ═══════════════════════════════════════════════════════════════════════
// 🎯 CRM — shell do módulo (route group "(crm)", ignorado na URL)
// ───────────────────────────────────────────────────────────────────────
// Roda DENTRO do shell principal (app/crm/layout.tsx). Renderiza a sub-barra
// do CRM (igual à do RH) + a tela atual. As URLs continuam /crm/dashboard,
// /crm/funil, /crm/vendas, /crm/contatos (o "(crm)" não aparece na URL).
// Cor do módulo: VERDE (identidade de Vendas do Wolf).
// ═══════════════════════════════════════════════════════════════════════

const COR = "#16a34a";
const COR_TEXTO = "#15803d";
const COR_BG = "#f0fdf4";

type Item = { path: string; icon: string; label: string };

export default function CRMModuloLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();

  const [isMobile, setIsMobile] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const itens: Item[] = [
    ...((isSuperAdmin || isDono || permissoes.dashboard) ? [{ path: "/crm/dashboard", icon: "📈", label: "Dashboard de Vendas" }] : []),
    ...((isSuperAdmin || isDono || permissoes.funil || permissoes.vendas_proprio || permissoes.vendas_equipe) ? [{ path: "/crm/funil", icon: "🎯", label: "Funil de Vendas" }] : []),
    ...((isSuperAdmin || isDono || permissoes.vendas_proprio || permissoes.vendas_equipe) ? [{ path: "/crm/vendas", icon: "💰", label: "Vendas" }] : []),
    ...(!isSuperAdmin && (isDono || permissoes.contatos_ver || permissoes.chat_proprio || permissoes.chat_todos) ? [{ path: "/crm/contatos", icon: "👥", label: "Contatos" }] : []),
  ];

  const ativo = (p: string) => pathname === p;
  const ir = (p: string) => {
    router.push(p);
    if (isMobile) setMenuAberto(false);
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: "Arial, sans-serif", background: "#f8fafc", position: "relative" }}>
      {/* Botão seções (mobile) — canto direito p/ não bater no menu principal */}
      {isMobile && !menuAberto && (
        <button
          onClick={() => setMenuAberto(true)}
          title="Abrir seções do CRM"
          style={{
            position: "fixed", top: 8, right: 8, zIndex: 65,
            background: COR_BG, border: `1px solid ${COR}`, color: COR_TEXTO,
            borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 12px rgba(22,163,74,0.18)",
          }}
        >
          ☰ Seções
        </button>
      )}
      {isMobile && menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)", zIndex: 1090 }}
        />
      )}

      {/* SUB-SIDEBAR DO MÓDULO */}
      <div
        style={{
          width: isMobile ? 260 : 224,
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0,
          position: isMobile ? "fixed" : "relative",
          top: isMobile ? 0 : "auto", left: isMobile ? 0 : "auto", bottom: isMobile ? 0 : "auto",
          height: isMobile ? "100vh" : "auto",
          zIndex: isMobile ? 1100 : "auto",
          transform: isMobile && !menuAberto ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.25s ease",
          boxShadow: isMobile ? "4px 0 16px rgba(0,0,0,0.1)" : "none",
        }}
      >
        {/* Header do módulo */}
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${COR} 0%, #22c55e 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, boxShadow: `0 4px 10px ${COR}40`, flexShrink: 0,
            }}
          >
            <span style={{ filter: "saturate(0) brightness(2)" }}>🎯</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ color: "#1f2937", fontWeight: 800, fontSize: 14, display: "block", letterSpacing: -0.3 }}>CRM</span>
            <span style={{ color: COR_TEXTO, fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Comercial &amp; Vendas</span>
          </div>
        </div>

        {/* Itens */}
        <div style={{ padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {itens.map((it) => {
            const sel = ativo(it.path);
            return (
              <button
                key={it.path}
                onClick={() => ir(it.path)}
                onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 12px",
                  background: sel ? COR_BG : "transparent",
                  border: "none",
                  borderLeft: sel ? `3px solid ${COR}` : "3px solid transparent",
                  borderRadius: sel ? "0 8px 8px 0" : 8,
                  cursor: "pointer",
                  color: sel ? COR_TEXTO : "#374151",
                  fontSize: 13, fontWeight: sel ? 700 : 500, textAlign: "left",
                  transition: "background .12s",
                }}
              >
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, borderRadius: 7,
                    background: sel ? COR : COR_BG,
                    fontSize: 13,
                    filter: sel ? "saturate(0) brightness(2)" : "none",
                    boxShadow: sel ? `0 2px 6px ${COR}40` : "none",
                  }}
                >
                  {it.icon}
                </span>
                {it.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTEÚDO (a tela atual do CRM) */}
      <div style={{ flex: 1, overflowY: "auto", minWidth: 0, padding: isMobile ? "56px 12px 16px" : 28 }}>
        {children}
      </div>
    </div>
  );
}