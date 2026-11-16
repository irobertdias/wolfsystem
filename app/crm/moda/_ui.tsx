"use client";
import { ReactNode } from "react";
import Icone, { IconeEmoji } from "../../components/a2/Icone";

// ═══════════════════════════════════════════════════════════════════════
// Kit visual próprio da Moda: estilo editorial de boutique. Papel creme, linhas
// finas, títulos em serifa, botões pretos em caixa alta e formulários em gaveta
// lateral (como provador). Não usa o kit do Financeiro.
// ═══════════════════════════════════════════════════════════════════════
export const SERIFA = "var(--font-moda), 'Playfair Display', Georgia, serif";
const LINHA = "1px solid var(--m-linha)";
const caixa: any = { textTransform: "uppercase", letterSpacing: ".16em" };

export const cardStyle: any = { background: "var(--m-papel)", border: LINHA };
export const inputStyle: any = { width: "100%", background: "transparent", border: 0, borderBottom: "1px solid var(--m-linha-forte)", borderRadius: 0, padding: "10px 2px", color: "var(--m-tinta)", fontSize: 14, fontWeight: 500, boxSizing: "border-box", outline: "none" };
export const inputSm: any = { ...inputStyle, padding: "8px 2px", fontSize: 13.5 };
export const labelStyle: any = { color: "var(--m-sub)", fontSize: 10, fontWeight: 700, display: "block", marginBottom: 2, ...caixa };
export const thStyle: any = { padding: "12px 16px", color: "var(--m-sub)", fontSize: 10, textAlign: "left", fontWeight: 700, borderBottom: "1px solid var(--m-tinta)", whiteSpace: "nowrap", ...caixa };
export const tdStyle: any = { padding: "15px 16px", fontSize: 13.5, color: "var(--m-tinta)", borderTop: LINHA, verticalAlign: "middle" };

function tom(cor?: string) {
  const c = (cor || "").toLowerCase();
  if (["#dc2626", "#ef4444", "#b91c1c", "#db2777"].includes(c)) return { fg: "#9F1239", bg: "#FCE7EC" };
  if (["#c2410c", "#ea580c", "#f59e0b", "#d97706", "#b45309"].includes(c)) return { fg: "#92400E", bg: "#FBF0DC" };
  if (["#16a34a", "#059669", "#047857"].includes(c)) return { fg: "#3F6212", bg: "#EEF3E2" };
  if (["#0891b2", "#2563eb"].includes(c)) return { fg: "#1E3A5F", bg: "#E6EDF5" };
  if (["#7c3aed"].includes(c)) return { fg: "#6B2149", bg: "#F6E4EE" };
  if (["#475569", "#64748b", "#94a3b8"].includes(c)) return { fg: "#57534E", bg: "#EFEAE2" };
  return { fg: "var(--w-700)", bg: "var(--w-50)" };
}

export function Page({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 26, width: "100%", boxSizing: "border-box" }}>{children}</div>;
}

// cabeçalho de revista: sobretítulo em caixa alta, título grande em serifa
export function PageHeader({ titulo, subtitulo, acao }: { icone?: string; titulo: string; subtitulo?: string; cor?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", paddingBottom: 16, borderBottom: "1px solid var(--m-tinta)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--w-600)", ...caixa }}>Ateliê · {new Date().toLocaleDateString("pt-BR", { month: "long" })}</span>
        <h1 style={{ color: "var(--m-tinta)", fontSize: 38, fontWeight: 500, margin: 0, fontFamily: SERIFA, letterSpacing: "-.01em", lineHeight: 1.05 }}>{titulo}</h1>
        {subtitulo && <p style={{ color: "var(--m-sub)", fontSize: 14, margin: 0, fontFamily: SERIFA, fontStyle: "italic" }}>{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

// números grandes em serifa separados por fios verticais
export function Stats({ children }: { children: ReactNode }) {
  return <div className="moda-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", borderTop: LINHA, borderBottom: LINHA }}>{children}</div>;
}
export function Stat({ label, valor, cor, sub }: { label: string; valor: ReactNode; cor?: string; icone?: string; sub?: string }) {
  const t = tom(cor);
  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, borderRight: LINHA }}>
      <span style={{ color: "var(--m-sub)", fontSize: 10, fontWeight: 700, ...caixa }}>{label}</span>
      <div style={{ color: t.fg === "var(--w-700)" ? "var(--m-tinta)" : t.fg, fontSize: 30, fontWeight: 500, fontFamily: SERIFA, lineHeight: 1.1, overflowWrap: "anywhere" }}>{valor}</div>
      {sub && <div style={{ color: "var(--m-sub)", fontSize: 12.5, fontStyle: "italic", fontFamily: SERIFA }}>{sub}</div>}
    </div>
  );
}

