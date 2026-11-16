"use client";
import { ReactNode } from "react";
import Icone, { IconeEmoji } from "../../components/a2/Icone";

// ═══════════════════════════════════════════════════════════════════════
// Kit visual próprio do Comercial: balcão / frente de caixa. Blocos firmes com
// borda grossa, números grandes tabulares, botões em "tecla" (com degrau) e
// etiquetas cheias. Não usa o kit do Financeiro.
// ═══════════════════════════════════════════════════════════════════════
const BORDA = "2px solid var(--c-borda)";
export const NUM: any = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: "'tnum'" };
export const cardStyle: any = { background: "#fff", border: BORDA, borderRadius: 14 };
export const inputStyle: any = { width: "100%", background: "#fff", border: BORDA, borderRadius: 10, padding: "11px 13px", color: "var(--c-tinta)", fontSize: 14.5, fontWeight: 600, boxSizing: "border-box", outline: "none" };
export const inputSm: any = { ...inputStyle, padding: "9px 12px", fontSize: 13.5 };
export const labelStyle: any = { color: "var(--c-sub)", fontSize: 12, fontWeight: 800, display: "block", marginBottom: 6 };
export const thStyle: any = { padding: "12px 16px", color: "#fff", fontSize: 12, textAlign: "left", fontWeight: 800, background: "var(--c-tinta)", whiteSpace: "nowrap" };
export const tdStyle: any = { padding: "13px 16px", fontSize: 14, color: "var(--c-tinta)", borderTop: BORDA, verticalAlign: "middle", ...NUM };

function tom(cor?: string) {
  const c = (cor || "").toLowerCase();
  if (["#dc2626", "#ef4444", "#b91c1c", "#db2777"].includes(c)) return { bg: "#DC2626", fg: "#fff", claro: "#FEE2E2" };
  if (["#c2410c", "#ea580c", "#f59e0b", "#d97706", "#b45309"].includes(c)) return { bg: "#F59E0B", fg: "#18181B", claro: "#FEF3C7" };
  if (["#16a34a", "#059669", "#047857"].includes(c)) return { bg: "#16A34A", fg: "#fff", claro: "#DCFCE7" };
  if (["#2563eb", "#0891b2"].includes(c)) return { bg: "#2563EB", fg: "#fff", claro: "#DBEAFE" };
  if (["#7c3aed"].includes(c)) return { bg: "#7C3AED", fg: "#fff", claro: "#EDE9FE" };
  if (["#475569", "#64748b", "#94a3b8"].includes(c)) return { bg: "#E4E4E7", fg: "#3F3F46", claro: "#F4F4F5" };
  return { bg: "var(--w-500)", fg: "#fff", claro: "var(--w-50)" };
}

export function Page({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", boxSizing: "border-box" }}>{children}</div>;
}

export function PageHeader({ titulo, subtitulo, acao }: { icone?: string; titulo: string; subtitulo?: string; cor?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 8, alignSelf: "stretch", minHeight: 40, borderRadius: 4, background: "var(--w-500)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 style={{ color: "var(--c-tinta)", fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-.03em", lineHeight: 1.1 }}>{titulo}</h1>
          {subtitulo && <p style={{ color: "var(--c-sub)", fontSize: 13.5, margin: 0, fontWeight: 600 }}>{subtitulo}</p>}
        </div>
      </div>
      {acao}
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>{children}</div>;
}
export function Stat({ label, valor, cor, icone, sub }: { label: string; valor: ReactNode; cor?: string; icone?: string; sub?: string }) {
  const t = tom(cor);
  return (
    <div style={{ ...cardStyle, padding: 0, display: "flex", minWidth: 0, overflow: "hidden" }}>
      <span style={{ width: 54, flexShrink: 0, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icone ? <IconeEmoji e={icone} tamanho={22} /> : null}</span>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ color: "var(--c-sub)", fontSize: 12, fontWeight: 800 }}>{label}</span>
        <div style={{ color: "var(--c-tinta)", fontSize: 24, fontWeight: 900, letterSpacing: "-.02em", lineHeight: 1.15, overflowWrap: "anywhere", ...NUM }}>{valor}</div>
        {sub && <div style={{ color: "var(--c-sub)", fontSize: 12, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Card({ titulo, acao, children, pad = 18 }: { titulo?: string; cor?: string; acao?: ReactNode; children: ReactNode; pad?: number }) {
  return (
    <div style={{ ...cardStyle, width: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      {(titulo || acao) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: BORDA, gap: 10, flexWrap: "wrap" }}>
          {titulo && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "var(--c-tinta)", letterSpacing: "-.01em" }}>{titulo}</h3>}
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
          <tbody className="com-tabela">
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
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--w-500)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4, boxShadow: "0 4px 0 var(--w-700)" }}><IconeEmoji e={icone} tamanho={26} /></div>
      <h3 style={{ color: "var(--c-tinta)", fontSize: 16, fontWeight: 900, margin: 0 }}>{titulo}</h3>
      {sub && <p style={{ color: "var(--c-sub)", fontSize: 13.5, margin: 0, maxWidth: 380, fontWeight: 600 }}>{sub}</p>}
      {acao && <div style={{ marginTop: 12 }}>{acao}</div>}
    </div>
  );
}
export function Empty(p: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return <div style={{ ...cardStyle, padding: "40px 24px" }}><Vazio {...p} /></div>;
}

