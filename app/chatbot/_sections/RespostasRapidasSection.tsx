"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

type RespostaRapida = {
  id?: number;
  atalho: string;
  mensagem: string;
  workspace_id?: string;
};

export function RespostasRapidasSection() {
  const { workspace, wsId } = useWorkspace();
  const [respostas, setRespostas] = useState<RespostaRapida[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ atalho: "", mensagem: "" });
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const IS = { width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", color: "#1f2937", fontSize: 13, boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  // 🔒 MULTI-TENANT FIX: padronizar a chave de workspace usada em TODAS as queries
  // (fetch, insert, delete). Antes, salvava com `wsId` e buscava com `workspace.username
  // || workspace.id.toString()` — bugado pra workspaces com username diferente do id.
  // Agora a fórmula é única e consistente.
  const wsKey = (): string | null => {
    return workspace?.username || workspace?.id?.toString() || wsId || null;
  };

  const fetchRespostas = async () => {
    const ws = wsKey();
    if (!ws) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("respostas_rapidas")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("[RespostasRapidas] erro no fetch:", error.message);
        setRespostas([]);
      } else {
        setRespostas(data || []);
      }
    } catch (e) {
      console.error("[RespostasRapidas] exceção no fetch:", e);
      setRespostas([]);
    }
    setCarregando(false);
  };

  useEffect(() => { fetchRespostas(); }, [workspace, wsId]);

  const salvar = async () => {
    if (!form.atalho.trim() || !form.mensagem.trim()) { alert("Preencha atalho e mensagem!"); return; }
    if (!form.atalho.startsWith("/")) { alert("O atalho deve começar com /"); return; }
    const ws = wsKey();
    if (!ws) { alert("Workspace não carregado. Recarregue a página."); return; }

    setSalvando(true);
    try {
      const { error } = await supabase.from("respostas_rapidas").insert([{
        atalho: form.atalho.trim(),
        mensagem: form.mensagem.trim(),
        workspace_id: ws,
      }]);
      if (error) {
        alert("Erro ao salvar: " + error.message);
      } else {
        await fetchRespostas();
        setForm({ atalho: "", mensagem: "" });
        setShowForm(false);
      }
    } catch (e: any) {
      alert("Erro ao salvar: " + (e?.message || "desconhecido"));
    }
    setSalvando(false);
  };

  const remover = async (r: RespostaRapida) => {
    if (!confirm(`Remover atalho ${r.atalho}?`)) return;
    if (!r.id) {
      setRespostas(respostas.filter(x => x.atalho !== r.atalho));
      return;
    }
    const ws = wsKey();
    if (!ws) { alert("Workspace não carregado. Recarregue a página."); return; }

    // 🔒 MULTI-TENANT: defesa em profundidade — só deleta se for deste workspace.
    const { error } = await supabase.from("respostas_rapidas").delete()
      .eq("id", r.id)
      .eq("workspace_id", ws);
    if (error) {
      alert("Erro ao remover: " + error.message);
      return;
    }
    await fetchRespostas();
  };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#f8fafc", minHeight: "100vh" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(245,158,11,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>⚡</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Respostas Rápidas</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "2px 0 0" }}>
              Digite <code style={{ background: "#f3f4f6", color: "#3b82f6", padding: "1px 6px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>/</code> no chat para usar
            </p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}>
          + Nova Resposta
        </button>
      </div>

      {/* ═══ FORM ═══ */}
      {showForm && (
        <div style={{ ...cardStyle, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#3b82f615", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>➕</div>
            <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Nova Resposta Rápida</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}>
            <div>
              <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Atalho *</label>
              <input placeholder="/oi" value={form.atalho} onChange={e => setForm({ ...form, atalho: e.target.value })} style={{ ...IS, fontFamily: "monospace", fontWeight: 600 }} />
            </div>
            <div>
              <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Mensagem *</label>
              <input placeholder="Olá! Como posso te ajudar?" value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} style={IS} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
            <button onClick={() => { setShowForm(false); setForm({ atalho: "", mensagem: "" }); }}
              style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 22px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}>
              {salvando ? "⏳ Salvando..." : "💾 Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ LISTA ═══ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {carregando ? (
          <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
            <p style={{ color: "#6b7280", fontSize: 13 }}>⏳ Carregando...</p>
          </div>
        ) : respostas.length === 0 ? (
          <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40, margin: "0 auto 16px",
              boxShadow: "0 12px 24px rgba(245,158,11,0.25)",
            }}>
              <span style={{ filter: "saturate(0) brightness(2)" }}>⚡</span>
            </div>
            <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Nenhuma resposta rápida cadastrada ainda</h3>
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Clique em <b>+ Nova Resposta</b> pra criar a primeira</p>
          </div>
        ) : respostas.map((r, i) => (
          <div key={r.id || i}
            style={{
              ...cardStyle,
              padding: "14px 20px",
              display: "flex", alignItems: "center", gap: 16,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <span style={{
              background: "#3b82f615",
              color: "#3b82f6",
              border: "1px solid #3b82f630",
              fontSize: 12, padding: "5px 12px",
              borderRadius: 8, fontWeight: 700,
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}>
              {r.atalho}
            </span>
            <p style={{ color: "#4b5563", fontSize: 13, margin: 0, flex: 1 }}>{r.mensagem}</p>
            <button onClick={() => remover(r)}
              style={{
                background: "#fef2f2", color: "#dc2626",
                border: "1px solid #fecaca", borderRadius: 8,
                padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#fee2e2"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#fef2f2"}>
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}