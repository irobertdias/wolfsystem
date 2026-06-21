"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
// 🆕 multi-tenant: hooks do Wolf em vez de useTemPermissao
import { useWorkspace } from "../../hooks/useWorkspace";
import { useModulos, ModuloBloqueado } from "../../hooks/useModulos";
import { formatNum, carregarFaturasStatus } from "../../lib/cobranca_lib";

// ═══════════════════════════════════════════════════════════════════════════
// 💰 COBRANÇA (hub) — Wolf System (multi-tenant)
// Porta de entrada: Dashboard · Negociações · Atualizar planilha
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

const card = { background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };

export default function CobrancaHub() {
  const router = useRouter();
  // 🆕 multi-tenant: gates do Wolf
  const { wsId, user, workspace, wsPronto } = useWorkspace();
  const { modulos, carregado: modulosCarregados } = useModulos();

  const isSuperAdmin = user?.email === ADMIN_EMAIL;
  const temAcesso = isSuperAdmin || !!modulos.cobranca;
  const permitido = (!wsPronto || !modulosCarregados) ? null : temAcesso;

  // 🆕 No Wolf, quem tem o módulo cobranca vê todos os 3 cards.
  //    (Permissões granulares por sub-página viriam aqui depois — quando o Wolf
  //     tiver sistema de escopos, troca por cardsLiberados.dashboard etc)
  const cardsLiberados = {
    dashboard: temAcesso,
    negociacoes: temAcesso,
    planilha: temAcesso,
  };

  const [isMobile, setIsMobile] = useState(false);
  const [contagem, setContagem] = useState<{ pagas: number; pendentes: number; inadimplentes: number } | null>(null);

  useEffect(() => {
    const ck = () => setIsMobile(window.innerWidth < 768);
    ck(); window.addEventListener("resize", ck);
    return () => window.removeEventListener("resize", ck);
  }, []);

  useEffect(() => {
    if (!wsPronto || !modulosCarregados) return;
    if (!temAcesso) return;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }   // 🆕 login do Wolf é "/"

      // 🆕 multi-tenant: passa wsId pra biblioteca filtrar por workspace
      const rf = await carregarFaturasStatus(wsId);
      let pg = 0, pe = 0, ina = 0;
      for (const f of rf.statusMap.values()) {
        if (f.status === "paga" || f.status === "paga_atraso") pg++;
        else if (f.status === "pendente") pe++;
        else if (f.status === "atrasada") ina++;
      }
      setContagem({ pagas: pg, pendentes: pe, inadimplentes: ina });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsPronto, modulosCarregados, temAcesso, wsId]);

  if (permitido === null) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#6b7280" }}>Carregando...</div>;

  // 🆕 Sem acesso → tela de upsell padronizada do Wolf
  if (!permitido) return <ModuloBloqueado modulo="cobranca" />;

  const PAGINAS = [
    {
      rota: "/crm/cobranca/dashboard", icone: "📊", titulo: "Dashboard", slug: "dashboard",
      desc: "Quantas faturas estão pagas, pendentes e inadimplentes, com a evolução dos pagamentos mês a mês.",
      cor: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
    },
    {
      rota: "/crm/cobranca/negociacoes", icone: "🤝", titulo: "Negociações", slug: "negociacoes",
      desc: "A operação de cobrança: faturas do CRM, status, disparos de WhatsApp, campanhas e atendimentos.",
      cor: "#dc2626", bg: "#fef2f2", bd: "#fecaca",   // 🆕 mudei roxo→vermelho (cor do tema cobrança no Wolf)
    },
    {
      rota: "/crm/cobranca/atualizacao", icone: "📤", titulo: "Atualizar planilha", slug: "planilha",
      desc: "Suba a planilha de status de pagamento — acha o cliente pela ordem de serviço e puxa o custcode sozinho.",
      cor: "#16a34a", bg: "#f0fdf4", bd: "#bbf7d0",
    },
  ].filter(p => (cardsLiberados as any)[p.slug]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 22 }}>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* 🆕 mudei gradient azul/roxo → vermelho (consistência com módulo Cobrança do Wolf) */}
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 4px 12px rgba(220,38,38,0.3)" }}>💰</div>
        <div>
          <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>Cobrança</h1>
          {/* 🆕 multi-tenant: mostra o nome do workspace logado (em vez do "Grupo Unita" fixo) */}
          <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>
            <b style={{ color: "#dc2626" }}>{workspace?.nome || "Wolf System"}</b> · Gestão completa da sua cobrança
          </p>
        </div>
      </div>

      {/* contagem rápida */}
      {contagem && (contagem.pagas + contagem.pendentes + contagem.inadimplentes) > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: isMobile ? 10 : 14 }}>
          {([
            { l: "✅ Pagas", v: contagem.pagas, cor: "#16a34a" },
            { l: "⏳ Pendentes", v: contagem.pendentes, cor: "#d97706" },
            { l: "🔴 Inadimplentes", v: contagem.inadimplentes, cor: "#dc2626" },
          ]).map(c => (
            <div key={c.l} style={{ ...card, padding: isMobile ? 12 : 16, textAlign: "center" }}>
              <p style={{ color: c.cor, fontSize: isMobile ? 20 : 26, fontWeight: 800, margin: 0 }}>{formatNum(c.v)}</p>
              <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0", fontWeight: 600 }}>{c.l}</p>
            </div>
          ))}
        </div>
      )}

      {/* cards de navegação */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 12 : 16 }}>
        {PAGINAS.map(p => (
          <button key={p.rota} onClick={() => router.push(p.rota)}
            style={{ ...card, padding: isMobile ? 18 : 24, cursor: "pointer", textAlign: "left", borderTop: `4px solid ${p.cor}`, display: "flex", flexDirection: "column", gap: 12, transition: "transform 0.12s, box-shadow 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: p.bg, border: `1px solid ${p.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{p.icone}</div>
            <div>
              <h2 style={{ color: "#1f2937", fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>{p.titulo} <span style={{ color: p.cor }}>→</span></h2>
              <p style={{ color: "#6b7280", fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}