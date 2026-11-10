"use client";
import { ReactNode, CSSProperties } from "react";
import Icone from "../components/a2/Icone";

// ═══════════════════════════════════════════════════════════════════════
// Moldura A2 das telas de acesso (login, cadastro, nova senha):
// painel esmeralda à esquerda e cartão branco flutuante à direita.
// ═══════════════════════════════════════════════════════════════════════

export const inputA2: CSSProperties = {
  width: "100%", boxSizing: "border-box", height: 48,
  background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 13,
  padding: "0 14px", fontSize: 14.5, fontWeight: 600, color: "#0F172A", outline: "none",
};

export function LogoA2({ claro = false }: { claro?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 18, color: claro ? "#065F46" : "#fff",
        background: claro ? "#fff" : "linear-gradient(140deg, #059669 0%, #065F46 100%)",
        boxShadow: claro ? "0 8px 20px -8px rgba(0,0,0,.35)" : "0 6px 14px -4px rgba(5,150,105,.55)",
      }}>W</div>
      <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.01em", color: claro ? "#fff" : "#0F172A" }}>Wolf System</span>
    </div>
  );
}

const DESTAQUES = [
  { icone: "whatsapp", texto: "WhatsApp, Instagram e Messenger num só lugar" },
  { icone: "robo", texto: "Chatbot com inteligência artificial" },
  { icone: "funil", texto: "Funil de vendas e relatórios em tempo real" },
  { icone: "usuarios", texto: "Roleta que distribui os contatos para a equipe" },
];

