"use client";
import { ReactNode } from "react";
import Icone, { IconeEmoji } from "../../components/a2/Icone";

// ═══════════════════════════════════════════════════════════════════════
// Kit visual próprio do sistema de Informática: painel escuro de bancada técnica,
// linhas finas, números em fonte mono, destaques em neon violeta/ciano.
// Não usa o kit do Financeiro: este é o visual só deste sistema.
// ═══════════════════════════════════════════════════════════════════════
export const MONO = "ui-monospace, 'JetBrains Mono', 'Cascadia Code', Consolas, monospace";
export const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAINEL = "var(--i-painel)";
const BORDA = "1px solid var(--i-borda)";
export const cardStyle: any = { background: PAINEL, border: BORDA, borderRadius: 12 };
export const inputStyle: any = { width: "100%", background: "var(--i-campo)", border: BORDA, borderRadius: 8, padding: "10px 12px", color: "var(--i-txt)", fontSize: 13.5, fontWeight: 500, boxSizing: "border-box", outline: "none" };
export const inputSm: any = { ...inputStyle, padding: "8px 11px", fontSize: 13 };
export const labelStyle: any = { color: "var(--i-mut)", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: MONO };
export const thStyle: any = { padding: "11px 16px", color: "var(--i-mut)", fontSize: 10.5, textAlign: "left", fontWeight: 700, borderBottom: BORDA, background: "var(--i-fundo2)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".1em", fontFamily: MONO };
export const tdStyle: any = { padding: "12px 16px", fontSize: 13, color: "var(--i-txt)", borderTop: BORDA, verticalAlign: "middle" };

// cor de destaque a partir da cor que a tela pede (alertas continuam com sentido)
export function neon(cor?: string) {
  const c = (cor || "").toLowerCase();
  if (["#dc2626", "#ef4444", "#b91c1c", "#db2777", "#f87171"].includes(c)) return "#F87171";
  if (["#c2410c", "#ea580c", "#f59e0b", "#d97706", "#b45309"].includes(c)) return "#FBBF24";
  if (["#16a34a", "#059669", "#047857", "#34d399"].includes(c)) return "#34D399";
  if (["#0891b2", "#06b6d4"].includes(c)) return "#22D3EE";
  if (["#2563eb", "#3b82f6"].includes(c)) return "#60A5FA";
  if (["#7c3aed", "#8b5cf6"].includes(c)) return "#A78BFA";
  if (["#475569", "#64748b", "#94a3b8"].includes(c)) return "#94A3B8";
  return "var(--i-acento)";
}

export function Page({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", boxSizing: "border-box" }}>{children}</div>;
}

// título em estilo terminal: caminho em mono acima, título e ação à direita
export function PageHeader({ titulo, subtitulo, acao }: { icone?: string; titulo: string; subtitulo?: string; cor?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", paddingBottom: 14, borderBottom: BORDA }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--i-acento)", letterSpacing: ".06em" }}>~/{titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}</span>
        <h1 style={{ color: "var(--i-txt)", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-.01em" }}>{titulo}</h1>
        {subtitulo && <p style={{ color: "var(--i-sub)", fontSize: 13, margin: 0 }}>{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

// indicadores em faixa contínua, divididos por linhas (não cartões soltos)
export function Stats({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 1, background: "var(--i-borda)", border: BORDA, borderRadius: 12, overflow: "hidden" }}>{children}</div>;
}
export function Stat({ label, valor, cor, icone, sub }: { label: string; valor: ReactNode; cor?: string; icone?: string; sub?: string }) {
  const n = neon(cor);
  return (
    <div style={{ background: PAINEL, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: n, boxShadow: `0 0 10px ${n}` }} />
        <span style={{ color: "var(--i-mut)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", fontFamily: MONO }}>{label}</span>
        {icone && <span style={{ marginLeft: "auto", color: "var(--i-mut)", opacity: .7 }}><IconeEmoji e={icone} tamanho={14} /></span>}
      </div>
      <div style={{ color: "var(--i-txt)", fontSize: 24, fontWeight: 700, fontFamily: MONO, letterSpacing: "-.02em", lineHeight: 1.15, overflowWrap: "anywhere" }}>{valor}</div>
      {sub && <div style={{ color: "var(--i-sub)", fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export function Card({ titulo, acao, children, pad = 18 }: { titulo?: string; cor?: string; acao?: ReactNode; children: ReactNode; pad?: number }) {
  return (
    <div style={{ ...cardStyle, width: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      {(titulo || acao) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: BORDA, background: "var(--i-fundo2)", gap: 10, flexWrap: "wrap" }}>
          {titulo && <h3 style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "var(--i-txt2)", textTransform: "uppercase", letterSpacing: ".1em", fontFamily: MONO }}>{titulo}</h3>}
          {acao}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

export function Table({ cols, empty, children }: { cols: { label: string; align?: "left" | "right" | "center"; width?: number }[]; empty?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ ...cardStyle, width: "100%", overflow: "hidden", boxSizing: "border-box" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{cols.map((c, i) => <th key={i} style={{ ...thStyle, textAlign: c.align || "left", width: c.width }}>{c.label}</th>)}</tr></thead>
          <tbody className="info-tabela">
            {empty ? <tr><td colSpan={cols.length} style={{ padding: "40px 24px", textAlign: "center" }}>{empty}</td></tr> : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Vazio({ icone = "📭", titulo, sub, acao }: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, border: "1px dashed var(--i-acento)", color: "var(--i-acento)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}><IconeEmoji e={icone} tamanho={22} /></div>
      <h3 style={{ color: "var(--i-txt)", fontSize: 14, fontWeight: 700, margin: 0 }}>{titulo}</h3>
      {sub && <p style={{ color: "var(--i-sub)", fontSize: 12.5, margin: 0, maxWidth: 380 }}>{sub}</p>}
      {acao && <div style={{ marginTop: 12 }}>{acao}</div>}
    </div>
  );
}
export function Empty(p: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return <div style={{ ...cardStyle, padding: "40px 24px" }}><Vazio {...p} /></div>;
}

export function Banner({ tipo = "info", children }: { tipo?: "info" | "warn" | "ok"; children: ReactNode }) {
  const cor = { info: "#22D3EE", warn: "#FBBF24", ok: "#34D399" }[tipo];
  const pre = { info: "INFO", warn: "ATENÇÃO", ok: "OK" }[tipo];
  return (
    <div style={{ background: "var(--i-fundo2)", border: BORDA, borderLeft: `3px solid ${cor}`, borderRadius: 8, padding: "11px 14px", color: "var(--i-txt2)", fontSize: 13, lineHeight: 1.55, display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: cor, letterSpacing: ".1em", flexShrink: 0 }}>[{pre}]</span>
      <div>{children}</div>
    </div>
  );
}

export function Btn({ children, onClick, cor, variante = "primary", disabled }: { children: ReactNode; onClick?: () => void; cor?: string; variante?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const perigo = neon(cor) === "#F87171";
  const base: any = { height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" };
  const est: any = {
    primary: perigo
      ? { ...base, border: "1px solid #F87171", background: "rgba(248,113,113,.15)", color: "#FCA5A5" }
      : { ...base, border: "1px solid var(--i-acento)", background: "var(--i-acento)", color: "#0B0F1A", boxShadow: "0 0 18px -4px var(--i-acento)" },
    ghost: { ...base, border: BORDA, background: "transparent", color: "var(--i-txt2)" },
    danger: { ...base, border: "1px solid rgba(248,113,113,.4)", background: "rgba(248,113,113,.1)", color: "#FCA5A5" },
  };
  return <button onClick={onClick} disabled={disabled} style={est[variante]}>{children}</button>;
}

export function Modal({ titulo, onClose, children, footer, maxWidth = 520 }: { titulo: string; cor?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,6,15,0.72)", backdropFilter: "blur(3px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PAINEL, border: BORDA, borderRadius: 12, boxShadow: "0 30px 80px -20px rgba(0,0,0,.8)", width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: BORDA, background: "var(--i-fundo2)", position: "sticky", top: 0, zIndex: 1 }}>
          <span style={{ display: "flex", gap: 5 }}>{["#F87171", "#FBBF24", "#34D399"].map((c) => <i key={c} style={{ width: 9, height: 9, borderRadius: 9, background: c, opacity: .85 }} />)}</span>
          <h2 style={{ color: "var(--i-txt)", fontSize: 14, fontWeight: 700, margin: 0, fontFamily: MONO }}>{titulo}</h2>
          <button onClick={onClose} title="Fechar" style={{ marginLeft: "auto", background: "transparent", border: BORDA, color: "var(--i-sub)", cursor: "pointer", width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={14} /></button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        {footer && <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: BORDA, padding: "12px 16px", flexWrap: "wrap", background: "var(--i-fundo2)" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, flex }: { label: string; children: ReactNode; flex?: number | string }) {
  return <div style={{ flex: flex as any, minWidth: 0 }}><label style={labelStyle}>{label}</label>{children}</div>;
}
export function Row({ children, gap = 10 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, flexWrap: "wrap" }}>{children}</div>;
}
// etiqueta de status em estilo LED
export function Pill({ texto, cor }: { texto: string; cor: string }) {
  const n = neon(cor);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: n, border: `1px solid color-mix(in srgb, ${n} 45%, transparent)`, background: `color-mix(in srgb, ${n} 10%, transparent)`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap", fontFamily: MONO, textTransform: "uppercase", letterSpacing: ".04em" }}>
      <i style={{ width: 6, height: 6, borderRadius: 6, background: n, boxShadow: `0 0 8px ${n}` }} />{texto}
    </span>
  );
}
export function IconBtn({ icone, onClick, title }: { icone: string; onClick?: () => void; title?: string }) {
  const perigo = /🗑|❌|✕|✖/.test(icone);
  return (
    <button onClick={onClick} title={title} style={{ background: "transparent", color: perigo ? "#F87171" : "var(--i-txt2)", border: BORDA, borderRadius: 7, width: 32, height: 32, cursor: "pointer", marginLeft: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>
      <IconeEmoji e={icone} tamanho={14} />
    </button>
  );
}
