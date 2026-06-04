"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 📨 Notas Recebidas — sobe o XML da NF-e e o sistema lê sozinho
const COR = "#d97706";
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Lê o XML da NF-e e extrai os campos principais
function parseNFe(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const txt = (el: Element | null | undefined, tag: string) => el?.getElementsByTagName(tag)[0]?.textContent || "";
  const g = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent || "";
  const inf = doc.getElementsByTagName("infNFe")[0];
  const emit = doc.getElementsByTagName("emit")[0] || null;
  const dest = doc.getElementsByTagName("dest")[0] || null;
  return {
    chave: (inf?.getAttribute("Id") || "").replace(/^NFe/i, ""),
    numero: g("nNF"),
    emissao: (g("dhEmi") || g("dEmi") || "").slice(0, 10),
    emitente_nome: txt(emit, "xNome"),
    emitente_doc: txt(emit, "CNPJ") || txt(emit, "CPF"),
    destinatario_nome: txt(dest, "xNome"),
    valor_total: parseFloat(g("vNF") || "0") || 0,
  };
}

export default function NotasRecebidas() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_notas").select("*").eq("workspace_id", wsId).eq("tipo", "nfe").eq("direcao", "recebida").order("emissao", { ascending: false });
    setLista((data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function importarArquivos(files: FileList | null) {
    if (!wsId || !files || files.length === 0) return;
    setImportando(true); setMsg("");
    let ok = 0, erro = 0;
    for (const file of Array.from(files)) {
      try {
        const xml = await file.text();
        const d = parseNFe(xml);
        if (!d.valor_total && !d.emitente_nome) { erro++; continue; }
        // sobe o XML no bucket (best-effort)
        let xml_url: string | null = null;
        try {
          const path = `${wsId}/${d.chave || Date.now()}.xml`;
          await supabase.storage.from("financeiro-notas").upload(path, file, { upsert: true });
          xml_url = path;
        } catch { /* segue sem o arquivo */ }
        await supabase.from("fin_notas").insert({
          workspace_id: wsId, tipo: "nfe", direcao: "recebida", status: "processada",
          chave: d.chave || null, numero: d.numero || null, emissao: d.emissao || null,
          emitente_nome: d.emitente_nome || null, emitente_doc: d.emitente_doc || null,
          destinatario_nome: d.destinatario_nome || null, valor_total: d.valor_total, xml_url, dados: d,
        });
        ok++;
      } catch { erro++; }
    }
    setImportando(false);
    setMsg(`${ok} nota(s) lida(s)${erro ? `, ${erro} com erro` : ""}.`);
    carregar();
  }

  async function lancar(n: any) {
    if (!wsId || n.lancamento_id) return;
    const { data } = await supabase.from("fin_lancamentos").insert({
      workspace_id: wsId, tipo: "despesa", descricao: `NF-e ${n.numero || ""} ${n.emitente_nome || ""}`.trim(),
      valor: n.valor_total || 0, vencimento: n.emissao, status: "pendente",
    }).select("id").maybeSingle();
    await supabase.from("fin_notas").update({ lancamento_id: data?.id || null }).eq("id", n.id).eq("workspace_id", wsId);
    carregar();
  }
  async function remover(n: any) {
    if (!wsId || !confirm("Excluir esta nota?")) return;
    await supabase.from("fin_notas").delete().eq("id", n.id).eq("workspace_id", wsId);
    carregar();
  }

  return (
    <div style={{ padding: 24, maxWidth: 940 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 26 }}>📨</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Notas recebidas</h1>
      </div>
      <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>Suba o XML da NF-e — o sistema lê emitente, valor e data sozinho e você lança a pagar com 1 clique.</p>

      <label style={{ display: "block", border: `2px dashed ${COR}88`, borderRadius: 12, padding: 26, textAlign: "center", cursor: "pointer", background: `${COR}08`, marginBottom: 8 }}>
        <input type="file" accept=".xml,text/xml" multiple style={{ display: "none" }} onChange={(e) => importarArquivos(e.target.files)} />
        <div style={{ fontSize: 30 }}>📥</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: COR, marginTop: 6 }}>{importando ? "Lendo…" : "Clique para subir XML(s) de NF-e"}</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Pode selecionar vários de uma vez</div>
      </label>
      {msg && <p style={{ color: "#16a34a", fontSize: 13, fontWeight: 600, margin: "0 0 16px" }}>✓ {msg}</p>}

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 16 }}>Carregando…</p> : lista.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic", marginTop: 16 }}>Nenhuma nota importada.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff", marginTop: 16 }}>
          {lista.map((n, i) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{n.emitente_nome || "—"} {n.numero ? <span style={{ color: "#9ca3af", fontWeight: 400 }}>· NF {n.numero}</span> : null}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{(n.emissao || "").split("-").reverse().join("/")}{n.emitente_doc ? ` · ${n.emitente_doc}` : ""}</div>
              </div>
              {n.lancamento_id ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#16a34a14", border: "1px solid #16a34a44", borderRadius: 20, padding: "3px 10px" }}>Lançada</span>
              ) : (
                <button onClick={() => lancar(n)} style={{ fontSize: 12, fontWeight: 700, color: COR, background: `${COR}14`, border: `1px solid ${COR}55`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>→ Lançar a pagar</button>
              )}
              <div style={{ fontSize: 15, fontWeight: 800, color: "#dc2626", minWidth: 100, textAlign: "right" }}>{brl(n.valor_total)}</div>
              <button onClick={() => remover(n)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}