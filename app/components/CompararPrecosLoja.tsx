"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";

// Compara o preço de cada produto com a concorrência (KaBuM direto; Terabyte e outras
// lojas pelo Google Shopping, se houver chave) e sugere o preço: igual ao menor ou X% abaixo,
// sem passar da margem mínima sobre o custo. Nada muda sem você aprovar.

type Oferta = { loja: string; preco: number; nome: string; url?: string } | null;
type Res = { id: string; busca: string; kabum: Oferta; terabyte: Oferta; outras: NonNullable<Oferta>[] };
const brl = (v?: number | null) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: any) => { const x = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };

export default function CompararPrecosLoja({ wsId, produtos, onSalvar, onFechar }: { wsId: string; produtos: any[]; onSalvar: (lista: any[]) => Promise<string | null>; onFechar: () => void }) {
  const candidatos = produtos.filter((p) => p.ativo !== false && !p.servico);
  const [abaixo, setAbaixo] = useState("5");
  const [margemMin, setMargemMin] = useState("10");
  const [apenasSemRef, setApenasSemRef] = useState(false);
  const [res, setRes] = useState<Record<string, Res>>({});
  const [manual, setManual] = useState<Record<string, string>>({}); // preço da Terabyte digitado
  const [novo, setNovo] = useState<Record<string, string>>({});
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [rodando, setRodando] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [aviso, setAviso] = useState("");
  const [serper, setSerper] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const lista = apenasSemRef ? candidatos.filter((p) => !p.preco_ref) : candidatos;

  const sugerir = (p: any, r?: Res, man?: string) => {
    const ofertas = [r?.kabum?.preco, r?.terabyte?.preco, num(man)].filter((x): x is number => !!x && x > 0);
    if (!ofertas.length) return 0;
    const alvo = Math.min(...ofertas) * (1 - num(abaixo) / 100);
    // Final ,90 para baixo (fica abaixo do concorrente): 722,51 → 721,90
    const i = Math.floor(alvo);
    let v = alvo >= i + 0.9 ? i + 0.9 : i - 0.1;
    // Nunca abaixo do custo + margem mínima (aí arredonda para cima até ,90)
    const minimo = num(p.custo) > 0 ? num(p.custo) * (1 + num(margemMin) / 100) : 0;
    if (v < minimo) { const j = Math.floor(minimo); v = minimo <= j + 0.9 ? j + 0.9 : j + 1.9; }
    return Math.max(0, Math.round(v * 100) / 100);
  };

  async function comparar() {
    setRodando(true); setAviso(""); setFeitos(0);
    const { data } = await supabase.auth.getSession();
    const alvo = lista.slice(0, 300);
    for (let i = 0; i < alvo.length; i += 8) {
      const lote = alvo.slice(i, i + 8);
      const r = await fetch("/api/loja/comparar-precos", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify({ ws: wsId, produtos: lote.map((p) => ({ id: p.id, nome: p.nome, marca: p.marca, modelo: p.modelo })) }) }).then((x) => x.json()).catch(() => ({ success: false, error: "Sem conexão" }));
      if (!r.success) { setAviso(r.error || "Falha na comparação"); break; }
      setSerper(!!r.serper);
      setRes((x) => { const n = { ...x }; for (const it of r.resultado) n[it.id] = it; return n; });
      setMarcados((x) => { const n = { ...x }; for (const it of r.resultado) if (it.kabum || it.terabyte) n[it.id] = true; return n; });
      setFeitos(Math.min(alvo.length, i + 8));
    }
    if (lista.length > 300) setAviso("Comparei os 300 primeiros. Rode de novo com “só os que ainda não comparei” para continuar.");
    setRodando(false);
  }

  async function aplicar() {
    setSalvando(true);
    const agora = new Date().toISOString();
    const final = produtos.map((p) => {
      const r = res[p.id]; if (!r && !manual[p.id]) return p;
      const ref = { em: agora, kabum: r?.kabum?.preco || null, terabyte: r?.terabyte?.preco || num(manual[p.id]) || null };
      if (!marcados[p.id]) return r ? { ...p, preco_ref: ref } : p;
      const v = num(novo[p.id]) || sugerir(p, r, manual[p.id]);
      return v > 0 ? { ...p, preco: Math.round(v * 100) / 100, preco_ref: ref } : { ...p, preco_ref: ref };
    });
    const erro = await onSalvar(final);
    setSalvando(false);
    if (erro) setAviso("Erro ao salvar: " + erro); else onFechar();
  }

  const qtdMarcados = Object.entries(marcados).filter(([id, v]) => v && (res[id] || manual[id])).length;
  const inp: any = { boxSizing: "border-box", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 10, padding: "8px 10px", fontSize: 13 };
  const lnk = (o: Oferta) => o ? <a href={o.url} target="_blank" rel="noreferrer" title={o.nome} style={{ color: "#0F172A", fontWeight: 700 }}>{brl(o.preco)}</a> : <span style={{ color: "#CBD5E1" }}>—</span>;
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, width: "min(1080px, 100%)", maxHeight: "92vh", overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center" }}><b style={{ fontSize: 19, flex: 1 }}>Comparar preços com a concorrência</b><button onClick={onFechar} style={{ border: 0, background: "#F1F5F9", borderRadius: 10, width: 34, height: 34, cursor: "pointer" }}>✕</button></div>
        <span style={{ fontSize: 13, color: "#64748B" }}>Consulta produto por produto. O preço sugerido é o menor preço encontrado menos o desconto, sem ficar abaixo do custo + margem mínima. Só muda o que você deixar marcado. Confira o link antes: produtos parecidos podem ter versões diferentes.</span>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "flex", flexDirection: "column", gap: 4 }}>Ficar abaixo do menor preço (%)<input style={{ ...inp, width: 120 }} value={abaixo} onChange={(e) => setAbaixo(e.target.value)} /></label>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "flex", flexDirection: "column", gap: 4 }}>Margem mínima sobre o custo (%)<input style={{ ...inp, width: 120 }} value={margemMin} onChange={(e) => setMargemMin(e.target.value)} /></label>
          <label style={{ fontSize: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", paddingBottom: 8 }}><input type="checkbox" checked={apenasSemRef} onChange={(e) => setApenasSemRef(e.target.checked)} /> Só os que ainda não comparei</label>
          <button disabled={rodando || !lista.length} onClick={comparar} style={{ height: 40, padding: "0 18px", borderRadius: 12, border: 0, background: "var(--w-600)", color: "#fff", fontWeight: 800, cursor: "pointer", opacity: rodando ? 0.6 : 1 }}>{rodando ? `Comparando… ${feitos}/${Math.min(lista.length, 300)}` : `Comparar ${Math.min(lista.length, 300)} produto(s)`}</button>
        </div>
        {serper === false && <span style={{ fontSize: 12.5, color: "#B45309" }}>Terabyte: o site bloqueia consulta automática. Para buscar pelo Google Shopping, cadastre a variável SERPER_API_KEY no Vercel; enquanto isso, digite o preço da Terabyte na coluna dela se quiser considerar.</span>}
        {aviso && <span style={{ fontSize: 13, color: "#B45309", fontWeight: 700 }}>{aviso}</span>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", minWidth: 860 }}>
            <thead><tr style={{ textAlign: "left", color: "#64748B", fontSize: 12 }}><th></th><th>Produto</th><th style={{ textAlign: "right" }}>Custo</th><th style={{ textAlign: "right" }}>Seu preço</th><th style={{ textAlign: "right" }}>KaBuM</th><th style={{ textAlign: "right" }}>Terabyte</th><th style={{ textAlign: "right" }}>Outras</th><th style={{ textAlign: "right" }}>Novo preço</th></tr></thead>
            <tbody>
              {lista.slice(0, 300).map((p) => {
                const r = res[p.id]; const sug = sugerir(p, r, manual[p.id]);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #E6ECEA", opacity: r || manual[p.id] ? 1 : 0.55 }}>
                    <td style={{ padding: "6px 4px" }}><input type="checkbox" disabled={!sug} checked={!!marcados[p.id] && !!sug} onChange={(e) => setMarcados({ ...marcados, [p.id]: e.target.checked })} /></td>
                    <td style={{ maxWidth: 320 }}><b>{p.nome}</b>{r && !r.kabum && !r.terabyte && <div style={{ fontSize: 11.5, color: "#94A3B8" }}>não encontrei o mesmo produto</div>}</td>
                    <td style={{ textAlign: "right", color: "#64748B" }}>{p.custo ? brl(p.custo) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{brl(p.preco)}</td>
                    <td style={{ textAlign: "right" }}>{lnk(r?.kabum || null)}</td>
                    <td style={{ textAlign: "right" }}>{r?.terabyte ? lnk(r.terabyte) : <input style={{ ...inp, width: 96, textAlign: "right" }} placeholder="digitar" value={manual[p.id] || ""} onChange={(e) => { setManual({ ...manual, [p.id]: e.target.value }); if (num(e.target.value)) setMarcados({ ...marcados, [p.id]: true }); }} />}</td>
                    <td style={{ textAlign: "right", fontSize: 12 }}>{r?.outras?.length ? r.outras.map((o, i) => <div key={i}><a href={o.url} target="_blank" rel="noreferrer" title={o.nome} style={{ color: "#475569" }}>{o.loja}: {brl(o.preco)}</a></div>) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{sug ? <input style={{ ...inp, width: 104, textAlign: "right", fontWeight: 800, color: sug < num(p.preco) ? "#047857" : "#B45309" }} value={novo[p.id] ?? sug.toFixed(2).replace(".", ",")} onChange={(e) => setNovo({ ...novo, [p.id]: e.target.value })} /> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "#64748B", marginRight: "auto" }}>Verde: fica mais barato que hoje · laranja: sobe o preço.</span>
          <button onClick={onFechar} style={{ height: 42, padding: "0 18px", borderRadius: 12, border: 0, background: "#F1F5F9", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button disabled={!qtdMarcados || salvando} onClick={aplicar} style={{ height: 42, padding: "0 18px", borderRadius: 12, border: 0, background: "var(--w-600)", color: "#fff", fontWeight: 800, cursor: "pointer", opacity: !qtdMarcados || salvando ? 0.5 : 1 }}>{salvando ? "Salvando…" : `Aplicar ${qtdMarcados} preço(s)`}</button>
        </div>
      </div>
    </div>
  );
}
