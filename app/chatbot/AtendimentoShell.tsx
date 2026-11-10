"use client";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useWorkspace } from "../hooks/useWorkspace";
import { usePermissao } from "../hooks/usePermissao";
import { useModulos } from "../hooks/useModulos";
import { ChatSection } from "./_sections/ChatSection";
import { DashboardSection } from "./_sections/DashboardSection";
import { ConexoesSection } from "./_sections/ConexoesSection";
import { EtiquetasSection } from "./_sections/EtiquetasSection";
import { RelatoriosSection } from "./_sections/RelatoriosSection";
import { RespostasRapidasSection } from "./_sections/RespostasRapidasSection";
import { RoletaSection } from "./_sections/RoletaSection";
import Icone from "../components/a2/Icone";

export default function AtendimentoShell({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paginaVendas = usePathname().startsWith("/chatbot/vendas");
  const aba = searchParams.get("aba") || (paginaVendas ? "vendas_enviadas" : "chat");
  const { workspace } = useWorkspace();
  const { permissoes, isDono } = usePermissao();
  const { modulos } = useModulos();
  // No desktop os menus são listas suspensas: começam fechadas.
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fecha a lista suspensa ao clicar fora dela.
  useEffect(() => {
    if (!menuAberto || isMobile) return;
    const fora = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(".wolf-chat-modules")) setMenuAberto(null);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menuAberto, isMobile]);

  const navegarPara = (path: string) => {
    router.push(path);
    if (isMobile) setMenuMobileAberto(false);
    else setMenuAberto(null);
  };

  const podeVerAutomacao = isDono || permissoes.administrador;
  const podeVerMarketing = isDono || permissoes.disparo_enviar || permissoes.templates_waba;
  const podeVerCadastro = isDono || permissoes.etiquetas;
  const podeVerRoleta = isDono || permissoes.roleta_gerenciar;

  const menus = [
    ...((modulos.vendedor_ia && (isDono || permissoes.vendas_proprio || permissoes.vendas_equipe || permissoes.configuracoes_workspace || permissoes.administrador)) ? [{
      key: 'vendas', icon: 'dinheiro', label: 'Vendas', cor: '#059669',
      subitens: [{ key: 'vendas_enviadas', label: 'Vendas enviadas', path: '/chatbot/vendas' }, ...((isDono || permissoes.configuracoes_workspace || permissoes.administrador) ? [{ key: 'configuracoes', label: 'Configurações', path: '/chatbot/vendas?aba=configuracoes' }] : [])]
    }] : []),
    ...((permissoes.chat_proprio || permissoes.chat_todos || permissoes.dashboard) ? [{
      key: "atendimentos", icon: "chat", label: "Atendimentos", cor: "#059669",
      subitens: [
        ...((permissoes.chat_proprio || permissoes.chat_todos) ? [{ key: "chat", label: "Conversas" }] : []),
        ...(permissoes.dashboard ? [{ key: "dashboard_atendimentos", label: "Dashboard" }] : []),
      ]
    }] : []),
    ...(permissoes.conexoes ? [{
      key: "conexoes_menu", icon: "whatsapp", label: "Conexões", cor: "#059669",
      subitens: [{ key: "conexoes", label: "Conexões" }]
    }] : []),
    ...(podeVerAutomacao ? [{
      key: "automacao", icon: "robo", label: "Automação", cor: "#059669",
      subitens: [{ key: "fluxos", label: "Chatbot / Fluxos" }]
    }] : []),
    ...(podeVerMarketing ? [{
      key: "marketing", icon: "megafone", label: "Marketing", cor: "#059669",
      subitens: [
        ...((isDono || permissoes.templates_waba) ? [{ key: "templates", label: "Templates", path: "/chatbot/templates" }] : []),
        ...((isDono || permissoes.disparo_enviar) ? [{ key: "disparos", label: "Disparos em Massa", path: "/chatbot/disparos" }] : []),
        ...(((isDono || permissoes.disparo_enviar) && modulos.validacao_numeros) ? [{ key: "validacao_numeros", label: "Valida\u00e7\u00e3o de n\u00fameros", path: "/chatbot/validacao-numeros" }] : []),
      ]
    }] : []),
    ...(podeVerCadastro ? [{
      key: "cadastro", icon: "tag", label: "Cadastro", cor: "#059669",
      subitens: [{ key: "etiquetas", label: "Etiquetas" }]
    }] : []),
    ...((permissoes.relatorios || permissoes.respostas_rapidas || podeVerRoleta) ? [{
      key: "configuracoes", icon: "config", label: "Configurações", cor: "#059669",
      subitens: [
        ...(permissoes.relatorios ? [{ key: "relatorios", label: "Relatórios" }] : []),
        ...(permissoes.respostas_rapidas ? [{ key: "respostas_rapidas", label: "Respostas Rápidas" }] : []),
        ...(podeVerRoleta ? [{ key: "roleta", label: "Roleta de Distribuição" }] : []),
      ]
    }] : []),
  ];

  return (
    <div className="wolf-chat-shell" style={{ display: "flex", height: "100vh", fontFamily: "var(--font-wolf), system-ui, sans-serif", background: "#F3F6F5", position: "relative" }}>

      {/* 🆕 BOTÃO HAMBÚRGUER ☰ — só aparece no mobile */}
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
            border: "1px solid #E6ECEA",
            color: "#0F172A",
            borderRadius: 10,
            padding: "6px 12px",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
          }}
        ><Icone nome="menu" tamanho={18} /></button>
      )}

      {isMobile && menuMobileAberto && (
        <div
          onClick={() => setMenuMobileAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
            zIndex: 999,
          }}
        />
      )}

      {/* SIDEBAR */}
      <div className={`wolf-chat-navigation ${menuMobileAberto ? "open" : ""}`} style={{
        width: isMobile ? 280 : 240,
        background: "#ffffff",
        borderRight: "1px solid #E6ECEA",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        position: isMobile ? "fixed" : "relative",
        top: isMobile ? 0 : "auto",
        left: isMobile ? 0 : "auto",
        bottom: isMobile ? 0 : "auto",
        height: isMobile ? "100vh" : "auto",
        zIndex: isMobile ? 1000 : "auto",
        transform: isMobile && !menuMobileAberto ? "translateX(-100%)" : "translateX(0)",
        transition: "transform 0.25s ease",
        boxShadow: isMobile ? "4px 0 16px rgba(0,0,0,0.1)" : "2px 0 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{ padding: 16, borderBottom: "1px solid #E6ECEA", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <img src="/logo1.png" alt="Wolf" style={{ width: 32, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <span style={{ color: "#0F172A", fontWeight: "700", fontSize: 14, display: "block" }}>Wolf Chatbot</span>
              <span style={{ color: "#059669", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 2px #22c55e22" }}/>
                {workspace?.nome || "Carregando..."}
              </span>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setMenuMobileAberto(false)}
              title="Fechar menu"
              style={{
                background: "#F1F5F4",
                border: "none",
                color: "#64748B",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                lineHeight: 1,
                flexShrink: 0,
              }}
            ><Icone nome="x" tamanho={16} /></button>
          )}
        </div>
        <div className="wolf-chat-modules" style={{ padding: 10, flex: 1 }}>
          {menus.map(menu => {
            const ativo = menuAberto === menu.key;
            // Seção atual (destaque verde), independente da lista estar aberta.
            const atual = menu.subitens.some(s => s.key === aba);
            return (
              <div key={menu.key} style={{ marginBottom: 4 }}>
                <button onClick={() => setMenuAberto(ativo ? null : menu.key)} className={`${atual ? "ativo" : ""} ${ativo ? "aberto" : ""}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "10px 12px",
                    background: ativo ? `${menu.cor}10` : "transparent",
                    border: "none", borderRadius: 10, cursor: "pointer",
                    color: ativo ? menu.cor : "#334155",
                    fontSize: 13, fontWeight: ativo ? "700" : "600",
                    textAlign: "left",
                    transition: "background .15s ease",
                  }}
                  onMouseEnter={e=>{ if (!ativo) e.currentTarget.style.background = "#F1F5F4"; }}
                  onMouseLeave={e=>{ if (!ativo) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 28, height: 28,
                      background: ativo ? menu.cor : `${menu.cor}15`,
                      borderRadius: 8,
                      fontSize: 14,
                      transition: "background .15s ease",
                      boxShadow: ativo ? `0 2px 6px ${menu.cor}40` : "none",
                    }}><Icone nome={menu.icon} tamanho={16} cor={ativo ? "#fff" : menu.cor} /></span>
                    {menu.label}
                  </span>
                  <span style={{ display: "inline-flex", color: ativo ? menu.cor : "#94A3B8", transition: "transform .2s", transform: ativo ? "rotate(180deg)" : "rotate(0deg)" }}><Icone nome="baixo" tamanho={14} espessura={2.2} /></span>
                </button>
                {ativo && (
                  <div style={{ paddingLeft: 10, marginTop: 2, marginBottom: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    {menu.subitens.map(sub => {
                      const selecionado = aba === sub.key;
                      return (
                        <button key={sub.key} onClick={() => navegarPara((sub as any).path || `/chatbot?aba=${sub.key}`)}
                          style={{
                            display: "block", width: "100%", padding: "8px 12px 8px 36px",
                            background: selecionado ? `${menu.cor}18` : "transparent",
                            border: "none", borderRadius: 8, cursor: "pointer",
                            color: selecionado ? menu.cor : "#64748B",
                            fontSize: 12, textAlign: "left",
                            fontWeight: selecionado ? "700" : "500",
                            position: "relative",
                            transition: "background .12s ease, color .12s ease",
                          }}
                          onMouseEnter={e=>{ if (!selecionado) { e.currentTarget.style.background = "#F1F5F4"; e.currentTarget.style.color = "#0F172A"; }}}
                          onMouseLeave={e=>{ if (!selecionado) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748B"; }}}>
                          {selecionado && <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", width: 4, height: 4, borderRadius: "50%", background: menu.cor }}/>}
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="wolf-chat-return" style={{ padding: 12, borderTop: "1px solid #E6ECEA", background: "#F7FAF9" }}>
          <button onClick={() => navegarPara("/crm")} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "10px 12px",
            background: "#ffffff",
            border: "1px solid #E6ECEA",
            borderRadius: 10, cursor: "pointer",
            color: "#334155", fontSize: 12, fontWeight: "600",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            transition: "box-shadow .12s, transform .12s, border-color .12s",
          }}
          onMouseEnter={e=>{
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
            e.currentTarget.style.borderColor = "#CBD5E1";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
            e.currentTarget.style.borderColor = "#E6ECEA";
            e.currentTarget.style.transform = "translateY(0)";
          }}><Icone nome="voltar" tamanho={15} /> Voltar ao CRM</button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="wolf-chat-workspace" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", width: isMobile ? "100%" : "auto", minWidth: 0 }}>
        {children}
        {!children && aba === "chat" && <ChatSection />}
        {aba === "dashboard_atendimentos" && permissoes.dashboard && <DashboardSection />}
        {aba === "conexoes" && !permissoes.conexoes && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
            <span style={{ width: 64, height: 64, borderRadius: 20, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="cadeado" tamanho={28} cor="#059669" /></span>
            <h2 style={{ color: "#0F172A", fontSize: 18, fontWeight: "bold", margin: 0 }}>Sem permissão</h2>
            <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>Você não tem acesso a esta área</p>
          </div>
        )}
        {aba === "conexoes" && permissoes.conexoes && <ConexoesSection />}
        {aba === "fluxos" && podeVerAutomacao && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, alignItems: "center", justifyContent: "center", flex: 1 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 24,
              background: "linear-gradient(140deg, #059669 0%, #065F46 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 18px 36px -14px rgba(5,150,105,.65)"
            }}><Icone nome="robo" tamanho={44} cor="#fff" espessura={1.7} /></div>
            <h1 style={{ color: "#0F172A", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", margin: 0 }}>Chatbot / Fluxos</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>Crie fluxos de atendimento automático</p>
            <button onClick={() => router.push("/chatbot/fluxos")} style={{
              background: "linear-gradient(140deg, #10B981 0%, #059669 100%)",
              color: "white", border: "none", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
              padding: "14px 32px", fontSize: 15, cursor: "pointer", fontWeight: "700",
              boxShadow: "0 8px 18px -8px rgba(5,150,105,.7)",
              transition: "transform .12s, box-shadow .12s",
            }}
            onMouseEnter={e=>{
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 12px 22px -8px rgba(5,150,105,.75)";
            }}
            onMouseLeave={e=>{
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 18px -8px rgba(5,150,105,.7)";
            }}>Abrir editor de fluxos <Icone nome="seta" tamanho={16} /></button>
          </div>
        )}
        {aba === "etiquetas" && podeVerCadastro && <EtiquetasSection />}
        {aba === "relatorios" && permissoes.relatorios && <RelatoriosSection />}
        {aba === "respostas_rapidas" && permissoes.respostas_rapidas && <RespostasRapidasSection />}
        {aba === "roleta" && podeVerRoleta && <RoletaSection />}
      </div>
    </div>
  );
}
