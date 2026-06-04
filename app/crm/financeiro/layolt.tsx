"use client";
import { useState, useEffect } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useModulos } from "../../hooks/useModulos";
import PlanoContas from "./_sections/PlanoContas";
import ContasBancarias from "./_sections/ContasBancarias";
import CentrosCusto from "./_sections/CentrosCusto";
import Contatos from "./_sections/Contatos";
import FormasPagamento from "./_sections/FormasPagamento";
import ConfigFinanceiro from "./_sections/ConfigFinanceiro";
import Lancamentos from "./_sections/Lancamentos";
import Transferencias from "./_sections/Transferencias";
import DashboardFinanceiro from "./_sections/Dashboard";
import DRE from "./_sections/DRE";
import FluxoCaixa from "./_sections/FluxoCaixa";
import Indicadores from "./_sections/Indicadores";
import Relatorios from "./_sections/Relatorios";
import Boletos from "./_sections/Boletos";
import NotasRecebidas from "./_sections/NotasRecebidas";
import EmitirNota from "./_sections/EmitirNota";
import Conciliacao from "./_sections/Conciliacao";
import ImportarExtrato from "./_sections/ImportarExtrato";
import IntegracaoBanco from "./_sections/IntegracaoBanco";

// ═══════════════════════════════════════════════════════════════════════
// 💰 Financeiro — SHELL (registro de seções + menu interno)
// ───────────────────────────────────────────────────────────────────────
// Gating de cada tela (3 níveis):
//   1. PLANO  → modulos.financeiro_opcoes[key]  (o que o workspace tem)
//   2. GRUPO  → permissoes["fin_"+key]           (o que o dono liberou ao user)
//   3. acesso → super admin vê tudo; dono/admin veem tudo que o PLANO tem.
//
// O registro SECTIONS mapeia key→componente. Telas ainda não construídas
// caem no <EmConstrucao/>. Pra ligar uma tela real: crie _sections/<X>.tsx,
// importe aqui e adicione em SECTIONS. O menu e as permissões já existem.
// ═══════════════════════════════════════════════════════════════════════

type Item = { key: string; label: string; icone: string };
type Grupo = { nome: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  { nome: "Visão Geral", itens: [
    { key: "dashboard",   label: "Dashboard",   icone: "📊" },
    { key: "indicadores", label: "Indicadores", icone: "📈" },
  ]},
  { nome: "Movimentações", itens: [
    { key: "contas_receber", label: "Contas a Receber", icone: "📥" },
    { key: "contas_pagar",   label: "Contas a Pagar",   icone: "📤" },
    { key: "caixa",          label: "Lançamentos / Caixa", icone: "💵" },
    { key: "transferencias", label: "Transferências",   icone: "🔄" },
  ]},
  { nome: "Bancos", itens: [
    { key: "contas_bancarias", label: "Contas bancárias",     icone: "🏦" },
    { key: "conciliacao",      label: "Conciliação",          icone: "🔁" },
    { key: "extrato",          label: "Importar extrato (OFX)", icone: "📑" },
    { key: "integracao_banco", label: "Integração bancária",  icone: "🔌" },
  ]},
  { nome: "Notas & Documentos", itens: [
    { key: "emitir_nota",     label: "Emitir NF-e",        icone: "🧾" },
    { key: "notas_recebidas", label: "Notas recebidas",    icone: "📨" },
    { key: "boletos",         label: "Boletos",            icone: "🎫" },
  ]},
  { nome: "Cadastros", itens: [
    { key: "plano_contas",     label: "Plano de Contas",   icone: "🏷️" },
    { key: "centros_custo",    label: "Centros de Custo",  icone: "🎯" },
    { key: "contatos",         label: "Clientes / Fornecedores", icone: "🧑‍🤝‍🧑" },
    { key: "formas_pagamento", label: "Formas de Pagamento", icone: "💳" },
  ]},
  { nome: "Relatórios", itens: [
    { key: "dre",        label: "DRE",            icone: "📈" },
    { key: "fluxo_caixa", label: "Fluxo de Caixa", icone: "🌊" },
    { key: "relatorios", label: "Relatórios",     icone: "📊" },
  ]},
  { nome: "Configurações", itens: [
    { key: "config", label: "Configurações", icone: "⚙️" },
  ]},
];

const COR = "#d97706"; // âmbar — identidade do Financeiro (bate com o botão da barra)

// 🚧 Fallback pras telas ainda não construídas
function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🚧</div>
      <h2 style={{ margin: "0 0 6px", color: "#111827", fontSize: 20 }}>{titulo}</h2>
      <p style={{ margin: 0, fontSize: 14 }}>Tela em construção — chega em breve.</p>
    </div>
  );
}

