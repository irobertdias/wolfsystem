"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";

// Ajuda da IA no cadastro de produtos (lojas): pesquisa o produto e sugere
// nome, marca, modelo, categoria, descrição, preço e fotos para escolher.

export type SugestaoIA = { nome?: string; marca?: string; modelo?: string; categoria?: string; descricao?: string; especificacoes?: string[]; preco_medio?: number; garantia_meses?: number; ean?: string; fontes?: string[] };

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token || ""; }

async function fotoParaDataUrl(url: string, ws: string, lado = 520): Promise<string> {
  const r = await fetch(`/api/loja/foto?ws=${encodeURIComponent(ws)}&url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!r.ok) throw new Error("Não foi possível baixar esta foto");
  const blob = await r.blob();
  const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("Imagem inválida")); i.src = URL.createObjectURL(blob); });
  const k = Math.min(1, lado / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.78);
}

export default function AssistenteIAProduto({ wsId, nicho, categorias, nomeInicial, onAplicar, onFoto }: {
  wsId: string; nicho: string; categorias: string[]; nomeInicial?: string;
  onAplicar: (s: SugestaoIA) => void; onFoto: (dataUrl: string) => void;
}) {
  const [q, setQ] = useState(nomeInicial || "");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [sug, setSug] = useState<SugestaoIA | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [baixando, setBaixando] = useState("");
  const [escolhida, setEscolhida] = useState("");

  async function buscar() {
    if (q.trim().length < 3) { setErro("Digite o nome ou modelo do produto."); return; }
    setBuscando(true); setErro(""); setSug(null); setFotos([]);
    try {
      const r = await fetch("/api/loja/ia-produto", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ ws: wsId, q, nicho, categorias }) });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || "Falha na busca");
      setSug(j.dados); setFotos(j.fotos || []);
      if (!j.fotos?.length) setErro("Não achei fotos deste produto; envie uma foto sua.");
    } catch (e: any) { setErro(e.message); }
    setBuscando(false);
  }
  async function usarFoto(u: string) {
    setBaixando(u); setErro("");
    try { onFoto(await fotoParaDataUrl(u, wsId)); setEscolhida(u); } catch (e: any) { setErro(e.message); }
    setBaixando("");
  }

  const bt: any = { height: 40, borderRadius: 12, border: 0, padding: "0 16px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" };
  return (
    <div style={{ background: "linear-gradient(135deg, var(--w-50), #fff)", borderRadius: 16, padding: 14, boxShadow: "inset 0 0 0 1.5px var(--w-200)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--w-800)" }}>✨ Cadastrar com IA</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} placeholder="Ex.: Gabinete Lian Li O11 Dynamic Razer Edition" style={{ flex: "1 1 260px", minWidth: 0, background: "#fff", border: "1px solid #E6ECEA", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, fontWeight: 600, outline: "none" }} />
        <button type="button" onClick={buscar} disabled={buscando} style={{ ...bt, background: "linear-gradient(140deg, var(--w-500), var(--w-600))", color: "#fff", opacity: buscando ? 0.6 : 1 }}>{buscando ? "Pesquisando…" : "Buscar"}</button>
      </div>
      {buscando && <span style={{ fontSize: 12.5, color: "#64748B" }}>Pesquisando o produto na internet e separando as fotos… (leva uns 15 a 30 segundos)</span>}
      {erro && <span style={{ fontSize: 12.5, color: "#B45309", fontWeight: 700 }}>{erro}</span>}
      {sug && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          <b style={{ fontSize: 14.5 }}>{sug.nome || q}</b>
          <span style={{ color: "#64748B" }}>{[sug.marca, sug.modelo, sug.categoria, sug.garantia_meses ? `garantia ${sug.garantia_meses} meses` : "", sug.preco_medio ? `preço médio ${sug.preco_medio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""].filter(Boolean).join(" · ")}</span>
          {sug.descricao && <span style={{ color: "#334155" }}>{sug.descricao}</span>}
          {!!sug.especificacoes?.length && <ul style={{ margin: "2px 0 0 18px", padding: 0, color: "#475569" }}>{sug.especificacoes.slice(0, 8).map((s, i) => <li key={i}>{s}</li>)}</ul>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <button type="button" onClick={() => onAplicar(sug)} style={{ ...bt, background: "var(--w-600)", color: "#fff" }}>Usar estes dados</button>
            {!!sug.fontes?.length && <span style={{ fontSize: 11.5, color: "#94A3B8", alignSelf: "center" }}>Fontes: {sug.fontes.slice(0, 3).map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }).filter(Boolean).join(", ")}</span>}
          </div>
        </div>
      )}
      {fotos.length > 0 && (
        <div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#64748B" }}>Fotos encontradas: clique para usar</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8, marginTop: 6 }}>
            {fotos.map((u) => (
              <button key={u} type="button" onClick={() => usarFoto(u)} title="Usar esta foto" style={{ position: "relative", aspectRatio: "1", borderRadius: 12, border: 0, cursor: "pointer", background: `#fff url("${u}") center/contain no-repeat`, boxShadow: escolhida === u ? "inset 0 0 0 3px var(--w-600)" : "inset 0 0 0 1px #E6ECEA", opacity: baixando && baixando !== u ? 0.5 : 1 }}>
                {baixando === u && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.7)", fontSize: 11, fontWeight: 800 }}>baixando…</span>}
                {escolhida === u && <span style={{ position: "absolute", right: 6, top: 6, background: "var(--w-600)", color: "#fff", borderRadius: 99, width: 20, height: 20, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
