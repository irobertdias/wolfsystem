"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🧑‍💼 RH · Indicadores  (CONECTADO — calcula a partir de 'funcionarios')
// Tempo de casa, turnover, custo médio e headcount: reais (via admissao,
// salario, status). Idade/gênero não existem no banco → trocados por
// admissões/mês e distribuição por status.
// ═══════════════════════════════════════════════════════════════════════

const COR = "#059669";
const card = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)",
};
const real = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_INFO: Record<string, { label: string; cor: string }> = {
  ativo: { label: "Ativos", cor: "#059669" },
  ferias: { label: "Em férias", cor: "#0369A1" },
  afastado: { label: "Afastados", cor: "#C2410C" },
  desligado: { label: "Desligados", cor: "#64748B" },
};

type Func = { departamento: string; salario: number; status: string; admissao: string };

export function IndicadoresSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [carregando, setCarregando] = useState(true);
  const [funcs, setFuncs] = useState<Func[]>([]);

  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const { data, error } = await supabase
      .from("funcionarios")
      .select("departamento, salario, status, admissao")
      .eq("workspace_id", wsId);
    if (error) {
      console.error(error);
      alert("Erro ao carregar indicadores: " + error.message);
    } else {
      setFuncs(
        (data || []).map((r: any) => ({
          departamento: r.departamento || "—",
          salario: Number(r.salario) || 0,
          status: r.status || "ativo",
          admissao: r.admissao || "",
        }))
      );
    }
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const ativos = useMemo(() => funcs.filter((f) => f.status !== "desligado"), [funcs]);
  const headcount = ativos.length;
  const desligados = useMemo(() => funcs.filter((f) => f.status === "desligado").length, [funcs]);
  const turnover = headcount + desligados > 0 ? (desligados / (headcount + desligados)) * 100 : 0;
  const custoMedio = headcount > 0 ? ativos.reduce((s, f) => s + f.salario, 0) / headcount : 0;
  const departamentos = useMemo(() => new Set(ativos.map((f) => f.departamento)).size, [ativos]);

  // tempo médio de casa (anos), a partir de admissao
  const anosCasa = (admissao: string) => {
    if (!admissao) return 0;
    return (Date.now() - new Date(admissao + "T00:00:00").getTime()) / (365.25 * 86400000);
  };
  const tempoMedio = useMemo(() => {
    const comData = ativos.filter((f) => f.admissao);
    if (!comData.length) return 0;
    return comData.reduce((s, f) => s + anosCasa(f.admissao), 0) / comData.length;
  }, [ativos]);

  const admissoesAno = useMemo(() => {
    const ano = new Date().getFullYear();
    return funcs.filter((f) => f.admissao && new Date(f.admissao + "T00:00:00").getFullYear() === ano).length;
  }, [funcs]);

  // distribuição por tempo de casa
  const tempoCasa = useMemo(() => {
    const faixas = [
      { faixa: "< 1 ano", min: 0, max: 1, cor: "#0369A1", qtd: 0 },
      { faixa: "1 a 3 anos", min: 1, max: 3, cor: "#059669", qtd: 0 },
      { faixa: "3 a 5 anos", min: 3, max: 5, cor: "#0F766E", qtd: 0 },
      { faixa: "+ 5 anos", min: 5, max: 999, cor: "#059669", qtd: 0 },
    ];
    ativos.forEach((f) => {
      if (!f.admissao) return;
      const a = anosCasa(f.admissao);
      const faixa = faixas.find((x) => a >= x.min && a < x.max);
      if (faixa) faixa.qtd++;
    });
    return faixas;
  }, [ativos]);
  const totalTempo = tempoCasa.reduce((s, t) => s + t.qtd, 0);

  // distribuição por status (substitui gênero)
  const porStatus = useMemo(() => {
    const m: Record<string, number> = {};
    funcs.forEach((f) => {
      m[f.status] = (m[f.status] || 0) + 1;
    });
    return Object.keys(STATUS_INFO)
      .filter((k) => m[k])
      .map((k) => ({ rotulo: STATUS_INFO[k].label, cor: STATUS_INFO[k].cor, qtd: m[k] }));
  }, [funcs]);
  const totalStatus = porStatus.reduce((s, g) => s + g.qtd, 0);

  // admissões por mês (últimos 6 meses) — substitui evolução de headcount
  const admissoesMes = useMemo(() => {
    const hoje = new Date();
    const out: { mes: string; qtd: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const qtd = funcs.filter((f) => {
        if (!f.admissao) return false;
        const a = new Date(f.admissao + "T00:00:00");
        return a.getMonth() === d.getMonth() && a.getFullYear() === d.getFullYear();
      }).length;
      out.push({ mes: MESES[d.getMonth()], qtd });
    }
    return out;
  }, [funcs]);
  const maxAdm = Math.max(1, ...admissoesMes.map((h) => h.qtd));

  const kpis = [
    { label: "Headcount", valor: String(headcount), cor: "#0F766E", icon: "👥" },
    { label: "Turnover", valor: turnover.toFixed(1) + "%", cor: "#0369A1", icon: "🔄" },
    { label: "Tempo médio de casa", valor: tempoMedio.toFixed(1) + " anos", cor: "#059669", icon: "📆" },
    { label: "Custo médio / func.", valor: real(custoMedio), cor: "#059669", icon: "💰" },
    { label: "Admissões (ano)", valor: String(admissoesAno), cor: "#C2410C", icon: "✅" },
    { label: "Departamentos", valor: String(departamentos), cor: "#BE185D", icon: "🏢" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div>
          <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>
            Indicadores de RH
          </h1>
          <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
            Métricas analíticas do quadro de pessoal
          </p>
        </div>
      </div>

      {carregando ? (
        <div style={{ ...card, padding: 50, textAlign: "center" }}>
          <p style={{ color: "#64748B", fontSize: 13 }}>Calculando indicadores...</p>
        </div>
      ) : headcount === 0 ? (
        <div style={{ ...card, padding: 50, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="grafico" tamanho={24} /></span>
          <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
            Sem dados ainda
          </p>
          <p style={{ color: "#64748B", fontSize: 13, margin: 0 }}>
            Cadastre funcionários para os indicadores serem calculados.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}
          >
            {kpis.map((k) => (
              <div key={k.label} style={{ ...card, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      background: `${k.cor}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                    }}
                  >
                    {<IconeEmoji e={k.icon} />}
                  </div>
                  <p
                    style={{
                      color: "#64748B",
                      fontSize: 13,
                      margin: 0,
                      fontWeight: 700,
                    }}
                  >
                    {k.label}
                  </p>
                </div>
                <p
                  style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}
                >
                  {k.valor}
                </p>
              </div>
            ))}
          </div>

          {/* Admissões por mês */}
          <div style={{ ...card, padding: 22 }}>
            <h3 style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
              Admissões por Mês
            </h3>
            <p style={{ color: "#94A3B8", fontSize: 12, margin: "0 0 18px" }}>Últimos 6 meses</p>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 18,
                height: 180,
              }}
            >
              {admissoesMes.map((h, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    height: "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={{ color: "#0F172A", fontSize: 13, fontWeight: 800 }}>{h.qtd}</span>
                  <div
                    style={{
                      width: "55%",
                      height: `${(h.qtd / maxAdm) * 100}%`,
                      background: `linear-gradient(180deg, ${COR} 0%, #059669 100%)`,
                      borderRadius: "6px 6px 0 0",
                      minHeight: 4,
                    }}
                  />
                  <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 600 }}>{h.mes}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribuições */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={{ ...card, padding: 22 }}>
              <h3 style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "0 0 18px" }}>
                Por tempo de casa
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {tempoCasa.map((t) => {
                  const pct = totalTempo ? Math.round((t.qtd / totalTempo) * 100) : 0;
                  return (
                    <div key={t.faixa}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>{t.faixa}</span>
                        <span style={{ color: "#0F172A", fontSize: 12, fontWeight: 700 }}>
                          {t.qtd} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                        <div
                          style={{ height: "100%", width: `${pct}%`, background: t.cor, borderRadius: 6 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...card, padding: 22 }}>
              <h3 style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "0 0 18px" }}>
                Por situação
              </h3>
              <div
                style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}
              >
                {porStatus.map((g) => (
                  <div
                    key={g.rotulo}
                    title={g.rotulo}
                    style={{ width: `${(g.qtd / totalStatus) * 100}%`, background: g.cor }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {porStatus.map((g) => (
                  <div
                    key={g.rotulo}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#334155",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ width: 12, height: 12, borderRadius: 4, background: g.cor }} />{" "}
                      {g.rotulo}
                    </span>
                    <span style={{ color: "#0F172A", fontSize: 12, fontWeight: 700 }}>
                      {g.qtd} ({Math.round((g.qtd / totalStatus) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}