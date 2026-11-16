"use client";
import { ReactNode } from "react";
import Icone, { IconeEmoji } from "../../components/a2/Icone";

// ═══════════════════════════════════════════════════════════════════════
// Kit visual próprio do Consignado: app de banco / mesa de crédito. Azul-marinho,
// cartões brancos que "sobem" sobre o cabeçalho, valores com centavos menores,
// botões em pílula. Não usa o kit do Financeiro.
// ═══════════════════════════════════════════════════════════════════════
const BORDA = "1px solid var(--k-borda)";
export const cardStyle: any = { background: "#fff", border: BORDA, borderRadius: 18, boxShadow: "0 1px 2px rgba(11,27,63,.04), 0 12px 28px -20px rgba(11,27,63,.35)" };
export const inputStyle: any = { width: "100%", background: "var(--k-campo)", border: "1px solid transparent", borderRadius: 12, padding: "12px 14px", color: "var(--k-tinta)", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
export const inputSm: any = { ...inputStyle, padding: "10px 12px", fontSize: 13.5 };
export const labelStyle: any = { color: "var(--k-sub)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 };
export const thStyle: any = { padding: "12px 18px", color: "var(--k-sub)", fontSize: 11.5, textAlign: "left", fontWeight: 700, borderBottom: BORDA, background: "#fff", whiteSpace: "nowrap" };
export const tdStyle: any = { padding: "14px 18px", fontSize: 13.5, color: "var(--k-tinta)", borderTop: BORDA, verticalAlign: "middle" };

function tom(cor?: string) {
  const c = (cor || "").toLowerCase();
  if (["#dc2626", "#ef4444", "#b91c1c", "#db2777"].includes(c)) return { fg: "#C0262D", bg: "#FDECEC" };
  if (["#c2410c", "#ea580c", "#f59e0b", "#d97706", "#b45309"].includes(c)) return { fg: "#A15C07", bg: "#FFF4E0" };
  if (["#16a34a", "#059669", "#047857"].includes(c)) return { fg: "#0E7A4F", bg: "#E5F6EE" };
  if (["#7c3aed"].includes(c)) return { fg: "#5B3CC4", bg: "#EFEBFD" };
  if (["#475569", "#64748b", "#94a3b8"].includes(c)) return { fg: "#4A5878", bg: "#EEF2F8" };
  return { fg: "var(--w-700)", bg: "var(--w-50)" };
}

/** "R$ 1.234,56" com os centavos menores, como em app de banco */
export function Dinheiro({ v, tam = 26 }: { v: string; tam?: number }) {
  const m = v.match(/^(.*?)(,\d{2})$/);
  if (!m) return <>{v}</>;
  return <span style={{ fontSize: tam, fontWeight: 800, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{m[1]}<span style={{ fontSize: tam * 0.55, fontWeight: 700, opacity: .7 }}>{m[2]}</span></span>;
}

export function Page({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", boxSizing: "border-box" }}>{children}</div>;
}

export function PageHeader({ titulo, subtitulo, acao }: { icone?: string; titulo: string; subtitulo?: string; cor?: string; acao?: ReactNode }) {
  return (
    <div style={{ ...cardStyle, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h1 style={{ color: "var(--k-tinta)", fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>{titulo}</h1>
        {subtitulo && <p style={{ color: "var(--k-sub)", fontSize: 13, margin: 0 }}>{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>{children}</div>;
}
export function Stat({ label, valor, cor, icone, sub }: { label: string; valor: ReactNode; cor?: string; icone?: string; sub?: string }) {
  const t = tom(cor);
  return (
    <div style={{ ...cardStyle, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icone && <span style={{ width: 36, height: 36, borderRadius: 12, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={icone} tamanho={17} /></span>}
        <span style={{ color: "var(--k-sub)", fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ color: "var(--k-tinta)", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, overflowWrap: "anywhere" }}>{typeof valor === "string" && /^R\$/.test(valor) ? <Dinheiro v={valor} tam={24} /> : valor}</div>
      {sub && <div style={{ color: "var(--k-sub)", fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export function Card({ titulo, acao, children, pad = 20 }: { titulo?: string; cor?: string; acao?: ReactNode; children: ReactNode; pad?: number }) {
  return (
    <div style={{ ...cardStyle, padding: pad, width: "100%", boxSizing: "border-box", overflow: pad === 0 ? "hidden" : undefined }}>
      {(titulo || acao) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: pad === 0 ? "16px 20px" : 0, marginBottom: pad === 0 ? 0 : 14, borderBottom: pad === 0 ? BORDA : "none", gap: 10, flexWrap: "wrap" }}>
          {titulo && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--k-tinta)" }}>{titulo}</h3>}
          {acao}
        </div>
      )}
      {children}
    </div>
  );
}

export function Table({ cols, empty, children }: { cols: { label: string; align?: "left" | "right" | "center"; width?: number }[]; empty?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ ...cardStyle, width: "100%", overflow: "hidden", boxSizing: "border-box" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{cols.map((c, i) => <th key={i} style={{ ...thStyle, textAlign: c.align || "left", width: c.width }}>{c.label}</th>)}</tr></thead>
          <tbody className="cons-tabela">
            {empty ? <tr><td colSpan={cols.length} style={{ padding: "44px 24px", textAlign: "center" }}>{empty}</td></tr> : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Vazio({ icone = "📭", titulo, sub, acao }: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: 54, height: 54, borderRadius: 999, background: "var(--w-50)", color: "var(--w-600)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}><IconeEmoji e={icone} tamanho={24} /></div>
      <h3 style={{ color: "var(--k-tinta)", fontSize: 15, fontWeight: 800, margin: 0 }}>{titulo}</h3>
      {sub && <p style={{ color: "var(--k-sub)", fontSize: 13, margin: 0, maxWidth: 380 }}>{sub}</p>}
      {acao && <div style={{ marginTop: 12 }}>{acao}</div>}
    </div>
  );
}
export function Empty(p: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return <div style={{ ...cardStyle, padding: "44px 24px" }}><Vazio {...p} /></div>;
}

export function Banner({ tipo = "info", children }: { tipo?: "info" | "warn" | "ok"; children: ReactNode }) {
  const m = { info: { bg: "#EEF4FF", cor: "#1D4ED8", ic: "info" }, warn: { bg: "#FFF4E0", cor: "#A15C07", ic: "alerta" }, ok: { bg: "#E5F6EE", cor: "#0E7A4F", ic: "check" } }[tipo];
  return (
    <div style={{ background: m.bg, borderRadius: 14, padding: "12px 16px", color: "var(--k-tinta)", fontSize: 13, lineHeight: 1.55, display: "flex", gap: 12, alignItems: "center" }}>
      <span style={{ color: m.cor, display: "flex", flexShrink: 0 }}><Icone nome={m.ic as any} tamanho={18} /></span>
      <div>{children}</div>
    </div>
  );
}

export function Btn({ children, onClick, cor, variante = "primary", disabled }: { children: ReactNode; onClick?: () => void; cor?: string; variante?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const perigo = tom(cor).fg === "#C0262D";
  const base: any = { height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, padding: "0 18px", fontSize: 13.5, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", border: "none" };
  const est: any = {
    primary: perigo ? { ...base, background: "#C0262D", color: "#fff" } : { ...base, background: "var(--k-tinta)", color: "#fff" },
    ghost: { ...base, background: "var(--k-campo)", color: "var(--k-tinta)" },
    danger: { ...base, background: "#FDECEC", color: "#C0262D" },
  };
  return <button className="cons-btn" onClick={onClick} disabled={disabled} style={est[variante]}>{children}</button>;
}

export function Modal({ titulo, onClose, children, footer, maxWidth = 520 }: { titulo: string; cor?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,27,63,0.5)", backdropFilter: "blur(2px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, boxShadow: "0 30px 70px -20px rgba(11,27,63,.55)", width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", background: "linear-gradient(120deg, var(--k-tinta), #17306B)", color: "#fff", position: "sticky", top: 0, zIndex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{titulo}</h2>
          <button onClick={onClose} title="Fechar" style={{ marginLeft: "auto", background: "rgba(255,255,255,.14)", border: 0, color: "#fff", cursor: "pointer", width: 34, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
        {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: BORDA, padding: "14px 22px", flexWrap: "wrap" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, flex }: { label: string; children: ReactNode; flex?: number | string }) {
  return <div style={{ flex: flex as any, minWidth: 0 }}><label style={labelStyle}>{label}</label>{children}</div>;
}
export function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, flexWrap: "wrap" }}>{children}</div>;
}
export function Pill({ texto, cor }: { texto: string; cor: string }) {
  const t = tom(cor);
  return <span style={{ fontSize: 12, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 8, padding: "4px 10px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 6, height: 6, borderRadius: 6, background: "currentColor" }} />{texto}</span>;
}
export function IconBtn({ icone, onClick, title }: { icone: string; onClick?: () => void; title?: string }) {
  const perigo = /🗑|❌|✕|✖/.test(icone);
  return (
    <button onClick={onClick} title={title} style={{ background: perigo ? "#FDECEC" : "var(--k-campo)", color: perigo ? "#C0262D" : "var(--k-tinta)", border: 0, borderRadius: 999, width: 34, height: 34, cursor: "pointer", marginLeft: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>
      <IconeEmoji e={icone} tamanho={15} />
    </button>
  );
}