export function Banner({ tipo = "info", children }: { tipo?: "info" | "warn" | "ok"; children: ReactNode }) {
  const m = { info: { bg: "var(--w-50)", bd: "var(--w-500)", ic: "info" }, warn: { bg: "#FEF3C7", bd: "#F59E0B", ic: "alerta" }, ok: { bg: "#DCFCE7", bd: "#16A34A", ic: "check" } }[tipo];
  return (
    <div style={{ background: m.bg, border: `2px solid ${m.bd}`, borderRadius: 12, padding: "11px 14px", color: "var(--c-tinta)", fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: m.bd, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome={m.ic as any} tamanho={15} /></span>
      <div>{children}</div>
    </div>
  );
}

// botão em formato de tecla (degrau embaixo)
export function Btn({ children, onClick, cor, variante = "primary", disabled }: { children: ReactNode; onClick?: () => void; cor?: string; variante?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const t = tom(cor);
  const perigo = t.bg === "#DC2626";
  const base: any = { height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 11, padding: "0 16px", fontSize: 14, fontWeight: 900, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", border: "none", transition: "transform .06s, box-shadow .06s" };
  const est: any = {
    primary: perigo ? { ...base, background: "#DC2626", color: "#fff", boxShadow: "0 3px 0 #991B1B" } : { ...base, background: "var(--w-500)", color: "#fff", boxShadow: "0 3px 0 var(--w-700)" },
    ghost: { ...base, background: "#fff", color: "var(--c-tinta)", boxShadow: "0 3px 0 var(--c-borda), inset 0 0 0 2px var(--c-borda)" },
    danger: { ...base, background: "#FEE2E2", color: "#B91C1C", boxShadow: "0 3px 0 #FCA5A5" },
  };
  return <button className="com-tecla" onClick={onClick} disabled={disabled} style={est[variante]}>{children}</button>;
}

export function Modal({ titulo, onClose, children, footer, maxWidth = 520 }: { titulo: string; cor?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(24,24,27,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, border: "2px solid var(--c-tinta)", boxShadow: "0 8px 0 var(--c-tinta)", width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--c-tinta)", color: "#fff", position: "sticky", top: 0, zIndex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{titulo}</h2>
          <button onClick={onClose} title="Fechar (Esc)" style={{ marginLeft: "auto", background: "rgba(255,255,255,.12)", border: 0, color: "#fff", cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: BORDA, padding: "14px 16px", flexWrap: "wrap", background: "#FAFAFA" }}>{footer}</div>}
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
export function Pill({ texto, cor }: { texto: string; cor: string }) {
  const t = tom(cor);
  return <span style={{ fontSize: 12, fontWeight: 900, color: t.fg, background: t.bg, borderRadius: 7, padding: "4px 9px", whiteSpace: "nowrap", display: "inline-block" }}>{texto}</span>;
}
export function IconBtn({ icone, onClick, title }: { icone: string; onClick?: () => void; title?: string }) {
  const perigo = /🗑|❌|✕|✖/.test(icone);
  return (
    <button onClick={onClick} title={title} style={{ background: perigo ? "#FEE2E2" : "#fff", color: perigo ? "#B91C1C" : "var(--c-tinta)", border: BORDA, borderRadius: 9, width: 34, height: 34, cursor: "pointer", marginLeft: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>
      <IconeEmoji e={icone} tamanho={15} />
    </button>
  );
}
