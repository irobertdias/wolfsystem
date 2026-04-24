"use client";
import { useState } from "react";
import { useSoftphone } from "../hooks/useSoftphone";

// ═══════════════════════════════════════════════════════════════════════
// 🎧 SOFTPHONE — UI flutuante no canto inferior direito
// ═══════════════════════════════════════════════════════════════════════
// 2 modos:
// - Minimizado (bolha redonda): clica pra abrir
// - Expandido (card): mostra chamada ativa OU teclado discador
// ═══════════════════════════════════════════════════════════════════════

export function Softphone() {
  const { chamada, aberto, setAberto, iniciarChamada, encerrarChamada, toggleMudo, enviarDTMF, segundosConectado } = useSoftphone();
  const [numeroDigitado, setNumeroDigitado] = useState("");
  const [modoTeclado, setModoTeclado] = useState(true); // true = mostrando teclado, false = mostrando chamada ativa

  const temChamada = chamada && chamada.status !== "ocioso";

  // Status em português
  const labelStatus = (s: string) => ({
    iniciando: "Iniciando...",
    chamando: "Chamando...",
    conectado: "Conectado",
    encerrando: "Encerrando...",
    sem_resposta: "Não atendeu",
    ocupado: "Ocupado",
    falha: "Falha na chamada",
    caixa_postal: "Caixa postal",
  }[s] || s);

  const corStatus = (s: string) => ({
    iniciando: "#f59e0b",
    chamando: "#f59e0b",
    conectado: "#16a34a",
    encerrando: "#dc2626",
    sem_resposta: "#6b7280",
    ocupado: "#dc2626",
    falha: "#dc2626",
    caixa_postal: "#6b7280",
  }[s] || "#6b7280");

  const formatTempo = (seg: number) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Formata número pra exibição: +5562981519991 → +55 62 9 8151-9991
  const formatarNumeroExibicao = (n: string) => {
    if (!n) return "";
    const limpo = n.replace(/\D/g, "");
    if (limpo.length === 13 && limpo.startsWith("55")) {
      return `+55 ${limpo.slice(2, 4)} ${limpo.slice(4, 5)} ${limpo.slice(5, 9)}-${limpo.slice(9, 13)}`;
    }
    if (limpo.length === 12 && limpo.startsWith("55")) {
      return `+55 ${limpo.slice(2, 4)} ${limpo.slice(4, 8)}-${limpo.slice(8, 12)}`;
    }
    return n;
  };

  const adicionarDigito = (d: string) => {
    if (temChamada && chamada?.status === "conectado") {
      enviarDTMF(d);
    } else {
      setNumeroDigitado(n => n + d);
    }
  };

  const apagarUltimo = () => setNumeroDigitado(n => n.slice(0, -1));

  const chamarManual = () => {
    const n = numeroDigitado.replace(/\D/g, "");
    if (n.length < 8) { alert("Digite um número válido (mínimo 8 dígitos)"); return; }
    iniciarChamada(n);
    setNumeroDigitado("");
  };

  // ═══════ MODO MINIMIZADO ═══════
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        title="Abrir discador"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: temChamada ? "#16a34a" : "#202c33",
          border: "2px solid #16a34a",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          zIndex: 9000,
          fontSize: 24,
          color: "white",
          animation: temChamada ? "pulse 1.5s infinite" : "none",
        }}
      >
        📞
        {temChamada && (
          <span style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "white", fontSize: 10, padding: "2px 6px", borderRadius: 10, fontWeight: "bold" }}>
            •
          </span>
        )}
      </button>
    );
  }

  // ═══════ MODO EXPANDIDO ═══════
  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          50% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); }
        }
      `}</style>
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 320,
        background: "#111",
        border: "1px solid #1f2937",
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 9000,
        overflow: "hidden",
        fontFamily: "Arial, sans-serif",
      }}>
        {/* HEADER */}
        <div style={{ background: "#0a0a0a", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📞</span>
            <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>Discador</span>
            <span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 9, padding: "2px 6px", borderRadius: 6, fontWeight: "bold" }}>MOCK</span>
          </div>
          <button onClick={() => setAberto(false)} title="Minimizar"
            style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>
            −
          </button>
        </div>

        {/* ÁREA DE CHAMADA ATIVA ou TECLADO */}
        {temChamada ? (
          <ChamadaAtivaView
            chamada={chamada!}
            segundosConectado={segundosConectado}
            labelStatus={labelStatus}
            corStatus={corStatus}
            formatTempo={formatTempo}
            formatarNumero={formatarNumeroExibicao}
            toggleMudo={toggleMudo}
            encerrar={encerrarChamada}
            enviarDTMF={enviarDTMF}
            adicionarDigito={adicionarDigito}
          />
        ) : (
          <TecladoView
            numero={numeroDigitado}
            setNumero={setNumeroDigitado}
            adicionar={adicionarDigito}
            apagar={apagarUltimo}
            chamar={chamarManual}
            formatarNumero={formatarNumeroExibicao}
          />
        )}
      </div>
    </>
  );
}

// ─── Vista de chamada ativa ───────────────────────────────────────────
function ChamadaAtivaView({ chamada, segundosConectado, labelStatus, corStatus, formatTempo, formatarNumero, toggleMudo, encerrar, enviarDTMF, adicionarDigito }: any) {
  const [mostrarTeclado, setMostrarTeclado] = useState(false);
  const tocando = chamada.status === "chamando" || chamada.status === "iniciando";

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      {/* Avatar / Nome / Número */}
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: corStatus(chamada.status) + "33",
        border: `3px solid ${corStatus(chamada.status)}`,
        margin: "0 auto 12px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32, fontWeight: "bold", color: "white",
        animation: tocando ? "ring 1.4s infinite" : "none",
      }}>
        {chamada.nome?.charAt(0).toUpperCase() || "?"}
      </div>

      <p style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 4px" }}>
        {chamada.nome || "Sem nome"}
      </p>
      <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 12px", fontFamily: "monospace" }}>
        {formatarNumero(chamada.numero)}
      </p>

      {/* Status + Timer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: corStatus(chamada.status), animation: tocando ? "pulse 1s infinite" : "none" }} />
        <span style={{ color: corStatus(chamada.status), fontSize: 13, fontWeight: "bold" }}>{labelStatus(chamada.status)}</span>
        {chamada.status === "conectado" && (
          <span style={{ color: "#9ca3af", fontSize: 13, fontFamily: "monospace", marginLeft: 4 }}>
            {formatTempo(segundosConectado)}
          </span>
        )}
      </div>

      {/* Teclado DTMF (só mostra quando conectado E clicou em mostrar) */}
      {chamada.status === "conectado" && mostrarTeclado && (
        <div style={{ marginBottom: 16 }}>
          <TecladoNumerico adicionar={(d: string) => enviarDTMF(d)} compacto />
        </div>
      )}

      {/* Controles */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
        {chamada.status === "conectado" && (
          <>
            <button onClick={toggleMudo} title={chamada.mudo ? "Ativar microfone" : "Mutar"}
              style={{ width: 50, height: 50, borderRadius: "50%", background: chamada.mudo ? "#dc2626" : "#374151", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>
              {chamada.mudo ? "🔇" : "🎤"}
            </button>
            <button onClick={() => setMostrarTeclado(!mostrarTeclado)} title="Teclado"
              style={{ width: 50, height: 50, borderRadius: "50%", background: mostrarTeclado ? "#3b82f6" : "#374151", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>
              🔢
            </button>
          </>
        )}
        <button onClick={encerrar} title="Desligar"
          style={{ width: 58, height: 58, borderRadius: "50%", background: "#dc2626", border: "none", color: "white", fontSize: 24, cursor: "pointer", boxShadow: "0 4px 12px rgba(220,38,38,0.4)" }}>
          📞
        </button>
      </div>
    </div>
  );
}

// ─── Vista do teclado (pra digitar manual e ligar) ─────────────────────
function TecladoView({ numero, setNumero, adicionar, apagar, chamar, formatarNumero }: any) {
  return (
    <div style={{ padding: 16 }}>
      {/* Display do número */}
      <div style={{ background: "#0a0a0a", borderRadius: 10, padding: "14px 12px", marginBottom: 14, textAlign: "center", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #1f2937" }}>
        <span style={{ color: numero ? "white" : "#6b7280", fontSize: numero ? 20 : 13, fontFamily: "monospace", letterSpacing: 1 }}>
          {numero ? formatarNumero(numero) : "Digite o número..."}
        </span>
      </div>

      <TecladoNumerico adicionar={adicionar} />

      {/* Botões inferiores */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={apagar} disabled={!numero}
          style={{ flex: 1, padding: 12, background: "#374151", border: "none", borderRadius: 10, cursor: numero ? "pointer" : "not-allowed", color: "white", fontSize: 14, opacity: numero ? 1 : 0.4 }}>
          ⌫ Apagar
        </button>
        <button onClick={chamar} disabled={!numero}
          style={{ flex: 2, padding: 12, background: numero ? "#16a34a" : "#374151", border: "none", borderRadius: 10, cursor: numero ? "pointer" : "not-allowed", color: "white", fontSize: 14, fontWeight: "bold", opacity: numero ? 1 : 0.4 }}>
          📞 Ligar
        </button>
      </div>
    </div>
  );
}

// ─── Teclado numérico (usado em 2 lugares) ─────────────────────────────
function TecladoNumerico({ adicionar, compacto = false }: { adicionar: (d: string) => void; compacto?: boolean }) {
  const teclas: Array<[string, string]> = [
    ["1", ""], ["2", "ABC"], ["3", "DEF"],
    ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
    ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
    ["*", ""], ["0", "+"], ["#", ""],
  ];

  const tamanho = compacto ? 40 : 56;
  const fontePrimaria = compacto ? 16 : 20;
  const fonteSecundaria = compacto ? 8 : 9;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {teclas.map(([num, letras]) => (
        <button key={num} onClick={() => adicionar(num)}
          style={{
            height: tamanho,
            background: "#1f2937",
            border: "1px solid #2a3942",
            borderRadius: 10,
            color: "white",
            cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            transition: "all 0.1s",
          }}
          onMouseDown={e => e.currentTarget.style.background = "#374151"}
          onMouseUp={e => e.currentTarget.style.background = "#1f2937"}
          onMouseLeave={e => e.currentTarget.style.background = "#1f2937"}
        >
          <span style={{ fontSize: fontePrimaria, fontWeight: "bold" }}>{num}</span>
          {letras && <span style={{ fontSize: fonteSecundaria, color: "#6b7280", marginTop: -2 }}>{letras}</span>}
        </button>
      ))}
    </div>
  );
}