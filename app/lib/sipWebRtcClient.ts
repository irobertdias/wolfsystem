"use client";

import { Inviter, Registerer, SessionState, UserAgent } from "sip.js";

export type SipWebRtcConfig = {
  sip_ws_url: string;
  sip_domain: string;
  sip_extension: string;
  sip_auth_user: string;
  sip_password: string;
  sip_stun_url?: string | null;
  sip_turn_url?: string | null;
  sip_turn_user?: string | null;
  sip_turn_password?: string | null;
};

export type SipCallEvents = {
  onRinging?: () => void;
  onAccepted?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
};

export class SipWebRtcClient {
  private config: SipWebRtcConfig;
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private session: Inviter | null = null;
  private remoteAudio: HTMLAudioElement | null = null;

  constructor(config: SipWebRtcConfig) {
    this.config = config;
  }

  async register() {
    if (this.userAgent) return;
    const uri = UserAgent.makeURI(`sip:${this.config.sip_extension}@${this.config.sip_domain}`);
    if (!uri) throw new Error("Endereço SIP do ramal inválido");

    const iceServers: RTCIceServer[] = [];
    if (this.config.sip_stun_url) iceServers.push({ urls: this.config.sip_stun_url });
    if (this.config.sip_turn_url) {
      iceServers.push({
        urls: this.config.sip_turn_url,
        username: this.config.sip_turn_user || undefined,
        credential: this.config.sip_turn_password || undefined,
      });
    }

    this.userAgent = new UserAgent({
      uri,
      authorizationUsername: this.config.sip_auth_user,
      authorizationPassword: this.config.sip_password,
      transportOptions: { server: this.config.sip_ws_url },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: iceServers.length ? { iceServers } : undefined,
      },
    });
    await this.userAgent.start();
    this.registerer = new Registerer(this.userAgent);
    await this.registerer.register();
  }

  async call(numero: string, events: SipCallEvents = {}) {
    await this.register();
    if (!this.userAgent) throw new Error("Ramal SIP não registrado");
    const destino = UserAgent.makeURI(`sip:${numero.replace(/\D/g, "")}@${this.config.sip_domain}`);
    if (!destino) throw new Error("Número de destino SIP inválido");

    const session = new Inviter(this.userAgent, destino, {
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    });
    this.session = session;
    session.stateChange.addListener(state => {
      if (state === SessionState.Establishing) events.onRinging?.();
      if (state === SessionState.Established) {
        this.attachRemoteAudio(session);
        events.onAccepted?.();
      }
      if (state === SessionState.Terminated) {
        this.session = null;
        events.onEnded?.();
      }
    });
    try {
      await session.invite();
    } catch (error: any) {
      events.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async hangup() {
    if (!this.session) return;
    const active = this.session;
    if (active.state === SessionState.Initial || active.state === SessionState.Establishing) await active.cancel();
    else if (active.state === SessionState.Established) await active.bye();
  }

  setMuted(muted: boolean) {
    const pc = (this.session as any)?.sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
    pc?.getSenders().forEach(sender => {
      if (sender.track?.kind === "audio") sender.track.enabled = !muted;
    });
  }

  sendDtmf(digit: string) {
    const handler = (this.session as any)?.sessionDescriptionHandler;
    if (typeof handler?.sendDtmf === "function") handler.sendDtmf(digit);
  }

  async destroy() {
    try { await this.hangup(); } catch {}
    try { await this.registerer?.unregister(); } catch {}
    try { await this.userAgent?.stop(); } catch {}
    this.session = null;
    this.registerer = null;
    this.userAgent = null;
    if (this.remoteAudio) this.remoteAudio.srcObject = null;
  }

  private attachRemoteAudio(session: Inviter) {
    const pc = (session as any).sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;
    const stream = new MediaStream();
    pc.getReceivers().forEach(receiver => {
      if (receiver.track) stream.addTrack(receiver.track);
    });
    if (!this.remoteAudio) {
      this.remoteAudio = document.createElement("audio");
      this.remoteAudio.autoplay = true;
    }
    this.remoteAudio.srcObject = stream;
    this.remoteAudio.play().catch(() => {});
  }
}
