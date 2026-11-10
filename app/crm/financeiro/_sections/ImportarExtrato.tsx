"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 📑 IMPORTAR EXTRATO (OFX) — lê o arquivo do banco → fin_extratos
//   parser de <STMTTRN>; dedupe por FITID; alimenta a Conciliação.
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, outline: "none" };
const th: any = { padding: "12px 18px", color: "#64748B", fontSize: 12, textAlign: "left",  fontWeight: 700, borderBottom: "1px solid #E6ECEA", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#0F172A", borderTop: "1px solid #F1F5F4", verticalAlign: "middle" };
const COR = "#475569", G2 = "#94a3b8";

function parseOFX(ofx: string) {
  const trns: any[] = [];
  const blocos = ofx.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const get = (tag: string) => { const m = b.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i")); return m ? m[1].trim() : ""; };
    const dt = get("DTPOSTED").slice(0, 8);
    const data = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : null;
    const valor = parseFloat(get("TRNAMT").replace(",", ".")) || 0;
    trns.push({ data, valor: Math.abs(valor), tipo: valor >= 0 ? "credito" : "debito", descricao: get("MEMO") || get("NAME") || "Lançamento", fitid: get("FITID") || `${dt}-${valor}-${trns.length}` });
  }
  return trns;
}

export default function ImportarExtrato() {
  const { wsId } = useWorkspace();
  const [contas, setContas] = useState<any[]>([]);
  const [conta, setConta] = useState("");
  const [linhas, setLinhas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [c, e] = await Promise.all([
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_extratos").select("*").eq("workspace_id", wsId).order("data", { ascending: false }).limit(150),
    ]);
    setContas((c.data as any[]) || []); setLinhas((e.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function importar(files: FileList | File[] | null) {
    if (!wsId || !files || (files as any).length === 0) return;
    if (!conta) { alert("Escolha a conta antes de importar."); return; }
    setImportando(true); setMsg("");
    try {
      const texto = await (files as any)[0].text();
      const trns = parseOFX(texto);
      if (trns.length === 0) { setMsg("Nenhuma transação encontrada no arquivo."); setImportando(false); return; }
      const existentes = new Set(linhas.filter((l) => l.conta_id === conta).map((l) => l.fitid));
      const novas = trns.filter((t) => !existentes.has(t.fitid)).map((t) => ({ ...t, conta_id: conta, origem: "ofx", conciliado: false, workspace_id: wsId }));
      if (novas.length) await supabase.from("fin_extratos").insert(novas);
      setMsg(`${novas.length} transação(ões) importada(s)${trns.length - novas.length ? `, ${trns.length - novas.length} já existia(m)` : ""}.`);
    } catch { setMsg("Não consegui ler o arquivo .ofx."); }
    setImportando(false); carregar();
  }

  const nome = (id: string) => contas.find((c) => c.id === id)?.nome || "—";
  const creditos = linhas.filter((l) => l.tipo === "credito").reduce((s, l) => s + (l.valor || 0), 0);
  const debitos = linhas.filter((l) => l.tipo === "debito").reduce((s, l) => s + (l.valor || 0), 0);
  const naoConc = linhas.filter((l) => !l.conciliado).length;
  const kpis = [
    { label: "Linhas importadas", valor: String(linhas.length), cor: COR, g2: G2, icone: "📑" },
    { label: "Créditos", valor: brl(creditos), cor: "#059669", g2: "#10B981", icone: "📥" },
    { label: "Débitos", valor: brl(debitos), cor: "#dc2626", g2: "#f87171", icone: "📤" },
    { label: "A conciliar", valor: String(naoConc), cor: "#C2410C", g2: "#FB923C", icone: "🔁" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Importar extrato (OFX)</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Baixe o extrato em .ofx no banco e suba aqui — depois concilie</p></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 25, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", }}>Conta de destino:</label>
          <select value={conta} onChange={(e) => setConta(e.target.value)} style={{ ...input, minWidth: 220 }}>
            <option value="">Escolha a conta…</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          {contas.length === 0 && <span style={{ fontSize: 12, color: "#dc2626" }}>Cadastre uma conta bancária primeiro.</span>}
        </div>
        <label
          onDragOver={(e) => { e.preventDefault(); if (conta) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); importar(e.dataTransfer.files); }}
          style={{ display: "block", border: `2px dashed ${conta ? (drag ? COR : COR + "88") : "#E6ECEA"}`, borderRadius: 14, padding: 26, textAlign: "center", cursor: conta ? "pointer" : "not-allowed", background: drag ? `${COR}10` : conta ? "#F3F6F5" : "#fafafa", opacity: conta ? 1 : 0.6 }}>
          <input type="file" accept=".ofx,.OFX" style={{ display: "none" }} disabled={!conta} onChange={(e) => importar(e.target.files)} />
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="📥" tamanho={24} /></div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: conta ? COR : "#94A3B8", marginTop: 6 }}>{importando ? "Lendo arquivo…" : conta ? "Arraste o .ofx aqui ou clique" : "Escolha a conta acima primeiro"}</div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>Importa as transações e evita duplicar pelo FITID</div>
        </label>
        {msg && <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "10px 14px", color: "#047857", fontSize: 13, fontWeight: 600 }}>{msg}</div>}
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #F1F5F4" }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Linhas do extrato</h3></div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#F7FAF9" }}><th style={th}>Data</th><th style={th}>Descrição</th><th style={th}>Conta</th><th style={th}>Situação</th><th style={{ ...th, textAlign: "right" }}>Valor</th></tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando…</td></tr>
              : linhas.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="📑" tamanho={24} /></div>
                  <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhuma linha importada</p>
                  <p style={{ color: "#94A3B8", fontSize: 13, margin: 0 }}>Escolha a conta e suba um arquivo .ofx do seu banco.</p>
                </td></tr>
              ) : linhas.map((l, i) => (
                <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAF9" }}>
                  <td style={{ ...td, color: "#64748B" }}>{dataBR(l.data)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{l.descricao}</td>
                  <td style={{ ...td, color: "#64748B" }}>{nome(l.conta_id)}</td>
                  <td style={td}>{l.conciliado ? <span style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", fontSize: 12, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>Conciliado</span> : <span style={{ background: "#fefce8", color: "#ca8a04", border: "1px solid #fde68a", fontSize: 12, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>A conciliar</span>}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: l.tipo === "credito" ? "#059669" : "#dc2626", whiteSpace: "nowrap" }}>{l.tipo === "credito" ? "+" : "-"}{brl(l.valor)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}