"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

// ═══════════════════════════════════════════════════════════════════════
// 🛠️ EDITOR DE CAMPOS DA PROPOSTA DE VENDA
// ═══════════════════════════════════════════════════════════════════════
// Permite que o dono ou admin do workspace adicione/remova/reordene campos
// customizados que aparecerão no formulário de Nova Proposta e no modal de
// edição/visualização da venda.
//
// Multi-tenant: tudo filtrado por workspace_id (workspace.username).
// Permissão: somente dono do workspace ou perfil "Administrador" acessam.

type TipoCampo = "texto" | "textarea" | "numero" | "moeda" | "data" | "dropdown" | "checkbox";

type CampoCustomizado = {
  id?: number;
  workspace_id?: string;
  slug: string;
  label: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  ordem: number;
  opcoes?: string[];
  ativo: boolean;
  placeholder?: string;
};

const TIPOS: { valor: TipoCampo; label: string; icone: string; descricao: string }[] = [
  { valor: "texto",    label: "Texto curto",  icone: "📝", descricao: "1 linha de texto" },
  { valor: "textarea", label: "Texto longo",  icone: "📄", descricao: "Várias linhas" },
  { valor: "numero",   label: "Número",       icone: "🔢", descricao: "Inteiro ou decimal" },
  { valor: "moeda",    label: "Valor (R$)",   icone: "💰", descricao: "Formato monetário" },
  { valor: "data",     label: "Data",         icone: "📅", descricao: "Seletor de data" },
  { valor: "dropdown", label: "Seleção",      icone: "📋", descricao: "Lista de opções" },
  { valor: "checkbox", label: "Sim / Não",    icone: "☑️", descricao: "Marcação simples" },
];

