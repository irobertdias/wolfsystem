"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import {
  CAMPOS_FIXOS,
  CAMPOS_FIXOS_MAP,
  SECOES_LABEL,
  montarCamposUnificados,
  type CampoUnificado,
  type ConfigCampoPadrao,
  type CampoCustom,
} from "../../lib/campos_proposta_definicao";

// ═══════════════════════════════════════════════════════════════════════
// 🛠️ EDITOR DE CAMPOS DA PROPOSTA — V2 (mostra fixos + custom unificados)
// ═══════════════════════════════════════════════════════════════════════

type TipoCustom = "texto" | "textarea" | "numero" | "moeda" | "data" | "dropdown" | "checkbox";

const TIPOS_CUSTOM: { valor: TipoCustom; label: string; icone: string }[] = [
  { valor: "texto",    label: "Texto curto",  icone: "📝" },
  { valor: "textarea", label: "Texto longo",  icone: "📄" },
  { valor: "numero",   label: "Número",       icone: "🔢" },
  { valor: "moeda",    label: "Valor (R$)",   icone: "💰" },
  { valor: "data",     label: "Data",         icone: "📅" },
  { valor: "dropdown", label: "Seleção",      icone: "📋" },
  { valor: "checkbox", label: "Sim / Não",    icone: "☑️" },
];

const labelToSlug = (label: string): string =>
  label.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 50);

