"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 💰 useLembretePagamento — Hook global de cobrança automática
// ───────────────────────────────────────────────────────────────────────
// Verifica o status de pagamento do workspace atual e decide quando
// mostrar o popup de lembrete ou a tela de bloqueio.
//
// Lógica:
//   - Admin master (Robert) nunca vê popup
//   - Dono e sub-usuários do workspace veem os popups
//   - 2 dias antes do venc até dia do venc → popup a cada 3h (educado/firme)
//   - 1 dia depois do venc → popup AGRESSIVO a cada 1h (não fecha)
//   - 2+ dias depois do venc → BLOQUEIO TOTAL
//   - Quando admin marca PAGO → popup some e recalcula próximo venc
//   - Quando admin SUSPENDE manualmente → BLOQUEIO imediato
// ═══════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

// Chave do localStorage pra controlar intervalo (não ficar abrindo popup direto)
const LS_KEY_PROXIMO_POPUP = "wolf_proximo_popup_at";

export type FaseCobranca =
  | "ativo"         // tudo em dia, sem popup
  | "lembrete"      // 2 dias antes até dia do venc (popup educado, cada 3h)
  | "agressivo"    // 1 dia atrasado (popup agressivo, cada 1h, não fecha)
  | "bloqueado"     // 2+ dias atrasado (tela de bloqueio)
  | "suspenso"      // admin suspendeu manualmente (tela de bloqueio)
  | "carregando"
  | "imune";        // é o admin master, nunca vê nada

export type DadosCobranca = {
  fase: FaseCobranca;
  diasAteVencimento: number | null;   // negativo = atrasado, 0 = vence hoje, positivo = futuro
  diaVencimento: number | null;
  valorMensalidade: number | null;
  proximoVencimento: string | null;   // ISO date 'YYYY-MM-DD'
  ultimoPagamento: string | null;
  cadastroId: number | null;
  nomeCliente: string | null;
  emailCliente: string | null;
  bloqueioPostergadoAte: string | null; // 🆕 v2 — desbloqueio em confiança
};

export type LembretePagamentoState = DadosCobranca & {
  popupVisivel: boolean;
  fecharPopup: () => void;
  forcarRecheck: () => void;
};

// ═══ Helpers ═══

function diasEntre(dataFutura: Date, hoje: Date): number {
  // Normaliza pra meia-noite local pra não dar problema de hora
  const a = new Date(dataFutura.getFullYear(), dataFutura.getMonth(), dataFutura.getDate());
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function determinarFase(
  statusPagamento: string,
  diasAteVencimento: number | null,
  bloqueioPostergadoAte: string | null
): FaseCobranca {
  // Suspenso manualmente sempre vence (não respeita postergação)
  if (statusPagamento === "suspenso") return "suspenso";

  // 🆕 v2: Se admin postergou bloqueio e a data ainda tá no futuro, fica ATIVO
  // (mesmo se tava pra bloquear). Isso é o "desbloqueio em confiança".
  if (bloqueioPostergadoAte) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ate = new Date(bloqueioPostergadoAte + "T00:00:00");
    if (ate.getTime() >= hoje.getTime()) {
      // Confiança ativa: cliente continua usando, sem popup
      return "ativo";
    }
  }

  // Bloqueado por atraso (2+ dias)
  if (statusPagamento === "bloqueado") return "bloqueado";

  if (diasAteVencimento === null) return "ativo";

  // 2 ou mais dias de atraso → bloqueio (mesmo se ainda tá marcado como ativo)
  if (diasAteVencimento <= -2) return "bloqueado";

  // 1 dia de atraso → agressivo
  if (diasAteVencimento === -1) return "agressivo";

  // De 2 dias antes até o dia do venc (inclusive) → lembrete
  if (diasAteVencimento >= -0 && diasAteVencimento <= 2) return "lembrete";

  return "ativo";
}

function intervaloDoPopup(fase: FaseCobranca): number {
  // Em milissegundos
  if (fase === "lembrete") return 3 * 60 * 60 * 1000;   // 3 horas
  if (fase === "agressivo") return 1 * 60 * 60 * 1000;  // 1 hora
  return 0;
}

// ═══ Hook principal ═══