export function MolduraAuth({ titulo, sub, children, larguraCartao = 440, destaques = DESTAQUES, chamada }: {
  titulo: string; sub?: string; children: ReactNode; larguraCartao?: number;
  destaques?: { icone: string; texto: string }[]; chamada?: ReactNode;
}) {
  return (
    <div className="a2-auth" style={{ minHeight: "100vh", display: "flex", background: "#F3F6F5", color: "#0F172A" }}>
      <style>{`
        @media (max-width: 960px) { .a2-auth-hero { display: none !important; } .a2-auth-logo-mobile { display: flex !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes a2Sobe { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .a2-auth-cartao { animation: a2Sobe .45s ease-out both; }
        .a2-auth-botao:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
        .a2-auth-link:hover { color: #065F46 !important; text-decoration: underline; }
      `}</style>

      {/* Painel esmeralda */}
      <aside className="a2-auth-hero" style={{
        flex: "1 1 44%", position: "sticky", top: 16, alignSelf: "flex-start", height: "calc(100vh - 32px)", boxSizing: "border-box",
        overflow: "hidden", margin: 16, borderRadius: 28,
        background: "linear-gradient(130deg, #10B981 0%, #059669 38%, #065F46 78%, #064E3B 100%)",
        boxShadow: "0 30px 60px -28px rgba(6,95,70,.75)", color: "#fff",
        display: "flex", flexDirection: "column", padding: "40px 48px",
      }}>
        <div aria-hidden style={{ position: "absolute", right: -120, top: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div aria-hidden style={{ position: "absolute", left: -90, bottom: -140, width: 340, height: 340, borderRadius: "50%", background: "rgba(255,255,255,.06)" }} />

        <div style={{ position: "relative" }}><LogoA2 claro /></div>

        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520, gap: 22 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", background: "rgba(255,255,255,.14)", borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#A7F3D0", boxShadow: "0 0 0 4px rgba(167,243,208,.25)" }} />
            Sistema online, atendendo agora
          </span>
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.025em" }}>
            Atendimento que vira venda.
          </h1>
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: "rgba(255,255,255,.82)", maxWidth: 460 }}>
            CRM e atendimento no WhatsApp para a sua equipe responder, qualificar e fechar sem perder nenhum cliente.
          </p>
          {chamada}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            {destaques.map((d) => (
              <div key={d.texto} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icone nome={d.icone as any} tamanho={17} />
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "rgba(255,255,255,.92)" }}>{d.texto}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "rgba(255,255,255,.6)", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.14)" }}>
          <span>© {new Date().getFullYear()} Wolf System</span>
          <span>wolfgyn.com.br</span>
        </div>
      </aside>

      {/* Formulário */}
      <main style={{ flex: "1 1 56%", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
        <div style={{ width: "100%", maxWidth: larguraCartao }}>
          <div className="a2-auth-logo-mobile" style={{ display: "none", justifyContent: "center", marginBottom: 22 }}><LogoA2 /></div>
          <div className="a2-auth-cartao" style={{ background: "#fff", borderRadius: 24, padding: "34px 32px", boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 24px 48px -24px rgba(16,24,40,.28)" }}>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>{titulo}</h2>
            {sub && <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748B", lineHeight: 1.5 }}>{sub}</p>}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Campo com rótulo, ícone à esquerda e espaço opcional à direita.
export function CampoA2({ rotulo, icone, direita, extra, children, dica, erro }: {
  rotulo: string; icone?: string; direita?: ReactNode; extra?: ReactNode; children: ReactNode; dica?: ReactNode; erro?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: "#475569" }}>{rotulo}</label>
        {extra}
      </div>
      <div style={{ position: "relative" }}>
        {icone && (
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: erro ? "#DC2626" : "#94A3B8", display: "flex", pointerEvents: "none" }}>
            <Icone nome={icone as any} tamanho={17} />
          </span>
        )}
        {children}
        {direita && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{direita}</span>}
      </div>
      {dica}
    </div>
  );
}

export function OlhoSenha({ visivel, onClick }: { visivel: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={visivel ? "Esconder senha" : "Mostrar senha"}
      style={{ width: 34, height: 34, borderRadius: 10, border: 0, background: visivel ? "#ECFDF5" : "transparent", color: visivel ? "#059669" : "#94A3B8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icone nome="olho" tamanho={17} />
    </button>
  );
}

export function BotaoA2({ children, onClick, disabled, carregando, variante = "primario", type = "button" }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; carregando?: boolean; variante?: "primario" | "claro"; type?: "button" | "submit";
}) {
  const primario = variante === "primario";
  return (
    <button type={type} onClick={onClick} disabled={disabled || carregando} className="a2-auth-botao"
      style={{
        width: "100%", height: 52, borderRadius: 15, border: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        fontSize: 15, fontWeight: 800, transition: "all .15s",
        cursor: disabled || carregando ? "not-allowed" : "pointer", opacity: disabled && !carregando ? 0.5 : 1,
        background: primario ? "linear-gradient(140deg, #10B981, #059669 60%, #047857)" : "#F3F6F5",
        color: primario ? "#fff" : "#334155",
        boxShadow: primario ? "0 16px 30px -14px rgba(5,150,105,.8)" : "none",
      }}>
      {carregando && <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} />}
      {children}
    </button>
  );
}

export function AvisoA2({ tipo = "erro", children }: { tipo?: "erro" | "ok"; children: ReactNode }) {
  const erro = tipo === "erro";
  return (
    <div role={erro ? "alert" : "status"} style={{ display: "flex", alignItems: "center", gap: 10, background: erro ? "#FEF2F2" : "#F7FFFB", boxShadow: `inset 0 0 0 1.5px ${erro ? "#FECACA" : "#A7F3D0"}`, borderRadius: 14, padding: "11px 14px" }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: erro ? "#FEE2E2" : "#ECFDF5", color: erro ? "#B91C1C" : "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icone nome={erro ? "alerta" : "check"} tamanho={15} />
      </span>
      <span style={{ color: erro ? "#991B1B" : "#065F46", fontSize: 13.5, fontWeight: 600 }}>{children}</span>
    </div>
  );
}

export function Divisor({ texto }: { texto: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#EEF2F1" }} />
      <span style={{ fontSize: 12.5, color: "#94A3B8", fontWeight: 600 }}>{texto}</span>
      <div style={{ flex: 1, height: 1, background: "#EEF2F1" }} />
    </div>
  );
}
