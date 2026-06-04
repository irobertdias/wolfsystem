"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🏷️ Plano de Contas (fin_categorias) — categorias de receita/despesa
// ═══════════════════════════════════════════════════════════════════════
const COR = "#d97706";

type Categoria = {
  id: string;
  workspace_id: string;
  nome: string;
  tipo: "receita" | "despesa";
  codigo: string | null;
  pai_id: string | null;
  cor: string | null;
  ativo: boolean;
};

const PALETA = ["#16a34a", "#dc2626", "#2563eb", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#64748b"];

const vazio = {
  nome: "",
  tipo: "despesa" as "receita" | "despesa",
  codigo: "",
  pai_id: "",
  cor: PALETA[3],
  ativo: true,
};

export default function PlanoContas() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [form, setForm] = useState({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase
      .from("fin_categorias")
      .select("*")
      .eq("workspace_id", wsId)
      .order("tipo", { ascending: true })
      .order("codigo", { ascending: true })
      .order("nome", { ascending: true });
    setLista((data as Categoria[]) || []);
    setCarregando(false);
  }, [wsId]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo(tipo: "receita" | "despesa") {
    setEditando(null);
    setForm({ ...vazio, tipo, cor: tipo === "receita" ? PALETA[0] : PALETA[1] });
    setModal(true);
  }

  function abrirEdicao(c: Categoria) {
    setEditando(c);
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      codigo: c.codigo || "",
      pai_id: c.pai_id || "",
      cor: c.cor || PALETA[3],
      ativo: c.ativo,
    });
    setModal(true);
  }

  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      codigo: form.codigo.trim() || null,
      pai_id: form.pai_id || null,
      cor: form.cor,
      ativo: form.ativo,
    };
    if (editando) {
      await supabase.from("fin_categorias").update(payload).eq("id", editando.id).eq("workspace_id", wsId);
    } else {
      await supabase.from("fin_categorias").insert({ ...payload, workspace_id: wsId });
    }
    setSalvando(false);
    setModal(false);
    carregar();
  }

  async function remover(c: Categoria) {
    if (!wsId) return;
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
    await supabase.from("fin_categorias").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }

  const filtrada = lista.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase().trim()));
  const receitas = filtrada.filter((c) => c.tipo === "receita");
  const despesas = filtrada.filter((c) => c.tipo === "despesa");
  const possiveisPais = lista.filter((c) => c.tipo === form.tipo && (!editando || c.id !== editando.id));

  const inputStyle: any = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

  function Secao({ titulo, itens, tipo }: { titulo: string; itens: Categoria[]; tipo: "receita" | "despesa" }) {
    const cor = tipo === "receita" ? "#16a34a" : "#dc2626";
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: cor, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {titulo} <span style={{ color: "#9ca3af", fontWeight: 600 }}>({itens.length})</span>
          </h3>
          <button
            onClick={() => abrirNovo(tipo)}
            style={{ background: `${cor}14`, color: cor, border: `1px solid ${cor}55`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            + Nova
          </button>
        </div>
        {itens.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 4px", fontStyle: "italic" }}>Nenhuma categoria.</p>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            {itens.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                  borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                  opacity: c.ativo ? 1 : 0.5,
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.cor || "#9ca3af", flexShrink: 0 }} />
                {c.codigo && <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace", minWidth: 40 }}>{c.codigo}</span>}
                <span style={{ flex: 1, fontSize: 14, color: "#111827", fontWeight: c.pai_id ? 400 : 600, paddingLeft: c.pai_id ? 16 : 0 }}>
                  {c.pai_id ? "↳ " : ""}{c.nome}
                </span>
                {!c.ativo && <span style={{ fontSize: 11, color: "#9ca3af" }}>inativo</span>}
                <button onClick={() => abrirEdicao(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }} title="Editar">✏️</button>
                <button onClick={() => remover(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }} title="Excluir">🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 26 }}>🏷️</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Plano de Contas</h1>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>
        Categorias de receita e despesa usadas pra classificar os lançamentos.
      </p>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="🔍 Buscar categoria..."
        style={{ ...inputStyle, maxWidth: 320, marginBottom: 20 }}
      />

      {carregando ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p>
      ) : (
        <>
          <Secao titulo="Receitas" itens={receitas} tipo="receita" />
          <Secao titulo="Despesas" itens={despesas} tipo="despesa" />
        </>
      )}

      {/* Modal */}
      {modal && (
        <div
          onClick={() => setModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>
              {editando ? "Editar categoria" : "Nova categoria"}
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nome *</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} placeholder="Ex: Vendas de produtos" />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as "receita" | "despesa", pai_id: "" })} style={inputStyle}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label style={labelStyle}>Código</label>
                <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} style={inputStyle} placeholder="1.1" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Categoria pai (opcional)</label>
              <select value={form.pai_id} onChange={(e) => setForm({ ...form, pai_id: e.target.value })} style={inputStyle}>
                <option value="">— Nenhuma (categoria principal) —</option>
                {possiveisPais.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Cor</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PALETA.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, cor: c })}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: form.cor === c ? "3px solid #111827" : "2px solid #e5e7eb" }}
                  />
                ))}
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativa
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || !form.nome.trim()}
                style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: salvando ? "default" : "pointer", opacity: salvando || !form.nome.trim() ? 0.6 : 1 }}
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}