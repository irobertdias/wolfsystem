"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { SipWebRtcClient } from "../lib/sipWebRtcClient";

// ═══════════════════════════════════════════════════════════════════════
// 🎧 SOFTPHONE — Context + Hook com suporte híbrido (Twilio real + mock)
// ═══════════════════════════════════════════════════════════════════════
// Fluxo automático:
// 1. Ao tentar ligar, busca conexão Twilio ativa no workspace
// 2. Se encontrou → usa Twilio Voice SDK real
// 3. Se não encontrou ou falhou → cai no MOCK (simula chamada pra UI não quebrar)
//
// Isso permite testar a UI mesmo sem Twilio configurado.
// Quando cliente conecta Twilio corretamente, chamadas viram REAIS sem mudar nada.
//
// REQUER: npm install @twilio/voice-sdk
// ═══════════════════════════════════════════════════════════════════════

export type StatusChamada =
  | "ocioso" | "iniciando" | "chamando" | "conectado" | "encerrando"
  | "sem_resposta" | "ocupado" | "falha" | "caixa_postal" | "encerrada";

export type ChamadaAtiva = {
  numero: string;
  nome?: string;
  status: StatusChamada;
  iniciadoEm: Date;
  atendidoEm?: Date;
  mudo: boolean;
  ligacaoId?: number;
  canalVoipId?: number;
  modoReal?: boolean;  // true = Twilio real, false = mock
  callSid?: string;    // ID da chamada Twilio
  provider?: "twilio" | "zenvia" | "sip_manual" | "mock";
};

export type CanalVoip = {
  id: number;
  nome: string;
  provider: "twilio" | "zenvia" | "sip_manual";
  status: string;
  twilio_twiml_app_sid?: string | null;
  sip_extension?: string | null;
  sip_domain?: string | null;
};

type SoftphoneContextType = {
  chamada: ChamadaAtiva | null;
  aberto: boolean;
  setAberto: (v: boolean) => void;
  iniciarChamada: (numero: string, nome?: string) => void;
  encerrarChamada: () => void;
  toggleMudo: () => void;
  enviarDTMF: (digito: string) => void;
  segundosConectado: number;
  canais: CanalVoip[];
  canalSelecionadoId: number | null;
  setCanalSelecionadoId: (id: number | null) => void;
};

const SoftphoneContext = createContext<SoftphoneContextType | null>(null);

export function useSoftphone() {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    if (typeof window !== "undefined") {
      console.warn("⚠️ useSoftphone chamado fora de <SoftphoneProvider>.");
    }
    return {
      chamada: null, aberto: false,
      setAberto: () => {},
      iniciarChamada: () => { alert("⚠️ Softphone indisponível nesta tela."); },
      encerrarChamada: () => {}, toggleMudo: () => {}, enviarDTMF: () => {},
      segundosConectado: 0,
      canais: [], canalSelecionadoId: null, setCanalSelecionadoId: () => {},
    } as SoftphoneContextType;
  }
  return ctx;
}

// Cache de workspace/email
let workspaceIdCache: string | null = null;
let userEmailCache: string | null = null;

async function getWorkspaceEusuario(): Promise<{ workspaceId: string | null; email: string | null }> {
  if (workspaceIdCache && userEmailCache) return { workspaceId: workspaceIdCache, email: userEmailCache };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { workspaceId: null, email: null };
    userEmailCache = user.email || null;

    const { data: wsDono } = await supabase.from("workspaces").select("username").eq("owner_id", user.id).maybeSingle();
    if (wsDono?.username) { workspaceIdCache = wsDono.username; return { workspaceId: wsDono.username, email: user.email || null }; }

    const { data: wsUsr } = await supabase.from("usuarios_workspace").select("workspace_id").eq("email", user.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (wsUsr?.workspace_id) { workspaceIdCache = wsUsr.workspace_id; return { workspaceId: wsUsr.workspace_id, email: user.email || null }; }

    return { workspaceId: null, email: user.email || null };
  } catch (e) { return { workspaceId: null, email: null }; }
}

