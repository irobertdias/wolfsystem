"use client";
import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ GruposPermissaoSection — Componente plug-and-play pra editar permissões
// ───────────────────────────────────────────────────────────────────────────
// Renderiza os 80+ checkboxes de permissão organizados em 10 categorias
// coloridas, com:
//   - Botões "Marcar tudo" / "Desmarcar tudo" globais
//   - Botões por categoria
//   - Indentação visual pra sub-itens (prefixo "↳" ou "      ✏️")
//   - Busca por nome da permissão
//   - Contador "X de Y permissões ativas"
//   - Read-only mode (pra preview)
//
// USO:
//   <GruposPermissaoSection
//     value={permissoes}                            // Record<string, boolean>
//     onChange={(novo) => setPermissoes(novo)}
//     readOnly={false}
//   />
//
// As permissões batem 1:1 com o `Permissoes` do hook `usePermissao.ts` do Wolf.
// ═══════════════════════════════════════════════════════════════════════════

export type PermissaoCheckbox = { key: string; label: string };
export type CategoriaPermissao = { nome: string; cor: string; permissoes: PermissaoCheckbox[] };

// ─── Catálogo padrão das permissões do Wolf (bate com Permissoes do usePermissao) ───
export const CATEGORIAS_PERMISSAO_WOLF: CategoriaPermissao[] = [
  { nome: "🎯 CRM", cor: "#16a34a", permissoes: [
    { key: "crm_acessar",        label: "Acessar o CRM" },
    { key: "dashboard",          label: "Dashboard de vendas" },
    { key: "funil",              label: "Ver funil de vendas" },
    { key: "vendas_proprio",     label: "Ver próprias vendas" },
    { key: "vendas_equipe",      label: "Ver vendas da própria equipe" },
    { key: "proposta_criar",     label: "Criar propostas" },
    { key: "contatos_ver",       label: "Ver contatos" },
    { key: "contatos_editar",    label: "Editar cadastro de contatos" },
    { key: "etiquetas",          label: "Gerenciar etiquetas" },
  ]},
  { nome: "💬 Chatbot", cor: "#3b82f6", permissoes: [
    { key: "chatbot_acessar",    label: "Acessar o Chatbot" },
    { key: "chat_proprio",       label: "Ver próprios atendimentos" },
    { key: "chat_todos",         label: "Ver todos os atendimentos" },
    { key: "chat_interno",       label: "Chat interno (conversar c/ equipe)" },
    { key: "respostas_rapidas",  label: "Usar respostas rápidas" },
    { key: "transferir_chat",    label: "Transferir conversas" },
    { key: "finalizar_chat",     label: "Finalizar atendimentos" },
    { key: "disparo_enviar",     label: "Enviar disparos em massa" },
    { key: "templates_waba",     label: "Gerenciar templates WABA" },
  ]},
  { nome: "📞 Telefonia", cor: "#0d9488", permissoes: [
    { key: "telefonia_acessar",  label: "Acessar a Telefonia" },
    { key: "voip_usar",          label: "Fazer ligações (softphone)" },
    { key: "voip_conexoes",      label: "Gerenciar conexões VOIP" },
    { key: "voip_campanhas",     label: "Criar campanhas VOIP" },
    { key: "relatorios_voip",    label: "Relatórios de telefonia" },
  ]},
  { nome: "💰 Cobrança", cor: "#dc2626", permissoes: [
    { key: "cobranca",           label: "Acessar a Cobrança (tudo)" },
  ]},
  { nome: "🧑‍💼 RH", cor: "#4f46e5", permissoes: [
    { key: "rh",                       label: "Acessar o RH (tudo)" },
    // Visão Geral
    { key: "rh_dashboard",             label: "↳ Dashboard" },
    { key: "rh_indicadores",           label: "↳ Indicadores" },
    // Pessoas
    { key: "rh_funcionarios",          label: "↳ Funcionários" },
    { key: "rh_departamentos",         label: "↳ Departamentos" },
    { key: "rh_cargos",                label: "↳ Cargos & Salários" },
    // Folha
    { key: "rh_folha",                 label: "↳ Folha do Mês" },
    { key: "rh_holerites",             label: "↳ Holerites" },
    { key: "rh_encargos",              label: "↳ Encargos & Impostos" },
    // Jornada
    { key: "rh_ponto",                 label: "↳ Ponto / Frequência" },
    { key: "rh_ferias",                label: "↳ Férias" },
    { key: "rh_afastamentos",          label: "↳ Afastamentos" },
    { key: "rh_banco_horas",           label: "↳ Banco de Horas" },
    // Benefícios
    { key: "rh_beneficios",            label: "↳ Benefícios" },
    { key: "rh_vale_transporte",       label: "↳ Vale Transporte" },
    { key: "rh_vale_refeicao",         label: "↳ Vale Refeição" },
    { key: "rh_plano_saude",           label: "↳ Plano de Saúde" },
    // Recrutamento
    { key: "rh_vagas",                 label: "↳ Vagas" },
    { key: "rh_candidatos",            label: "↳ Candidatos" },
    { key: "rh_selecao",               label: "↳ Processos Seletivos" },
    // Desenvolvimento
    { key: "rh_treinamentos",          label: "↳ Treinamentos" },
    { key: "rh_avaliacoes",            label: "↳ Avaliações de Desempenho" },
    // Documentos
    { key: "rh_documentos",            label: "↳ Documentos" },
    { key: "rh_contratos",             label: "↳ Contratos" },
    // Config
    { key: "rh_config",                label: "↳ Configurações do RH" },
  ]},
  { nome: "💵 Financeiro", cor: "#d97706", permissoes: [
    { key: "financeiro_acessar",       label: "Acessar o Financeiro" },
    { key: "fin_dashboard",            label: "↳ Dashboard" },
    { key: "fin_indicadores",          label: "↳ Indicadores" },
    { key: "fin_contas_receber",       label: "↳ Contas a Receber" },
    { key: "fin_contas_pagar",         label: "↳ Contas a Pagar" },
    { key: "fin_caixa",                label: "↳ Caixa" },
    { key: "fin_transferencias",       label: "↳ Transferências" },
    { key: "fin_contas_bancarias",     label: "↳ Contas Bancárias" },
    { key: "fin_conciliacao",          label: "↳ Conciliação" },
    { key: "fin_extrato",              label: "↳ Extrato" },
    { key: "fin_integracao_banco",     label: "↳ Integração Banco" },
    { key: "fin_emitir_nota",          label: "↳ Emitir Nota Fiscal" },
    { key: "fin_notas_recebidas",      label: "↳ Notas Recebidas" },
    { key: "fin_boletos",              label: "↳ Boletos" },
    { key: "fin_plano_contas",         label: "↳ Plano de Contas" },
    { key: "fin_centros_custo",        label: "↳ Centros de Custo" },
    { key: "fin_contatos",             label: "↳ Contatos Financeiros" },
    { key: "fin_formas_pagamento",     label: "↳ Formas de Pagamento" },
    { key: "fin_dre",                  label: "↳ DRE" },
    { key: "fin_fluxo_caixa",          label: "↳ Fluxo de Caixa" },
    { key: "fin_relatorios",           label: "↳ Relatórios" },
    { key: "fin_config",               label: "↳ Configurações do Financeiro" },
  ]},
  { nome: "🕐 Bater Ponto", cor: "#db2777", permissoes: [
    { key: "bater_ponto",              label: "Acessar o Bater Ponto" },
  ]},
  { nome: "⚙️ Administração", cor: "#64748b", permissoes: [
    { key: "conexoes",                 label: "Gerenciar conexões WhatsApp" },
    { key: "filas",                    label: "Gerenciar filas" },
    { key: "usuarios_gerenciar",       label: "Gerenciar usuários" },
    { key: "grupos_permissao",         label: "Gerenciar grupos de permissão" },
    { key: "configuracoes_workspace",  label: "Configurações do workspace" },
    { key: "relatorios",               label: "Relatórios de atendimento" },
    { key: "roleta_gerenciar",         label: "Gerenciar roleta" },
  ]},
  { nome: "👤 Pessoal", cor: "#0ea5e9", permissoes: [
    { key: "config_proprio",           label: "Editar próprio perfil" },
  ]},
];

