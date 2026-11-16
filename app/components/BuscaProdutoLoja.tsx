"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// Seletor de produto com busca (lupa) e filtro por categoria, para catálogos grandes.
type P = { id: string; nome: string; categoria?: string; marca?: string; sku?: string; modelo?: string; preco: number; foto?: string; servico?: boolean; variantes: { estoque: number }[] };

const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const LIMITE = 80;

export default function BuscaProdutoLoja<T extends P>({ produtos, titulo = "Escolher produto", onEscolher, onFechar }: { produtos: T[]; titulo?: string; onEscolher: (p: T) => void; onFechar: () => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const indice = useMemo(() => produtos.map((p) => ({ p, txt: norm(`${p.nome} ${p.marca} ${p.sku} ${p.modelo} ${p.categoria}`) })), [produtos]);
  const categorias = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of produtos) if (p.categoria) c.set(p.categoria, (c.get(p.categoria) || 0) + 1);
    return [...c].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [produtos]);
  const achados = useMemo(() => {
    const termos = norm(q).split(/\s+/).filter(Boolean);
    return indice.filter(({ p, txt }) => (!cat || p.categoria === cat) && termos.every((t) => txt.includes(t))).map((x) => x.p);
  }, [indice, q, cat]);

  const estoque = (p: P) => p.variantes.reduce((s, v) => s + (Number(v.estoque) || 0), 0);
  const campo: React.CSSProperties = { height: 42, borderRadius: 12, border: "1px solid #E2E8F0", padding: "0 12px", fontSize: 14, background: "#fff", color: "#0F172A", outline: "none" };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px" }}>
      <div role="dialog" aria-label={titulo} style={{ width: "min(760px, 100%)", maxHeight: "88vh", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px -20px rgba(15,23,42,.45)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
          <b style={{ fontSize: 16, color: "#0F172A", flex: 1 }}>{titulo}</b>
          <button onClick={onFechar} aria-label="Fechar" style={{ border: 0, background: "#F1F5F9", borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#475569" }}>×</button>
        </div>
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ ...campo, flex: "2 1 260px", display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && achados[0]) onEscolher(achados[0]); }} placeholder="Buscar por nome, marca, código ou modelo" style={{ border: 0, outline: "none", flex: 1, fontSize: 14, minWidth: 0, background: "transparent" }} />
            {q && <button onClick={() => setQ("")} aria-label="Limpar" style={{ border: 0, background: "transparent", cursor: "pointer", color: "#94A3B8", fontSize: 18 }}>×</button>}
          </label>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...campo, flex: "1 1 200px" }} aria-label="Categoria">
            <option value="">Todas as categorias ({produtos.length})</option>
            {categorias.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>
        </div>
        <div style={{ padding: "0 16px 6px", fontSize: 12.5, color: "#64748B" }}>
          {achados.length === 0 ? "Nada encontrado." : achados.length > LIMITE ? `${achados.length} produtos. Mostrando os ${LIMITE} primeiros; refine a busca.` : `${achados.length} produto(s)`}
        </div>
        <div style={{ overflowY: "auto", padding: "0 8px 10px" }}>
          {achados.slice(0, LIMITE).map((p) => {
            const est = estoque(p);
            return (
              <button key={p.id} onClick={() => onEscolher(p)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, border: 0, background: "transparent", textAlign: "left", padding: "8px 8px", borderRadius: 12, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 10, background: p.foto ? `#fff url("${p.foto}") center/contain no-repeat` : "#F1F5F9", border: "1px solid #EEF2F6" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>{[p.categoria, p.marca, p.sku && `SKU ${p.sku}`].filter(Boolean).join(" · ")}</div>
                </div>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--w-700, #0F172A)" }}>{brl(p.preco)}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: p.servico ? "#64748B" : est > 0 ? "#047857" : "#B91C1C" }}>{p.servico ? "serviço" : `${est} em estoque`}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
