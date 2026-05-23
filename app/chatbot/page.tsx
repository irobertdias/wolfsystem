"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "../hooks/useWorkspace";
import { usePermissao } from "../hooks/usePermissao";
import { ChatSection } from "./_sections/ChatSection";
import { DashboardSection } from "./_sections/DashboardSection";
import { ConexoesSection } from "./_sections/ConexoesSection";
import { EtiquetasSection } from "./_sections/EtiquetasSection";
import { RelatoriosSection } from "./_sections/RelatoriosSection";
import { RespostasRapidasSection } from "./_sections/RespostasRapidasSection";
import { RoletaSection } from "./_sections/RoletaSection";

function ChatbotInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aba = searchParams.get("aba") || "chat";
  const { workspace } = useWorkspace();
  const { permissoes, isDono } = usePermissao();
  const [menuAberto, setMenuAberto] = useState<string | null>("atendimentos");

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // FASE 1.5 MOBILE — sidebar vira drawer/hambúrguer no celular
  // ═══════════════════════════════════════════════════════════════════════
  // - isMobile: detecta tela < 768px
  // - menuMobileAberto: controla se o drawer está aberto no mobile
  // - No desktop o sidebar continua igual (240px fixo). No mobile ele esconde
  //   pra esquerda (translateX -100%) e abre quando user clica no ☰
  const [isMobile, setIsMobile] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🆕 Helper: navega pra uma rota e (no mobile) fecha o drawer automaticamente
  // Substituiu o router.push direto nos onClick dos subitens.
  const navegarPara = (path: string) => {
    router.push(path);
    if (isMobile) setMenuMobileAberto(false);
  };

  // 🆕 Agora usando as permissões granulares ao invés de só "isDono" em tudo.
  // Isso faz com que um Administrador ou um Supervisor com grupo customizado
  // consiga acessar as áreas corretas sem precisar ser o dono do workspace.
  const podeVerAutomacao = isDono || permissoes.administrador;
  const podeVerMarketing = isDono || permissoes.disparo_enviar || permissoes.templates_waba;
  const podeVerCadastro = isDono || permissoes.etiquetas;
  const podeVerRoleta = isDono || permissoes.roleta_gerenciar;

  const menus = [
    ...((permissoes.chat_proprio || permissoes.chat_todos || permissoes.dashboard) ? [{
      key: "atendimentos", icon: "💬", label: "Atendimentos",
      subitens: [
        ...((permissoes.chat_proprio || permissoes.chat_todos) ? [{ key: "chat", label: "Conversas" }] : []),
        ...(permissoes.dashboard ? [{ key: "dashboard_atendimentos", label: "Dashboard" }] : []),
      ]
    }] : []),
    ...(permissoes.conexoes ? [{
      key: "conexoes_menu", icon: "📱", label: "Conexões",
      subitens: [{ key: "conexoes", label: "Conexões" }]
    }] : []),
    ...(podeVerAutomacao ? [{
      key: "automacao", icon: "🤖", label: "Automação",
      subitens: [{ key: "fluxos", label: "Chatbot / Fluxos" }]
    }] : []),
    ...(podeVerMarketing ? [{
      key: "marketing", icon: "📢", label: "Marketing",
      subitens: [
        ...((isDono || permissoes.templates_waba) ? [{ key: "templates", label: "Templates", path: "/chatbot/templates" }] : []),
        ...((isDono || permissoes.disparo_enviar) ? [{ key: "disparos", label: "Disparos em Massa", path: "/chatbot/disparos" }] : []),
      ]
    }] : []),
    ...(podeVerCadastro ? [{
      key: "cadastro", icon: "📋", label: "Cadastro",
      subitens: [{ key: "etiquetas", label: "Etiquetas" }]
    }] : []),
    ...((permissoes.relatorios || permissoes.respostas_rapidas || podeVerRoleta) ? [{
      key: "configuracoes", icon: "⚙️", label: "Configurações",
      subitens: [
        ...(permissoes.relatorios ? [{ key: "relatorios", label: "Relatórios" }] : []),
        ...(permissoes.respostas_rapidas ? [{ key: "respostas_rapidas", label: "Respostas Rápidas" }] : []),
        // 🆕 Roleta de Distribuição — visível pra dono e pra quem tem permissão de gerenciar roleta
        ...(podeVerRoleta ? [{ key: "roleta", label: "🎯 Roleta de Distribuição" }] : []),
      ]
    }] : []),
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a", position: "relative" }}>

      {/* 🆕 BOTÃO HAMBÚRGUER ☰ — só aparece no mobile, fixo no canto superior esquerdo.
          Z-index 999 pra ficar visível sobre o conteúdo do ChatSection.
          Esconde quando o drawer já está aberto (pra dar lugar ao botão ✕ dentro do drawer). */}
      {isMobile && !menuMobileAberto && (
        <button
          onClick={() => setMenuMobileAberto(true)}
          title="Abrir menu"
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            zIndex: 999,
            background: "#1f2937",
            border: "1px solid #374151",
            color: "white",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}
        >☰</button>
      )}

      {/* 🆕 OVERLAY escuro — só aparece no mobile quando drawer está aberto.
          Clique fecha o drawer (UX padrão de drawer em mobile). */}
      {isMobile && menuMobileAberto && (
        <div
          onClick={() => setMenuMobileAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 999,
          }}
        />
      )}

      {/* SIDEBAR — desktop: coluna 240px fixa na esquerda.
          Mobile: drawer que entra/sai com transform/translateX, ocupa tela cheia. */}
      <div style={{
        width: isMobile ? 280 : 240,
        background: "#111",
        borderRight: "1px solid #1f2937",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        // 🆕 No mobile, vira drawer FIXO que abre/fecha por cima do conteúdo
        position: isMobile ? "fixed" : "relative",
        top: isMobile ? 0 : "auto",
        left: isMobile ? 0 : "auto",
        bottom: isMobile ? 0 : "auto",
        height: isMobile ? "100vh" : "auto",
        zIndex: isMobile ? 1000 : "auto",
        transform: isMobile && !menuMobileAberto ? "translateX(-100%)" : "translateX(0)",
        transition: "transform 0.25s ease",
      }}>
        <div style={{ padding: 16, borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <img src="/logo1.png" alt="Wolf" style={{ width: 32, filter: "brightness(0) invert(1)", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <span style={{ color: "white", fontWeight: "bold", fontSize: 14, display: "block" }}>Wolf Chatbot</span>
              <span style={{ color: "#16a34a", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{workspace?.nome || "Carregando..."}</span>
            </div>
          </div>
          {/* 🆕 Botão de FECHAR drawer — só aparece no mobile, no topo do menu */}
          {isMobile && (
            <button
              onClick={() => setMenuMobileAberto(false)}
              title="Fechar menu"
              style={{
                background: "none",
                border: "none",
                color: "#9ca3af",
                fontSize: 22,
                cursor: "pointer",
                padding: 4,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >✕</button>
          )}
        </div>
        <div style={{ padding: 8, flex: 1 }}>
          {menus.map(menu => (
            <div key={menu.key}>
              <button onClick={() => setMenuAberto(menuAberto === menu.key ? null : menu.key)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: menuAberto === menu.key ? "#3b82f6" : "#9ca3af", fontSize: 13, fontWeight: "bold", textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{menu.icon} {menu.label}</span>
                <span style={{ fontSize: 10 }}>{menuAberto === menu.key ? "▼" : "▶"}</span>
              </button>
              {menuAberto === menu.key && (
                <div style={{ paddingLeft: 12, marginBottom: 4 }}>
                  {menu.subitens.map(sub => (
                    <button key={sub.key} onClick={() => navegarPara((sub as any).path || `/chatbot?aba=${sub.key}`)}
                      style={{ display: "block", width: "100%", padding: "8px 12px", background: aba === sub.key ? "#3b82f622" : "none", border: "none", borderRadius: 8, cursor: "pointer", color: aba === sub.key ? "#3b82f6" : "#6b7280", fontSize: 12, textAlign: "left", fontWeight: aba === sub.key ? "bold" : "normal" }}>
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #1f2937" }}>
          <button onClick={() => navegarPara("/crm")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#6b7280", fontSize: 12 }}>← Voltar ao CRM</button>
        </div>
      </div>

      {/* CONTEÚDO — desktop: ocupa o que sobra. Mobile: 100% da tela (sidebar é overlay) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", width: isMobile ? "100%" : "auto", minWidth: 0 }}>
        {aba === "chat" && <ChatSection />}
        {aba === "dashboard_atendimentos" && permissoes.dashboard && <DashboardSection />}
        {aba === "conexoes" && !permissoes.conexoes && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 48 }}>🔒</span>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>Sem permissão</h2>
            <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Você não tem acesso a esta área</p>
          </div>
        )}
        {aba === "conexoes" && permissoes.conexoes && <ConexoesSection />}
        {aba === "fluxos" && podeVerAutomacao && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, alignItems: "center", justifyContent: "center", flex: 1 }}>
            <span style={{ fontSize: 64 }}>🤖</span>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Chatbot / Fluxos</h1>
            <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Crie fluxos de atendimento automático</p>
            <button onClick={() => router.push("/chatbot/fluxos")} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 16, cursor: "pointer", fontWeight: "bold" }}>🤖 Abrir Editor de Fluxos →</button>
          </div>
        )}
        {aba === "etiquetas" && podeVerCadastro && <EtiquetasSection />}
        {aba === "relatorios" && permissoes.relatorios && <RelatoriosSection />}
        {aba === "respostas_rapidas" && permissoes.respostas_rapidas && <RespostasRapidasSection />}
        {/* 🆕 Rota Roleta */}
        {aba === "roleta" && podeVerRoleta && <RoletaSection />}
      </div>
    </div>
  );
}

export default function Chatbot() {
  return (
    <Suspense fallback={<div style={{ background: "#0a0a0a", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#6b7280" }}>Carregando...</p></div>}>
      <ChatbotInner />
    </Suspense>
  );
}