// Exporta lista FLAT pra usar em outros lugares (defaults, validação, etc)
export const TODAS_PERMISSOES_WOLF = CATEGORIAS_PERMISSAO_WOLF.flatMap(c => c.permissoes);

// Mapa SLUG→LABEL (pra mostrar nome amigável em outros lugares)
export const LABELS_PERMISSOES_WOLF: Record<string, string> = TODAS_PERMISSOES_WOLF.reduce((acc, p) => {
  acc[p.key] = p.label;
  return acc;
}, {} as Record<string, string>);

// Mapa "vazio" — todas false. Útil pra iniciar grupos novos.
export const PERMISSOES_VAZIO: Record<string, boolean> = TODAS_PERMISSOES_WOLF.reduce((acc, p) => {
  acc[p.key] = false;
  return acc;
}, {} as Record<string, boolean>);

// ═══════════════════════════════════════════════════════════════════════════

type Props = {
  /** Mapa atual de permissões marcadas */
  value: Record<string, boolean>;
  /** Callback ao mudar uma permissão */
  onChange: (novo: Record<string, boolean>) => void;
  /** Bloqueia edição (mostra só leitura) */
  readOnly?: boolean;
  /** Permite customizar as categorias (default: WOLF) */
  categorias?: CategoriaPermissao[];
  /** Largura do componente (default: 100%) */
  estilo?: React.CSSProperties;
};