export default function EditorProposta() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const { isDono, perfil, isSuperAdmin } = usePermissao();
  const podeEditar = isDono || isSuperAdmin || perfil === "Administrador";

  const [campos, setCampos] = useState<CampoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // 🎨 ESTILOS LIGHT TECH
  const inputStyle = {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "9px 12px",
    color: "#1f2937",
    fontSize: 13,
    boxSizing: "border-box" as const,
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  const fetchCampos = async () => {
    if (!workspace?.username) return;
    setLoading(true);
    try {
      const [respConfig, respCustom] = await Promise.all([
        supabase.from("proposta_campos_padrao_config")
          .select("*")
          .eq("workspace_id", workspace.username),
        supabase.from("proposta_campos_customizados")
          .select("*")
          .eq("workspace_id", workspace.username)
          .eq("ativo", true)
          .order("ordem", { ascending: true }),
      ]);

      const configs: ConfigCampoPadrao[] = (respConfig.data || []).map((c: any) => ({
        id: c.id,
        campo_slug: c.campo_slug,
        label_custom: c.label_custom,
        obrigatorio: c.obrigatorio,
        visivel: c.visivel,
        ordem: c.ordem,
        opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" && c.opcoes ? JSON.parse(c.opcoes) : null),
        placeholder_custom: c.placeholder_custom,
      }));

      const customs: CampoCustom[] = (respCustom.data || []).map((c: any) => ({
        id: c.id,
        slug: c.slug,
        label: c.label,
        tipo: c.tipo,
        obrigatorio: c.obrigatorio,
        ordem: c.ordem,
        opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" ? JSON.parse(c.opcoes) : []),
        placeholder: c.placeholder,
        ativo: c.ativo,
      }));

      const lista = montarCamposUnificados(configs, customs);

      // 📊 Enriquece cada campo com mostrar_na_lista (lido das tabelas brutas)
      const mostrarFixoMap = new Map<string, boolean>();
      for (const c of (respConfig.data || [])) {
        mostrarFixoMap.set(c.campo_slug, !!c.mostrar_na_lista);
      }
      const mostrarCustomMap = new Map<string, boolean>();
      for (const c of (respCustom.data || [])) {
        mostrarCustomMap.set(c.slug, !!c.mostrar_na_lista);
      }
      const enriquecida = lista.map(c => ({
        ...c,
        mostrar_na_lista: c.origem === "fixo"
          ? !!mostrarFixoMap.get(c.slug)
          : !!mostrarCustomMap.get(c.slug),
      }));
      setCampos(enriquecida as any);
    } catch (e) {
      console.error("[EditorProposta] erro fetch:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampos(); }, [workspace]);

  const adicionarCustom = () => {
    const maxOrdem = campos.reduce((m, c) => Math.max(m, c.ordem), 0);
    const novo: CampoUnificado = {
      origem: "custom",
      slug: "",
      label: "",
      tipo: "texto",
      obrigatorio: false,
      visivel: true,
      ordem: maxOrdem + 1,
      opcoes: [],
    };
    setCampos([...campos, { ...novo, mostrar_na_lista: true } as any]);
  };

  const atualizar = (idx: number, patch: Partial<CampoUnificado>) => {
    setCampos(campos.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const mover = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= campos.length) return;
    const novo = [...campos];
    [novo[idx], novo[target]] = [novo[target], novo[idx]];
    setCampos(novo.map((c, i) => ({ ...c, ordem: i })));
  };

  const remover = async (idx: number) => {
    const c = campos[idx];
    if (c.origem === "fixo") {
      if (confirm(`Ocultar o campo "${c.label}"?\n\nEle deixa de aparecer no formulário, mas os dados das propostas existentes ficam preservados. Você pode voltar a mostrar a qualquer momento.`)) {
        atualizar(idx, { visivel: false });
      }
      return;
    }
    const msg = c.idCustom
      ? `Remover o campo "${c.label}"?\n\nOs valores já preenchidos nas propostas existentes NÃO serão excluídos.`
      : `Remover o campo "${c.label || "novo"}"?`;
    if (!confirm(msg)) return;

    if (c.idCustom && workspace?.username) {
      const { error } = await supabase
        .from("proposta_campos_customizados")
        .update({ ativo: false })
        .eq("id", c.idCustom)
        .eq("workspace_id", workspace.username);
      if (error) {
        alert("Erro ao remover: " + error.message);
        return;
      }
    }
    setCampos(campos.filter((_, i) => i !== idx).map((c, i) => ({ ...c, ordem: i })));
  };

  const adicionarOpcao = (idx: number) => {
    const c = campos[idx];
    const opcoes = [...(c.opcoes || []), ""];
    atualizar(idx, { opcoes });
  };

  const atualizarOpcao = (idx: number, opIdx: number, valor: string) => {
    const c = campos[idx];
    const opcoes = [...(c.opcoes || [])];
    opcoes[opIdx] = valor;
    atualizar(idx, { opcoes });
  };

  const removerOpcao = (idx: number, opIdx: number) => {
    const c = campos[idx];
    const opcoes = (c.opcoes || []).filter((_, i) => i !== opIdx);
    atualizar(idx, { opcoes });
  };

  const salvar = async () => {
    if (!workspace?.username) return;

    for (let i = 0; i < campos.length; i++) {
      const c = campos[i];
      if (c.origem === "custom") {
        if (!c.label.trim()) {
          alert(`Campo customizado #${i + 1} não tem nome. Preencha ou remova.`);
          return;
        }
        if (c.tipo === "dropdown") {
          const opcoesValidas = (c.opcoes || []).filter(o => o.trim());
          if (opcoesValidas.length === 0) {
            alert(`Campo "${c.label}" é uma Seleção (dropdown) mas não tem opções cadastradas.`);
            return;
          }
        }
      }
    }

    setSalvando(true);
    try {
      // ─── 1) Salva config dos fixos ──────────────────────────────────
      const fixosNaLista = campos.filter(c => c.origem === "fixo");
      for (let i = 0; i < fixosNaLista.length; i++) {
        const c = fixosNaLista[i];
        const def = CAMPOS_FIXOS_MAP[c.slug];
        if (!def) continue;

        const labelMudou = c.label.trim() !== def.labelPadrao;
        const obrigMudou = c.obrigatorio !== def.obrigatorioPadrao;
        const ordemMudou = c.ordem !== def.ordemPadrao;

        let opcoesMudou = false;
        let opcoesFinal: string[] | null = null;
        if (def.tipo === "dropdown") {
          const opcoesAtuais = (c.opcoes || []).filter(o => String(o).trim());
          const opcoesPadrao = def.opcoes || [];
          opcoesMudou = JSON.stringify(opcoesAtuais) !== JSON.stringify(opcoesPadrao);
          if (opcoesMudou) opcoesFinal = opcoesAtuais;
        }

        const placeholderMudou = (c.placeholder || "").trim() !== (def.placeholderPadrao || "");
        const placeholderFinal = placeholderMudou ? (c.placeholder || null) : null;

        // 📊 Detecta mudança no "mostrar na tela principal"
        const mostrarNaListaAtual = !!(c as any).mostrar_na_lista;
        const mostrarMudou = mostrarNaListaAtual !== false; // default é false

        const labelCustomFinal = labelMudou ? c.label.trim() : null;
        const obrigatorioFinal = obrigMudou ? c.obrigatorio : null;
        const ordemFinal = ordemMudou ? c.ordem : null;

        if (!labelMudou && !obrigMudou && !ordemMudou && !opcoesMudou && !placeholderMudou && !mostrarMudou && c.visivel) {
          if (c.idConfig) {
            await supabase.from("proposta_campos_padrao_config")
              .delete()
              .eq("id", c.idConfig)
              .eq("workspace_id", workspace.username);
          }
          continue;
        }

        const payload: any = {
          workspace_id: workspace.username,
          campo_slug: c.slug,
          label_custom: labelCustomFinal,
          obrigatorio: obrigatorioFinal,
          visivel: c.visivel,
          ordem: ordemFinal,
          opcoes: opcoesFinal,
          placeholder_custom: placeholderFinal,
          mostrar_na_lista: mostrarNaListaAtual,
        };

        if (c.idConfig) {
          await supabase.from("proposta_campos_padrao_config")
            .update(payload)
            .eq("id", c.idConfig)
            .eq("workspace_id", workspace.username);
        } else {
          await supabase.from("proposta_campos_padrao_config")
            .insert([payload]);
        }
      }

      // ─── 2) Salva customs ──────────────────────────────────────────
      const customsNaLista = campos.filter(c => c.origem === "custom");

      const customsComSlug = customsNaLista.map(c => ({
        ...c,
        slug: (c.slug || labelToSlug(c.label)).slice(0, 50),
      }));

      const slugSet = new Set<string>();
      for (const c of customsComSlug) {
        if (!c.slug) {
          alert(`Campo "${c.label}" não conseguiu gerar slug. Renomeie.`);
          setSalvando(false);
          return;
        }
        if (slugSet.has(c.slug)) {
          alert(`Campos customizados com nome interno duplicado ("${c.slug}"). Renomeie um.`);
          setSalvando(false);
          return;
        }
        if (CAMPOS_FIXOS_MAP[c.slug]) {
          alert(`O nome "${c.slug}" conflita com um campo padrão. Escolha outro nome pro campo "${c.label}".`);
          setSalvando(false);
          return;
        }
        slugSet.add(c.slug);
      }

      const { data: existentes } = await supabase
        .from("proposta_campos_customizados")
        .select("id, slug")
        .eq("workspace_id", workspace.username);
      const slugsExistentes = new Map<string, number>((existentes || []).map(x => [x.slug, x.id]));

      for (const c of customsComSlug) {
        const existeId = slugsExistentes.get(c.slug);
        const mostrarNaLista = !!(c as any).mostrar_na_lista;
        if (existeId) {
          await supabase.from("proposta_campos_customizados").update({
            label: c.label,
            tipo: c.tipo,
            obrigatorio: c.obrigatorio,
            ordem: c.ordem,
            opcoes: c.tipo === "dropdown" ? (c.opcoes || []).filter(o => o.trim()) : null,
            ativo: true,
            placeholder: c.placeholder || null,
            mostrar_na_lista: mostrarNaLista,
          }).eq("id", existeId).eq("workspace_id", workspace.username);
        } else {
          await supabase.from("proposta_campos_customizados").insert([{
            workspace_id: workspace.username,
            slug: c.slug,
            label: c.label,
            tipo: c.tipo,
            obrigatorio: c.obrigatorio,
            ordem: c.ordem,
            opcoes: c.tipo === "dropdown" ? (c.opcoes || []).filter(o => o.trim()) : null,
            ativo: true,
            placeholder: c.placeholder || null,
            mostrar_na_lista: mostrarNaLista,
          }]);
        }
      }

      alert("✅ Configurações salvas com sucesso!");
      await fetchCampos();
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
    setSalvando(false);
  };

  // ═══ Sem permissão ═══
  if (!podeEditar) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(239,68,68,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>
          <h1 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 22px", lineHeight: 1.5 }}>
            Só o dono ou administrador do workspace pode editar os campos da proposta.
          </p>
          <button onClick={() => router.back()}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
            }}>
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(139,92,246,0.25)",
            flexShrink: 0,
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🛠️</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Editor de Campos da Proposta</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0", maxWidth: 820, lineHeight: 1.5 }}>
              Configure quais campos aparecem no formulário de proposta deste workspace. Você pode editar os campos padrão (label, obrigatório, ocultar) e adicionar quantos campos personalizados quiser. Cada workspace tem sua própria configuração.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/crm/vendas")}
            style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            ← Voltar para Vendas
          </button>
          <button onClick={salvar} disabled={salvando || loading}
            style={{
              background: salvando ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "10px 22px", fontSize: 13, fontWeight: 700,
              cursor: salvando || loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}>
            {salvando ? "⏳ Salvando..." : "💾 Salvar Tudo"}
          </button>
        </div>
      </div>

      {/* ═══ LEGENDA ═══ */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "#6b7280", ...cardStyle, padding: "12px 16px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>🔒 Padrão</span>
          Campos fixos do sistema — editar label, obrigatório, visibilidade e ordem
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#f3e8ff", color: "#a855f7", border: "1px solid #ddd6fe", padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>✨ Personalizado</span>
          Campos extras criados pelo workspace — pode editar tudo + remover
        </span>
      </div>

      {/* ═══ AVISO LGPD ═══ */}
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
        <div>
          <p style={{ color: "#92400e", fontSize: 12, fontWeight: 700, margin: 0 }}>Atenção sobre dados pessoais (LGPD)</p>
          <p style={{ color: "#78350f", fontSize: 11, margin: "3px 0 0", lineHeight: 1.5 }}>
            Você é responsável pelos dados coletados nesses campos. Não cadastre informações sensíveis sem consentimento expresso do titular.
          </p>
        </div>
      </div>

      {/* ═══ LISTA ═══ */}
      {loading ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          ⏳ Carregando campos...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campos.map((campo, idx) => {
            const ehFixo = campo.origem === "fixo";
            const corBadge = ehFixo ? "#3b82f6" : "#a855f7";
            const bgBadge = ehFixo ? "#eff6ff" : "#f3e8ff";
            const borderBadge = ehFixo ? "#bfdbfe" : "#ddd6fe";
            const labelBadge = ehFixo ? "🔒 Padrão" : "✨ Personalizado";
            const opacidade = !campo.visivel ? 0.55 : 1;

            return (
              <div key={`${campo.origem}-${campo.slug}-${idx}`}
                style={{
                  ...cardStyle,
                  padding: 16,
                  opacity: opacidade,
                  transition: "opacity 0.15s, box-shadow 0.15s",
                  borderLeft: `3px solid ${corBadge}`,
                }}>
                {/* Linha 1 — Mover + Badge + Label + Tipo + Ações */}
                <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto auto", gap: 10, alignItems: "center" }}>
                  {/* Mover */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <button onClick={() => mover(idx, -1)} disabled={idx === 0} title="Mover pra cima"
                      style={{
                        background: "#f9fafb",
                        color: idx === 0 ? "#d1d5db" : "#6b7280",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6, width: 26, height: 20, fontSize: 9,
                        cursor: idx === 0 ? "not-allowed" : "pointer", lineHeight: 1, fontWeight: 700,
                      }}>▲</button>
                    <button onClick={() => mover(idx, 1)} disabled={idx === campos.length - 1} title="Mover pra baixo"
                      style={{
                        background: "#f9fafb",
                        color: idx === campos.length - 1 ? "#d1d5db" : "#6b7280",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6, width: 26, height: 20, fontSize: 9,
                        cursor: idx === campos.length - 1 ? "not-allowed" : "pointer", lineHeight: 1, fontWeight: 700,
                      }}>▼</button>
                  </div>

                  {/* Badge */}
                  <span style={{
                    background: bgBadge, color: corBadge,
                    border: `1px solid ${borderBadge}`,
                    padding: "4px 10px", borderRadius: 10, fontSize: 10,
                    fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    {labelBadge}
                  </span>

                  {/* Label */}
                  <div>
                    <input
                      value={campo.label}
                      onChange={(e) => atualizar(idx, { label: e.target.value })}
                      placeholder={ehFixo ? campo.labelPadrao : 'Ex: "CEP do Imóvel", "Operadora atual"'}
                      style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }}
                    />
                    {ehFixo && campo.label !== campo.labelPadrao && (
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontStyle: "italic" }}>
                        Padrão: {campo.labelPadrao} · slug interno: <code style={{ color: "#6b7280", background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, border: "1px solid #e5e7eb" }}>{campo.slug}</code>
                      </p>
                    )}
                  </div>

                  {/* Tipo */}
                  {ehFixo ? (
                    <div style={{ minWidth: 160 }}>
                      <span style={{ background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb", padding: "9px 14px", borderRadius: 10, fontSize: 12, display: "block", textAlign: "center", fontWeight: 600 }}>
                        {campo.tipo === "vendedor" ? "👤 Vendedor" : campo.tipo === "telefone" ? "📞 Telefone" : campo.tipo === "email" ? "📧 E-mail" : campo.tipo === "data" ? "📅 Data" : campo.tipo === "moeda" ? "💰 Valor (R$)" : campo.tipo === "dropdown" ? "📋 Seleção" : "📝 Texto"}
                      </span>
                    </div>
                  ) : (
                    <select
                      value={campo.tipo}
                      onChange={(e) => {
                        const novoTipo = e.target.value as TipoCustom;
                        atualizar(idx, {
                          tipo: novoTipo,
                          opcoes: novoTipo === "dropdown" ? (campo.opcoes || [""]) : []
                        });
                      }}
                      style={{ ...inputStyle, minWidth: 170 }}
                    >
                      {TIPOS_CUSTOM.map(t => (
                        <option key={t.valor} value={t.valor}>{t.icone} {t.label}</option>
                      ))}
                    </select>
                  )}

                  {/* Botão remover/ocultar */}
                  <button onClick={() => remover(idx)}
                    title={ehFixo ? "Ocultar campo (não pode ser deletado)" : "Remover campo"}
                    style={{
                      background: ehFixo ? "#fffbeb" : "#fef2f2",
                      color: ehFixo ? "#f59e0b" : "#dc2626",
                      border: `1px solid ${ehFixo ? "#fde68a" : "#fecaca"}`,
                      borderRadius: 10, padding: "9px 12px", fontSize: 14,
                      cursor: "pointer", height: 38, whiteSpace: "nowrap", fontWeight: 600,
                    }}>
                    {ehFixo ? "👁️‍🗨️" : "🗑️"}
                  </button>
                </div>

                {/* Linha 2 — Toggles */}
                <div style={{ display: "flex", gap: 14, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                    background: campo.obrigatorio ? "#f0fdf4" : "#f9fafb",
                    border: `1px solid ${campo.obrigatorio ? "#bbf7d0" : "#e5e7eb"}`,
                    padding: "5px 12px", borderRadius: 8,
                    transition: "all 0.15s",
                  }}>
                    <input type="checkbox" checked={campo.obrigatorio}
                      onChange={(e) => atualizar(idx, { obrigatorio: e.target.checked })}
                      style={{ accentColor: "#16a34a", width: 15, height: 15, cursor: "pointer" }} />
                    <span style={{ color: campo.obrigatorio ? "#16a34a" : "#6b7280", fontSize: 12, fontWeight: 600 }}>⭐ Obrigatório</span>
                  </label>

                  <label style={{
                    display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                    background: campo.visivel ? "#eff6ff" : "#f3f4f6",
                    border: `1px solid ${campo.visivel ? "#bfdbfe" : "#e5e7eb"}`,
                    padding: "5px 12px", borderRadius: 8,
                    transition: "all 0.15s",
                  }}>
                    <input type="checkbox" checked={campo.visivel}
                      onChange={(e) => atualizar(idx, { visivel: e.target.checked })}
                      style={{ accentColor: campo.visivel ? "#3b82f6" : "#9ca3af", width: 15, height: 15, cursor: "pointer" }} />
                    <span style={{ color: campo.visivel ? "#3b82f6" : "#6b7280", fontSize: 12, fontWeight: 600 }}>
                      {campo.visivel ? "👁️ Visível" : "🙈 Oculto"}
                    </span>
                  </label>

                  {/* 📊 Visualizar na tela principal (lista de Vendas) */}
                  {(() => {
                    const mostraNaLista = !!(campo as any).mostrar_na_lista;
                    return (
                      <label style={{
                        display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                        background: mostraNaLista ? "#f0fdf4" : "#f9fafb",
                        border: `1px solid ${mostraNaLista ? "#bbf7d0" : "#e5e7eb"}`,
                        padding: "5px 12px", borderRadius: 8,
                        transition: "all 0.15s",
                      }}>
                        <input type="checkbox" checked={mostraNaLista}
                          onChange={(e) => atualizar(idx, { mostrar_na_lista: e.target.checked } as any)}
                          style={{ accentColor: "#16a34a", width: 15, height: 15, cursor: "pointer" }} />
                        <span style={{ color: mostraNaLista ? "#16a34a" : "#6b7280", fontSize: 12, fontWeight: 600 }}>
                          📊 Visualizar na tela principal
                        </span>
                      </label>
                    );
                  })()}

                  {/* Placeholder */}
                  {(campo.tipo === "texto" || campo.tipo === "textarea" || campo.tipo === "numero" || campo.tipo === "moeda" || campo.tipo === "telefone" || campo.tipo === "email") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 220 }}>
                      <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>Placeholder:</span>
                      <input placeholder="Texto de exemplo (opcional)"
                        value={campo.placeholder || ""}
                        onChange={(e) => atualizar(idx, { placeholder: e.target.value })}
                        style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, flex: 1 }} />
                    </div>
                  )}
                </div>

                {/* Linha 3 — Opções pra dropdowns */}
                {campo.tipo === "dropdown" && (
                  <div style={{ marginTop: 12, padding: 12, background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                    <p style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px", fontWeight: 700 }}>
                      📋 Opções do dropdown
                      {ehFixo && (
                        <span style={{ color: "#9ca3af", fontSize: 10, marginLeft: 8, textTransform: "none", fontWeight: 500, fontStyle: "italic" }}>
                          (você pode editar a lista — vai sobrescrever a do sistema)
                        </span>
                      )}
                    </p>
                    {(campo.opcoes || []).map((op, opIdx) => (
                      <div key={opIdx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input placeholder={`Opção ${opIdx + 1}`} value={op}
                          onChange={(e) => atualizarOpcao(idx, opIdx, e.target.value)}
                          style={{ ...inputStyle, padding: "7px 12px", fontSize: 12 }} />
                        <button onClick={() => removerOpcao(idx, opIdx)}
                          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => adicionarOpcao(idx)}
                      style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "7px 16px", fontSize: 12, cursor: "pointer", fontWeight: 700, marginTop: 4 }}>
                      ➕ Adicionar opção
                    </button>
                    {ehFixo && campo.slug === "status_venda" && (
                      <p style={{ color: "#92400e", fontSize: 10, margin: "10px 0 0", fontStyle: "italic", background: "#fffbeb", padding: "6px 10px", borderRadius: 6, border: "1px solid #fde68a" }}>
                        ⚠️ Status novos não terão cor personalizada na lista de vendas — vão aparecer em cinza. Dashboard e Funil seguem funcionando normalmente.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Botão adicionar custom */}
          <button onClick={adicionarCustom}
            style={{
              background: "#ffffff",
              color: "#a855f7",
              border: "2px dashed #ddd6fe",
              borderRadius: 14, padding: "16px 24px",
              fontSize: 13, cursor: "pointer", fontWeight: 700, marginTop: 6,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f3e8ff"; e.currentTarget.style.borderColor = "#a855f7"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#ddd6fe"; }}>
            ➕ Adicionar campo personalizado
          </button>
        </div>
      )}
    </div>
  );
}