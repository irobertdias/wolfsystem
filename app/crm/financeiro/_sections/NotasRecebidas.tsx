"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 📨 NOTAS RECEBIDAS — sobe o XML da NF-e e o sistema lê sozinho
//   (fin_notas tipo=nfe direcao=recebida) + lançar a pagar (fin_lancamentos)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesAtual = () => new Date().toISOString().slice(0, 7);
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const th: any = { padding: "12px 18px", color: "#6b7280", fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#1f2937", borderTop: "1px solid #f3f4f6", verticalAlign: "middle" };
const COR = "#0891b2", G2 = "#22d3ee";

// lê o XML da NF-e e extrai os campos principais
function parseNFe(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const t = (el: Element | null, tag: string) => el?.getElementsByTagName(tag)[0]?.textContent || "";
  const g = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent || "";
  const inf = doc.getElementsByTagName("infNFe")[0];
  const emit = doc.getElementsByTagName("emit")[0] || null;
  const dest = doc.getElementsByTagName("dest")[0] || null;
  return {
    chave: (inf?.getAttribute("Id") || "").replace(/^NFe/i, ""),
    numero: g("nNF"),
    emissao: (g("dhEmi") || g("dEmi") || "").slice(0, 10),
    emitente_nome: t(emit, "xNome"),
    emitente_doc: t(emit, "CNPJ") || t(emit, "CPF"),
    destinatario_nome: t(dest, "xNome"),
    valor_total: parseFloat(g("vNF") || "0") || 0,
  };
}

export default function NotasRecebidas() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_notas").select("*").eq("workspace_id", wsId).eq("tipo", "nfe").eq("direcao", "recebida").order("emissao", { ascending: false });
    setLista((data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function processar(files: FileList | File[] | null) {
    if (!wsId || !files || (files as any).length === 0) return;
    setImportando(true); setMsg("");
    let ok = 0, erro = 0, dup = 0;
    const chavesExistentes = new Set(lista.map((n) => n.chave).filter(Boolean));
    for (const file of Array.from(files as any) as File[]) {
      try {
        const xml = await file.text();
        const d = parseNFe(xml);
        if (!d.valor_total && !d.emitente_nome) { erro++; continue; }
        if (d.chave && chavesExistentes.has(d.chave)) { dup++; continue; }
        let xml_url: string | null = null;
        try { const path = `${wsId}/${d.chave || Date.now()}.xml`; await supabase.storage.from("financeiro-notas").upload(path, file, { upsert: true }); xml_url = path; } catch { /* segue */ }
        await supabase.from("fin_notas").insert({ workspace_id: wsId, tipo: "nfe", direcao: "recebida", status: "processada", chave: d.chave || null, numero: d.numero || null, emissao: d.emissao || null, emitente_nome: d.emitente_nome || null, emitente_doc: d.emitente_doc || null, destinatario_nome: d.destinatario_nome || null, valor_total: d.valor_total, xml_url, dados: d });
        if (d.chave) chavesExistentes.add(d.chave);
        ok++;
      } catch { erro++; }
    }
    setImportando(false);
    setMsg(`${ok} nota(s) lida(s)${dup ? `, ${dup} já existia(m)` : ""}${erro ? `, ${erro} com erro` : ""}.`);
    carregar();
  }
  async function lancar(n: any) {
    if (!wsId || n.lancamento_id) return;
    const { data } = await supabase.from("fin_lancamentos").insert({ workspace_id: wsId, tipo: "despesa", descricao: `NF-e ${n.numero || ""} ${n.emitente_nome || ""}`.trim(), valor: n.valor_total || 0, vencimento: n.emissao, status: "pendente" }).select("id").maybeSingle();
    await supabase.from("fin_notas").update({ lancamento_id: data?.id || null }).eq("id", n.id).eq("workspace_id", wsId);
    carregar();
  }
  async function remover(n: any) {
    if (!wsId || !confirm("Excluir esta nota?")) return;
    await supabase.from("fin_notas").delete().eq("id", n.id).eq("workspace_id", wsId);
    carregar();
  }

  const mes = mesAtual();
  const total = lista.reduce((s, n) => s + (n.valor_total || 0), 0);
  const noMes = lista.filter((n) => (n.emissao || "").slice(0, 7) === mes);
  const lancadas = lista.filter((n) => n.lancamento_id).length;
  const kpis = [
    { label: "Notas importadas", valor: String(lista.length), cor: COR, g2: G2, icone: "📨" },
    { label: "Valor total", valor: brl(total), cor: "#dc2626", g2: "#f87171", icone: "💰" },
    { label: "Notas no mês", valor: String(noMes.length), cor: "#2563eb", g2: "#60a5fa", icone: "📅" },
    { label: "Já lançadas", valor: `${lancadas}/${lista.length}`, cor: "#16a34a", g2: "#22c55e", icone: "✅" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>📨</span></div>
        <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Notas recebidas</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Suba o XML da NF-e — o sistema lê emitente, valor e data sozinho</p></div>
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

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); processar(e.dataTransfer.files); }}
        style={{ display: "block", border: `2px dashed ${drag ? COR : COR + "88"}`, borderRadius: 16, padding: 30, textAlign: "center", cursor: "pointer", background: drag ? `${COR}10` : `${COR}06`, transition: "all 0.15s" }}>
        <input type="file" accept=".xml,text/xml" multiple style={{ display: "none" }} onChange={(e) => processar(e.target.files)} />
        <div style={{ fontSize: 36 }}>📥</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: COR, marginTop: 8 }}>{importando ? "Lendo XML(s)…" : "Arraste os XML aqui ou clique para selecionar"}</div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4 }}>Aceita vários arquivos · evita duplicar pela chave da nota</div>
      </label>
      {msg && <div style={{ background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 12, padding: "11px 16px", color: "#0e7490", fontSize: 13, fontWeight: 600 }}>✓ {msg}</div>}

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f3f4f6" }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1f2937" }}>Notas importadas</h3></div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}>
            <th style={th}>Emitente</th><th style={th}>NF</th><th style={th}>Emissão</th><th style={th}>Situação</th>
            <th style={{ ...th, textAlign: "right" }}>Valor</th><th style={{ ...th, textAlign: "right" }}>Ações</th>
          </tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
              : lista.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 38 }}>📨</div>
                  <p style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhuma nota importada</p>
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Suba o XML de uma NF-e acima — o sistema preenche tudo sozinho.</p>
                </td></tr>
              ) : lista.map((n, i) => (
                <tr key={n.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={td}><div style={{ fontWeight: 700, color: "#1f2937" }}>{n.emitente_nome || "—"}</div>{n.emitente_doc && <div style={{ fontSize: 11.5, color: "#9ca3af", fontFamily: "monospace" }}>{n.emitente_doc}</div>}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{n.numero || "—"}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{dataBR(n.emissao)}</td>
                  <td style={td}>{n.lancamento_id
                    ? <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>✓ Lançada</span>
                    : <button onClick={() => lancar(n)} style={{ background: `${COR}12`, color: COR, border: `1px solid ${COR}55`, borderRadius: 9, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>→ Lançar a pagar</button>}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#dc2626", whiteSpace: "nowrap" }}>{brl(n.valor_total)}</td>
                  <td style={{ ...td, textAlign: "right" }}><button onClick={() => remover(n)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>🗑️</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}