export default function GruposPermissaoSection({ value, onChange, readOnly = false, categorias = CATEGORIAS_PERMISSAO_WOLF, estilo }: Props) {
  const [busca, setBusca] = useState("");
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);

  // Filtra categorias pela busca
  const categoriasFiltradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return categorias;
    return categorias
      .map(c => ({
        ...c,
        permissoes: c.permissoes.filter(p => p.label.toLowerCase().includes(b) || p.key.toLowerCase().includes(b)),
      }))
      .filter(c => c.permissoes.length > 0);
  }, [busca, categorias]);

  // Contador total
  const { totalAtivas, totalGeral } = useMemo(() => {
    let ativas = 0;
    let total = 0;
    for (const c of categorias) {
      for (const p of c.permissoes) {
        total++;
        if (value[p.key] === true) ativas++;
      }
    }
    return { totalAtivas: ativas, totalGeral: total };
  }, [value, categorias]);

  // Contador por categoria
  const contagemCategoria = (cat: CategoriaPermissao) => {
    let ativas = 0;
    for (const p of cat.permissoes) if (value[p.key] === true) ativas++;
    return { ativas, total: cat.permissoes.length };
  };

  // Detecta indentação pelo label (↳ ou      ✏️)
  const niveDeIndent = (label: string): number => {
    if (label.startsWith("      ✏️")) return 2;
    if (label.startsWith("↳")) return 1;
    return 0;
  };

  // Toggle uma permissão individual
  const togglePermissao = (key: string) => {
    if (readOnly) return;
    onChange({ ...value, [key]: !value[key] });
  };

  // Marcar/desmarcar todos de uma categoria
  const setarCategoria = (cat: CategoriaPermissao, novo: boolean) => {
    if (readOnly) return;
    const next = { ...value };
    for (const p of cat.permissoes) next[p.key] = novo;
    onChange(next);
  };

  // Marcar/desmarcar TUDO
  const setarTudo = (novo: boolean) => {
    if (readOnly) return;
    const next = { ...value };
    for (const c of categorias) for (const p of c.permissoes) next[p.key] = novo;
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, ...estilo }}>

      {/* ─── Cabeçalho: busca + contador + ações globais ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 220px" }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#1f2937" }}>
              {totalAtivas} <span style={{ color: "#9ca3af" }}>de</span> {totalGeral} <span style={{ color: "#6b7280", fontWeight: 600 }}>permissões ativas</span>
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>
              {readOnly ? "Modo somente leitura" : "Marque o que esse grupo pode fazer"}
            </p>
          </div>
        </div>

        {/* Busca */}
        <input
          type="text"
          placeholder="🔍 buscar permissão..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12.5,
            outline: "none",
            background: "#fff",
            minWidth: 180,
          }}
        />

        {/* Ações globais */}
        {!readOnly && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setarTudo(true)} style={btnGlobal("#16a34a", "#f0fdf4", "#bbf7d0")}>✓ Tudo</button>
            <button onClick={() => setarTudo(false)} style={btnGlobal("#dc2626", "#fef2f2", "#fecaca")}>✕ Nada</button>
          </div>
        )}
      </div>

      {/* ─── Categorias ─── */}
      {categoriasFiltradas.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13, background: "#fff", border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Nenhuma permissão encontrada pra "<b>{busca}</b>"
        </div>
      ) : (
        categoriasFiltradas.map(cat => {
          const { ativas, total } = contagemCategoria(cat);
          const aberta = categoriaAberta === cat.nome || !!busca;   // busca abre tudo
          return (
            <div key={cat.nome} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>

              {/* Header da categoria */}
              <div
                onClick={() => !busca && setCategoriaAberta(aberta ? null : cat.nome)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  background: `${cat.cor}10`,
                  borderBottom: aberta ? `1px solid ${cat.cor}30` : "none",
                  cursor: busca ? "default" : "pointer",
                  userSelect: "none",
                }}
              >
                {/* Bolinha colorida */}
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: cat.cor, flexShrink: 0 }} />

                {/* Nome */}
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#1f2937", flex: 1 }}>{cat.nome}</p>

                {/* Contador */}
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: ativas > 0 ? cat.cor : "#9ca3af",
                  background: ativas > 0 ? `${cat.cor}15` : "#f3f4f6",
                  border: `1px solid ${ativas > 0 ? `${cat.cor}40` : "#e5e7eb"}`,
                  borderRadius: 12,
                  padding: "2px 10px",
                }}>
                  {ativas}/{total}
                </span>

                {/* Botões marcar/desmarcar da categoria */}
                {!readOnly && (
                  <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setarCategoria(cat, true)}
                      title={`Marcar tudo de ${cat.nome}`}
                      style={btnPequeno("#16a34a")}>✓</button>
                    <button onClick={() => setarCategoria(cat, false)}
                      title={`Desmarcar tudo de ${cat.nome}`}
                      style={btnPequeno("#dc2626")}>✕</button>
                  </div>
                )}

                {/* Chevron */}
                {!busca && (
                  <span style={{ fontSize: 16, color: cat.cor, marginLeft: 4, transition: "transform 0.2s", transform: aberta ? "rotate(180deg)" : "none" }}>▾</span>
                )}
              </div>

              {/* Lista de checkboxes */}
              {aberta && (
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {cat.permissoes.map(p => {
                    const ativo = value[p.key] === true;
                    const indent = niveDeIndent(p.label);
                    const labelLimpo = p.label.replace(/^(↳|\s*✏️)\s*/, "").trim();
                    const labelFinal = indent === 0 ? p.label : (
                      indent === 1 ? `↳ ${labelLimpo}` : `✏️ editar ${labelLimpo.replace(/^editar\s*/, "")}`
                    );
                    return (
                      <label
                        key={p.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "7px 8px 7px " + (8 + indent * 20) + "px",
                          borderRadius: 6,
                          cursor: readOnly ? "default" : "pointer",
                          background: ativo ? `${cat.cor}08` : "transparent",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { if (!readOnly) e.currentTarget.style.background = ativo ? `${cat.cor}15` : "#f9fafb"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ativo ? `${cat.cor}08` : "transparent"; }}
                      >
                        <input
                          type="checkbox"
                          checked={ativo}
                          disabled={readOnly}
                          onChange={() => togglePermissao(p.key)}
                          style={{
                            width: 16, height: 16,
                            accentColor: cat.cor,
                            cursor: readOnly ? "default" : "pointer",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{
                          fontSize: 12.5,
                          color: ativo ? "#1f2937" : "#4b5563",
                          fontWeight: ativo ? 600 : 500,
                          flex: 1,
                        }}>
                          {labelFinal}
                        </span>
                        {/* Slug em monospace pra debug (some no mobile) */}
                        <code style={{
                          fontSize: 10,
                          color: "#9ca3af",
                          fontFamily: "monospace",
                          background: "#f3f4f6",
                          padding: "1px 6px",
                          borderRadius: 4,
                          display: ativo ? "inline-block" : "none",
                        }}>
                          {p.key}
                        </code>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── helpers de estilo ──────────────────────────────────────────────────────
const btnGlobal = (cor: string, bg: string, border: string): React.CSSProperties => ({
  background: bg,
  color: cor,
  border: `1px solid ${border}`,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const btnPequeno = (cor: string): React.CSSProperties => ({
  background: "#fff",
  color: cor,
  border: `1px solid ${cor}40`,
  borderRadius: 6,
  width: 26,
  height: 26,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});