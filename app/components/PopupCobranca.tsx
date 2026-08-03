"use client";
import { useState, useEffect } from "react";
import { useLembretePagamento } from "../hooks/useLembretePagamento";

// ═══════════════════════════════════════════════════════════════════════
// 💰 PopupCobranca — Componente visual do sistema de cobrança
// ───────────────────────────────────────────────────────────────────────
// Renderiza dependendo da fase calculada pelo hook useLembretePagamento:
//   - "imune"/"ativo"/"carregando" → null (nada aparece)
//   - "lembrete" → popup amigável que pode fechar (a cada 3h)
//   - "agressivo" → popup vermelho que NÃO fecha (a cada 1h)
//   - "bloqueado"/"suspenso" → tela cheia bloqueando tudo
//
// 🆕 VALOR (R$) só aparece pra ADM (cobranca.ehAdm === true):
//    dono do workspace ou sub-usuário perfil "Administrador".
//    Os demais veem o aviso de vencimento + meios de pagamento, sem o preço.
//
// Pra integrar: adicionar <PopupCobranca /> no app/layout.tsx
// ═══════════════════════════════════════════════════════════════════════

// 🔧 Dados de contato — fixos no código (pode mover pra .env.local depois)
const CONTATO = {
  pix_cnpj: "62.007.374/0001-96",
  razao_social: "ABC Call e Serviços",
  whatsapp_display: "(62) 98151-9991",
  whatsapp_numero: "5562981519991",
  email: "contato@abccompany.com.br",
};

const formatarReais = (v: number | null): string => {
  if (v == null) return "R$ ---";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatarData = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch { return iso; }
};