// Busca conexão Twilio ativa pro workspace (cache 60s)
let twilioConfigCache: { conn: any | null; ts: number } = { conn: null, ts: 0 };
async function buscarConfigTwilio(workspaceId: string) {
  const agora = Date.now();
  if (twilioConfigCache.conn !== null && agora - twilioConfigCache.ts < 60000) return twilioConfigCache.conn;

  const { data } = await supabase.from("conexoes_voip")
    .select("id, provider, twilio_api_key_sid, twilio_twiml_app_sid, twilio_numero_did, status")
    .eq("workspace_id", workspaceId).eq("provider", "twilio").eq("status", "conectado")
    .limit(1).maybeSingle();

  twilioConfigCache = { conn: data || null, ts: agora };
  return data || null;
}

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const [chamada, setChamada] = useState<ChamadaAtiva | null>(null);
  const [aberto, setAberto] = useState(false);
  const [segundosConectado, setSegundosConectado] = useState(0);
  const [canais, setCanais] = useState<CanalVoip[]>([]);
  const [canalSelecionadoId, setCanalSelecionadoId] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const deviceRef = useRef<any>(null);
  const twilioDeviceCanalRef = useRef<number | null>(null);     // Twilio Device
  const callRef = useRef<any>(null);       // Twilio Call em andamento
  const sipClientRef = useRef<SipWebRtcClient | null>(null);
  const chamadaRef = useRef<ChamadaAtiva | null>(null);  // snapshot pra callbacks

  useEffect(() => { chamadaRef.current = chamada; }, [chamada]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { workspaceId } = await getWorkspaceEusuario();
      if (!workspaceId) return;
      try {
        const resp = await fetch(`/api/whatsapp?rota=voip/conexoes/listar&workspaceId=${encodeURIComponent(workspaceId)}`);
        const json = await resp.json();
        if (!ativo || !resp.ok || !json.success) return;
        const disponiveis = (json.conexoes || []).filter((c: CanalVoip) => c.status === "conectado");
        setCanais(disponiveis);
        setCanalSelecionadoId(atual => atual && disponiveis.some((c: CanalVoip) => c.id === atual) ? atual : (disponiveis[0]?.id || null));
      } catch (error) { console.error("Softphone: falha ao listar canais", error); }
    })();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (chamada?.status === "conectado" && chamada.atendidoEm) {
      timerRef.current = setInterval(() => {
        setSegundosConectado(Math.floor((Date.now() - chamada.atendidoEm!.getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (chamada === null || chamada.status === "ocioso") setSegundosConectado(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [chamada?.status, chamada?.atendidoEm]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const registrarLigacao = useCallback(async (ch: ChamadaAtiva, statusFinal: StatusChamada, duracaoSegs: number) => {
    try {
      const { workspaceId, email } = await getWorkspaceEusuario();
      if (!workspaceId) { console.warn("Softphone: sem workspace"); return false; }

      const resp = await fetch("/api/whatsapp?rota=voip/registrar-ligacao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId, atendenteEmail: email,
          canalVoipId: ch.canalVoipId,
          numero_destino: ch.numero, status: statusFinal,
          duracao_segundos: duracaoSegs,
          iniciado_em: ch.iniciadoEm.toISOString(),
          atendido_em: ch.atendidoEm?.toISOString(),
          finalizado_em: new Date().toISOString(),
          provider_call_id: ch.callSid || null,
        })
      });
      return resp.ok;
    } catch (e) { console.error("Erro ao registrar ligação:", e); return false; }
  }, []);

  // ─── Inicializa Twilio Device (carrega SDK, pega token, cria Device) ──
  const inicializarTwilioDevice = async (conexaoId?: number): Promise<any | null> => {
    try {
      // Carrega SDK dinamicamente (evita quebrar build quando pacote não instalado)
      let TwilioSDK;
      try {
        TwilioSDK = await import("@twilio/voice-sdk");
      } catch (e) {
        console.warn("📞 @twilio/voice-sdk não instalado — usando mock. Rode: npm install @twilio/voice-sdk");
        return null;
      }

      const { workspaceId, email } = await getWorkspaceEusuario();
      if (!workspaceId) return null;

      // Pega token do backend
      const tokenResp = await fetch("/api/whatsapp?rota=voip/twilio/token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, identity: email, conexaoId })
      });

      if (!tokenResp.ok) {
        const err = await tokenResp.json().catch(() => ({}));
        console.warn(`📞 Sem Twilio configurado (${err.error || "erro"}) — usando mock`);
        return null;
      }

      const { token } = await tokenResp.json();
      const Device = TwilioSDK.Device;
      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: [TwilioSDK.Call.Codec.Opus, TwilioSDK.Call.Codec.PCMU] as any,
      });

      await device.register();
      deviceRef.current = device;
      twilioDeviceCanalRef.current = conexaoId || null;
      console.log("📞 Twilio Device inicializado");
      return device;
    } catch (e: any) {
      console.error("Erro ao inicializar Twilio:", e.message);
      return null;
    }
  };

  // ─── Chamada REAL via Twilio ───────────────────────────────────────────
  const iniciarChamadaTwilio = async (numero: string, nome: string | undefined, device: any, canal: CanalVoip) => {
    const numeroLimpo = numero.replace(/\D/g, "");
    const numeroE164 = numeroLimpo.startsWith("55") ? `+${numeroLimpo}` : `+55${numeroLimpo}`;

    const novaChamada: ChamadaAtiva = {
      numero, nome, status: "iniciando",
      iniciadoEm: new Date(), mudo: false, modoReal: true,
      provider: "twilio", canalVoipId: canal.id,
    };
    setChamada(novaChamada); setAberto(true);

    try {
      const call = await device.connect({ params: { To: numeroE164, ConnectionId: String(canal.id) } });
      callRef.current = call;

      call.on("ringing", () => setChamada(c => c ? { ...c, status: "chamando" } : c));
      call.on("accept", () => {
        const callSid = call.parameters?.CallSid;
        setChamada(c => c ? { ...c, status: "conectado", atendidoEm: new Date(), callSid } : c);
      });
      call.on("disconnect", () => {
        const ch = chamadaRef.current;
        if (ch) {
          const duracao = ch.atendidoEm ? Math.floor((Date.now() - ch.atendidoEm.getTime()) / 1000) : 0;
          registrarLigacao(ch, "encerrada", duracao);
        }
        callRef.current = null;
        setChamada(null); setAberto(false);
      });
      call.on("reject", () => {
        setChamada(c => c ? { ...c, status: "ocupado" } : c);
        setTimeout(() => { callRef.current = null; setChamada(null); setAberto(false); }, 2000);
      });
      call.on("error", (err: any) => {
        console.error("Erro Twilio:", err);
        setChamada(c => c ? { ...c, status: "falha" } : c);
        setTimeout(() => { callRef.current = null; setChamada(null); setAberto(false); }, 2500);
      });
    } catch (e: any) {
      console.error("Erro ao conectar:", e.message);
      setChamada(c => c ? { ...c, status: "falha" } : c);
      setTimeout(() => { setChamada(null); setAberto(false); }, 2500);
    }
  };

  // ─── Chamada MOCK (fallback quando Twilio não disponível) ──────────────
  const iniciarChamadaSip = async (numero: string, nome: string | undefined, canal: CanalVoip) => {
    const { workspaceId } = await getWorkspaceEusuario();
    if (!workspaceId) throw new Error("Workspace nao identificado");
    const resp = await fetch("/api/whatsapp?rota=voip/sip/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, conexaoId: canal.id }) });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) throw new Error(json.error || "Nao foi possivel carregar o ramal SIP");
    if (sipClientRef.current) await sipClientRef.current.destroy();
    const client = new SipWebRtcClient(json.config); sipClientRef.current = client;
    const novaChamada: ChamadaAtiva = { numero, nome, status: "iniciando", iniciadoEm: new Date(), mudo: false, modoReal: true, provider: "sip_manual", canalVoipId: canal.id };
    setChamada(novaChamada); setAberto(true);
    await client.call(numero, {
      onRinging: () => setChamada(c => c ? { ...c, status: "chamando" } : c),
      onAccepted: () => setChamada(c => c ? { ...c, status: "conectado", atendidoEm: new Date() } : c),
      onEnded: () => { const ch = chamadaRef.current; if (ch) registrarLigacao(ch, "encerrada", ch.atendidoEm ? Math.floor((Date.now() - ch.atendidoEm.getTime()) / 1000) : 0); sipClientRef.current = null; setChamada(null); setAberto(false); },
      onError: error => { console.error("Erro SIP:", error); setChamada(c => c ? { ...c, status: "falha" } : c); }
    });
  };

  const iniciarChamadaMock = async (numero: string, nome: string | undefined) => {
    const novaChamada: ChamadaAtiva = {
      numero, nome, status: "iniciando",
      iniciadoEm: new Date(), mudo: false, modoReal: false,
    };
    setChamada(novaChamada); setAberto(true);

    await sleep(600);
    setChamada(c => c ? { ...c, status: "chamando" } : c);
    await sleep(2000 + Math.random() * 3000);

    const sorteio = Math.random();
    if (sorteio < 0.75) {
      setChamada(c => c ? { ...c, status: "conectado", atendidoEm: new Date() } : c);
    } else if (sorteio < 0.90) {
      setChamada(c => c ? { ...c, status: "sem_resposta" } : c);
      await sleep(2500);
      registrarLigacao({ ...novaChamada, status: "sem_resposta" }, "sem_resposta", 0);
      setChamada(null); setAberto(false);
    } else {
      setChamada(c => c ? { ...c, status: "ocupado" } : c);
      await sleep(2500);
      registrarLigacao({ ...novaChamada, status: "ocupado" }, "ocupado", 0);
      setChamada(null); setAberto(false);
    }
  };

  const iniciarChamada = useCallback(async (numero: string, nome?: string) => {
    if (chamada && chamada.status !== "ocioso") {
      alert("Já existe uma chamada em andamento. Encerre a atual primeiro.");
      return;
    }

    const { workspaceId } = await getWorkspaceEusuario();
    if (!workspaceId) { alert("Usuário não autenticado."); return; }

    const selecionado = canais.find(c => c.id === canalSelecionadoId) || canais[0];
    if (selecionado?.provider === "sip_manual") {
      try { await iniciarChamadaSip(numero, nome, selecionado); }
      catch (error: any) { alert(error?.message || "Falha ao iniciar chamada SIP"); setChamada(null); setAberto(false); }
      return;
    }

    const conn = selecionado?.provider === "twilio" ? selecionado : await buscarConfigTwilio(workspaceId);
    if (conn && conn.twilio_twiml_app_sid) {
      let device = deviceRef.current;
      if (device && twilioDeviceCanalRef.current !== conn.id) {
        try { device.destroy(); } catch {}
        deviceRef.current = null;
        twilioDeviceCanalRef.current = null;
        device = null;
      }
      if (!device) device = await inicializarTwilioDevice(conn.id);
      if (device) { await iniciarChamadaTwilio(numero, nome, device, conn); return; }
      console.warn("Twilio configurado mas Device falhou; usando mock");
    }
    await iniciarChamadaMock(numero, nome);
  }, [chamada, registrarLigacao, canais, canalSelecionadoId]);

  const encerrarChamada = useCallback(async () => {
    if (!chamada) return;

    if (chamada.provider === "sip_manual" && sipClientRef.current) {
      try { await sipClientRef.current.hangup(); } catch (e) { console.error(e); }
      return;
    }

    if (chamada.modoReal && callRef.current) {
      // Desliga chamada real — o evento disconnect vai finalizar
      try { callRef.current.disconnect(); } catch (e) { console.error(e); }
      return;
    }

    // Mock: fecha localmente
    const ch = chamada;
    setChamada(c => c ? { ...c, status: "encerrando" } : c);
    const duracao = ch.atendidoEm ? Math.floor((Date.now() - ch.atendidoEm.getTime()) / 1000) : 0;
    await registrarLigacao(ch, "encerrada", duracao);
    await sleep(700);
    setChamada(null); setAberto(false); setSegundosConectado(0);
  }, [chamada, registrarLigacao]);

  const toggleMudo = useCallback(() => {
    setChamada(c => {
      if (!c) return c;
      const novoMudo = !c.mudo;
      if (c.provider === "sip_manual" && sipClientRef.current) sipClientRef.current.setMuted(novoMudo);
      else if (c.modoReal && callRef.current) {
        try { callRef.current.mute(novoMudo); } catch (e) { console.error(e); }
      }
      return { ...c, mudo: novoMudo };
    });
  }, []);

  const enviarDTMF = useCallback((digito: string) => {
    if (!chamada || chamada.status !== "conectado") return;
    if (chamada.provider === "sip_manual" && sipClientRef.current) sipClientRef.current.sendDtmf(digito);
    else if (chamada.modoReal && callRef.current) {
      try { callRef.current.sendDigits(digito); } catch (e) { console.error(e); }
    } else {
      console.log(`🔢 DTMF (mock): ${digito}`);
    }
  }, [chamada]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (callRef.current) { try { callRef.current.disconnect(); } catch (e) {} }
      if (deviceRef.current) { try { deviceRef.current.destroy(); } catch (e) {} }
      twilioDeviceCanalRef.current = null;
      if (sipClientRef.current) { sipClientRef.current.destroy().catch(() => {}); }
    };
  }, []);

  return (
    <SoftphoneContext.Provider value={{
      chamada, aberto, setAberto,
      iniciarChamada, encerrarChamada, toggleMudo, enviarDTMF,
      segundosConectado,
      canais, canalSelecionadoId, setCanalSelecionadoId,
    }}>
      {children}
    </SoftphoneContext.Provider>
  );
}

