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

import Icone from "../../components/a2/Icone";
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
    { key: "dashboard",   label: "Dashboard",   icone: "grafico" },
    { key: "indicadores", label: "Indicadores", icone: "alvo" },
  ]},
  { nome: "Movimentações", itens: [
    { key: "contas_receber", label: "Contas a Receber", icone: "download" },
    { key: "contas_pagar",   label: "Contas a Pagar",   icone: "upload" },
    { key: "caixa",          label: "Lançamentos / Caixa", icone: "dinheiro" },
    { key: "transferencias", label: "Transferências",   icone: "atualizar" },
  ]},
  { nome: "Bancos", itens: [
    { key: "contas_bancarias", label: "Contas bancárias",     icone: "predio" },
    { key: "conciliacao",      label: "Conciliação",          icone: "check" },
    { key: "extrato",          label: "Importar extrato (OFX)", icone: "documento" },
    { key: "integracao_banco", label: "Integração bancária",  icone: "link" },
  ]},
  { nome: "Notas & Documentos", itens: [
    { key: "emitir_nota",     label: "Emitir NF-e",        icone: "documento" },
    { key: "notas_recebidas", label: "Notas recebidas",    icone: "pasta" },
    { key: "boletos",         label: "Boletos",            icone: "carteira" },
  ]},
  { nome: "Cadastros", itens: [
    { key: "plano_contas",     label: "Plano de Contas",   icone: "tag" },
    { key: "centros_custo",    label: "Centros de Custo",  icone: "alvo" },
    { key: "contatos",         label: "Clientes / Fornecedores", icone: "usuarios" },
    { key: "formas_pagamento", label: "Formas de Pagamento", icone: "carteira" },
  ]},
  { nome: "Relatórios", itens: [
    { key: "dre",        label: "DRE",            icone: "balanca" },
    { key: "fluxo_caixa", label: "Fluxo de Caixa", icone: "grafico" },
    { key: "relatorios", label: "Relatórios",     icone: "pasta" },
  ]},
  { nome: "Configurações", itens: [
    { key: "config", label: "Configurações", icone: "config" },
  ]},
];

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";

// 🚧 Fallback pras telas ainda não construídas
function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: "44px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="relogio" tamanho={24} /></span>
      <h2 style={{ margin: 0, color: "#0F172A", fontSize: 18, fontWeight: 800 }}>{titulo}</h2>
      <p style={{ margin: 0, fontSize: 14, color: "#64748B" }}>Tela em construção, chega em breve.</p>
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
  const [menuMobile, setMenuMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const ver = () => setIsMobile(window.innerWidth < 900);
    ver(); window.addEventListener("resize", ver);
    return () => window.removeEventListener("resize", ver);
  }, []);

  // mantém a aba válida (1ª tela visível) quando as permissões carregam
  useEffect(() => {
    const visiveis = GRUPOS.flatMap((g) => g.itens.map((i) => i.key)).filter((k) => podeItem(k));
    if (visiveis.length && !visiveis.includes(aba)) setAba(visiveis[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissoes, modulos, isSuperAdmin]);

  if (!carregado) {
    return <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>Carregando…</div>;
  }

  if (!temAcessoModulo) {
    return (
      <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: 40, textAlign: "center", maxWidth: 420 }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF2F2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icone nome="cadeado" tamanho={24} /></span>
          <h2 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: 19, fontWeight: 800 }}>Financeiro</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748B" }}>Você não tem acesso a este módulo. Fale com o administrador.</p>
        </div>
      </div>
    );
  }

  const Comp = SECTIONS[aba] || (() => <EmConstrucao titulo={LABELS[aba] || "Financeiro"} />);

  const botao = (i: Item) => {
    const sel = aba === i.key;
    return (
      <button key={i.key} onClick={() => { setAba(i.key); setMenuMobile(false); }}
        className={`a2-menu-config${sel ? " ativo" : ""}`}
        style={{
          width: isMobile ? "auto" : "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", border: 0, borderRadius: 11, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
          background: sel ? "#ECFDF5" : "transparent", color: sel ? "#065F46" : "#475569",
          fontSize: 13.5, fontWeight: sel ? 800 : 600, transition: "background .15s",
        }}>
        <Icone nome={i.icone as any} tamanho={16} cor={sel ? "#059669" : "#94A3B8"} />
        {i.label}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start", padding: isMobile ? "4px 0 20px" : "8px 4px 28px", maxWidth: 1440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {isMobile ? (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => setMenuMobile((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: 0, borderRadius: 16, boxShadow: SOMBRA, padding: "12px 16px", fontSize: 14, fontWeight: 800, color: "#0F172A", cursor: "pointer" }}>
            <Icone nome="dinheiro" tamanho={18} cor="#059669" />
            Financeiro · {LABELS[aba] || ""}
            <span style={{ marginLeft: "auto", display: "inline-flex", transform: menuMobile ? "rotate(180deg)" : "none", transition: "transform .15s" }}><Icone nome="baixo" tamanho={16} /></span>
          </button>
          {menuMobile && (
            <nav aria-label="Seções do financeiro" style={{ background: "#fff", borderRadius: 16, boxShadow: SOMBRA, padding: 10, display: "flex", flexDirection: "column", gap: 2 }}>
              {gruposVisiveis.map((g) => (
                <div key={g.nome} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 700, padding: "8px 12px 4px" }}>{g.nome}</span>
                  {g.itens.map((i) => <div key={i.key} style={{ display: "flex" }}>{botao(i)}</div>)}
                </div>
              ))}
            </nav>
          )}
        </div>
      ) : (
        <nav aria-label="Seções do financeiro" style={{ flex: "0 0 250px", background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: 12, display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 10px" }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="dinheiro" tamanho={17} /></span>
            <span style={{ fontWeight: 800, color: "#0F172A", fontSize: 16 }}>Financeiro</span>
          </div>
          {gruposVisiveis.map((g) => (
            <div key={g.nome} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 700, padding: "12px 12px 4px" }}>{g.nome}</span>
              {g.itens.map(botao)}
            </div>
          ))}
        </nav>
      )}

      <main style={{ flex: "999 1 560px", minWidth: 0 }}>
        <Comp secKey={aba} />
      </main>
    </div>
  );
}
