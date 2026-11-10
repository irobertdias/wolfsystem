"use client";
import { ReactNode } from "react";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// _ui — kit visual do Financeiro no padrão A2 (esmeralda, cartões brancos,
// sombras suaves). A API é a mesma de antes: as seções não mudam.
//   import { Page, PageHeader, Stats, Stat, Table, Card, Modal, ... } from "./_ui";
// ═══════════════════════════════════════════════════════════════════════
export const COR = "#059669";
export const C = { amber: "#C2410C", green: "#059669", red: "#DC2626", blue: "#0F766E", purple: "#047857", pink: "#B91C1C", slate: "#475569", gray: "#64748B" };

export const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n: number) => `${(n || 0).toFixed(1)}%`;
export const hoje = () => new Date().toISOString().slice(0, 10);
export const mesAtual = () => new Date().toISOString().slice(0, 7);
export const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";
export const cardStyle: any = { background: "#fff", borderRadius: 20, boxShadow: SOMBRA };
export const inputStyle: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
export const inputSm: any = { ...inputStyle, padding: "9px 12px", fontSize: 13, borderRadius: 10 };
export const labelStyle: any = { color: "#64748B", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 };
export const thStyle: any = { padding: "14px 18px", color: "#64748B", fontSize: 12, textAlign: "left", fontWeight: 700, borderBottom: "1px solid #EEF2F1", background: "#F7FAF9", whiteSpace: "nowrap" };
export const tdStyle: any = { padding: "14px 18px", fontSize: 13.5, color: "#0F172A", borderTop: "1px solid #F1F5F4", verticalAlign: "middle" };

// Tons A2 a partir da cor pedida pela seção (vermelho e laranja continuam com sentido de alerta).
function tom(cor?: string) {
  const c = (cor || "").toLowerCase();
  if (["#dc2626", "#ef4444", "#b91c1c", "#db2777"].includes(c)) return { fg: "#B91C1C", bg: "#FEF2F2", valor: "#DC2626" };
  if (["#c2410c", "#ea580c", "#f59e0b", "#d97706"].includes(c)) return { fg: "#C2410C", bg: "#FFF7ED", valor: "#C2410C" };
  if (["#475569", "#64748b", "#94a3b8"].includes(c)) return { fg: "#475569", bg: "#F3F6F5", valor: "#0F172A" };
  return { fg: "#059669", bg: "#ECFDF5", valor: "#0F172A" };
}

// container largura total
export function Page({ children }: { children: ReactNode }) {
  return <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box" }}>{children}</div>;
}

// título grande da seção (como nas telas do protótipo A2)
export function PageHeader({ titulo, subtitulo, acao }: { icone?: string; titulo: string; subtitulo?: string; cor?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>{titulo}</h1>
        {subtitulo && <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

// cartões de resumo
export function Stats({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 18 }}>{children}</div>;
}
export function Stat({ label, valor, cor = COR, icone, sub }: { label: string; valor: ReactNode; cor?: string; icone?: string; sub?: string }) {
  const t = tom(cor);
  return (
    <div style={{ ...cardStyle, borderRadius: 18, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icone && <span style={{ width: 30, height: 30, borderRadius: 9, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={icone} tamanho={16} /></span>}
        <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ color: t.valor, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.15, overflowWrap: "anywhere" }}>{valor}</div>
      {sub && <div style={{ color: "#64748B", fontSize: 12.5 }}>{sub}</div>}
    </div>
  );
}

// cartão branco genérico
export function Card({ titulo, acao, children, pad = 22 }: { titulo?: string; cor?: string; acao?: ReactNode; children: ReactNode; pad?: number }) {
  return (
    <div style={{ ...cardStyle, padding: pad, width: "100%", boxSizing: "border-box", overflow: pad === 0 ? "hidden" : undefined }}>
      {(titulo || acao) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: pad === 0 ? "16px 20px" : 0, marginBottom: pad === 0 ? 0 : 14, borderBottom: pad === 0 ? "1px solid #F1F5F4" : "none", gap: 10, flexWrap: "wrap" }}>
          {titulo && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{titulo}</h3>}
          {acao}
        </div>
      )}
      {children}
    </div>
  );
}

