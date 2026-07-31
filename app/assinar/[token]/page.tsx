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
  papel?: "empresa" | "cliente";
  signatarios?: Array<{ papel: "empresa" | "cliente"; ordem: number; nome: string; status: string; assinatura_em?: string | null }>;
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
  const [cameraPronta, setCameraPronta] = useState(false);
  const [assinou, setAssinou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [concluida, setConcluida] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasSelfieRef = useRef<HTMLCanvasElement>(null);
  const canvasAssinaturaRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const desenhandoRef = useRef(false);
  const assinaturaCapturadaRef = useRef("");
  const temTracoAssinaturaRef = useRef(false);

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
    temTracoAssinaturaRef.current = true;
    setAssinou(true);
  }

  function finalizarDesenho(event: PointerEvent<HTMLCanvasElement>) {
    desenhandoRef.current = false;
    if (temTracoAssinaturaRef.current) assinaturaCapturadaRef.current = event.currentTarget.toDataURL("image/png");
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
  }

  function limparAssinatura() {
    assinaturaCapturadaRef.current = "";
    temTracoAssinaturaRef.current = false;
    prepararCanvasAssinatura();
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

  useEffect(() => {
    if (!cameraAberta) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    let ativo = true;
    setCameraPronta(false);
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    const marcarPronta = () => {
      if (ativo && video.videoWidth > 0 && video.videoHeight > 0) setCameraPronta(true);
    };
    video.addEventListener("loadedmetadata", marcarPronta);
    video.addEventListener("canplay", marcarPronta);
    video.addEventListener("playing", marcarPronta);
    void video.play().then(marcarPronta).catch(() => {
      if (ativo) setErro("O navegador não iniciou a câmera. Use Tirar foto com o celular abaixo.");
    });
    const timeout = window.setTimeout(() => {
      if (ativo && video.videoWidth <= 0) setErro("A câmera demorou para carregar. Use Tirar foto com o celular ou tente novamente.");
    }, 6000);
    return () => {
      ativo = false;
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", marcarPronta);
      video.removeEventListener("canplay", marcarPronta);
      video.removeEventListener("playing", marcarPronta);
      video.srcObject = null;
    };
  }, [cameraAberta]);

  function fecharCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraPronta(false);
    setCameraAberta(false);
  }

  async function abrirCamera() {
    setErro("");
    setCameraPronta(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera_indisponivel");
      streamRef.current?.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraAberta(true);
    } catch {
      setErro("Não foi possível abrir a câmera ao vivo. Use Tirar foto com o celular abaixo.");
    }
  }

  function carregarSelfieArquivo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Selecione uma foto válida."); return; }
    const reader = new FileReader();
    reader.onerror = () => setErro("Não foi possível ler a foto.");
    reader.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => setErro("A foto selecionada é inválida.");
      imagem.onload = () => {
        const canvas = canvasSelfieRef.current;
        if (!canvas) return;
        const lado = Math.min(imagem.naturalWidth, imagem.naturalHeight);
        const sx = (imagem.naturalWidth - lado) / 2;
        const sy = (imagem.naturalHeight - lado) / 2;
        canvas.width = 720;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(imagem, sx, sy, lado, lado, 0, 0, 720, 720);
        setSelfie(canvas.toDataURL("image/jpeg", 0.82));
        fecharCamera();
        setErro("");
      };
      imagem.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
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
    fecharCamera();
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
          assinatura: assinaturaCapturadaRef.current || canvasAssinaturaRef.current.toDataURL("image/png"),
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
          {info?.papel === "empresa" ? "Sua assinatura foi registrada. Agora o cliente receberá automaticamente o contrato já assinado pela empresa." : "As duas assinaturas foram concluídas. O PDF final e as evidências serão enviados por WhatsApp e e-mail aos participantes."}
        </p>
        <div style={styles.notice}>
          Guarde o PDF recebido. Ele contém sua assinatura legível e a trilha técnica da assinatura.
        </div>
      </main>
    );
  }

  if (info?.status === "concluida") {
    return <main style={styles.center}>
      <div style={styles.successIcon}>✓</div>
      <h1 style={styles.title}>Esta etapa já foi assinada</h1>
      <p style={styles.muted}>{info.papel === "empresa" ? "A assinatura da empresa foi concluída. O contrato já seguiu para o cliente." : "Sua assinatura foi concluída e o contrato final está sendo entregue aos participantes."}</p>
    </main>;
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
        <div style={styles.heroContent}>
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

      {info?.signatarios?.length ? <section style={styles.progressCard}>
        <div style={styles.progressTitle}>Andamento das assinaturas</div>
        {info.signatarios.map(participante => <div key={participante.papel} style={styles.progressRow}>
          <span style={participante.status === "concluida" ? styles.progressDone : styles.progressPending}>{participante.status === "concluida" ? "✓" : participante.ordem}</span>
          <div><strong>{participante.papel === "empresa" ? "Representante da empresa" : "Cliente"}</strong><small style={styles.progressName}>{participante.nome}</small></div>
          <b style={participante.status === "concluida" ? styles.progressStatusDone : styles.progressStatusPending}>{participante.status === "concluida" ? "Assinado" : participante.status === "pendente" ? "Sua vez de assinar" : "Aguardando"}</b>
        </div>)}
      </section> : null}
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
        <p style={styles.pdfHint}>No celular, se o documento aparecer cortado, toque em <strong>Abrir em outra aba</strong> para ler todas as páginas.</p>
        <iframe
          src={`/api/assinatura-wolf/${encodeURIComponent(token)}/arquivo#view=FitH`}
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
            <div style={styles.videoWrap}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.video}/>
              <span style={styles.cameraStatus}>{cameraPronta ? "Câmera pronta" : "Carregando câmera…"}</span>
            </div>
            <div style={styles.row}>
              <button type="button" onClick={capturarSelfie} disabled={!cameraPronta} style={{ ...styles.primaryButton, opacity: cameraPronta ? 1 : 0.55 }}>Capturar selfie</button>
              <button type="button" onClick={fecharCamera} style={styles.textButton}>Cancelar</button>
            </div>
          </div>
        )}
        {!selfie && (
          <label style={styles.captureLabel}>
            Tirar foto com o celular
            <input type="file" accept="image/*" capture="user" onChange={e => carregarSelfieArquivo(e.target.files?.[0])} style={styles.hiddenInput}/>
          </label>
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
          <button type="button" onClick={limparAssinatura} style={styles.textButton}>Limpar</button>
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
  page: { minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", boxSizing: "border-box", background: "#f3f6fb", color: "#101828", padding: "24px 16px 50px", fontFamily: "Arial, sans-serif" },
  center: { minHeight: "100vh", background: "#f3f6fb", color: "#101828", padding: 24, display: "grid", placeContent: "center", justifyItems: "center", textAlign: "center", fontFamily: "Arial, sans-serif" },
  header: { width: "100%", maxWidth: 980, boxSizing: "border-box", margin: "0 auto 22px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 },
  brand: { fontSize: 21, fontWeight: 900, letterSpacing: 1.5, color: "#155eef" },
  brandSub: { fontSize: 12, color: "#667085", marginTop: 2 },
  secure: { fontSize: 12, color: "#027a48", background: "#ecfdf3", border: "1px solid #abefc6", borderRadius: 999, padding: "7px 11px" },
  hero: { width: "100%", maxWidth: 980, boxSizing: "border-box", overflow: "hidden", margin: "0 auto 18px", background: "linear-gradient(135deg,#ffffff,#eff4ff)", border: "1px solid #d0d5dd", borderRadius: 18, padding: 22, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 20, boxShadow: "0 10px 30px rgba(16,24,40,.06)" },
  heroContent: { minWidth: 0, maxWidth: "100%", flex: "1 1 260px" },
  step: { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#155eef" },
  title: { maxWidth: "100%", overflowWrap: "anywhere", wordBreak: "break-word", fontSize: 25, lineHeight: 1.15, margin: "7px 0 8px", color: "#101828" },
  muted: { fontSize: 13, lineHeight: 1.55, color: "#475467", margin: "8px 0" },
  expiry: { maxWidth: "100%", overflowWrap: "anywhere", fontSize: 11, lineHeight: 1.5, color: "#475467", textAlign: "left", flex: "0 1 auto" },
  progressCard: { width: "100%", maxWidth: 980, boxSizing: "border-box", margin: "0 auto 16px", background: "#fff", border: "1px solid #d0d5dd", borderRadius: 16, padding: 18 },
  progressTitle: { fontSize: 12, fontWeight: 900, color: "#344054", marginBottom: 12, textTransform: "uppercase", letterSpacing: .7 },
  progressRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #eef2f6" },
  progressDone: { display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 99, background: "#12b76a", color: "white", fontWeight: 900 },
  progressPending: { display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 99, background: "#eaf0fb", color: "#155eef", fontWeight: 900 },
  progressName: { display: "block", color: "#667085", marginTop: 2 },
  progressStatusDone: { marginLeft: "auto", color: "#027a48", fontSize: 12 },
  progressStatusPending: { marginLeft: "auto", color: "#b54708", fontSize: 12 },  card: { width: "100%", maxWidth: 980, minWidth: 0, boxSizing: "border-box", overflow: "hidden", margin: "0 auto 16px", background: "#fff", border: "1px solid #d0d5dd", borderRadius: 16, padding: 18, boxShadow: "0 5px 18px rgba(16,24,40,.04)" },
  cardHeader: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 },
  number: { display: "inline-grid", placeItems: "center", width: 27, height: 27, borderRadius: 9, background: "#155eef", color: "#fff", fontSize: 12, marginRight: 9 },
  link: { color: "#155eef", fontSize: 12, fontWeight: 700, textDecoration: "none" },
  pdfHint: { margin: "0 0 10px", fontSize: 11, lineHeight: 1.45, color: "#475467", background: "#f8fafc", borderRadius: 8, padding: "8px 10px" },
  pdf: { display: "block", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", height: "min(70vh,680px)", border: "1px solid #d0d5dd", borderRadius: 10, background: "#f2f4f7" },
  row: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 },
  otp: { width: 170, maxWidth: "100%", boxSizing: "border-box", padding: "13px 15px", border: "1px solid #98a2b3", borderRadius: 10, fontSize: 22, letterSpacing: 7, textAlign: "center", color: "#101828", background: "#fff" },
  secondaryButton: { border: "1px solid #84adff", background: "#eff4ff", color: "#004eeb", borderRadius: 10, padding: "12px 16px", fontWeight: 800, cursor: "pointer" },
  primaryButton: { border: 0, background: "#155eef", color: "#fff", borderRadius: 10, padding: "12px 18px", fontWeight: 800, cursor: "pointer" },
  cameraBox: { display: "grid", gap: 12, justifyItems: "center", marginTop: 12 },
  videoWrap: { position: "relative", width: "min(100%,420px)", maxWidth: "100%" },
  video: { display: "block", width: "100%", maxWidth: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 16, background: "#101828", transform: "scaleX(-1)" },
  cameraStatus: { position: "absolute", left: 10, bottom: 10, padding: "6px 9px", borderRadius: 999, background: "rgba(16,24,40,.78)", color: "#fff", fontSize: 11, fontWeight: 800 },
  captureLabel: { display: "inline-flex", marginTop: 12, border: "1px solid #84adff", background: "#fff", color: "#004eeb", borderRadius: 10, padding: "12px 16px", fontWeight: 800, cursor: "pointer" },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" },
  selfieBox: { display: "flex", gap: 16, alignItems: "center", marginTop: 12, flexWrap: "wrap" },
  selfie: { width: 150, height: 150, objectFit: "cover", borderRadius: 16, border: "2px solid #84adff", transform: "scaleX(-1)" },
  textButton: { border: 0, background: "transparent", color: "#155eef", fontWeight: 800, cursor: "pointer", padding: 6 },
  signature: { display: "block", width: "100%", maxWidth: "100%", boxSizing: "border-box", height: 180, border: "1px dashed #667085", borderRadius: 12, background: "#fff", touchAction: "none", cursor: "crosshair" },
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