export default function PopupCobranca() {
  const cobranca = useLembretePagamento();
  const [pixCopiado, setPixCopiado] = useState(false);
  const [emailCopiado, setEmailCopiado] = useState(false);

  // 🆕 Só ADM (dono / Administrador) vê o valor da mensalidade
  const mostrarValor = cobranca.ehAdm && cobranca.valorMensalidade != null;

  // Não renderiza nada em fases que não precisam de popup
  if (
    cobranca.fase === "imune" ||
    cobranca.fase === "ativo" ||
    cobranca.fase === "carregando"
  ) return null;

  if (!cobranca.popupVisivel) return null;

  const copiarPix = async () => {
    try {
      await navigator.clipboard.writeText(CONTATO.pix_cnpj);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 2500);
    } catch {
      alert("Não foi possível copiar automaticamente. Copia manual:\n\n" + CONTATO.pix_cnpj);
    }
  };

  const copiarEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTATO.email);
      setEmailCopiado(true);
      setTimeout(() => setEmailCopiado(false), 2500);
    } catch { alert(CONTATO.email); }
  };

  const abrirWhatsApp = () => {
    const dias = cobranca.diasAteVencimento;
    let msg = "";
    if (dias != null && dias < 0) {
      msg = `Olá! Vim regularizar meu pagamento (${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"} de atraso). Cliente: ${cobranca.nomeCliente || cobranca.emailCliente}.`;
    } else if (dias === 0) {
      msg = `Olá! Vou efetuar o pagamento da mensalidade (vence hoje). Cliente: ${cobranca.nomeCliente || cobranca.emailCliente}.`;
    } else {
      msg = `Olá! Quero acertar o pagamento da mensalidade. Cliente: ${cobranca.nomeCliente || cobranca.emailCliente}.`;
    }
    const url = `https://wa.me/${CONTATO.whatsapp_numero}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // ═══ TELA DE BLOQUEIO (cobre TUDO, não pode sair) ═══
  if (cobranca.fase === "bloqueado" || cobranca.fase === "suspenso") {
    const ehSuspenso = cobranca.fase === "suspenso";
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%)",
        zIndex: 99999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, overflow: "auto",
      }}>
        <div style={{
          background: "white", borderRadius: 20, padding: 40, maxWidth: 560, width: "100%",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)", textAlign: "center",
        }}>
          {/* Ícone gigante */}
          <div style={{
            width: 100, height: 100, borderRadius: 28,
            background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 56, margin: "0 auto 20px",
            boxShadow: "0 12px 30px rgba(220,38,38,0.4)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>

          <h1 style={{ color: "#7f1d1d", fontSize: 24, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.5 }}>
            {ehSuspenso ? "CONTA SUSPENSA" : "SISTEMA BLOQUEADO"}
          </h1>

          <p style={{ color: "#991b1b", fontSize: 14, margin: "0 0 24px", lineHeight: 1.5 }}>
            {ehSuspenso
              ? "Sua conta foi suspensa pela administração. Entre em contato para regularizar."
              : `Seu pagamento está em atraso há ${Math.abs(cobranca.diasAteVencimento || 0)} ${Math.abs(cobranca.diasAteVencimento || 0) === 1 ? "dia" : "dias"}. O acesso foi bloqueado.`
            }
          </p>

          {/* 🆕 Valor só pra ADM */}
          {!ehSuspenso && mostrarValor && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626",
              borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "left",
            }}>
              <p style={{ color: "#7f1d1d", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" }}>Valor pendente</p>
              <p style={{ color: "#dc2626", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
                {formatarReais(cobranca.valorMensalidade)}
              </p>
              {cobranca.proximoVencimento && (
                <p style={{ color: "#991b1b", fontSize: 12, margin: "6px 0 0" }}>
                  Vencimento: <b>{formatarData(cobranca.proximoVencimento)}</b>
                </p>
              )}
            </div>
          )}

          {/* 🆕 Sem valor (não-ADM): mostra só o vencimento */}
          {!ehSuspenso && !mostrarValor && cobranca.proximoVencimento && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626",
              borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "left",
            }}>
              <p style={{ color: "#7f1d1d", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" }}>Vencimento</p>
              <p style={{ color: "#dc2626", fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
                {formatarData(cobranca.proximoVencimento)}
              </p>
            </div>
          )}

          {/* Dados de contato + PIX */}
          <div style={{
            background: "#f9fafb", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: 18, marginBottom: 18, textAlign: "left",
          }}>
            <p style={{ color: "#374151", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>📞 Para regularizar</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={copiarPix}
                style={{
                  background: pixCopiado ? "#16a34a" : "#ffffff",
                  color: pixCopiado ? "white" : "#1f2937",
                  border: `1px solid ${pixCopiado ? "#16a34a" : "#e5e7eb"}`,
                  borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                }}>
                <span>💸 PIX (CNPJ): <b style={{ fontFamily: "monospace" }}>{CONTATO.pix_cnpj}</b></span>
                <span style={{ fontSize: 11 }}>{pixCopiado ? "✓ Copiado!" : "Copiar"}</span>
              </button>

              <div style={{ fontSize: 11, color: "#6b7280", padding: "0 6px" }}>
                Em nome de: <b>{CONTATO.razao_social}</b>
              </div>

              <button onClick={abrirWhatsApp}
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "12px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}>
                💬 Falar no WhatsApp: {CONTATO.whatsapp_display}
              </button>

              <button onClick={copiarEmail}
                style={{
                  background: emailCopiado ? "#3b82f6" : "#ffffff",
                  color: emailCopiado ? "white" : "#3b82f6",
                  border: "1px solid #bfdbfe",
                  borderRadius: 10, padding: "9px 14px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontSize: 12, fontWeight: 600,
                }}>
                <span>✉️ {CONTATO.email}</span>
                <span style={{ fontSize: 11 }}>{emailCopiado ? "✓" : "Copiar"}</span>
              </button>
            </div>
          </div>

          <p style={{ color: "#9ca3af", fontSize: 10, margin: 0, fontStyle: "italic" }}>
            {ehSuspenso ? "Sua conta será reativada após contato com a administração." : "Após confirmação do pagamento, o acesso será liberado em até 1h."}
          </p>
        </div>
      </div>
    );
  }

  // ═══ POPUP AGRESSIVO (-1 dia atrasado, não fecha) ═══
  if (cobranca.fase === "agressivo") {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(127,29,29,0.85)", backdropFilter: "blur(6px)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, overflow: "auto",
      }}>
        <div style={{
          background: "white", borderRadius: 18, padding: 32, maxWidth: 520, width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.4)", textAlign: "center",
          borderTop: "5px solid #dc2626",
          animation: "popupShake 0.5s ease",
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: 20,
            background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 10px 24px rgba(220,38,38,0.35)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>⚠️</span>
          </div>

          <h2 style={{ color: "#dc2626", fontSize: 20, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.3 }}>
            PAGAMENTO EM ATRASO
          </h2>

          <p style={{ color: "#991b1b", fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>
            Sua mensalidade venceu <b>{Math.abs(cobranca.diasAteVencimento || 0)} {Math.abs(cobranca.diasAteVencimento || 0) === 1 ? "dia" : "dias"}</b> atrás.<br />
            ⚠️ <b>O sistema será bloqueado em {2 + (cobranca.diasAteVencimento || 0)} {2 + (cobranca.diasAteVencimento || 0) === 1 ? "dia" : "dias"}</b> se não regularizar.
          </p>

          {/* 🆕 Valor só pra ADM */}
          {mostrarValor && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: 14, marginBottom: 14,
            }}>
              <p style={{ color: "#7f1d1d", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Valor pendente</p>
              <p style={{ color: "#dc2626", fontSize: 24, fontWeight: 800, margin: "2px 0", letterSpacing: -0.5 }}>
                {formatarReais(cobranca.valorMensalidade)}
              </p>
              {cobranca.proximoVencimento && (
                <p style={{ color: "#991b1b", fontSize: 11, margin: 0 }}>Venceu em {formatarData(cobranca.proximoVencimento)}</p>
              )}
            </div>
          )}

          {/* 🆕 Sem valor (não-ADM): mostra só o vencimento */}
          {!mostrarValor && cobranca.proximoVencimento && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: 14, marginBottom: 14,
            }}>
              <p style={{ color: "#7f1d1d", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Vencimento</p>
              <p style={{ color: "#dc2626", fontSize: 18, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.3 }}>
                Venceu em {formatarData(cobranca.proximoVencimento)}
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <button onClick={copiarPix}
              style={{
                background: pixCopiado ? "#16a34a" : "#f9fafb",
                color: pixCopiado ? "white" : "#1f2937",
                border: `1px solid ${pixCopiado ? "#16a34a" : "#e5e7eb"}`,
                borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              }}>
              <span>💸 PIX: <b style={{ fontFamily: "monospace" }}>{CONTATO.pix_cnpj}</b></span>
              <span style={{ fontSize: 11 }}>{pixCopiado ? "✓ Copiado!" : "Copiar"}</span>
            </button>

            <button onClick={abrirWhatsApp}
              style={{
                background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "12px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
              }}>
              💬 Avisar pagamento no WhatsApp
            </button>
          </div>

          {/* 🆕 v2: botão pra fechar e voltar a trabalhar (re-exibe em 1h) */}
          <button onClick={cobranca.fecharPopup}
            style={{
              width: "100%",
              background: "white", color: "#6b7280",
              border: "1px solid #e5e7eb", borderRadius: 10,
              padding: "9px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
              marginBottom: 10,
            }}>
            ✕ Fechar e continuar (re-exibe em 1h)
          </button>

          <p style={{ color: "#9ca3af", fontSize: 10, margin: 0, fontStyle: "italic" }}>
            Este aviso voltará a aparecer em 1 hora até a regularização do pagamento.
          </p>
        </div>

        <style jsx>{`
          @keyframes popupShake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
          }
        `}</style>
      </div>
    );
  }

  // ═══ POPUP LEMBRETE (educado / firme, pode fechar) ═══
  // fase === "lembrete" (0 a 2 dias antes do venc)
  const dias = cobranca.diasAteVencimento || 0;
  const venceHoje = dias === 0;
  const corPrincipal = venceHoje ? "#dc2626" : "#f59e0b";
  const bgPrincipal = venceHoje ? "#fef2f2" : "#fffbeb";
  const borderPrincipal = venceHoje ? "#fecaca" : "#fde68a";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, overflow: "auto",
    }}>
      <div style={{
        background: "white", borderRadius: 18, padding: 30, maxWidth: 480, width: "100%",
        boxShadow: "0 20px 50px rgba(0,0,0,0.3)", textAlign: "center",
        borderTop: `5px solid ${corPrincipal}`,
        animation: "popupBounce 0.4s ease",
      }}>
        <div style={{
          width: 68, height: 68, borderRadius: 18,
          background: `linear-gradient(135deg, ${corPrincipal} 0%, ${corPrincipal}cc 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 34, margin: "0 auto 14px",
          boxShadow: `0 8px 20px ${corPrincipal}40`,
        }}>
          <span style={{ filter: "saturate(0) brightness(2)" }}>
            {venceHoje ? "⚠️" : "💰"}
          </span>
        </div>

        <h2 style={{ color: corPrincipal, fontSize: 18, fontWeight: 700, margin: "0 0 6px", letterSpacing: -0.3 }}>
          {venceHoje ? "Sua mensalidade vence HOJE!" : "Lembrete de pagamento"}
        </h2>

        <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>
          {venceHoje ? (
            <>Sua mensalidade do Wolf vence <b>hoje</b>.<br />Pague antes do fim do dia pra evitar bloqueio.</>
          ) : (
            <>Sua mensalidade vence em <b>{dias} {dias === 1 ? "dia" : "dias"}</b> ({formatarData(cobranca.proximoVencimento)}).</>
          )}
        </p>

        {/* 🆕 Valor só pra ADM */}
        {mostrarValor && (
          <div style={{
            background: bgPrincipal, border: `1px solid ${borderPrincipal}`,
            borderRadius: 10, padding: 14, marginBottom: 14,
          }}>
            <p style={{ color: corPrincipal, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Valor</p>
            <p style={{ color: corPrincipal, fontSize: 24, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.5 }}>
              {formatarReais(cobranca.valorMensalidade)}
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <button onClick={copiarPix}
            style={{
              background: pixCopiado ? "#16a34a" : "#f9fafb",
              color: pixCopiado ? "white" : "#1f2937",
              border: `1px solid ${pixCopiado ? "#16a34a" : "#e5e7eb"}`,
              borderRadius: 10, padding: "10px 14px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
            }}>
            <span>💸 PIX (CNPJ): <b style={{ fontFamily: "monospace" }}>{CONTATO.pix_cnpj}</b></span>
            <span style={{ fontSize: 11 }}>{pixCopiado ? "✓ Copiado!" : "Copiar"}</span>
          </button>

          <button onClick={abrirWhatsApp}
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "11px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700,
              display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
            }}>
            💬 Falar no WhatsApp
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={cobranca.fecharPopup}
            style={{
              flex: 1, background: "white", color: "#6b7280",
              border: "1px solid #e5e7eb", borderRadius: 10,
              padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>
            Lembrar daqui 3h
          </button>
        </div>

        <p style={{ color: "#9ca3af", fontSize: 10, margin: "12px 0 0", fontStyle: "italic" }}>
          Em nome de {CONTATO.razao_social}
        </p>
      </div>

      <style jsx>{`
        @keyframes popupBounce {
          0% { transform: scale(0.9); opacity: 0; }
          60% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}