// tabela emoldurada: sempre mostra o cabeçalho; vazio vira linha centralizada dentro do quadro
export function Table({ cols, empty, children }: { cols: { label: string; align?: "left" | "right" | "center"; width?: number }[]; empty?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ ...cardStyle, borderRadius: 22, width: "100%", overflow: "hidden", boxSizing: "border-box" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{cols.map((c, i) => <th key={i} style={{ ...thStyle, textAlign: c.align || "left", width: c.width }}>{c.label}</th>)}</tr></thead>
          <tbody className="a2-tabela-fin">
            {empty ? (
              <tr><td colSpan={cols.length} style={{ padding: "44px 24px", textAlign: "center" }}>{empty}</td></tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// estado vazio (usado dentro de Table ou solto)
export function Vazio({ icone = "📭", titulo, sub, acao }: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}><IconeEmoji e={icone} tamanho={24} /></div>
      <h3 style={{ color: "#0F172A", fontSize: 15, fontWeight: 800, margin: 0 }}>{titulo}</h3>
      {sub && <p style={{ color: "#64748B", fontSize: 13, margin: 0, maxWidth: 380 }}>{sub}</p>}
      {acao && <div style={{ marginTop: 12 }}>{acao}</div>}
    </div>
  );
}

// estado vazio em cartão (solto, fora de tabela)
export function Empty({ icone = "📭", titulo, sub, acao }: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return <div style={{ ...cardStyle, padding: "44px 24px" }}><Vazio icone={icone} titulo={titulo} sub={sub} acao={acao} /></div>;
}

// aviso
export function Banner({ tipo = "info", children }: { tipo?: "info" | "warn" | "ok"; children: ReactNode }) {
  const m = {
    info: { bg: "#F7FFFB", anel: "#A7F3D0", cor: "#334155", icBg: "#ECFDF5", icCor: "#059669", ic: "info" },
    warn: { bg: "#FFFBEB", anel: "#FDE68A", cor: "#78350F", icBg: "#FEF3C7", icCor: "#B45309", ic: "alerta" },
    ok: { bg: "#F7FFFB", anel: "#A7F3D0", cor: "#065F46", icBg: "#ECFDF5", icCor: "#059669", ic: "check" },
  }[tipo];
  return (
    <div style={{ background: m.bg, boxShadow: `inset 0 0 0 1.5px ${m.anel}`, borderRadius: 16, padding: "13px 16px", color: m.cor, fontSize: 13, lineHeight: 1.55, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: m.icBg, color: m.icCor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome={m.ic as any} tamanho={15} /></span>
      <div style={{ paddingTop: 4 }}>{children}</div>
    </div>
  );
}

// botão
export function Btn({ children, onClick, cor = COR, variante = "primary", disabled }: { children: ReactNode; onClick?: () => void; cor?: string; variante?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const t = tom(cor);
  const base: any = { height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, padding: "0 18px", fontSize: 13.5, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", border: "none" };
  const vermelho = t.fg === "#B91C1C";
  const est: any = {
    primary: vermelho
      ? { ...base, background: "linear-gradient(140deg, #EF4444, #DC2626)", color: "#fff", boxShadow: "0 12px 24px -12px rgba(220,38,38,.7)" }
      : { ...base, background: "linear-gradient(140deg, #10B981, #059669)", color: "#fff", boxShadow: "0 12px 24px -12px rgba(5,150,105,.8)" },
    ghost: { ...base, background: "#F3F6F5", color: "#334155", fontWeight: 700 },
    danger: { ...base, background: "#FEF2F2", color: "#B91C1C", fontWeight: 700 },
  };
  return <button onClick={onClick} disabled={disabled} style={est[variante]}>{children}</button>;
}

// janela
export function Modal({ titulo, onClose, children, footer, maxWidth = 520 }: { titulo: string; cor?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, boxShadow: "0 30px 60px -20px rgba(15,23,42,.45)", padding: 24, width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>{titulo}</h2>
          <button onClick={onClose} title="Fechar" style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome="x" tamanho={16} /></button>
        </div>
        {children}
        {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #F1F5F4", paddingTop: 16, flexWrap: "wrap" }}>{footer}</div>}
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
  const neutro = t.fg === "#475569";
  return <span style={{ fontSize: 12, fontWeight: 700, color: neutro ? "#475569" : t.fg, background: t.bg, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap", display: "inline-block" }}>{texto}</span>;
}
export function IconBtn({ icone, onClick, title }: { icone: string; onClick?: () => void; title?: string }) {
  const perigo = /🗑|❌|✕|✖/.test(icone);
  return (
    <button onClick={onClick} title={title}
      style={{ background: perigo ? "#FEF2F2" : "#F3F6F5", color: perigo ? "#B91C1C" : "#475569", border: 0, borderRadius: 10, width: 34, height: 34, cursor: "pointer", marginLeft: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>
      <IconeEmoji e={icone} tamanho={15} />
    </button>
  );
}
