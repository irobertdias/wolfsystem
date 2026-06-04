"use client";
import { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════
// 🎨 _ui — kit visual compartilhado das telas do Financeiro
//   Importe nas seções:  import { Page, PageHeader, Stat, ... } from "./_ui";
//   Tudo ocupa largura total e segue o visual do resto do Wolf.
// ═══════════════════════════════════════════════════════════════════════

export const COR = "#d97706"; // âmbar — identidade do módulo
export const C = {
  amber: "#d97706", green: "#16a34a", red: "#dc2626", blue: "#2563eb",
  purple: "#7c3aed", pink: "#db2777", slate: "#475569", gray: "#6b7280",
};

// ── helpers de formato ──
export const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n: number) => `${(n || 0).toFixed(1)}%`;
export const hoje = () => new Date().toISOString().slice(0, 10);
export const mesAtual = () => new Date().toISOString().slice(0, 7);
export const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");

// ── estilos base ──
export const cardStyle: any = {
  background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
};
export const inputStyle: any = {
  width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
  padding: "10px 14px", color: "#1f2937", fontSize: 14, boxSizing: "border-box", outline: "none",
};
export const inputSm: any = { ...inputStyle, padding: "9px 12px", fontSize: 13 };
export const labelStyle: any = {
  color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: 0.5, display: "block", marginBottom: 6,
};
export const thStyle: any = {
  padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left",
  textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700,
  borderBottom: "1px solid #e5e7eb", background: "#f9fafb", whiteSpace: "nowrap",
};
export const tdStyle: any = { padding: "12px 16px", fontSize: 13, color: "#1f2937", borderTop: "1px solid #f3f4f6" };

// ── container da página (largura total) ──
export function Page({ children }: { children: ReactNode }) {
  return <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box" }}>{children}</div>;
}

// ── cabeçalho com badge em gradiente + ação à direita ──
export function PageHeader({ icone, titulo, subtitulo, cor = COR, acao }: { icone: string; titulo: string; subtitulo?: string; cor?: string; acao?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${cor} 0%, ${cor}bb 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: `0 8px 20px ${cor}40`, flexShrink: 0 }}>
          <span style={{ filter: "saturate(0) brightness(2)" }}>{icone}</span>
        </div>
        <div>
          <h1 style={{ color: "#1f2937", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>{titulo}</h1>
          {subtitulo && <p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>{subtitulo}</p>}
        </div>
      </div>
      {acao}
    </div>
  );
}

// ── linha de stat-cards (flex-wrap, ocupa tudo) ──
export function Stats({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>{children}</div>;
}
export function Stat({ label, valor, cor = COR, icone }: { label: string; valor: ReactNode; cor?: string; icone?: string }) {
  return (
    <div style={{ flex: "1 1 200px", minWidth: 180, ...cardStyle, padding: 18, borderTop: `3px solid ${cor}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icone && <div style={{ width: 28, height: 28, borderRadius: 8, background: `${cor}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icone}</div>}
        <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</span>
      </div>
      <div style={{ color: cor, fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>{valor}</div>
    </div>
  );
}

// ── card branco genérico ──
export function Card({ titulo, cor, acao, children, pad = 20 }: { titulo?: string; cor?: string; acao?: ReactNode; children: ReactNode; pad?: number }) {
  return (
    <div style={{ ...cardStyle, padding: pad, width: "100%", boxSizing: "border-box" }}>
      {(titulo || acao) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
          {titulo && <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: cor || "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</h3>}
          {acao}
        </div>
      )}
      {children}
    </div>
  );
}

// ── botão ──
export function Btn({ children, onClick, cor = COR, variante = "primary", disabled }: { children: ReactNode; onClick?: () => void; cor?: string; variante?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const base: any = { borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, whiteSpace: "nowrap", border: "none" };
  const estilos: any = {
    primary: { ...base, background: `linear-gradient(135deg, ${cor} 0%, ${cor}dd 100%)`, color: "#fff", boxShadow: `0 4px 12px ${cor}40` },
    ghost: { ...base, background: "#fff", color: cor, border: `1px solid ${cor}55` },
    danger: { ...base, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
  };
  return <button onClick={onClick} disabled={disabled} style={estilos[variante]}>{children}</button>;
}

// ── estado vazio ──
export function Empty({ icone = "📭", titulo, sub, acao }: { icone?: string; titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div style={{ ...cardStyle, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 42, marginBottom: 10 }}>{icone}</div>
      <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{titulo}</h3>
      {sub && <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>{sub}</p>}
      {acao && <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>{acao}</div>}
    </div>
  );
}

// ── modal ──
export function Modal({ titulo, cor = COR, onClose, children, footer, maxWidth = 520 }: { titulo: string; cor?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, padding: 26, width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: cor, fontSize: 18, fontWeight: 800, margin: 0 }}>{titulo}</h2>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
        </div>
        {children}
        {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── campo de formulário (label + input) ──
export function Field({ label, children, flex }: { label: string; children: ReactNode; flex?: number | string }) {
  return <div style={{ flex: flex as any }}><label style={labelStyle}>{label}</label>{children}</div>;
}
export function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, flexWrap: "wrap" }}>{children}</div>;
}

// ── badge/pílula ──
export function Pill({ texto, cor }: { texto: string; cor: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color: cor, background: `${cor}14`, border: `1px solid ${cor}44`, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{texto}</span>;
}