"use client";
import { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// 🕐 TogglesPontoUsuario — 2 toggles pra usar no formulário de criar/editar usuário
// ───────────────────────────────────────────────────────────────────────────
// Os 2 toggles definem:
//   1. exige_ponto    → Se o usuário precisa bater ponto pra ACESSAR o sistema
//   2. exige_selfie   → Se precisa SELFIE no ponto (true) ou só GPS (false)
//
// USO no formulário:
//   const [exigePonto, setExigePonto] = useState(true);
//   const [exigeSelfie, setExigeSelfie] = useState(true);
//   ...
//   <TogglesPontoUsuario
//     exigePonto={exigePonto}
//     exigeSelfie={exigeSelfie}
//     onChangeExigePonto={setExigePonto}
//     onChangeExigeSelfie={setExigeSelfie}
//   />
//
// Ao salvar usuário, mandar esses dois campos pro insert/update da
// `usuarios_workspace`:
//   { ..., exige_ponto: exigePonto, exige_selfie: exigeSelfie }
// ═══════════════════════════════════════════════════════════════════════════

type Props = {
  exigePonto: boolean;
  exigeSelfie: boolean;
  onChangeExigePonto: (v: boolean) => void;
  onChangeExigeSelfie: (v: boolean) => void;
  /** Bloqueia edição (modo visualização) */
  readOnly?: boolean;
  /** Layout vertical (default) ou em grid 2 colunas */
  layout?: "vertical" | "grid";
};

export default function TogglesPontoUsuario({
  exigePonto,
  exigeSelfie,
  onChangeExigePonto,
  onChangeExigeSelfie,
  readOnly = false,
  layout = "vertical",
}: Props) {
  return (
    <div style={{
      display: layout === "grid" ? "grid" : "flex",
      gridTemplateColumns: layout === "grid" ? "1fr 1fr" : undefined,
      flexDirection: layout === "vertical" ? "column" : undefined,
      gap: 12,
    }}>
      {/* 🕐 Exige bater ponto pra acessar o sistema */}
      <Toggle
        ligado={exigePonto}
        onChange={onChangeExigePonto}
        readOnly={readOnly}
        icone="🕐"
        titulo="Exige bater ponto pra acessar?"
        subtitulo={
          exigePonto
            ? "Sim — o sistema fica BLOQUEADO até o usuário bater o ponto de entrada"
            : "Não — o usuário entra direto, sem precisar bater ponto"
        }
        corLigado="#db2777"
        corLigadoBg="#fdf2f8"
        corLigadoBorder="#fbcfe8"
      />

      {/* 🤳 Selfie obrigatória no ponto */}
      <Toggle
        ligado={exigeSelfie}
        onChange={onChangeExigeSelfie}
        readOnly={readOnly}
        icone="🤳"
        titulo="Exige selfie ao bater ponto?"
        subtitulo={
          exigeSelfie
            ? "Sim — exige selfie + GPS (mais seguro contra fraude)"
            : "Não — só GPS, sem foto"
        }
        corLigado="#2563eb"
        corLigadoBg="#eff6ff"
        corLigadoBorder="#bfdbfe"
        desabilitado={!exigePonto}
        avisoDesabilitado="Ative 'Exige bater ponto' primeiro"
      />

      {/* Aviso visual quando os 2 são "Não" */}
      {!exigePonto && (
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderLeft: "3px solid #f59e0b",
          borderRadius: 10,
          padding: "10px 14px",
          gridColumn: layout === "grid" ? "1 / -1" : undefined,
        }}>
          <p style={{ color: "#92400e", fontSize: 12, margin: 0, fontWeight: 600 }}>
            ⚠️ Esse usuário <b>não vai bater ponto</b>. Geralmente usado para sócios,
            gerentes, freelancers ou usuários externos que não cumprem jornada.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Toggle visual reutilizável ──────────────────────────────────────────
function Toggle({
  ligado,
  onChange,
  readOnly,
  icone,
  titulo,
  subtitulo,
  corLigado,
  corLigadoBg,
  corLigadoBorder,
  desabilitado = false,
  avisoDesabilitado,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  readOnly?: boolean;
  icone: string;
  titulo: string;
  subtitulo: ReactNode;
  corLigado: string;
  corLigadoBg: string;
  corLigadoBorder: string;
  desabilitado?: boolean;
  avisoDesabilitado?: string;
}) {
  const interativo = !readOnly && !desabilitado;
  const visualLigado = ligado && !desabilitado;

  return (
    <div
      onClick={() => interativo && onChange(!ligado)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        background: visualLigado ? corLigadoBg : "#f9fafb",
        border: `1px solid ${visualLigado ? corLigadoBorder : "#e5e7eb"}`,
        borderRadius: 12,
        cursor: interativo ? "pointer" : "default",
        opacity: desabilitado ? 0.55 : 1,
        transition: "all 0.15s",
      }}
      title={desabilitado ? avisoDesabilitado : undefined}
    >
      {/* Ícone */}
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: visualLigado ? corLigado : "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        flexShrink: 0,
        transition: "background 0.15s",
      }}>
        <span style={visualLigado ? { filter: "grayscale(0)" } : { filter: "grayscale(1)" }}>
          {icone}
        </span>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "#0f172a", fontSize: 13.5, fontWeight: 700 }}>{titulo}</span>

          {/* Switch */}
          <div style={{
            width: 40,
            height: 22,
            borderRadius: 999,
            background: visualLigado ? corLigado : "#cbd5e1",
            position: "relative",
            flexShrink: 0,
            transition: "background 0.15s",
            marginLeft: "auto",
          }}>
            <div style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 2,
              left: visualLigado ? 20 : 2,
              transition: "left 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
        </div>

        {/* Subtítulo explicativo */}
        <p style={{
          color: visualLigado ? corLigado : "#64748b",
          fontSize: 11.5,
          margin: 0,
          lineHeight: 1.45,
          fontWeight: 500,
        }}>
          {subtitulo}
        </p>

        {desabilitado && avisoDesabilitado && (
          <p style={{ color: "#94a3b8", fontSize: 10.5, margin: "4px 0 0", fontStyle: "italic" }}>
            {avisoDesabilitado}
          </p>
        )}
      </div>
    </div>
  );
}