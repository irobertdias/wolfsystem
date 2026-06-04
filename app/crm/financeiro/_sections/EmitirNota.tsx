"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🧾 Emitir NF-e — registro de notas emitidas (+ slot pra emissão ao-vivo)
const COR = "#d97706";
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

export default function EmitirNota() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [contatos, setContatos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [provedor, setProvedor] = useState("");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<any>({ destinatario_nome: "", numero: "", valor_total: "", emissao: hoje(), gerarReceber: true });

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [n, c, cfg] = await Promise.all([
      supabase.from("fin_notas").select("*").eq("workspace_id", wsId).eq("tipo", "nfe").eq("direcao", "emitida").order("emissao", { ascending: false }),
      supabase.from("fin_contatos").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle(),
    ]);
    setLista((n.data as any[]) || []);
    setContatos((c.data as any[]) || []);
    setProvedor((cfg.data?.config?.nfe_provedor) || "");
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrir() { setForm({ destinatario_nome: "", numero: "", valor_total: "", emissao: hoje(), gerarReceber: true }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.destinatario_nome.trim()) return;
    setSalvando(true);
    const valor = parseFloat(String(form.valor_total).replace(",", ".")) || 0;
    let lancamento_id: string | null = null;
    if (form.gerarReceber) {
      const { data } = await supabase.from("fin_lancamentos").insert({
        workspace_id: wsId, tipo: "receita", descricao: `NF-e ${form.numero || ""} ${form.destinatario_nome}`.trim(),
        valor, vencimento: form.emissao, status: "pendente",
      }).select("id").maybeSingle();
      lancamento_id = data?.id || null;
    }
    await supabase.from("fin_notas").insert({
      workspace_id: wsId, tipo: "nfe", direcao: "emitida", status: "emitida",
      destinatario_nome: form.destinatario_nome.trim(), numero: form.numero.trim() || null,
      valor_total: valor, emissao: form.emissao, lancamento_id,
    });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(n: any) {
    if (!wsId || !confirm("Excluir esta nota?")) return;
    await supabase.from("fin_notas").delete().eq("id", n.id).eq("workspace_id", wsId);
    carregar();
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🧾</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Emitir NF-e</h1>
        </div>
        <button onClick={abrir} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Nova nota</button>
      </div>

      <div style={{ background: provedor ? "#ecfdf5" : "#fffbeb", border: `1px solid ${provedor ? "#6ee7b7" : "#fcd34d"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#374151" }}>
        {provedor
          ? <>🔌 Provedor configurado: <strong>{provedor}</strong>. A emissão ao-vivo na SEFAZ entra quando ligarmos a integração.</>
          : <>⚠️ Sem provedor de NF-e configurado. Por aqui você <strong>registra</strong> as notas emitidas e gera o "a receber"; a <strong>emissão automática na SEFAZ</strong> precisa de um provedor (PlugNotas, Focus, eNotas) — configure em <strong>Configurações</strong>.</>}
      </div>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : lista.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhuma nota emitida registrada.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {lista.map((n, i) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{n.destinatario_nome}{n.numero ? <span style={{ color: "#9ca3af", fontWeight: 400 }}> · NF {n.numero}</span> : null}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{(n.emissao || "").split("-").reverse().join("/")}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#16a34a", minWidth: 100, textAlign: "right" }}>{brl(n.valor_total)}</div>
              <button onClick={() => remover(n)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>Nova nota emitida</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Destinatário *</label>
              <input list="fin-clientes" value={form.destinatario_nome} onChange={(e) => setForm({ ...form, destinatario_nome: e.target.value })} style={inputStyle} />
              <datalist id="fin-clientes">{contatos.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 120 }}>
                <label style={labelStyle}>Nº</label>
                <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ width: 140 }}>
                <label style={labelStyle}>Valor</label>
                <input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} style={inputStyle} placeholder="0,00" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Emissão</label>
                <input type="date" value={form.emissao} onChange={(e) => setForm({ ...form, emissao: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}>
              <input type="checkbox" checked={form.gerarReceber} onChange={(e) => setForm({ ...form, gerarReceber: e.target.checked })} /> Gerar conta a receber automaticamente
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.destinatario_nome.trim()} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando || !form.destinatario_nome.trim() ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Registrar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}