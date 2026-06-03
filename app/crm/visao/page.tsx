"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

// ═══════════════════════════════════════════════════════════════════════
// 📊 Visão Geral — dashboard global do Wolf (landing do login)
// ───────────────────────────────────────────────────────────────────────
// Agrega o sistema inteiro numa tela só, sempre isolado por workspace_id:
//   • Vendas    (proposta)         — receita do mês, vendas, instaladas, pendentes, conversão
//   • Cobrança  (proposta)         — em dia, vencendo, atrasado, bloqueado
//   • RH        (funcionarios,     — ativos, custo da folha do mês, batidas de ponto hoje
//                folha_itens, ponto_registros)
//   • Equipe    (usuarios_workspace) — usuários, vendedores ativos
// ═══════════════════════════════════════════════════════════════════════

const card = {
  background: "#ffffff",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
};

const real = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Proposta = {
  status_venda: string | null;
  valor_plano: number | null;
  vendedor: string | null;
  created_at: string | null;
  proximo_vencimento: string | null;
  status_pagamento: string | null;
};
type FuncRow = { status: string | null; salario: number | null };
type FolhaRow = { competencia: string | null; base: number | null; comissao: number | null };

const compAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function diasAteVenc(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + "T00:00:00");
  if (isNaN(alvo.getTime())) return null;
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export default function VisaoGeralPage() {
  const { wsId, workspace } = useWorkspace();

  const [carregando, setCarregando] = useState(true);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [funcs, setFuncs] = useState<FuncRow[]>([]);
  const [folha, setFolha] = useState<FolhaRow[]>([]);
  const [pontoHoje, setPontoHoje] = useState(0);
  const [totalUsuarios, setTotalUsuarios] = useState(0);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      setCarregando(true);
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);

      const [prop, fun, fol, pon, usr] = await Promise.all([
        supabase
          .from("proposta")
          .select("status_venda, valor_plano, vendedor, created_at, proximo_vencimento, status_pagamento")
          .eq("workspace_id", wsId),
        supabase.from("funcionarios").select("status, salario").eq("workspace_id", wsId),
        supabase.from("folha_itens").select("competencia, base, comissao").eq("workspace_id", wsId),
        supabase
          .from("ponto_registros")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .gte("data_hora", inicioDia.toISOString()),
        supabase.from("usuarios_workspace").select("email, equipe_id").eq("workspace_id", wsId),
      ]);

      setPropostas((prop.data || []) as Proposta[]);
      setFuncs((fun.data || []) as FuncRow[]);
      setFolha((fol.data || []) as FolhaRow[]);
      setPontoHoje(pon.count || 0);
      setTotalUsuarios((usr.data || []).length);
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  // ── Vendas ──
  const vendas = useMemo(() => {
    const comp = compAtual();
    const noMes = (iso: string | null) => (iso || "").slice(0, 7) === comp;
    const instaladas = propostas.filter((p) => p.status_venda === "INSTALADA");
    const instaladasMes = instaladas.filter((p) => noMes(p.created_at));
    const receitaMes = instaladasMes.reduce((s, p) => s + (Number(p.valor_plano) || 0), 0);
    const pendentes = propostas.filter((p) => p.status_venda === "PENDENTE").length;
    const total = propostas.length;
    const conversao = total ? Math.round((instaladas.length / total) * 100) : 0;
    return { receitaMes, vendasMes: instaladasMes.length, instaladas: instaladas.length, pendentes, conversao };
  }, [propostas]);

  // ── Cobrança (derivada de proposta com proximo_vencimento) ──
  const cobranca = useMemo(() => {
    let emDia = 0, vencendo = 0, atrasado = 0, bloqueado = 0;
    propostas.forEach((p) => {
      if (p.status_pagamento === "suspenso") return;
      const d = diasAteVenc(p.proximo_vencimento);
      if (d === null) return;
      if (d <= -2) bloqueado++;
      else if (d < 0) atrasado++;
      else if (d <= 2) vencendo++;
      else emDia++;
    });
    return { emDia, vencendo, atrasado, bloqueado };
  }, [propostas]);

  // ── RH ──
  const rh = useMemo(() => {
    const ativos = funcs.filter((f) => f.status !== "desligado").length;
    const comp = compAtual();
    const custoFolha = folha
      .filter((i) => (i.competencia || "") === comp)
      .reduce((s, i) => s + (Number(i.base) || 0) + (Number(i.comissao) || 0), 0);
    return { ativos, custoFolha };
  }, [funcs, folha]);

  // ── Equipe ──
  const vendedoresAtivos = useMemo(() => {
    const set = new Set(propostas.map((p) => (p.vendedor || "").trim()).filter(Boolean));
    return set.size;
  }, [propostas]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: "Arial, sans-serif" }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(22,163,74,0.3)",
          }}
        >
          <span style={{ filter: "saturate(0) brightness(2)" }}>📊</span>
        </div>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>
            Visão Geral
          </h1>
          <p style={{ color: "#64748b", fontSize: 12, margin: "2px 0 0" }}>
            {(workspace as any)?.nome ? `${(workspace as any).nome} · ` : ""}
            Panorama do sistema completo
          </p>
        </div>
      </div>

      {carregando ? (
        <div style={{ ...card, padding: 48, textAlign: "center" }}>
          <p style={{ color: "#64748b", fontSize: 13 }}>Carregando o panorama...</p>
        </div>
      ) : (
        <>
          <Secao titulo="Vendas" icone="💰" cor="#16a34a">
            <Kpi label="Receita do mês" valor={real(vendas.receitaMes)} cor="#16a34a" icone="💵" />
            <Kpi label="Vendas no mês" valor={String(vendas.vendasMes)} cor="#16a34a" icone="✅" />
            <Kpi label="Instaladas (total)" valor={String(vendas.instaladas)} cor="#0ea5e9" icone="📦" />
            <Kpi label="Pendentes" valor={String(vendas.pendentes)} cor="#f59e0b" icone="⏳" />
            <Kpi label="Conversão" valor={vendas.conversao + "%"} cor="#8b5cf6" icone="📈" />
          </Secao>

          <Secao titulo="Cobrança" icone="🧾" cor="#dc2626">
            <Kpi label="Em dia" valor={String(cobranca.emDia)} cor="#16a34a" icone="🟢" />
            <Kpi label="Vencendo" valor={String(cobranca.vencendo)} cor="#f59e0b" icone="🟡" />
            <Kpi label="Atrasado" valor={String(cobranca.atrasado)} cor="#dc2626" icone="🔴" />
            <Kpi label="Bloqueado" valor={String(cobranca.bloqueado)} cor="#7f1d1d" icone="🔒" />
          </Secao>

          <Secao titulo="RH" icone="🧑‍💼" cor="#4f46e5">
            <Kpi label="Funcionários ativos" valor={String(rh.ativos)} cor="#4f46e5" icone="👥" />
            <Kpi label="Custo da folha (mês)" valor={real(rh.custoFolha)} cor="#f59e0b" icone="💰" />
            <Kpi label="Batidas de ponto hoje" valor={String(pontoHoje)} cor="#0891b2" icone="🕐" />
          </Secao>

          <Secao titulo="Equipe" icone="👥" cor="#3b82f6">
            <Kpi label="Usuários no workspace" valor={String(totalUsuarios)} cor="#3b82f6" icone="🧑‍💻" />
            <Kpi label="Vendedores ativos" valor={String(vendedoresAtivos)} cor="#0ea5e9" icone="🏆" />
          </Secao>
        </>
      )}
    </div>
  );
}

function Secao({
  titulo, icone, cor, children,
}: {
  titulo: string; icone: string; cor: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 8, background: `${cor}15`, fontSize: 14,
          }}
        >
          {icone}
        </span>
        <h2 style={{ color: "#0f172a", fontSize: 15, fontWeight: 800, margin: 0 }}>{titulo}</h2>
        <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function Kpi({ label, valor, cor, icone }: { label: string; valor: string; cor: string; icone: string }) {
  return (
    <div style={{ ...card, padding: 16, borderTop: `3px solid ${cor}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: 8, background: `${cor}15`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}
        >
          {icone}
        </div>
        <p style={{ color: "#6b7280", fontSize: 11, margin: 0, fontWeight: 700, textTransform: "uppercase" }}>
          {label}
        </p>
      </div>
      <p style={{ color: cor, fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{valor}</p>
    </div>
  );
}