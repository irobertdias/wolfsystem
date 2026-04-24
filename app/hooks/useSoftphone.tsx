"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";

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
  | "ocioso"         // nenhuma chamada
  | "iniciando"      // clicou ligar, preparando
  | "chamando"       // tocando no destino
  | "conectado"      // destino atendeu
  | "encerrando"     // desligando
  | "sem_resposta"   // não atendeu
  | "ocupado"        // linha ocupada
  | "falha"          // erro
  | "caixa_postal";  // caiu na caixa postal

export type ChamadaAtiva = {
  numero: string;
  nome?: string;
  status: StatusChamada;
  iniciadoEm: Date;
  atendidoEm?: Date;
  mudo: boolean;
  ligacaoId?: number;  // id na tabela `ligacoes` após registro
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
  // Segundos decorridos desde que atendeu (só conta após conectado)
  segundosConectado: number;
};

const SoftphoneContext = createContext<SoftphoneContextType | null>(null);

export function useSoftphone() {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) throw new Error("useSoftphone precisa estar dentro de <SoftphoneProvider>");
  return ctx;
}

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const [chamada, setChamada] = useState<ChamadaAtiva | null>(null);
  const [aberto, setAberto] = useState(false);
  const [segundosConectado, setSegundosConectado] = useState(0);

  // Timer de segundos após atender
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

  // Helpers que programam transições de estado (simulação da chamada mockada)
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const registrarLigacao = useCallback(async (ch: ChamadaAtiva, statusFinal: StatusChamada, duracaoSegs: number) => {
    try {
      const resp = await fetch("/api/whatsapp?rota=voip/registrar-ligacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      numero,
      nome,
      status: "iniciando",
      iniciadoEm: new Date(),
      mudo: false,
    };
    setChamada(novaChamada);
    setAberto(true);

    // 🆕 SIMULAÇÃO — remove quando plugar Twilio/Zenvia real
    await sleep(600);
    setChamada(c => c ? { ...c, status: "chamando" } : c);

    // Simula toque entre 2-5 segundos
    const tempoToque = 2000 + Math.random() * 3000;
    await sleep(tempoToque);

    // 75% atende, 15% sem resposta, 10% ocupado (pra variar o mock)
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
    // Quando plugar Twilio/Zenvia real, envia o DTMF pelo SDK
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