// Helper — gera slug a partir do label (sem acento, minúsculo, com _)
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

  const [campos, setCampos] = useState<CampoCustomizado[]>([]);
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

  const fetchCampos = async () => {
    if (!workspace?.username) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("proposta_campos_customizados")
        .select("*")
        .eq("workspace_id", workspace.username)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) {
        console.error("[EditorProposta] erro fetch:", error);
        setCampos([]);
      } else {
        // Garante que opcoes seja sempre array
        const tratados = (data || []).map((c: any) => ({
          ...c,
          opcoes: Array.isArray(c.opcoes) ? c.opcoes : (c.opcoes ? JSON.parse(c.opcoes) : []),
        }));
        setCampos(tratados);
      }
    } catch (e) {
      console.error("[EditorProposta] exceção:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampos(); }, [workspace]);

  const adicionar = () => {
    const novo: CampoCustomizado = {
      slug: "",
      label: "",
      tipo: "texto",
      obrigatorio: false,
      ordem: campos.length,
      opcoes: [],
      ativo: true,
    };
    setCampos([...campos, novo]);
  };

  const remover = async (idx: number) => {
    const c = campos[idx];
    const msg = c.id
      ? `Remover o campo "${c.label}"?\n\nOs valores já cadastrados em propostas existentes NÃO serão excluídos — só ficam invisíveis no formulário daqui pra frente.`
      : `Remover o campo "${c.label || "novo"}"?`;
    if (!confirm(msg)) return;

    if (c.id && workspace?.username) {
      // Soft delete: marca como inativo (preserva dados históricos das propostas)
      const { error } = await supabase
        .from("proposta_campos_customizados")
        .update({ ativo: false })
        .eq("id", c.id)
        .eq("workspace_id", workspace.username);
      if (error) {
        alert("Erro ao remover: " + error.message);
        return;
      }
    }
    setCampos(campos.filter((_, i) => i !== idx).map((c, i) => ({ ...c, ordem: i })));
  };

  const mover = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= campos.length) return;
    const novo = [...campos];
    [novo[idx], novo[target]] = [novo[target], novo[idx]];
    setCampos(novo.map((c, i) => ({ ...c, ordem: i })));
  };

  const atualizar = (idx: number, patch: Partial<CampoCustomizado>) => {
    setCampos(campos.map((c, i) => i === idx ? { ...c, ...patch } : c));
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

    // Valida tudo antes
    for (let i = 0; i < campos.length; i++) {
      const c = campos[i];
      if (!c.label.trim()) {
        alert(`Campo #${i + 1} não tem nome. Preencha ou remova.`);
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

    // Gera slugs automaticamente onde estiver vazio
    const camposComSlug = campos.map((c, i) => ({
      ...c,
      slug: (c.slug || labelToSlug(c.label)).slice(0, 50),
      ordem: i,
      workspace_id: workspace.username,
      opcoes: c.tipo === "dropdown" ? (c.opcoes || []).filter(o => o.trim()) : null,
    }));

    // Detecta slugs duplicados
    const slugSet = new Set<string>();
    for (const c of camposComSlug) {
      if (!c.slug) { alert(`Campo "${c.label}" não conseguiu gerar slug. Renomeie.`); return; }
      if (slugSet.has(c.slug)) {
        alert(`Campos com nome interno duplicado ("${c.slug}"). Renomeie um deles pra ficar único.`);
        return;
      }
      slugSet.add(c.slug);
    }

    setSalvando(true);
    try {
      // Busca os existentes do workspace (incluindo INATIVOS, pra reativar se o slug bater)
      const { data: existentes } = await supabase
        .from("proposta_campos_customizados")
        .select("id, slug, ativo")
        .eq("workspace_id", workspace.username);

      const slugsExistentes = new Map<string, number>(
        (existentes || []).map(x => [x.slug, x.id])
      );

      // Pra cada campo: update se slug já existe no banco, insert se não
      for (const c of camposComSlug) {
        const existeId = slugsExistentes.get(c.slug);
        if (existeId) {
          const { error } = await supabase.from("proposta_campos_customizados").update({
            label: c.label,
            tipo: c.tipo,
            obrigatorio: c.obrigatorio,
            ordem: c.ordem,
            opcoes: c.opcoes,
            ativo: true,
            placeholder: c.placeholder || null,
          }).eq("id", existeId).eq("workspace_id", workspace.username);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("proposta_campos_customizados").insert([{
            workspace_id: workspace.username,
            slug: c.slug,
            label: c.label,
            tipo: c.tipo,
            obrigatorio: c.obrigatorio,
            ordem: c.ordem,
            opcoes: c.opcoes,
            ativo: true,
            placeholder: c.placeholder || null,
          }]);
          if (error) throw error;
        }
      }

      alert("✅ Campos salvos com sucesso!");
      await fetchCampos();
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
    setSalvando(false);
  };

  // ═══════════════════════════════════════════════════════════════════
  // Sem permissão — tela de acesso restrito
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
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0", maxWidth: 720 }}>
            Adicione campos personalizados que vão aparecer no formulário de Nova Proposta e na visualização das vendas. Os valores ficam disponíveis pra cada proposta cadastrada.
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

      {/* AVISO LGPD */}
      <div style={{ background: "#f59e0b11", border: "1px solid #f59e0b44", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div>
          <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: "bold", margin: 0 }}>Atenção sobre dados pessoais (LGPD)</p>
          <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0", lineHeight: 1.5 }}>
            Você é responsável pelos dados coletados nesses campos. Não cadastre informações sensíveis sem consentimento expresso do titular (CPF, dados bancários, saúde, religião, biometria, etc).
          </p>
        </div>
      </div>

      {/* LISTA DE CAMPOS */}
      {loading ? (
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 48, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          ⏳ Carregando campos...
        </div>
      ) : campos.length === 0 ? (
        <div style={{ background: "#111", borderRadius: 12, border: "1px dashed #374151", padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 48, margin: "0 0 12px" }}>📋</p>
          <p style={{ color: "#9ca3af", fontSize: 14, fontWeight: "bold", margin: "0 0 4px" }}>Nenhum campo personalizado ainda</p>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 20px" }}>
            Os campos padrão (Nome, CPF, Endereço, Plano, etc) sempre vão aparecer.<br />
            Adicione campos extras conforme a necessidade do seu negócio.
          </p>
          <button onClick={adicionar} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            ➕ Adicionar Primeiro Campo
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campos.map((campo, idx) => (
            <div key={idx} style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 18 }}>

              {/* Linha 1 — Label + Tipo + Ações */}
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 220px auto", gap: 12, alignItems: "end" }}>

                {/* Ordem + botões de mover */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>#{idx + 1}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                      title="Mover pra cima"
                      style={{ background: "#1f2937", color: idx === 0 ? "#374151" : "#9ca3af", border: "1px solid #374151", borderRadius: 4, width: 28, height: 22, fontSize: 11, cursor: idx === 0 ? "not-allowed" : "pointer" }}>▲</button>
                    <button onClick={() => mover(idx, 1)} disabled={idx === campos.length - 1}
                      title="Mover pra baixo"
                      style={{ background: "#1f2937", color: idx === campos.length - 1 ? "#374151" : "#9ca3af", border: "1px solid #374151", borderRadius: 4, width: 28, height: 22, fontSize: 11, cursor: idx === campos.length - 1 ? "not-allowed" : "pointer" }}>▼</button>
                  </div>
                </div>

                {/* Label */}
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Nome do campo *
                  </label>
                  <input
                    placeholder='Ex: "CEP do imóvel", "Operadora atual", "Plano contratado"'
                    value={campo.label}
                    onChange={(e) => atualizar(idx, { label: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Tipo do campo
                  </label>
                  <select
                    value={campo.tipo}
                    onChange={(e) => atualizar(idx, { tipo: e.target.value as TipoCampo, opcoes: e.target.value === "dropdown" ? (campo.opcoes || [""]) : [] })}
                    style={inputStyle}
                  >
                    {TIPOS.map(t => (
                      <option key={t.valor} value={t.valor}>{t.icone} {t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Remover */}
                <button onClick={() => remover(idx)}
                  title="Remover campo"
                  style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "9px 12px", fontSize: 13, cursor: "pointer", height: 38 }}>
                  🗑️
                </button>
              </div>

              {/* Linha 2 — Configurações extras */}
              <div style={{ display: "flex", gap: 16, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={campo.obrigatorio}
                    onChange={(e) => atualizar(idx, { obrigatorio: e.target.checked })}
                    style={{ accentColor: "#16a34a", width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ color: "#d1d5db", fontSize: 12 }}>⭐ Campo obrigatório</span>
                </label>

                {(campo.tipo === "texto" || campo.tipo === "textarea" || campo.tipo === "numero" || campo.tipo === "moeda") && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>Placeholder:</span>
                    <input
                      placeholder="Texto de exemplo (opcional)"
                      value={campo.placeholder || ""}
                      onChange={(e) => atualizar(idx, { placeholder: e.target.value })}
                      style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, flex: 1 }}
                    />
                  </div>
                )}
              </div>

              {/* Linha 3 — Opções (só pra dropdown) */}
              {campo.tipo === "dropdown" && (
                <div style={{ marginTop: 14, padding: 12, background: "#0a0a0a", borderRadius: 8, border: "1px solid #1f2937" }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 8px", fontWeight: "bold" }}>
                    📋 Opções do dropdown
                  </p>
                  {(campo.opcoes || []).map((op, opIdx) => (
                    <div key={opIdx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input
                        placeholder={`Opção ${opIdx + 1}`}
                        value={op}
                        onChange={(e) => atualizarOpcao(idx, opIdx, e.target.value)}
                        style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }}
                      />
                      <button onClick={() => removerOpcao(idx, opIdx)}
                        style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ✕
                      </button>
                    </div>
                  ))}
                  <button onClick={() => adicionarOpcao(idx)}
                    style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold", marginTop: 4 }}>
                    ➕ Adicionar opção
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Botão adicionar (após a lista) */}
          <button onClick={adicionar}
            style={{ background: "transparent", color: "#16a34a", border: "1px dashed #16a34a", borderRadius: 12, padding: "14px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            ➕ Adicionar outro campo
          </button>
        </div>
      )}

      {/* PREVIEW */}
      {campos.length > 0 && (
        <div style={{ background: "#0a0a0a", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
          <h3 style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>👁️ Preview — como vai aparecer no formulário da Proposta</h3>
          <div style={{ background: "#111", borderRadius: 10, padding: 18, border: "1px solid #1f2937" }}>
            <p style={{ color: "#16a34a", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 14px", fontWeight: "bold", borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>
              ✨ Campos Personalizados
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {campos.map((c, i) => (
                <div key={i}>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "block" }}>
                    {c.label || "(sem nome)"} {c.obrigatorio && <span style={{ color: "#dc2626" }}>*</span>}
                  </label>
                  {c.tipo === "texto" && <input placeholder={c.placeholder || ""} disabled style={{ ...inputStyle, opacity: 0.7 }} />}
                  {c.tipo === "textarea" && <textarea placeholder={c.placeholder || ""} disabled rows={2} style={{ ...inputStyle, opacity: 0.7, resize: "none" } as any} />}
                  {c.tipo === "numero" && <input type="number" placeholder={c.placeholder || "0"} disabled style={{ ...inputStyle, opacity: 0.7 }} />}
                  {c.tipo === "moeda" && <input placeholder={c.placeholder || "R$ 0,00"} disabled style={{ ...inputStyle, opacity: 0.7 }} />}
                  {c.tipo === "data" && <input type="date" disabled style={{ ...inputStyle, opacity: 0.7 }} />}
                  {c.tipo === "dropdown" && (
                    <select disabled style={{ ...inputStyle, opacity: 0.7 }}>
                      <option>Selecione...</option>
                      {(c.opcoes || []).map((op, i) => <option key={i}>{op}</option>)}
                    </select>
                  )}
                  {c.tipo === "checkbox" && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#1f2937", borderRadius: 8, border: "1px solid #374151", opacity: 0.7 }}>
                      <input type="checkbox" disabled style={{ accentColor: "#16a34a" }} />
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>Sim</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}