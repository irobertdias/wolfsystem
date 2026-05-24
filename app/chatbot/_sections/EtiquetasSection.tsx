"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

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
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Etiqueta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const [form, setForm] = useState({ nome: "", cor: "#3b82f6", icone: "🏷️" });

  const IS = { width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", color: "#1f2937", fontSize: 14, boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

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

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: "", cor: "#3b82f6", icone: "🏷️" });
    setShowForm(true);
  };

  const abrirEditar = (e: Etiqueta) => {
    setEditando(e);
    setForm({ nome: e.nome, cor: e.cor, icone: e.icone || "🏷️" });
    setShowForm(true);
  };

  const cancelar = () => {
    setShowForm(false);
    setEditando(null);
    setForm({ nome: "", cor: "#3b82f6", icone: "🏷️" });
  };

  const salvar = async () => {
    if (!isDono && !isSuperAdmin && !permissoes.etiquetas) {
      alert("❌ Você não tem permissão para gerenciar etiquetas.");
      return;
    }
    if (!form.nome.trim()) { alert("Digite o nome da etiqueta!"); return; }
    if (!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    setSalvando(true);
    try {
      if (editando) {
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

  const excluir = async (e: Etiqueta) => {
    if (!isDono && !isSuperAdmin && !permissoes.etiquetas) {
      alert("❌ Você não tem permissão para excluir etiquetas.");
      return;
    }
    if (!confirm(`Excluir a etiqueta "${e.nome}"?\n\nEla será removida de todos os atendimentos que a usavam.`)) return;
    if (!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    try {
      if (e.workspace_id && e.workspace_id !== wsId) {
        alert("Erro: etiqueta não pertence a este workspace.");
        return;
      }
      await supabase.from("atendimento_etiquetas").delete().eq("etiqueta_id", e.id);
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
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#f8fafc", minHeight: "100vh" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(59, 130, 246, 0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🏷️</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Etiquetas</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>{etiquetas.length} etiqueta(s) cadastrada(s)</p>
          </div>
        </div>
        <button onClick={abrirNovo}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}>
          + Nova Etiqueta
        </button>
      </div>

      {/* ═══ BUSCA ═══ */}
      {etiquetas.length > 5 && (
        <input placeholder="🔍 Buscar etiqueta..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...IS, maxWidth: 400, padding: "10px 16px", fontSize: 13, borderRadius: 20 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f680"; e.currentTarget.style.boxShadow = "0 0 0 3px #3b82f620"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
        />
      )}

      {/* ═══ FORM NOVA/EDITAR ═══ */}
      {showForm && (
        <div style={{ ...cardStyle, padding: 24, display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: 0 }}>
              {editando ? "✏️ Editar Etiqueta" : "➕ Nova Etiqueta"}
            </h2>
            <button onClick={cancelar} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* PRÉVIA DA ETIQUETA */}
          <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #d1d5db" }}>
            <div style={{ background: form.cor + "15", border: `2px solid ${form.cor}`, borderRadius: 20, padding: "8px 18px", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{form.icone}</span>
              <span style={{ color: form.cor, fontSize: 13, fontWeight: 700 }}>{form.nome || "Prévia da etiqueta"}</span>
            </div>
          </div>

          {/* NOME */}
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nome *</label>
            <input placeholder="Ex: Lead Quente" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
              style={IS} maxLength={40} />
          </div>

          {/* ÍCONE (EMOJI) */}
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Ícone (emoji)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input value={form.icone} onChange={e => setForm({ ...form, icone: e.target.value })}
                style={{ ...IS, width: 60, textAlign: "center", fontSize: 20 }} maxLength={2} />
              <span style={{ color: "#9ca3af", fontSize: 11 }}>Digite um emoji ou escolha abaixo</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
              {EMOJIS_COMUNS.map(emoji => (
                <button key={emoji} onClick={() => setForm({ ...form, icone: emoji })}
                  style={{
                    background: form.icone === emoji ? "#3b82f615" : "#f9fafb",
                    border: `1px solid ${form.icone === emoji ? "#3b82f6" : "#e5e7eb"}`,
                    borderRadius: 8, padding: "6px 0", fontSize: 16, cursor: "pointer",
                    transition: "all 0.1s",
                  }}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* COR */}
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Cor</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, marginBottom: 10 }}>
              {CORES_PADRAO.map(cor => (
                <button key={cor} onClick={() => setForm({ ...form, cor })}
                  style={{
                    background: cor,
                    border: form.cor === cor ? "3px solid #1f2937" : "2px solid #e5e7eb",
                    borderRadius: 8, height: 34, cursor: "pointer",
                    boxShadow: form.cor === cor ? `0 0 0 2px white, 0 0 0 4px ${cor}` : "0 1px 2px rgba(0,0,0,0.1)",
                    transition: "all 0.15s",
                  }}
                  title={cor} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                style={{ width: 40, height: 34, borderRadius: 8, border: "1px solid #e5e7eb", cursor: "pointer", background: "#ffffff" }} />
              <input value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                style={{ ...IS, maxWidth: 120, fontFamily: "monospace", padding: "6px 10px", fontSize: 12 }} maxLength={7} />
              <span style={{ color: "#9ca3af", fontSize: 10 }}>Código hex ou picker</span>
            </div>
          </div>

          {/* BOTÕES */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
            <button onClick={cancelar} style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}>
              {salvando ? "Salvando..." : editando ? "💾 Atualizar" : "➕ Criar Etiqueta"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ LISTA ═══ */}
      {loading ? (
        <p style={{ color: "#6b7280", fontSize: 13 }}>Carregando...</p>
      ) : etiquetasFiltradas.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(59,130,246,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🏷️</span>
          </div>
          <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
            {busca ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta cadastrada ainda"}
          </h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px" }}>
            {busca ? "Tente buscar por outro termo" : "Crie etiquetas pra organizar seus atendimentos"}
          </p>
          {!busca && (
            <button onClick={abrirNovo} style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "12px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700,
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
            }}>
              + Nova Etiqueta
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {etiquetasFiltradas.map(e => (
            <div key={e.id}
              style={{
                ...cardStyle,
                padding: "14px 18px",
                borderLeft: `4px solid ${e.cor}`,
                display: "flex", alignItems: "center", gap: 12, minWidth: 220,
                transition: "all 0.15s",
              }}
              onMouseEnter={(ev) => { ev.currentTarget.style.boxShadow = `0 4px 12px ${e.cor}20`; ev.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; ev.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{
                background: e.cor + "15", borderRadius: 10, width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                {e.icone || "🏷️"}
              </div>
              <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, flex: 1 }}>{e.nome}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => abrirEditar(e)} title="Editar"
                  style={{
                    background: "#3b82f610", color: "#3b82f6",
                    border: "1px solid #3b82f630", borderRadius: 8,
                    padding: "5px 9px", fontSize: 11, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = "#3b82f620"}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "#3b82f610"}
                >✏️</button>
                <button onClick={() => excluir(e)} title="Excluir"
                  style={{
                    background: "#fef2f2", color: "#dc2626",
                    border: "1px solid #fecaca", borderRadius: 8,
                    padding: "5px 9px", fontSize: 11, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = "#fee2e2"}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "#fef2f2"}
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}