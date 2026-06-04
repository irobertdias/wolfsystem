"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🧾 EMITIR NF-e — registro de notas emitidas + geração de "a receber"
//   (fin_notas tipo=nfe direcao=emitida) | slot pra emissão ao-vivo na SEFAZ
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#6b7280", fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#1f2937", borderTop: "1px solid #f3f4f6", verticalAlign: "middle" };
const COR = "#d97706", G2 = "#f59e0b";

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
    setLista((n.data as any[]) || []); setContatos((c.data as any[]) || []); setProvedor((cfg.data?.config?.nfe_provedor) || "");
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
      const { data } = await supabase.from("fin_lancamentos").insert({ workspace_id: wsId, tipo: "receita", descricao: `NF-e ${form.numero || ""} ${form.destinatario_nome}`.trim(), valor, vencimento: form.emissao, status: "pendente" }).select("id").maybeSingle();
      lancamento_id = data?.id || null;
    }
    await supabase.from("fin_notas").insert({ workspace_id: wsId, tipo: "nfe", direcao: "emitida", status: "emitida", destinatario_nome: form.destinatario_nome.trim(), numero: form.numero.trim() || null, valor_total: valor, emissao: form.emissao, lancamento_id });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(n: any) {
    if (!wsId || !confirm("Excluir esta nota?")) return;
    await supabase.from("fin_notas").delete().eq("id", n.id).eq("workspace_id", wsId);
    carregar();
  }

  const mes = mesAtual();
  const totalEmitido = lista.reduce((s, n) => s + (n.valor_total || 0), 0);
  const noMes = lista.filter((n) => (n.emissao || "").slice(0, 7) === mes);
  const totalMes = noMes.reduce((s, n) => s + (n.valor_total || 0), 0);
  const comReceber = lista.filter((n) => n.lancamento_id).length;
  const kpis = [
    { label: "Notas emitidas", valor: String(lista.length), cor: COR, g2: G2, icone: "🧾" },
    { label: "Total emitido", valor: brl(totalEmitido), cor: "#16a34a", g2: "#22c55e", icone: "💰" },
    { label: "Emitido no mês", valor: brl(totalMes), cor: "#2563eb", g2: "#60a5fa", icone: "📅" },
    { label: "Geraram a receber", valor: `${comReceber}/${lista.length}`, cor: "#7c3aed", g2: "#a78bfa", icone: "📥" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>🧾</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Emitir NF-e</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Notas fiscais emitidas e geração de contas a receber</p></div>
        </div>
        <button onClick={abrir} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${COR}40` }}>+ Nova nota</button>
      </div>

      <div style={{ background: provedor ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" : "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", border: `1px solid ${provedor ? "#bbf7d0" : "#fde68a"}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: provedor ? "#bbf7d0" : "#fde68a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{provedor ? "🔌" : "⚠️"}</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          {provedor ? <>Provedor configurado: <b>{provedor}</b>. A emissão ao-vivo na SEFAZ entra quando ligarmos a integração.</>
            : <>Sem provedor de NF-e. Aqui você <b>registra</b> as notas e gera o "a receber"; a <b>emissão automática na SEFAZ</b> precisa de um provedor (PlugNotas, Focus, eNotas) — configure em <b>Configurações</b>.</>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.cor} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 4px 10px ${k.cor}30` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span></div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: 25, fontWeight: 800, letterSpacing: -1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f3f4f6" }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1f2937" }}>Notas emitidas</h3></div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}><th style={th}>Destinatário</th><th style={th}>NF</th><th style={th}>Emissão</th><th style={th}>A receber</th><th style={{ ...th, textAlign: "right" }}>Valor</th><th style={{ ...th, textAlign: "right" }}>Ações</th></tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
              : lista.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 38 }}>🧾</div>
                  <p style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhuma nota emitida</p>
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 14px" }}>Registre uma nota e, se quiser, gere a conta a receber automaticamente.</p>
                  <button onClick={abrir} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nova nota</button>
                </td></tr>
              ) : lista.map((n, i) => (
                <tr key={n.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={{ ...td, fontWeight: 700 }}>{n.destinatario_nome}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{n.numero || "—"}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{dataBR(n.emissao)}</td>
                  <td style={td}>{n.lancamento_id ? <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>✓ Gerado</span> : <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#16a34a", whiteSpace: "nowrap" }}>{brl(n.valor_total)}</td>
                  <td style={{ ...td, textAlign: "right" }}><button onClick={() => remover(n)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>🗑️</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: COR, fontSize: 18, fontWeight: 800, margin: 0 }}>🧾 Nova nota emitida</h2>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Destinatário *</label>
              <input list="fin-clientes-emit" value={form.destinatario_nome} onChange={(e) => setForm({ ...form, destinatario_nome: e.target.value })} style={input} placeholder="Cliente" />
              <datalist id="fin-clientes-emit">{contatos.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 140px 1fr", gap: 12, marginBottom: 16 }}>
              <div><label style={lbl}>Nº</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} style={input} /></div>
              <div><label style={lbl}>Valor</label><input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} style={input} placeholder="0,00" /></div>
              <div><label style={lbl}>Emissão</label><input type="date" value={form.emissao} onChange={(e) => setForm({ ...form, emissao: e.target.value })} style={input} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 12px" }}>
              <input type="checkbox" checked={form.gerarReceber} onChange={(e) => setForm({ ...form, gerarReceber: e.target.checked })} /> 📥 Gerar conta a receber automaticamente
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.destinatario_nome.trim()} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.destinatario_nome.trim() ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : "💾 Registrar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}