export function Card({ titulo, acao, children, pad = 22 }: { titulo?: string; cor?: string; acao?: ReactNode; children: ReactNode; pad?: number }) {
  return (
    <div style={{ ...cardStyle, padding: pad, width: "100%", boxSizing: "border-box", overflow: pad === 0 ? "hidden" : undefined }}>
      {(titulo || acao) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 10, flexWrap: "wrap", padding: pad === 0 ? "16px 20px 0" : 0 }}>
          {titulo && <h3 style={{ margin: 0, fontSize: 19, fontWeight: 500, color: "var(--m-tinta)", fontFamily: SERIFA }}>{titulo}</h3>}
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
          <tbody className="moda-tabela">
            {empty ? <tr><td colSpan={cols.length} style={{ padding: "48px 24px", textAlign: "center" }}>{empty}</td></tr> : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Vazio({ titulo, sub, acao }: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--w-500)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6a2 2 0 1 0-2-2M12 6v1.5L3 15h18l-9-7.5" /></svg>
      <h3 style={{ color: "var(--m-tinta)", fontSize: 22, fontWeight: 500, margin: 0, fontFamily: SERIFA }}>{titulo}</h3>
      {sub && <p style={{ color: "var(--m-sub)", fontSize: 13.5, margin: 0, maxWidth: 400, fontFamily: SERIFA, fontStyle: "italic" }}>{sub}</p>}
      {acao && <div style={{ marginTop: 14 }}>{acao}</div>}
    </div>
  );
}
export function Empty(p: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return <div style={{ ...cardStyle, padding: "48px 24px" }}><Vazio {...p} /></div>;
}

export function Banner({ tipo = "info", children }: { tipo?: "info" | "warn" | "ok"; children: ReactNode }) {
  const cor = { info: "var(--w-600)", warn: "#92400E", ok: "#3F6212" }[tipo];
  return (
    <div style={{ borderTop: `1px solid ${cor}`, borderBottom: LINHA, padding: "12px 4px", color: "var(--m-txt2)", fontSize: 13.5, lineHeight: 1.6, display: "flex", gap: 14, alignItems: "baseline" }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: cor, flexShrink: 0, ...caixa }}>{tipo === "warn" ? "Atenção" : tipo === "ok" ? "Pronto" : "Nota"}</span>
      <div>{children}</div>
    </div>
  );
}

export function Btn({ children, onClick, cor, variante = "primary", disabled }: { children: ReactNode; onClick?: () => void; cor?: string; variante?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const perigo = tom(cor).fg === "#9F1239";
  const base: any = { height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 0, padding: "0 22px", fontSize: 11, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap", ...caixa };
  const est: any = {
    primary: perigo ? { ...base, border: "1px solid #9F1239", background: "#9F1239", color: "#fff" } : { ...base, border: "1px solid var(--m-tinta)", background: "var(--m-tinta)", color: "var(--m-papel)" },
    ghost: { ...base, border: "1px solid var(--m-tinta)", background: "transparent", color: "var(--m-tinta)" },
    danger: { ...base, border: "1px solid #9F1239", background: "transparent", color: "#9F1239" },
  };
  return <button className="moda-btn" onClick={onClick} disabled={disabled} style={est[variante]}>{children}</button>;
}

// gaveta lateral (abre da direita, como uma arara)
export function Modal({ titulo, onClose, children, footer, maxWidth = 520 }: { titulo: string; cor?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,0.38)", zIndex: 2000, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} className="moda-gaveta" style={{ background: "var(--m-papel)", width: "100%", maxWidth: Math.min(maxWidth, 760), height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", boxSizing: "border-box", boxShadow: "-30px 0 60px -30px rgba(28,25,23,.45)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 28px 16px", borderBottom: "1px solid var(--m-tinta)", position: "sticky", top: 0, background: "var(--m-papel)", zIndex: 1 }}>
          <h2 style={{ color: "var(--m-tinta)", fontSize: 26, fontWeight: 500, margin: 0, fontFamily: SERIFA }}>{titulo}</h2>
          <button onClick={onClose} title="Fechar" style={{ marginLeft: "auto", background: "transparent", border: 0, color: "var(--m-tinta)", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, ...caixa }}>Fechar <Icone nome="x" tamanho={14} /></button>
        </div>
        <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>{children}</div>
        {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: LINHA, padding: "16px 28px", flexWrap: "wrap", position: "sticky", bottom: 0, background: "var(--m-papel)" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, flex }: { label: string; children: ReactNode; flex?: number | string }) {
  return <div style={{ flex: flex as any, minWidth: 0 }}><label style={labelStyle}>{label}</label>{children}</div>;
}
export function Row({ children, gap = 18 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, flexWrap: "wrap", alignItems: "flex-end" }}>{children}</div>;
}
export function Pill({ texto, cor }: { texto: string; cor: string }) {
  const t = tom(cor);
  return <span style={{ fontSize: 10, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap", display: "inline-block", ...caixa, letterSpacing: ".1em" }}>{texto}</span>;
}
export function IconBtn({ icone, onClick, title }: { icone: string; onClick?: () => void; title?: string }) {
  const perigo = /🗑|❌|✕|✖/.test(icone);
  return (
    <button onClick={onClick} title={title} style={{ background: "transparent", color: perigo ? "#9F1239" : "var(--m-tinta)", border: LINHA, borderRadius: 999, width: 32, height: 32, cursor: "pointer", marginLeft: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>
      <IconeEmoji e={icone} tamanho={14} />
    </button>
  );
}
