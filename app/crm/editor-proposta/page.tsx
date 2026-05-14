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
// Permite que dono/admin do workspace controle TODA a estrutura do
// formulário de proposta. Pra cada campo (fixo ou custom):
//
//   FIXOS  → editar LABEL, OBRIGATORIEDADE, VISIBILIDADE, ORDEM
//            (NÃO pode mudar TIPO nem DELETAR — só ocultar)
//   CUSTOM → editar TUDO + REMOVER (soft delete)
//
// Isolamento multi-tenant: tudo filtrado por workspace.username.

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

  const inputStyle = {
    width: "100%",
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "9px 12px",
    color: "white",
    fontSize: 13,
    boxSizing: "border-box" as const,
  };

  // ═══════════════════════════════════════════════════════════════════
  // Fetch — busca config dos fixos + customs e monta lista unificada
  // ═══════════════════════════════════════════════════════════════════
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
      setCampos(lista);
    } catch (e) {
      console.error("[EditorProposta] erro fetch:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampos(); }, [workspace]);

  // ═══════════════════════════════════════════════════════════════════
  // Ações
  // ═══════════════════════════════════════════════════════════════════
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
    setCampos([...campos, novo]);
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
      // Fixo não pode ser deletado — só ocultado
      if (confirm(`Ocultar o campo "${c.label}"?\n\nEle deixa de aparecer no formulário, mas os dados das propostas existentes ficam preservados. Você pode voltar a mostrar a qualquer momento.`)) {
        atualizar(idx, { visivel: false });
      }
      return;
    }
    // Custom — soft delete
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

  // ═══════════════════════════════════════════════════════════════════
  // Salvar — upsert nas duas tabelas
  // ═══════════════════════════════════════════════════════════════════
  const salvar = async () => {
    if (!workspace?.username) return;

    // Valida customs
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
      // Pra cada FIXO da lista, verifica se a config "diverge" do padrão.
      // Se sim, upsert; se igual ao padrão, podemos deixar como está.
      // Pra simplicidade: salva config de TODOS os fixos (idempotente).
      const fixosNaLista = campos.filter(c => c.origem === "fixo");
      for (let i = 0; i < fixosNaLista.length; i++) {
        const c = fixosNaLista[i];
        const def = CAMPOS_FIXOS_MAP[c.slug];
        if (!def) continue;

        // Detecta o que mudou
        const labelMudou = c.label.trim() !== def.labelPadrao;
        const obrigMudou = c.obrigatorio !== def.obrigatorioPadrao;
        const ordemMudou = c.ordem !== def.ordemPadrao;

        const labelCustomFinal = labelMudou ? c.label.trim() : null;
        // visivel sempre salva (pra poder ocultar/mostrar)
        const obrigatorioFinal = obrigMudou ? c.obrigatorio : null;
        const ordemFinal = ordemMudou ? c.ordem : null;

        // Se nada diverge e está visível → não precisa criar config
        if (!labelMudou && !obrigMudou && !ordemMudou && c.visivel) {
          if (c.idConfig) {
            // Mas se já tinha config no banco, deleta pra limpar
            await supabase.from("proposta_campos_padrao_config")
              .delete()
              .eq("id", c.idConfig)
              .eq("workspace_id", workspace.username);
          }
          continue;
        }

        // Upsert
        const payload: any = {
          workspace_id: workspace.username,
          campo_slug: c.slug,
          label_custom: labelCustomFinal,
          obrigatorio: obrigatorioFinal,
          visivel: c.visivel,
          ordem: ordemFinal,
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

      // Gera slugs onde vazio
      const customsComSlug = customsNaLista.map(c => ({
        ...c,
        slug: (c.slug || labelToSlug(c.label)).slice(0, 50),
      }));

      // Detecta slugs duplicados (entre custom)
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
        // Conflito com slug de fixo
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
        if (existeId) {
          await supabase.from("proposta_campos_customizados").update({
            label: c.label,
            tipo: c.tipo,
            obrigatorio: c.obrigatorio,
            ordem: c.ordem,
            opcoes: c.tipo === "dropdown" ? (c.opcoes || []).filter(o => o.trim()) : null,
            ativo: true,
            placeholder: c.placeholder || null,
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

  // ═══════════════════════════════════════════════════════════════════
  // Sem permissão
  // ═══════════════════════════════════════════════════════════════════
  if (!podeEditar) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#dc262611", border: "1px solid #dc262633", borderRadius: 12, padding: 40, textAlign: "center", maxWidth: 480 }}>
          <p style={{ fontSize: 56, margin: "0 0 16px" }}>🔒</p>
          <h1 style={{ color: "#dc2626", fontSize: 18, fontWeight: "bold", margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 20px" }}>
            Só o dono ou administrador do workspace pode editar os campos da proposta.
          </p>
          <button onClick={() => router.back()} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: "bold", cursor: "pointer" }}>
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🛠️ Editor de Campos da Proposta</h1>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0", maxWidth: 820 }}>
            Configure quais campos aparecem no formulário de proposta deste workspace. Você pode editar os campos padrão (label, obrigatório, ocultar) e adicionar quantos campos personalizados quiser. Cada workspace tem sua própria configuração.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/crm/vendas")} style={{
            background: "#1f2937", color: "#9ca3af", border: "1px solid #374151",
            borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer"
          }}>
            ← Voltar para Vendas
          </button>
          <button onClick={salvar} disabled={salvando || loading} style={{
            background: salvando ? "#15803d" : "#16a34a", color: "white", border: "none",
            borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: "bold",
            cursor: salvando || loading ? "not-allowed" : "pointer"
          }}>
            {salvando ? "⏳ Salvando..." : "💾 Salvar Tudo"}
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "#9ca3af" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: "#3b82f622", color: "#3b82f6", padding: "2px 8px", borderRadius: 12, fontWeight: "bold" }}>🔒 Padrão</span>
          Campos fixos do sistema — editar label, obrigatório, visibilidade e ordem
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: "#a855f722", color: "#a855f7", padding: "2px 8px", borderRadius: 12, fontWeight: "bold" }}>✨ Personalizado</span>
          Campos extras criados pelo workspace — pode editar tudo + remover
        </span>
      </div>

      {/* AVISO LGPD */}
      <div style={{ background: "#f59e0b11", border: "1px solid #f59e0b44", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div>
          <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: "bold", margin: 0 }}>Atenção sobre dados pessoais (LGPD)</p>
          <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0", lineHeight: 1.5 }}>
            Você é responsável pelos dados coletados nesses campos. Não cadastre informações sensíveis sem consentimento expresso do titular.
          </p>
        </div>
      </div>

      {/* LISTA */}
      {loading ? (
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 48, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          ⏳ Carregando campos...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campos.map((campo, idx) => {
            const ehFixo = campo.origem === "fixo";
            const corBadge = ehFixo ? "#3b82f6" : "#a855f7";
            const bgBadge = ehFixo ? "#3b82f622" : "#a855f722";
            const labelBadge = ehFixo ? "🔒 Padrão" : "✨ Personalizado";
            const opacidade = !campo.visivel ? 0.45 : 1;

            return (
              <div key={`${campo.origem}-${campo.slug}-${idx}`} style={{
                background: "#111",
                borderRadius: 10,
                border: `1px solid ${campo.visivel ? "#1f2937" : "#374151"}`,
                padding: 14,
                opacity: opacidade,
                transition: "opacity 0.15s"
              }}>
                {/* Linha 1 — Badge + Label + Ações */}
                <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto auto", gap: 10, alignItems: "center" }}>
                  {/* Mover */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button onClick={() => mover(idx, -1)} disabled={idx === 0} title="Mover pra cima"
                      style={{ background: "#1f2937", color: idx === 0 ? "#374151" : "#9ca3af", border: "1px solid #374151", borderRadius: 4, width: 24, height: 18, fontSize: 10, cursor: idx === 0 ? "not-allowed" : "pointer", lineHeight: 1 }}>▲</button>
                    <button onClick={() => mover(idx, 1)} disabled={idx === campos.length - 1} title="Mover pra baixo"
                      style={{ background: "#1f2937", color: idx === campos.length - 1 ? "#374151" : "#9ca3af", border: "1px solid #374151", borderRadius: 4, width: 24, height: 18, fontSize: 10, cursor: idx === campos.length - 1 ? "not-allowed" : "pointer", lineHeight: 1 }}>▼</button>
                  </div>

                  {/* Badge */}
                  <span style={{ background: bgBadge, color: corBadge, padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: "bold", whiteSpace: "nowrap" }}>
                    {labelBadge}
                  </span>

                  {/* Label */}
                  <div>
                    <input
                      value={campo.label}
                      onChange={(e) => atualizar(idx, { label: e.target.value })}
                      placeholder={ehFixo ? campo.labelPadrao : 'Ex: "CEP do Imóvel", "Operadora atual"'}
                      style={{ ...inputStyle, fontSize: 13 }}
                    />
                    {ehFixo && campo.label !== campo.labelPadrao && (
                      <p style={{ color: "#6b7280", fontSize: 10, margin: "3px 0 0", fontStyle: "italic" }}>
                        Padrão: {campo.labelPadrao} · slug interno: <code style={{ color: "#9ca3af" }}>{campo.slug}</code>
                      </p>
                    )}
                  </div>

                  {/* Tipo (read-only pra fixos, editável pra custom) */}
                  {ehFixo ? (
                    <div style={{ minWidth: 160 }}>
                      <span style={{ background: "#1f2937", color: "#9ca3af", padding: "9px 12px", borderRadius: 8, fontSize: 12, display: "block", textAlign: "center" }}>
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
                      style={{ ...inputStyle, minWidth: 160 }}
                    >
                      {TIPOS_CUSTOM.map(t => (
                        <option key={t.valor} value={t.valor}>{t.icone} {t.label}</option>
                      ))}
                    </select>
                  )}

                  {/* Botão remover/ocultar */}
                  <button onClick={() => remover(idx)}
                    title={ehFixo ? "Ocultar campo (não pode ser deletado)" : "Remover campo"}
                    style={{ background: ehFixo ? "#f59e0b22" : "#dc262622", color: ehFixo ? "#f59e0b" : "#dc2626", border: `1px solid ${ehFixo ? "#f59e0b33" : "#dc262633"}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap" }}>
                    {ehFixo ? "👁️‍🗨️" : "🗑️"}
                  </button>
                </div>

                {/* Linha 2 — Toggles */}
                <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={campo.obrigatorio}
                      onChange={(e) => atualizar(idx, { obrigatorio: e.target.checked })}
                      style={{ accentColor: "#16a34a", width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ color: "#d1d5db", fontSize: 12 }}>⭐ Obrigatório</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={campo.visivel}
                      onChange={(e) => atualizar(idx, { visivel: e.target.checked })}
                      style={{ accentColor: campo.visivel ? "#16a34a" : "#6b7280", width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ color: campo.visivel ? "#d1d5db" : "#9ca3af", fontSize: 12 }}>
                      {campo.visivel ? "👁️ Visível" : "🙈 Oculto"}
                    </span>
                  </label>

                  {/* Placeholder — só pra texto/textarea/numero/moeda */}
                  {(campo.tipo === "texto" || campo.tipo === "textarea" || campo.tipo === "numero" || campo.tipo === "moeda") && !ehFixo && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>Placeholder:</span>
                      <input placeholder="Texto de exemplo (opcional)"
                        value={campo.placeholder || ""}
                        onChange={(e) => atualizar(idx, { placeholder: e.target.value })}
                        style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, flex: 1 }} />
                    </div>
                  )}
                </div>

                {/* Linha 3 — Opções (só pra dropdown custom) */}
                {campo.tipo === "dropdown" && !ehFixo && (
                  <div style={{ marginTop: 12, padding: 10, background: "#0a0a0a", borderRadius: 8, border: "1px solid #1f2937" }}>
                    <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 6px", fontWeight: "bold" }}>📋 Opções</p>
                    {(campo.opcoes || []).map((op, opIdx) => (
                      <div key={opIdx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input placeholder={`Opção ${opIdx + 1}`} value={op}
                          onChange={(e) => atualizarOpcao(idx, opIdx, e.target.value)}
                          style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }} />
                        <button onClick={() => removerOpcao(idx, opIdx)}
                          style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => adicionarOpcao(idx)}
                      style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold", marginTop: 2 }}>
                      ➕ Adicionar opção
                    </button>
                  </div>
                )}

                {/* Pra dropdown fixo — só lista (opções vêm do sistema, não pode mudar) */}
                {campo.tipo === "dropdown" && ehFixo && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#0a0a0a", borderRadius: 8, border: "1px solid #1f2937" }}>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontStyle: "italic" }}>
                      🔒 Opções fixas do sistema: {(campo.opcoes || []).join(" · ")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Botão adicionar custom */}
          <button onClick={adicionarCustom}
            style={{ background: "transparent", color: "#a855f7", border: "1px dashed #a855f7", borderRadius: 12, padding: "14px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold", marginTop: 4 }}>
            ➕ Adicionar campo personalizado
          </button>
        </div>
      )}
    </div>
  );
}