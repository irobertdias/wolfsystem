"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
// 🆕 multi-tenant: hooks do Wolf em vez de useTemPermissao
import { useWorkspace } from "../../hooks/useWorkspace";
import { useModulos, ModuloBloqueado } from "../../hooks/useModulos";
import { formatNum, carregarFaturasStatus } from "../../lib/cobranca_lib";

import Icone from "../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════════
// 💰 COBRANÇA (hub) — Wolf System (multi-tenant)
// Porta de entrada: Dashboard · Negociações · Atualizar planilha
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

const card = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };

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

  if (permitido === null) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#64748B" }}>Carregando...</div>;

  // 🆕 Sem acesso → tela de upsell padronizada do Wolf
  if (!permitido) return <ModuloBloqueado modulo="cobranca" />;

  const PAGINAS = [
    {
      rota: "/crm/cobranca/dashboard", icone: "grafico", titulo: "Dashboard", slug: "dashboard",
      desc: "Quantas faturas estão pagas, pendentes e inadimplentes, com a evolução dos pagamentos mês a mês.",
    },
    {
      rota: "/crm/cobranca/negociacoes", icone: "chat", titulo: "Negociações", slug: "negociacoes",
      desc: "A operação de cobrança: faturas do CRM, status, disparos de WhatsApp, campanhas e atendimentos.",
    },
    {
      rota: "/crm/cobranca/atualizacao", icone: "upload", titulo: "Atualizar planilha", slug: "planilha",
      desc: "Suba a planilha de status de pagamento. O sistema acha o cliente pela ordem de serviço e puxa o custcode sozinho.",
    },
  ].filter(p => (cardsLiberados as any)[p.slug]);

  const total = contagem ? contagem.pagas + contagem.pendentes + contagem.inadimplentes : 0;
  const pctPagas = total > 0 && contagem ? Math.round((contagem.pagas / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 22, maxWidth: 1240, margin: "0 auto", width: "100%", padding: isMobile ? "4px 0 20px" : "8px 4px 28px", boxSizing: "border-box" }}>
      <style>{`.a2-cob-card:hover { transform: translateY(-2px); box-shadow: 0 1px 2px rgba(16,24,40,.05), 0 22px 40px -20px rgba(16,24,40,.32) !important; } .a2-cob-card:hover .a2-cob-seta { transform: translateX(3px); }`}</style>

      <div>
        <h1 style={{ color: "#0F172A", fontSize: isMobile ? 24 : 30, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Cobrança</h1>
        <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
          <b style={{ color: "#065F46" }}>{workspace?.nome || "Wolf System"}</b> · acompanhe faturas, negocie e atualize os pagamentos
        </p>
      </div>

      {contagem && total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr", gap: isMobile ? 10 : 16 }}>
          <div style={{ borderRadius: 20, padding: 20, color: "#fff", background: "linear-gradient(140deg, #10B981 0%, #059669 45%, #065F46 100%)", boxShadow: "0 18px 34px -18px rgba(5,150,105,.75)", display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="check" tamanho={17} /></span>
              Faturas pagas
            </span>
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.02em" }}>{formatNum(contagem.pagas)}</span>
            <span style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,.2)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${pctPagas}%`, background: "#fff", borderRadius: 99 }} /></span>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{pctPagas}% de {formatNum(total)} faturas</span>
          </div>
          {[
            { l: "Pendentes", v: contagem.pendentes, cor: "#C2410C", fundo: "#FFF7ED", icone: "relogio", sub: "aguardando pagamento" },
            { l: "Inadimplentes", v: contagem.inadimplentes, cor: "#B91C1C", fundo: "#FEF2F2", icone: "alerta", sub: "com fatura em atraso" },
          ].map(c => (
            <div key={c.l} style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#64748B" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: c.fundo, color: c.cor, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome={c.icone as any} tamanho={17} /></span>
                {c.l}
              </span>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", letterSpacing: "-.02em" }}>{formatNum(c.v)}</span>
              <span style={{ fontSize: 12.5, color: "#94A3B8", fontWeight: 600 }}>{c.sub}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 12 : 16 }}>
        {PAGINAS.map(p => (
          <button key={p.rota} onClick={() => router.push(p.rota)} className="a2-cob-card"
            style={{ ...card, border: 0, padding: isMobile ? 20 : 24, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 14, transition: "transform .15s, box-shadow .15s" }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome={p.icone as any} tamanho={22} /></span>
            <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#0F172A", fontSize: 17, fontWeight: 800 }}>{p.titulo}</span>
              <span style={{ color: "#64748B", fontSize: 13.5, lineHeight: 1.55 }}>{p.desc}</span>
            </span>
            <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, color: "#059669", fontSize: 13.5, fontWeight: 800 }}>
              Abrir <span className="a2-cob-seta" style={{ display: "inline-flex", transition: "transform .15s" }}><Icone nome="seta" tamanho={15} espessura={2.3} /></span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