export function useLembretePagamento(): LembretePagamentoState {
  const [dados, setDados] = useState<DadosCobranca>({
    fase: "carregando",
    diasAteVencimento: null,
    diaVencimento: null,
    valorMensalidade: null,
    proximoVencimento: null,
    ultimoPagamento: null,
    cadastroId: null,
    nomeCliente: null,
    emailCliente: null,
    bloqueioPostergadoAte: null,
  });

  const [popupVisivel, setPopupVisivel] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const popupCheckRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Função principal: busca status do workspace atual ───
  const buscarStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDados(d => ({ ...d, fase: "ativo" }));
        return;
      }

      // Admin master? Imune.
      if (user.email === ADMIN_EMAIL) {
        setDados(d => ({ ...d, fase: "imune" }));
        return;
      }

      // Tenta encontrar o dono do workspace (cadastros tem coluna email do dono)
      let emailDono = user.email!;
      let nomeDono: string | null = null;

      // É dono direto?
      const { data: wsDono } = await supabase
        .from("workspaces")
        .select("owner_email, nome")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (wsDono?.owner_email) {
        emailDono = wsDono.owner_email;
        nomeDono = wsDono.nome ?? null;
      } else {
        // É sub-usuário? Procura o workspace dele
        const { data: usuarioWs } = await supabase
          .from("usuarios_workspace")
          .select("workspace_id")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (usuarioWs?.workspace_id) {
          const { data: wsSub } = await supabase
            .from("workspaces")
            .select("owner_email, nome")
            .eq("username", usuarioWs.workspace_id)
            .maybeSingle();
          if (wsSub?.owner_email) {
            emailDono = wsSub.owner_email;
            nomeDono = wsSub.nome ?? null;
          }
        }
      }

      // Busca o cadastro do dono
      const { data: cadastro } = await supabase
        .from("cadastros")
        .select("id, nome, email, dia_vencimento, valor_mensalidade, proximo_vencimento, status_pagamento, ultimo_pagamento_em, bloqueio_postergado_ate")
        .eq("email", emailDono)
        .maybeSingle();

      if (!cadastro) {
        // Sem cadastro → não cobra
        setDados(d => ({ ...d, fase: "ativo" }));
        return;
      }

      // Calcula dias até vencimento
      let diasAteVencimento: number | null = null;
      if (cadastro.proximo_vencimento) {
        const hoje = new Date();
        const venc = new Date(cadastro.proximo_vencimento + "T00:00:00");
        diasAteVencimento = diasEntre(venc, hoje);
      }

      const bloqueioPostergadoAte = cadastro.bloqueio_postergado_ate ?? null;
      const fase = determinarFase(cadastro.status_pagamento || "ativo", diasAteVencimento, bloqueioPostergadoAte);

      setDados({
        fase,
        diasAteVencimento,
        diaVencimento: cadastro.dia_vencimento ?? null,
        valorMensalidade: cadastro.valor_mensalidade != null ? Number(cadastro.valor_mensalidade) : null,
        proximoVencimento: cadastro.proximo_vencimento ?? null,
        ultimoPagamento: cadastro.ultimo_pagamento_em ?? null,
        cadastroId: cadastro.id,
        nomeCliente: nomeDono ?? cadastro.nome ?? null,
        emailCliente: emailDono,
        bloqueioPostergadoAte,
      });
    } catch (e) {
      console.error("[useLembretePagamento] Erro ao buscar status:", e);
      setDados(d => ({ ...d, fase: "ativo" }));
    }
  }, []);

  // ─── Decide se mostra popup baseado na fase + localStorage ───
  const verificarPopup = useCallback(() => {
    const fase = dados.fase;

    // Bloqueio/suspensão → sempre mostra (não é popup, é tela cheia)
    if (fase === "bloqueado" || fase === "suspenso") {
      setPopupVisivel(true);
      return;
    }

    // Agressivo → sempre mostra (não pode fechar)
    if (fase === "agressivo") {
      setPopupVisivel(true);
      return;
    }

    // Lembrete educado → respeita o intervalo
    if (fase === "lembrete") {
      const proximoStr = localStorage.getItem(LS_KEY_PROXIMO_POPUP);
      const agora = Date.now();
      if (proximoStr) {
        const proximoEm = parseInt(proximoStr);
        if (!isNaN(proximoEm) && proximoEm > agora) {
          setPopupVisivel(false);
          return;
        }
      }
      setPopupVisivel(true);
      return;
    }

    setPopupVisivel(false);
  }, [dados.fase]);

  // ─── Fecha popup e agenda próximo (usado só no modo lembrete educado) ───
  const fecharPopup = useCallback(() => {
    // Em modo agressivo/bloqueado/suspenso, não permite fechar
    if (dados.fase === "agressivo" || dados.fase === "bloqueado" || dados.fase === "suspenso") {
      return;
    }
    const intervalo = intervaloDoPopup(dados.fase);
    if (intervalo > 0) {
      const proximoEm = Date.now() + intervalo;
      localStorage.setItem(LS_KEY_PROXIMO_POPUP, proximoEm.toString());
    }
    setPopupVisivel(false);
  }, [dados.fase]);

  // ─── Força um recheck (usado quando admin marca como pago, por exemplo) ───
  const forcarRecheck = useCallback(() => {
    localStorage.removeItem(LS_KEY_PROXIMO_POPUP);
    buscarStatus();
  }, [buscarStatus]);

  // ─── Effect: busca inicial + periódica (a cada 5min) ───
  useEffect(() => {
    buscarStatus();
    intervalRef.current = setInterval(buscarStatus, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [buscarStatus]);

  // ─── Effect: real-time pra atualizar quando admin marca como pago ───
  useEffect(() => {
    if (!dados.cadastroId) return;
    const ch = supabase
      .channel("cobranca_rt_" + dados.cadastroId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cadastros", filter: `id=eq.${dados.cadastroId}` },
        () => {
          localStorage.removeItem(LS_KEY_PROXIMO_POPUP);
          buscarStatus();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pagamentos", filter: `cadastro_id=eq.${dados.cadastroId}` },
        () => {
          localStorage.removeItem(LS_KEY_PROXIMO_POPUP);
          buscarStatus();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dados.cadastroId, buscarStatus]);

  // ─── Effect: re-verifica popup quando fase muda + agendamento por intervalo ───
  useEffect(() => {
    verificarPopup();

    // Em modo agressivo, agenda re-check a cada 1min pra garantir que tá sempre visível
    // Em modo lembrete, agenda re-check a cada 1min pra detectar quando o intervalo passou
    if (dados.fase === "lembrete" || dados.fase === "agressivo") {
      if (popupCheckRef.current) clearInterval(popupCheckRef.current);
      popupCheckRef.current = setInterval(verificarPopup, 60 * 1000);
    } else {
      if (popupCheckRef.current) {
        clearInterval(popupCheckRef.current);
        popupCheckRef.current = null;
      }
    }
    return () => {
      if (popupCheckRef.current) clearInterval(popupCheckRef.current);
    };
  }, [dados.fase, verificarPopup]);

  return {
    ...dados,
    popupVisivel,
    fecharPopup,
    forcarRecheck,
  };
}