// 🗂️ Registro de seções reais (vai crescendo conforme entrego cada tela)
const SECTIONS: Record<string, React.ComponentType<any>> = {
  plano_contas: PlanoContas,
  contas_bancarias: ContasBancarias,
  centros_custo: CentrosCusto,
  contatos: Contatos,
  formas_pagamento: FormasPagamento,
  config: ConfigFinanceiro,
  dashboard: DashboardFinanceiro,
  caixa: Lancamentos,
  contas_receber: Lancamentos,
  contas_pagar: Lancamentos,
  transferencias: Transferencias,
  dre: DRE,
  fluxo_caixa: FluxoCaixa,
  indicadores: Indicadores,
  relatorios: Relatorios,
  boletos: Boletos,
  notas_recebidas: NotasRecebidas,
  emitir_nota: EmitirNota,
  conciliacao: Conciliacao,
  extrato: ImportarExtrato,
  integracao_banco: IntegracaoBanco,
};

const LABELS: Record<string, string> = Object.fromEntries(
  GRUPOS.flatMap((g) => g.itens.map((i) => [i.key, i.label]))
);

export default function FinanceiroLayolt() {
  const { permissoes, isDono, isSuperAdmin, perfil } = usePermissao();
  const { modulos, carregado } = useModulos();

  const veTudoGrupo = isDono || perfil === "Administrador";
  const opcoes = (modulos.financeiro_opcoes || {}) as Record<string, boolean>;

  // PLANO precisa ter a opção (vale pra todos, menos super admin); dentro disso,
  // dono/admin veem tudo e sub-usuário depende do grupo (fin_<key>).
  const podeItem = (key: string) =>
    isSuperAdmin || (!!opcoes[key] && (veTudoGrupo || !!(permissoes as any)["fin_" + key]));

  const temAcessoModulo =
    isSuperAdmin || (modulos.financeiro && (veTudoGrupo || !!(permissoes as any).financeiro_acessar));

  const gruposVisiveis = GRUPOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => podeItem(i.key)) }))
    .filter((g) => g.itens.length > 0);

  const [aba, setAba] = useState("dashboard");
  const [abertos, setAbertos] = useState<Record<string, boolean>>(
    GRUPOS.reduce((acc, g) => { acc[g.nome] = true; return acc; }, {} as Record<string, boolean>)
  );
  const [menuMobile, setMenuMobile] = useState(false);

  // mantém a aba válida (1ª tela visível) quando as permissões carregam
  useEffect(() => {
    const visiveis = GRUPOS.flatMap((g) => g.itens.map((i) => i.key)).filter((k) => podeItem(k));
    if (visiveis.length && !visiveis.includes(aba)) setAba(visiveis[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissoes, modulos, isSuperAdmin]);

  if (!carregado) {
    return <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>Carregando…</div>;
  }

  if (!temAcessoModulo) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: "0 0 6px", color: "#111827", fontSize: 20 }}>Financeiro</h2>
        <p style={{ margin: 0, fontSize: 14 }}>Você não tem acesso a este módulo.</p>
      </div>
    );
  }

  const Comp = SECTIONS[aba] || (() => <EmConstrucao titulo={LABELS[aba] || "Financeiro"} />);

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 64px)", background: "#f8fafc" }}>
      {/* Sidebar interna */}
      <aside
        style={{
          width: 248,
          background: "#fff",
          borderRight: "1px solid #e5e7eb",
          padding: "16px 10px",
          flexShrink: 0,
          display: menuMobile ? "block" : undefined,
        }}
        className="fin-aside"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 14px" }}>
          <span style={{ fontSize: 22 }}>💰</span>
          <span style={{ fontWeight: 800, color: COR, fontSize: 16 }}>Financeiro</span>
        </div>

        {gruposVisiveis.map((g) => (
          <div key={g.nome} style={{ marginBottom: 6 }}>
            <button
              onClick={() => setAbertos((p) => ({ ...p, [g.nome]: !p[g.nome] }))}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 8px", color: "#6b7280", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.5,
              }}
            >
              {g.nome}
              <span style={{ fontSize: 10 }}>{abertos[g.nome] ? "▼" : "▶"}</span>
            </button>

            {abertos[g.nome] && g.itens.map((i) => {
              const sel = aba === i.key;
              return (
                <button
                  key={i.key}
                  onClick={() => { setAba(i.key); setMenuMobile(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", marginBottom: 2,
                    background: sel ? `${COR}14` : "transparent",
                    border: sel ? `1px solid ${COR}55` : "1px solid transparent",
                    borderRadius: 8, cursor: "pointer", textAlign: "left",
                    color: sel ? COR : "#374151", fontSize: 13.5,
                    fontWeight: sel ? 700 : 500,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{i.icone}</span>
                  {i.label}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Conteúdo */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <Comp secKey={aba} />
      </main>
    </div>
  );
}