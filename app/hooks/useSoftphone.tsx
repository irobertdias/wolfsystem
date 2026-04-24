"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🎧 SOFTPHONE — Context + Hook
// ═══════════════════════════════════════════════════════════════════════
// Provê estado global da chamada ativa. Qualquer componente chama:
//   const { iniciarChamada } = useSoftphone();
//   iniciarChamada("+5562981519991", "João da Silva")
// E o componente <Softphone /> renderiza a UI flutuante.
//
// 🆕 NOTA: Esta primeira versão SIMULA as chamadas (fase 2 UI-only).
// Quando plugar Twilio/Zenvia real, só trocar a função `iniciarChamada`
// pelo SDK do provedor. Os estados e eventos continuam iguais.
// ═══════════════════════════════════════════════════════════════════════

export type StatusChamada =
  | "ocioso"
  | "iniciando"
  | "chamando"
  | "conectado"
  | "encerrando"
  | "sem_resposta"
  | "ocupado"
  | "falha"
  | "caixa_postal";

export type ChamadaAtiva = {
  numero: string;
  nome?: string;
  status: StatusChamada;
  iniciadoEm: Date;
  atendidoEm?: Date;
  mudo: boolean;
  ligacaoId?: number;
  canalVoipId?: number;
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
};

const SoftphoneContext = createContext<SoftphoneContextType | null>(null);

export function useSoftphone() {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    // 🆕 Fallback seguro — caso alguém chame useSoftphone() fora do Provider,
    // retorna dummy em vez de crashar a página inteira.
    if (typeof window !== "undefined") {
      console.warn("⚠️ useSoftphone chamado fora de <SoftphoneProvider>.");
    }
    return {
      chamada: null,
      aberto: false,
      setAberto: () => {},
      iniciarChamada: () => { alert("⚠️ Softphone indisponível nesta tela."); },
      encerrarChamada: () => {},
      toggleMudo: () => {},
      enviarDTMF: () => {},
      segundosConectado: 0,
    } as SoftphoneContextType;
  }
  return ctx;
}

// Cache de workspace/email — evita consultas repetidas ao Supabase
let workspaceIdCache: string | null = null;
let userEmailCache: string | null = null;

async function getWorkspaceEusuario(): Promise<{ workspaceId: string | null; email: string | null }> {
  if (workspaceIdCache && userEmailCache) {
    return { workspaceId: workspaceIdCache, email: userEmailCache };
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { workspaceId: null, email: null };
    userEmailCache = user.email || null;

    const { data: wsDono } = await supabase.from("workspaces").select("username").eq("owner_id", user.id).maybeSingle();
    if (wsDono?.username) { workspaceIdCache = wsDono.username; return { workspaceId: wsDono.username, email: user.email || null }; }

    const { data: wsUsr } = await supabase.from("usuarios_workspace").select("workspace_id").eq("email", user.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (wsUsr?.workspace_id) { workspaceIdCache = wsUsr.workspace_id; return { workspaceId: wsUsr.workspace_id, email: user.email || null }; }

    return { workspaceId: null, email: user.email || null };
  } catch (e) {
    return { workspaceId: null, email: null };
  }
}

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const [chamada, setChamada] = useState<ChamadaAtiva | null>(null);
  const [aberto, setAberto] = useState(false);
  const [segundosConectado, setSegundosConectado] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (!workspaceId) { console.warn("Softphone: sem workspace, chamada não registrada"); return false; }

      const resp = await fetch("/api/whatsapp?rota=voip/registrar-ligacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          atendenteEmail: email,
          numero_destino: ch.numero,
          status: statusFinal,
          duracao_segundos: duracaoSegs,
          iniciado_em: ch.iniciadoEm.toISOString(),
          atendido_em: ch.atendidoEm?.toISOString(),
          finalizado_em: new Date().toISOString(),
        })
      });
      return resp.ok;
    } catch (e) {
      console.error("Erro ao registrar ligação:", e);
      return false;
    }
  }, []);

  const iniciarChamada = useCallback(async (numero: string, nome?: string) => {
    if (chamada && chamada.status !== "ocioso") {
      alert("Já existe uma chamada em andamento. Encerre a atual primeiro.");
      return;
    }

    const novaChamada: ChamadaAtiva = {
      numero, nome,
      status: "iniciando",
      iniciadoEm: new Date(),
      mudo: false,
    };
    setChamada(novaChamada);
    setAberto(true);

    // 🆕 SIMULAÇÃO — remove quando plugar Twilio/Zenvia real
    await sleep(600);
    setChamada(c => c ? { ...c, status: "chamando" } : c);

    const tempoToque = 2000 + Math.random() * 3000;
    await sleep(tempoToque);

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
  }, [chamada, registrarLigacao]);

  const encerrarChamada = useCallback(async () => {
    if (!chamada) return;
    const ch = chamada;
    setChamada(c => c ? { ...c, status: "encerrando" } : c);

    const duracao = ch.atendidoEm ? Math.floor((Date.now() - ch.atendidoEm.getTime()) / 1000) : 0;
    await registrarLigacao(ch, "encerrada", duracao);

    await sleep(700);
    setChamada(null);
    setAberto(false);
    setSegundosConectado(0);
  }, [chamada, registrarLigacao]);

  const toggleMudo = useCallback(() => {
    setChamada(c => c ? { ...c, mudo: !c.mudo } : c);
  }, []);

  const enviarDTMF = useCallback((digito: string) => {
    if (!chamada || chamada.status !== "conectado") return;
    console.log(`🔢 DTMF: ${digito}`);
  }, [chamada]);

  return (
    <SoftphoneContext.Provider value={{
      chamada, aberto, setAberto,
      iniciarChamada, encerrarChamada, toggleMudo, enviarDTMF,
      segundosConectado,
    }}>
      {children}
    </SoftphoneContext.Provider>
  );
}