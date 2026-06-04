"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 📑 Importar Extrato (OFX) — lê o arquivo do banco e popula fin_extratos
const COR = "#d97706";
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inputStyle: any = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" };

// Parser OFX (SGML): extrai cada <STMTTRN>
function parseOFX(ofx: string) {
  const trns: any[] = [];
  const blocos = ofx.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const get = (tag: string) => {
      const m = b.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dt = get("DTPOSTED").slice(0, 8); // YYYYMMDD
    const data = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : null;
    const valor = parseFloat(get("TRNAMT").replace(",", ".")) || 0;
    trns.push({
      data, valor: Math.abs(valor), tipo: valor >= 0 ? "credito" : "debito",
      descricao: get("MEMO") || get("NAME") || "Lançamento", fitid: get("FITID") || `${dt}-${valor}-${trns.length}`,
    });
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
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [c, e] = await Promise.all([
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_extratos").select("*").eq("workspace_id", wsId).order("data", { ascending: false }).limit(100),
    ]);
    setContas((c.data as any[]) || []);
    setLinhas((e.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function importar(files: FileList | null) {
    if (!wsId || !files?.[0]) return;
    if (!conta) { alert("Escolha a conta antes de importar."); return; }
    setImportando(true); setMsg("");
    try {
      const texto = await files[0].text();
      const trns = parseOFX(texto);
      if (trns.length === 0) { setMsg("Nenhuma transação encontrada no arquivo."); setImportando(false); return; }
      // evita duplicar por fitid já existente na conta
      const existentes = new Set(linhas.filter((l) => l.conta_id === conta).map((l) => l.fitid));
      const novas = trns.filter((t) => !existentes.has(t.fitid)).map((t) => ({ ...t, conta_id: conta, origem: "ofx", conciliado: false, workspace_id: wsId }));
      if (novas.length) await supabase.from("fin_extratos").insert(novas);
      setMsg(`${novas.length} transação(ões) importada(s)${trns.length - novas.length ? `, ${trns.length - novas.length} já existia(m)` : ""}.`);
    } catch {
      setMsg("Não consegui ler o arquivo (.ofx).");
    }
    setImportando(false); carregar();
  }

  const nome = (id: string) => contas.find((c) => c.id === id)?.nome || "—";

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 26 }}>📑</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Importar extrato (OFX)</h1>
      </div>
      <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>Baixe o extrato em <strong>.ofx</strong> no seu banco e suba aqui. Depois concilie com os lançamentos.</p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <select value={conta} onChange={(e) => setConta(e.target.value)} style={inputStyle}>
          <option value="">Escolha a conta…</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label style={{ background: conta ? COR : "#d1d5db", color: "#fff", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: conta ? "pointer" : "default" }}>
          <input type="file" accept=".ofx,.OFX" style={{ display: "none" }} disabled={!conta} onChange={(e) => importar(e.target.files)} />
          {importando ? "Lendo…" : "📥 Subir arquivo OFX"}
        </label>
      </div>
      {msg && <p style={{ color: "#16a34a", fontSize: 13, fontWeight: 600, margin: "0 0 16px" }}>✓ {msg}</p>}

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : linhas.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhuma linha de extrato importada.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {linhas.map((l, i) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 78 }}>{(l.data || "").split("-").reverse().join("/")}</span>
              <span style={{ flex: 1, fontSize: 13, color: "#111827", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.descricao}</span>
              <span style={{ fontSize: 11, color: l.conciliado ? "#16a34a" : "#9ca3af" }}>{l.conciliado ? "✓ conciliado" : nome(l.conta_id)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: l.tipo === "credito" ? "#16a34a" : "#dc2626", minWidth: 100, textAlign: "right" }}>{l.tipo === "credito" ? "+" : "-"}{brl(l.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}