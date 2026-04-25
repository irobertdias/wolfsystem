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

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  const fetchRespostas = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("respostas_rapidas").select("*")
      .eq("workspace_id", workspace.username || workspace.id.toString())
      .order("created_at", { ascending: true });
    if (data) setRespostas(data);
    else {
      // Se tabela não existe ainda, usa padrão
      setRespostas([
        { atalho: "/oi", mensagem: "Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?" },
        { atalho: "/planos", mensagem: "Temos planos a partir de R$ 89,90. Posso te passar mais detalhes!" },
        { atalho: "/aguarda", mensagem: "Por favor, aguarde um momento que já vou te atender!" },
        { atalho: "/encerrar", mensagem: "Obrigado pelo contato! Tenha um ótimo dia!" },
      ]);
    }
  };

  useEffect(() => { fetchRespostas(); }, [workspace]);

  const salvar = async () => {
    if (!form.atalho.trim() || !form.mensagem.trim()) { alert("Preencha atalho e mensagem!"); return; }
    if (!form.atalho.startsWith("/")) { alert("O atalho deve começar com /"); return; }
    setSalvando(true);
    try {
      await supabase.from("respostas_rapidas").insert([{ atalho: form.atalho.trim(), mensagem: form.mensagem.trim(), workspace_id: wsId }]);
      await fetchRespostas();
      setForm({ atalho: "", mensagem: "" });
      setShowForm(false);
    } catch (e: any) { alert("Erro ao salvar: " + e.message); }
    setSalvando(false);
  };

  const remover = async (r: RespostaRapida) => {
    if (!confirm(`Remover atalho ${r.atalho}?`)) return;
    if (r.id) {
      // 🔒 MULTI-TENANT: defesa em profundidade — só deleta se for deste workspace.
      // Antes, qualquer um com o id da resposta podia deletar de outro workspace via DevTools.
      const wsAlvo = workspace?.username || workspace?.id?.toString() || wsId;
      if (!wsAlvo) { alert("Workspace não carregado. Recarregue a página."); return; }
      await supabase.from("respostas_rapidas").delete()
        .eq("id", r.id)
        .eq("workspace_id", wsAlvo);
      await fetchRespostas();
    } else {
      setRespostas(respostas.filter(x => x.atalho !== r.atalho));
    }
  };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>⚡ Respostas Rápidas</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Digite / no chat para usar</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Resposta</button>
      </div>

      {showForm && (
        <div style={{ background: "#111", borderRadius: 12, padding: 20, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>➕ Nova Resposta Rápida</p>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}>
            <div>
              <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Atalho *</label>
              <input placeholder="/oi" value={form.atalho} onChange={e => setForm({ ...form, atalho: e.target.value })} style={IS} />
            </div>
            <div>
              <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Mensagem *</label>
              <input placeholder="Olá! Como posso te ajudar?" value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} style={IS} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowForm(false); setForm({ atalho: "", mensagem: "" }); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{salvando ? "⏳ Salvando..." : "💾 Salvar"}</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {respostas.length === 0 ? (
          <div style={{ background: "#111", borderRadius: 12, padding: 32, textAlign: "center", border: "1px solid #1f2937" }}>
            <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhuma resposta rápida cadastrada ainda</p>
          </div>
        ) : respostas.map((r, i) => (
          <div key={i} style={{ background: "#111", borderRadius: 10, padding: "16px 20px", border: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "4px 12px", borderRadius: 8, fontWeight: "bold", whiteSpace: "nowrap" }}>{r.atalho}</span>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0, flex: 1 }}>{r.mensagem}</p>
            <button onClick={() => remover(r)} style={{ background: "none", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}