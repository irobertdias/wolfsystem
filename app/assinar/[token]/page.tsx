"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

type AssinaturaInfo = {
  status: string;
  nome: string;
  cpf_ultimos4?: string | null;
  documento: string;
  expira_em: string;
  exigir_selfie: boolean;
  exigir_otp: boolean;
  exigir_localizacao: boolean;
  biometria_status: string;
  consentimento_versao: string;
  consentimento_texto: string;
};

const CONSENTIMENTO =
  "Declaro que li o documento, reconheço como válido este meio de assinatura eletrônica e autorizo a coleta da assinatura, selfie de evidência, código OTP, IP, data, hora e dados técnicos para comprovação de autoria, integridade, prevenção a fraude e exercício regular de direitos.";

export default function AssinarWolfPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");
  const [info, setInfo] = useState<AssinaturaInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [otp, setOtp] = useState("");
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [enviandoOtp, setEnviandoOtp] = useState(false);
  const [aceiteContrato, setAceiteContrato] = useState(false);
  const [aceiteAssinatura, setAceiteAssinatura] = useState(false);
  const [aceiteSelfie, setAceiteSelfie] = useState(false);
  const [selfie, setSelfie] = useState("");
  const [cameraAberta, setCameraAberta] = useState(false);
  const [assinou, setAssinou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [concluida, setConcluida] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasSelfieRef = useRef<HTMLCanvasElement>(null);
  const canvasAssinaturaRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const response = await fetch(`/api/assinatura-wolf/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Link inválido");
        if (ativo) setInfo(data.assinatura);
      } catch (e: any) {
        if (ativo) setErro(e.message || "Não foi possível abrir a assinatura");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    if (token) void carregar();
    return () => {
      ativo = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [token]);

  const prepararCanvasAssinatura = useCallback(() => {
    const canvas = canvasAssinaturaRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(320, canvas.clientWidth);
    const height = 180;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#101828";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setAssinou(false);
  }, []);

  useEffect(() => {
    if (!carregando && !erro) prepararCanvasAssinatura();
    window.addEventListener("resize", prepararCanvasAssinatura);
    return () => window.removeEventListener("resize", prepararCanvasAssinatura);
  }, [carregando, erro, prepararCanvasAssinatura]);

  function coordenada(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function iniciarDesenho(event: PointerEvent<HTMLCanvasElement>) {
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = coordenada(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    desenhandoRef.current = true;
  }

  function desenhar(event: PointerEvent<HTMLCanvasElement>) {
    if (!desenhandoRef.current) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = coordenada(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setAssinou(true);
  }

  function finalizarDesenho(event: PointerEvent<HTMLCanvasElement>) {
    desenhandoRef.current = false;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
  }

  async function solicitarOtp() {
    setErro("");
    setEnviandoOtp(true);
    try {
      const response = await fetch(`/api/assinatura-wolf/${encodeURIComponent(token)}/otp`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Falha ao enviar código");
      setOtpEnviado(true);
    } catch (e: any) {
      setErro(e.message || "Não foi possível enviar o código");
    } finally {
      setEnviandoOtp(false);
    }
  }

  async function abrirCamera() {
    setErro("");
    try {
      streamRef.current?.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraAberta(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setErro("Não foi possível acessar a câmera. Libere a permissão e tente novamente.");
    }
  }

  function capturarSelfie() {
    const video = videoRef.current;
    const canvas = canvasSelfieRef.current;
    if (!video || !canvas || video.videoWidth <= 0) {
      setErro("A câmera ainda está carregando");
      return;
    }
    const lado = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 720;
    canvas.height = 720;
    const sx = (video.videoWidth - lado) / 2;
    const sy = (video.videoHeight - lado) / 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, lado, lado, 0, 0, 720, 720);
    setSelfie(canvas.toDataURL("image/jpeg", 0.82));
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraAberta(false);
  }

  async function obterLocalizacao() {
    if (!navigator.geolocation) return {};
    return new Promise<Record<string, number>>(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: pos.coords.accuracy,
        }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  async function concluir() {
    setErro("");
    if (!/^\d{6}$/.test(otp)) {
      setErro("Informe o código de 6 dígitos enviado pelo WhatsApp.");
      return;
    }
    if (!aceiteContrato || !aceiteAssinatura || !aceiteSelfie) {
      setErro("Leia e marque os três consentimentos obrigatórios.");
      return;
    }
    if (!selfie) {
      setErro("Tire a selfie de evidência.");
      return;
    }
    if (!assinou || !canvasAssinaturaRef.current) {
      setErro("Desenhe sua assinatura no campo indicado.");
      return;
    }
    setEnviando(true);
    try {
      const localizacao = info?.exigir_localizacao ? await obterLocalizacao() : {};
      const response = await fetch(`/api/assinatura-wolf/${encodeURIComponent(token)}/concluir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp,
          aceite_contrato: aceiteContrato,
          aceite_assinatura_eletronica: aceiteAssinatura,
          aceite_selfie: aceiteSelfie,
          consentimento_texto: info?.consentimento_texto || CONSENTIMENTO,
          assinatura: canvasAssinaturaRef.current.toDataURL("image/png"),
          selfie,
          ...localizacao,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Falha ao concluir assinatura");
      setConcluida(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setErro(e.message || "Não foi possível concluir a assinatura");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <main style={styles.center}><div style={styles.loader}/><p>Carregando documento seguro...</p></main>;
  }

  if (erro && !info) {
    return (
      <main style={styles.center}>
        <div style={styles.errorIcon}>!</div>
        <h1 style={styles.title}>Não foi possível abrir o documento</h1>
        <p style={styles.muted}>{erro}</p>
      </main>
    );
  }

  if (concluida) {
    return (
      <main style={styles.center}>
        <div style={styles.successIcon}>✓</div>
        <h1 style={styles.title}>Contrato assinado com sucesso</h1>
        <p style={styles.muted}>
          O PDF assinado e o certificado de evidências foram enviados para o seu WhatsApp.
          O atendimento continuará automaticamente.
        </p>
        <div style={styles.notice}>
          Guarde o PDF recebido. Ele contém sua assinatura legível e a trilha técnica da assinatura.
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>WOLF SIGN</div>
          <div style={styles.brandSub}>Assinatura eletrônica segura</div>
        </div>
        <div style={styles.secure}>🔒 Conexão segura</div>
      </header>

      <section style={styles.hero}>
        <div>
          <span style={styles.step}>DOCUMENTO PARA ASSINATURA</span>
          <h1 style={styles.title}>{info?.documento || "Contrato"}</h1>
          <p style={styles.muted}>
            Signatário: <strong>{info?.nome}</strong> · CPF final {info?.cpf_ultimos4 || "****"}
          </p>
        </div>
        <div style={styles.expiry}>
          Link válido até<br/><strong>{info ? new Date(info.expira_em).toLocaleString("pt-BR") : ""}</strong>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div><span style={styles.number}>1</span><strong>Leia o documento completo</strong></div>
          <a
            href={`/api/assinatura-wolf/${encodeURIComponent(token)}/arquivo`}
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            Abrir em outra aba
          </a>
        </div>
        <iframe
          src={`/api/assinatura-wolf/${encodeURIComponent(token)}/arquivo`}
          title="Contrato para assinatura"
          style={styles.pdf}
        />
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div><span style={styles.number}>2</span><strong>Confirme o código recebido</strong></div>
        </div>
        <p style={styles.muted}>Enviaremos um código de 6 dígitos para o mesmo WhatsApp deste atendimento.</p>
        <div style={styles.row}>
          <button type="button" onClick={solicitarOtp} disabled={enviandoOtp} style={styles.secondaryButton}>
            {enviandoOtp ? "Enviando..." : otpEnviado ? "Reenviar código" : "Enviar código"}
          </button>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="Código de confirmação"
            style={styles.otp}
          />
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div><span style={styles.number}>3</span><strong>Tire uma selfie de evidência</strong></div>
        </div>
        <p style={styles.muted}>
          Posicione o rosto em local iluminado. A selfie será protegida e vinculada à trilha desta assinatura.
          Nesta versão ela é uma evidência visual, não uma validação biométrica facial automatizada.
        </p>
        {!selfie && !cameraAberta && (
          <button type="button" onClick={abrirCamera} style={styles.secondaryButton}>Abrir câmera</button>
        )}
        {cameraAberta && (
          <div style={styles.cameraBox}>
            <video ref={videoRef} playsInline muted style={styles.video}/>
            <button type="button" onClick={capturarSelfie} style={styles.primaryButton}>Capturar selfie</button>
          </div>
        )}
        {selfie && (
          <div style={styles.selfieBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selfie} alt="Selfie capturada" style={styles.selfie}/>
            <button type="button" onClick={() => { setSelfie(""); void abrirCamera(); }} style={styles.textButton}>
              Tirar outra
            </button>
          </div>
        )}
        <canvas ref={canvasSelfieRef} style={{ display: "none" }}/>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div><span style={styles.number}>4</span><strong>Desenhe sua assinatura</strong></div>
          <button type="button" onClick={prepararCanvasAssinatura} style={styles.textButton}>Limpar</button>
        </div>
        <p style={styles.muted}>Use o dedo, a caneta digital ou o mouse. Esta imagem ficará legível no PDF final.</p>
        <canvas
          ref={canvasAssinaturaRef}
          onPointerDown={iniciarDesenho}
          onPointerMove={desenhar}
          onPointerUp={finalizarDesenho}
          onPointerCancel={finalizarDesenho}
          style={styles.signature}
        />
        <div style={styles.signatureLine}>{info?.nome}</div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div><span style={styles.number}>5</span><strong>Confirme sua manifestação de vontade</strong></div>
        </div>
        <label style={styles.check}>
          <input type="checkbox" checked={aceiteContrato} onChange={e => setAceiteContrato(e.target.checked)}/>
          <span>Li e concordo com o conteúdo integral do contrato apresentado.</span>
        </label>
        <label style={styles.check}>
          <input type="checkbox" checked={aceiteAssinatura} onChange={e => setAceiteAssinatura(e.target.checked)}/>
          <span>Reconheço este procedimento como minha assinatura eletrônica e manifestação de vontade.</span>
        </label>
        <label style={styles.check}>
          <input type="checkbox" checked={aceiteSelfie} onChange={e => setAceiteSelfie(e.target.checked)}/>
          <span>Autorizo a coleta da selfie, OTP e dados técnicos exclusivamente para comprovar esta assinatura e prevenir fraude.</span>
        </label>
        <p style={styles.legal}>{info?.consentimento_texto || CONSENTIMENTO}</p>
      </section>

      {erro && <div role="alert" style={styles.alert}>{erro}</div>}

      <button type="button" onClick={concluir} disabled={enviando} style={styles.finishButton}>
        {enviando ? "Gerando contrato assinado..." : "Assinar e concluir"}
      </button>

      <footer style={styles.footer}>
        Wolf Sign · Documento protegido por hash SHA-256 e trilha de auditoria
      </footer>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#f3f6fb", color: "#101828", padding: "24px 16px 50px", fontFamily: "Arial, sans-serif" },
  center: { minHeight: "100vh", background: "#f3f6fb", color: "#101828", padding: 24, display: "grid", placeContent: "center", justifyItems: "center", textAlign: "center", fontFamily: "Arial, sans-serif" },
  header: { maxWidth: 980, margin: "0 auto 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  brand: { fontSize: 21, fontWeight: 900, letterSpacing: 1.5, color: "#155eef" },
  brandSub: { fontSize: 12, color: "#667085", marginTop: 2 },
  secure: { fontSize: 12, color: "#027a48", background: "#ecfdf3", border: "1px solid #abefc6", borderRadius: 999, padding: "7px 11px" },
  hero: { maxWidth: 980, margin: "0 auto 18px", background: "linear-gradient(135deg,#ffffff,#eff4ff)", border: "1px solid #d0d5dd", borderRadius: 18, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, boxShadow: "0 10px 30px rgba(16,24,40,.06)" },
  step: { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#155eef" },
  title: { fontSize: 25, lineHeight: 1.15, margin: "7px 0 8px", color: "#101828" },
  muted: { fontSize: 13, lineHeight: 1.55, color: "#475467", margin: "8px 0" },
  expiry: { fontSize: 11, lineHeight: 1.5, color: "#475467", textAlign: "right", flexShrink: 0 },
  card: { maxWidth: 980, margin: "0 auto 16px", background: "#fff", border: "1px solid #d0d5dd", borderRadius: 16, padding: 18, boxShadow: "0 5px 18px rgba(16,24,40,.04)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 },
  number: { display: "inline-grid", placeItems: "center", width: 27, height: 27, borderRadius: 9, background: "#155eef", color: "#fff", fontSize: 12, marginRight: 9 },
  link: { color: "#155eef", fontSize: 12, fontWeight: 700, textDecoration: "none" },
  pdf: { width: "100%", height: "min(70vh,680px)", border: "1px solid #d0d5dd", borderRadius: 10, background: "#f2f4f7" },
  row: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 },
  otp: { width: 170, padding: "13px 15px", border: "1px solid #98a2b3", borderRadius: 10, fontSize: 22, letterSpacing: 7, textAlign: "center", color: "#101828", background: "#fff" },
  secondaryButton: { border: "1px solid #84adff", background: "#eff4ff", color: "#004eeb", borderRadius: 10, padding: "12px 16px", fontWeight: 800, cursor: "pointer" },
  primaryButton: { border: 0, background: "#155eef", color: "#fff", borderRadius: 10, padding: "12px 18px", fontWeight: 800, cursor: "pointer" },
  cameraBox: { display: "grid", gap: 12, justifyItems: "center", marginTop: 12 },
  video: { width: "min(100%,420px)", aspectRatio: "1", objectFit: "cover", borderRadius: 16, background: "#101828", transform: "scaleX(-1)" },
  selfieBox: { display: "flex", gap: 16, alignItems: "center", marginTop: 12, flexWrap: "wrap" },
  selfie: { width: 150, height: 150, objectFit: "cover", borderRadius: 16, border: "2px solid #84adff", transform: "scaleX(-1)" },
  textButton: { border: 0, background: "transparent", color: "#155eef", fontWeight: 800, cursor: "pointer", padding: 6 },
  signature: { width: "100%", height: 180, border: "1px dashed #667085", borderRadius: 12, background: "#fff", touchAction: "none", cursor: "crosshair" },
  signatureLine: { maxWidth: 420, borderTop: "1px solid #344054", marginTop: 10, paddingTop: 6, textAlign: "center", fontSize: 12, color: "#475467" },
  check: { display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 0", fontSize: 13, lineHeight: 1.45, color: "#344054", cursor: "pointer" },
  legal: { fontSize: 10, lineHeight: 1.5, color: "#667085", background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: 9, padding: 10 },
  alert: { maxWidth: 980, margin: "0 auto 16px", padding: 13, borderRadius: 10, border: "1px solid #fda29b", background: "#fef3f2", color: "#b42318", fontSize: 13, fontWeight: 700 },
  finishButton: { display: "block", width: "min(100%,980px)", margin: "0 auto", padding: "16px 20px", border: 0, borderRadius: 13, background: "#155eef", color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 20px rgba(21,94,239,.25)" },
  footer: { maxWidth: 980, margin: "24px auto 0", textAlign: "center", fontSize: 10, color: "#667085" },
  loader: { width: 38, height: 38, borderRadius: "50%", border: "4px solid #d1e0ff", borderTopColor: "#155eef", animation: "spin 1s linear infinite" },
  errorIcon: { display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: "50%", background: "#fef3f2", color: "#d92d20", fontSize: 28, fontWeight: 900 },
  successIcon: { display: "grid", placeItems: "center", width: 62, height: 62, borderRadius: "50%", background: "#dcfae6", color: "#079455", fontSize: 34, fontWeight: 900 },
  notice: { maxWidth: 520, marginTop: 18, padding: 13, borderRadius: 10, background: "#eff4ff", border: "1px solid #b2ccff", color: "#1849a9", fontSize: 12, lineHeight: 1.5 },
};

