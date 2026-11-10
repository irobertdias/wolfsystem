"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🧑‍💼 RH · Dashboard  (CONECTADO — agrega funcionarios, vagas, afastamentos,
// ferias, contratos, documentos). Campos sem coluna no banco (aniversariantes,
// idade) foram trocados por equivalentes reais (novas admissões, vagas).
// ═══════════════════════════════════════════════════════════════════════

const COR = "#059669";
const COR_TEXTO = "#065F46";
const PALETA = ["#059669", "#0369A1", "#C2410C", "#10b981", "#BE185D", "#0F766E", "#ef4444", "#14b8a6"];

const card = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)",
};
const real = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};

type Func = {
  nome: string;
  cargo: string;
  departamento: string;
  salario: number;
  status: string;
  admissao: string;
};

export function DashboardSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [periodo, setPeriodo] = useState<"mes" | "trimestre" | "ano">("mes");
  const [carregando, setCarregando] = useState(true);
  const [funcs, setFuncs] = useState<Func[]>([]);
  const [pend, setPend] = useState({ contratos: 0, afastamentos: 0, ferias: 0, documentos: 0, vagas: 0 });

  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const [f, vagas, afast, fer, contr, docs] = await Promise.all([
      supabase.from("funcionarios").select("nome, cargo, departamento, salario, status, admissao").eq("workspace_id", wsId),
      supabase.from("vagas").select("status").eq("workspace_id", wsId),
      supabase.from("afastamentos").select("status").eq("workspace_id", wsId),
      supabase.from("ferias").select("status").eq("workspace_id", wsId),
      supabase.from("contratos").select("status").eq("workspace_id", wsId),
      supabase.from("documentos").select("validade").eq("workspace_id", wsId),
    ]);
    if (f.error) {
      console.error(f.error);
      alert("Erro ao carregar o dashboard: " + f.error.message);
      setCarregando(false);
      return;
    }
    setFuncs(
      (f.data || []).map((r: any) => ({
        nome: r.nome,
        cargo: r.cargo || "",
        departamento: r.departamento || "—",
        salario: Number(r.salario) || 0,
        status: r.status || "ativo",
        admissao: r.admissao || "",
      }))
    );
    // pendências reais
    const vagasAbertas = (vagas.data || []).filter((v: any) => v.status === "aberta").length;
    const afastAtivos = (afast.data || []).filter((a: any) => a.status === "em_andamento").length;
    const feriasVenc = (fer.data || []).filter((x: any) => x.status === "vencendo").length;
    const contrRenovar = (contr.data || []).filter((c: any) => c.status === "renovar").length;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const docsVenc = (docs.data || []).filter((d: any) => {
      if (!d.validade) return false;
      const dias = Math.round((new Date(d.validade + "T00:00:00").getTime() - hoje.getTime()) / 86400000);
      return dias <= 30; // vencido ou vencendo
    }).length;
    setPend({
      contratos: contrRenovar,
      afastamentos: afastAtivos,
      ferias: feriasVenc,
      documentos: docsVenc,
      vagas: vagasAbertas,
    });
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const ativos = useMemo(() => funcs.filter((f) => f.status !== "desligado"), [funcs]);
  const headcount = ativos.length;
  const custoFolha = useMemo(() => ativos.reduce((s, f) => s + f.salario, 0), [ativos]);
  const desligados = useMemo(() => funcs.filter((f) => f.status === "desligado").length, [funcs]);
  const turnover = headcount + desligados > 0 ? (desligados / (headcount + desligados)) * 100 : 0;

  // admissões no período selecionado
  const admissoesPeriodo = useMemo(() => {
    const hoje = new Date();
    return funcs.filter((f) => {
      if (!f.admissao) return false;
      const d = new Date(f.admissao + "T00:00:00");
      if (periodo === "mes")
        return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
      if (periodo === "trimestre") {
        const tresMesesAtras = new Date(hoje);
        tresMesesAtras.setMonth(hoje.getMonth() - 3);
        return d >= tresMesesAtras;
      }
      return d.getFullYear() === hoje.getFullYear();
    }).length;
  }, [funcs, periodo]);

  // headcount por departamento
  const porDepto = useMemo(() => {
    const m: Record<string, number> = {};
    ativos.forEach((f) => {
      m[f.departamento] = (m[f.departamento] || 0) + 1;
    });
    return Object.entries(m)
      .map(([nome, qtd], i) => ({ nome, qtd, cor: PALETA[i % PALETA.length] }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [ativos]);
  const maxDep = Math.max(1, ...porDepto.map((d) => d.qtd));

  // novas admissões (substitui aniversariantes)
  const novasAdmissoes = useMemo(
    () =>
      [...funcs]
        .filter((f) => f.admissao && f.status !== "desligado")
        .sort((a, b) => (a.admissao < b.admissao ? 1 : -1))
        .slice(0, 5),
    [funcs]
  );

  const labelPeriodo = periodo === "mes" ? "no mês" : periodo === "trimestre" ? "no trimestre" : "no ano";
  const kpis = [
    {
      label: "Funcionários",
      valor: String(headcount),
      sub: `${desligados} desligado(s)`,
      cor: "#059669",
      icon: "👥",
    },
    { label: `Admissões`, valor: String(admissoesPeriodo), sub: labelPeriodo, cor: "#059669", icon: "✅" },
    { label: "Turnover", valor: turnover.toFixed(1) + "%", sub: "acumulado", cor: "#0369A1", icon: "🔄" },
    { label: "Custo da Folha", valor: real(custoFolha), sub: "ativos", cor: "#C2410C", icon: "💰" },
    { label: "Vagas abertas", valor: String(pend.vagas), sub: "recrutando", cor: "#0F766E", icon: "📢" },
    { label: "Afastados", valor: String(pend.afastamentos), sub: "agora", cor: "#dc2626", icon: "🏥" },
  ];

  const pendencias = [
    { texto: `${pend.contratos} contrato(s) a renovar`, icon: "📄", cor: "#C2410C", n: pend.contratos },
    {
      texto: `${pend.afastamentos} afastamento(s) em andamento`,
      icon: "🏥",
      cor: "#dc2626",
      n: pend.afastamentos,
    },
    { texto: `${pend.ferias} período(s) de férias vencendo`, icon: "🌴", cor: "#0369A1", n: pend.ferias },
    {
      texto: `${pend.documentos} documento(s) vencendo/vencidos`,
      icon: "🩺",
      cor: "#0F766E",
      n: pend.documentos,
    },
  ].filter((p) => p.n > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>
              Visão Geral de RH
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              Acompanhe o quadro de pessoal, folha e movimentações
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: 4, borderRadius: 12 }}>
          {(["mes", "trimestre", "ano"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              style={{
                padding: "7px 16px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "capitalize",
                background: periodo === p ? "#ffffff" : "transparent",
                color: periodo === p ? COR_TEXTO : "#64748b",
                boxShadow: periodo === p ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {p === "mes" ? "Mês" : p}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div style={{ ...card, padding: 50, textAlign: "center" }}>
          <p style={{ color: "#64748B", fontSize: 13 }}>Carregando indicadores...</p>
        </div>
      ) : headcount === 0 ? (
        <div style={{ ...card, padding: 50, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="grafico" tamanho={24} /></span>
          <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
            Sem dados ainda
          </p>
          <p style={{ color: "#64748B", fontSize: 13, margin: 0 }}>
            Cadastre funcionários e os números aparecem aqui automaticamente.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}
          >
            {kpis.map((k, i) => {
              const hero = i === 0;
              return (
                <div key={k.label} style={{ ...card, padding: 18, position: "relative", overflow: "hidden", ...(hero ? { background: "linear-gradient(140deg, #10B981 0%, #059669 45%, #065F46 100%)", boxShadow: "0 18px 34px -18px rgba(5,150,105,.75)" } : {}) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: hero ? "rgba(255,255,255,.18)" : `${k.cor}14`, color: hero ? "#fff" : k.cor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconeEmoji e={k.icon} tamanho={17} />
                    </span>
                    <span style={{ color: hero ? "rgba(255,255,255,.85)" : "#64748B", fontSize: 13, fontWeight: 700 }}>{k.label}</span>
                  </div>
                  <p style={{ color: hero ? "#fff" : "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>{k.valor}</p>
                  <p style={{ color: hero ? "rgba(255,255,255,.75)" : "#94A3B8", fontSize: 12, margin: "4px 0 0", fontWeight: 600 }}>{k.sub}</p>
                </div>
              );
            })}
          </div>

          {/* HEADCOUNT + NOVAS ADMISSÕES */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
            <div style={{ ...card, padding: 22 }}>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: 0 }}>
                  Headcount por Departamento
                </h3>
                <p style={{ color: "#94A3B8", fontSize: 12, margin: "2px 0 0" }}>
                  {headcount} funcionários ativos
                </p>
              </div>
              {porDepto.length === 0 ? (
                <p style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: 30 }}>
                  Sem departamentos.
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: 18,
                    height: 200,
                    padding: "0 4px",
                  }}
                >
                  {porDepto.map((d) => (
                    <div
                      key={d.nome}
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
                      <span style={{ color: "#0F172A", fontSize: 13, fontWeight: 800 }}>{d.qtd}</span>
                      <div
                        title={`${d.qtd} pessoas`}
                        style={{
                          width: "60%",
                          height: `${(d.qtd / maxDep) * 100}%`,
                          background: `linear-gradient(180deg, ${d.cor} 0%, ${d.cor}cc 100%)`,
                          borderRadius: "6px 6px 0 0",
                          minHeight: 6,
                        }}
                      />
                      <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 600, textAlign: "center" }}>
                        {d.nome}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...card, padding: 22 }}>
              <h3 style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
                Novas Admissões
              </h3>
              <p style={{ color: "#94A3B8", fontSize: 12, margin: "0 0 16px" }}>Contratações mais recentes</p>
              {novasAdmissoes.length === 0 ? (
                <p style={{ color: "#94A3B8", fontSize: 13 }}>Nenhuma admissão registrada.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {novasAdmissoes.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 14,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {a.nome.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            color: "#0F172A",
                            fontSize: 13,
                            fontWeight: 700,
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.nome}
                        </p>
                        <p
                          style={{
                            color: "#94A3B8",
                            fontSize: 11,
                            margin: "1px 0 0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.cargo}
                        </p>
                      </div>
                      <span
                        style={{
                          background: COR_TEXTO + "12",
                          color: COR_TEXTO,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 9px",
                          borderRadius: 8,
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {dataBR(a.admissao)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PENDÊNCIAS */}
          <div style={{ ...card, padding: 22 }}>
            <h3 style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>
              Pendências de RH
            </h3>
            {pendencias.length === 0 ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="check" tamanho={24} /></span>
                <p style={{ color: "#059669", fontSize: 13, fontWeight: 700, margin: 0 }}>
                  Tudo em dia, nenhuma pendência!
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                {pendencias.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      background: "#F7FAF9",
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 9,
                        background: `${p.cor}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {<IconeEmoji e={p.icon} />}
                    </div>
                    <p style={{ color: "#334155", fontSize: 13, fontWeight: 600, margin: 0 }}>{p.texto}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}