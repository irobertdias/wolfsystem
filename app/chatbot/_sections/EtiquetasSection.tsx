"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

type Etiqueta = {
  id: number;
  nome: string;
  cor: string;
  icone: string;
  workspace_id: string;
  created_at?: string;
};

// Paleta de cores pré-definidas
const CORES_PADRAO = [
  "#dc2626", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#16a34a", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#ec4899", "#f43f5e", "#6b7280",
];

// Emojis mais comuns pra etiquetas
const EMOJIS_COMUNS = [
  "🏷️", "🔥", "⭐", "💰", "🎯", "📞", "✅", "❌",
  "⚠️", "🆕", "🔔", "💎", "🚀", "📌", "🔴", "🟢",
  "🟡", "🔵", "🟣", "⚡", "💼", "🎁", "🏆", "❤️",
];

export function EtiquetasSection() {
  const { wsId, wsPronto } = useWorkspace();
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Etiqueta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const [form, setForm] = useState({ nome: "", cor: "#3b82f6", icone: "🏷️" });

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };

  // ═══ Carrega etiquetas ═══
  const fetchEtiquetas = async (ws: string) => {
    setLoading(true);
    const { data } = await supabase.from("etiquetas")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: true });
    setEtiquetas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!wsPronto || !wsId) return;
    fetchEtiquetas(wsId);
    const ch = supabase.channel("etiquetas_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "etiquetas", filter: `workspace_id=eq.${wsId}` }, () => fetchEtiquetas(wsId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId, wsPronto]);

  // ═══ Abrir form novo ═══
  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: "", cor: "#3b82f6", icone: "🏷️" });
    setShowForm(true);
  };

  // ═══ Abrir form editar ═══
  const abrirEditar = (e: Etiqueta) => {
    setEditando(e);
    setForm({ nome: e.nome, cor: e.cor, icone: e.icone || "🏷️" });
    setShowForm(true);
  };

  // ═══ Cancelar ═══
  const cancelar = () => {
    setShowForm(false);
    setEditando(null);
    setForm({ nome: "", cor: "#3b82f6", icone: "🏷️" });
  };

  // ═══ Salvar (criar ou atualizar) ═══
  const salvar = async () => {
    if (!form.nome.trim()) { alert("Digite o nome da etiqueta!"); return; }
    if (!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    setSalvando(true);
    try {
      if (editando) {
        // 🔒 MULTI-TENANT: defesa em profundidade — só edita etiqueta se for deste workspace.
        // Antes, se um user descobrisse o id de uma etiqueta de outro workspace, podia editar.
        const { error } = await supabase.from("etiquetas")
          .update({ nome: form.nome.trim(), cor: form.cor, icone: form.icone })
          .eq("id", editando.id)
          .eq("workspace_id", wsId);
        if (error) { alert("Erro ao atualizar: " + error.message); setSalvando(false); return; }
      } else {
        const { error } = await supabase.from("etiquetas").insert([{
          nome: form.nome.trim(),
          cor: form.cor,
          icone: form.icone,
          workspace_id: wsId,
        }]);
        if (error) { alert("Erro ao criar: " + error.message); setSalvando(false); return; }
      }
      await fetchEtiquetas(wsId);
      cancelar();
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvando(false);
  };

  // ═══ Excluir ═══
  const excluir = async (e: Etiqueta) => {
    if (!confirm(`Excluir a etiqueta "${e.nome}"?\n\nEla será removida de todos os atendimentos que a usavam.`)) return;
    if (!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    try {
      // 🔒 MULTI-TENANT: confere que a etiqueta pertence a este workspace ANTES de qualquer delete.
      // e.workspace_id veio do banco filtrado, mas confirmamos pra ficar 100% blindado contra
      // manipulação via DevTools.
      if (e.workspace_id && e.workspace_id !== wsId) {
        alert("Erro: etiqueta não pertence a este workspace.");
        return;
      }
      // Primeiro remove das tabelas de associação. atendimento_etiquetas filtra por etiqueta_id
      // (que é único globalmente), então não precisa de workspace_id aqui.
      await supabase.from("atendimento_etiquetas").delete().eq("etiqueta_id", e.id);
      // Depois apaga a etiqueta — defesa em profundidade com workspace_id no WHERE.
      const { error } = await supabase.from("etiquetas").delete()
        .eq("id", e.id)
        .eq("workspace_id", wsId);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await fetchEtiquetas(wsId);
    } catch (err: any) { alert("Erro: " + err.message); }
  };

  const etiquetasFiltradas = etiquetas.filter(e =>
    !busca || e.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🏷️ Etiquetas</h1>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{etiquetas.length} etiqueta(s) cadastrada(s)</p>
        </div>
        <button onClick={abrirNovo}
          style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
          + Nova Etiqueta
        </button>
      </div>

      {/* BUSCA */}
      {etiquetas.length > 5 && (
        <input placeholder="🔍 Buscar etiqueta..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...IS, maxWidth: 400, padding: "8px 14px", fontSize: 13 }} />
      )}

      {/* FORM NOVA/EDITAR */}
      {showForm && (
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>
              {editando ? "✏️ Editar Etiqueta" : "➕ Nova Etiqueta"}
            </h2>
            <button onClick={cancelar} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>

          {/* PRÉVIA DA ETIQUETA */}
          <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #374151" }}>
            <div style={{ background: form.cor + "22", border: `2px solid ${form.cor}`, borderRadius: 20, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{form.icone}</span>
              <span style={{ color: form.cor, fontSize: 13, fontWeight: "bold" }}>{form.nome || "Prévia da etiqueta"}</span>
            </div>
          </div>

          {/* NOME */}
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nome *</label>
            <input placeholder="Ex: Lead Quente" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
              style={IS} maxLength={40} />
          </div>

          {/* ÍCONE (EMOJI) */}
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Ícone (emoji)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input value={form.icone} onChange={e => setForm({ ...form, icone: e.target.value })}
                style={{ ...IS, width: 60, textAlign: "center", fontSize: 20 }} maxLength={2} />
              <span style={{ color: "#6b7280", fontSize: 11 }}>Digite um emoji ou escolha abaixo</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
              {EMOJIS_COMUNS.map(emoji => (
                <button key={emoji} onClick={() => setForm({ ...form, icone: emoji })}
                  style={{ background: form.icone === emoji ? "#3b82f622" : "#1f2937", border: `1px solid ${form.icone === emoji ? "#3b82f6" : "#374151"}`, borderRadius: 6, padding: "6px 0", fontSize: 16, cursor: "pointer" }}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* COR */}
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Cor</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, marginBottom: 8 }}>
              {CORES_PADRAO.map(cor => (
                <button key={cor} onClick={() => setForm({ ...form, cor })}
                  style={{ background: cor, border: form.cor === cor ? "3px solid white" : "2px solid #374151", borderRadius: 8, height: 32, cursor: "pointer" }}
                  title={cor} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                style={{ width: 40, height: 32, borderRadius: 6, border: "1px solid #374151", cursor: "pointer", background: "#1f2937" }} />
              <input value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                style={{ ...IS, maxWidth: 120, fontFamily: "monospace", padding: "6px 10px", fontSize: 12 }} maxLength={7} />
              <span style={{ color: "#6b7280", fontSize: 10 }}>Código hex ou picker</span>
            </div>
          </div>

          {/* BOTÕES */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #1f2937", paddingTop: 14 }}>
            <button onClick={cancelar} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{ background: salvando ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
              {salvando ? "Salvando..." : editando ? "💾 Atualizar" : "➕ Criar Etiqueta"}
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {loading ? (
        <p style={{ color: "#6b7280", fontSize: 13 }}>Carregando...</p>
      ) : etiquetasFiltradas.length === 0 ? (
        <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
          <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>🏷️</p>
          <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px" }}>
            {busca ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta cadastrada ainda"}
          </h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px" }}>
            {busca ? "Tente buscar por outro termo" : "Crie etiquetas pra organizar seus atendimentos"}
          </p>
          {!busca && (
            <button onClick={abrirNovo} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
              + Nova Etiqueta
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {etiquetasFiltradas.map(e => (
            <div key={e.id}
              style={{ background: "#111", borderRadius: 10, padding: "12px 16px", border: `2px solid ${e.cor}44`, display: "flex", alignItems: "center", gap: 12, minWidth: 200 }}>
              <div style={{ background: e.cor + "22", borderRadius: 8, padding: "4px 8px", fontSize: 18 }}>
                {e.icone || "🏷️"}
              </div>
              <span style={{ color: "white", fontSize: 13, fontWeight: "bold", flex: 1 }}>{e.nome}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => abrirEditar(e)} title="Editar"
                  style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                <button onClick={() => excluir(e)} title="Excluir"
                  style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}