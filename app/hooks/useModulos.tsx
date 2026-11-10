"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "./useWorkspace";

import Icone, { IconeEmoji } from "../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🎁 useModulos — descobre quais módulos estão liberados pro workspace atual
// ═══════════════════════════════════════════════════════════════════════
// O admin Wolf libera/bloqueia módulos por cadastro de cliente.
// Cada workspace puxa os módulos do SEU DONO (owner) da tabela cadastros.
//
// Uso típico:
//   const { carregado, modulos } = useModulos();
//   if (!carregado) return <Loading />;
//   if (!modulos.voip) return <ModuloBloqueado modulo="voip" />;
//   return <SeuConteudo />;
// ═══════════════════════════════════════════════════════════════════════

export type Modulos = {
  vendedor_ia: boolean;
  roleta: boolean;
  disparos_web: boolean;
  validacao_numeros: boolean;
  disparos_api: boolean;
  voip: boolean;
  api_integracao: boolean;
  instagram: boolean;
  cobranca: boolean;
  meta_ads: boolean;

  contratos_assinaturas: boolean;
  revisional: boolean;    // Revisional (simulação + propostas com link)
  rh: boolean;           // 🆕 Recursos Humanos
  bater_ponto: boolean;   // 🆕 Bater Ponto
  financeiro: boolean;                          // 🆕 Financeiro (master)
  financeiro_opcoes: Record<string, boolean>;   // 🆕 subset de opções do workspace
  plano: "basico" | "intermediario" | "ultra" | string;
};

export const FIN_OPCOES = [
  "dashboard","indicadores","contas_receber","contas_pagar","caixa","transferencias",
  "contas_bancarias","conciliacao","extrato","integracao_banco",
  "emitir_nota","notas_recebidas","boletos",
  "plano_contas","centros_custo","contatos","formas_pagamento",
  "dre","fluxo_caixa","relatorios","config",
] as const;
const FIN_TODAS: Record<string, boolean> = Object.fromEntries(FIN_OPCOES.map((k) => [k, true]));

const MODULOS_BLOQUEADOS_DEFAULT: Modulos = {
  vendedor_ia: false,
  roleta: false, disparos_web: false, validacao_numeros: false, disparos_api: false,
  voip: false, api_integracao: false, instagram: false,
  cobranca: false, meta_ads: false,  contratos_assinaturas: false, revisional: false, rh: false, bater_ponto: false,
  financeiro: false, financeiro_opcoes: {},
  plano: "basico",
};

// O workspace interno do admin Wolf tem tudo liberado (admin Wolf não tem plano).
// A permissão sempre segue o DONO do workspace aberto, inclusive quando o admin
// está acessando um workspace de cliente.
const ADMIN_EMAIL = "robert.dias@live.com";

export function useModulos() {
  const { wsId } = useWorkspace();
  const [modulos, setModulos] = useState<Modulos>(MODULOS_BLOQUEADOS_DEFAULT);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    let cancelado = false;

    const fetch = async () => {
      try {
        // 🆕 v18: Busca workspace pegando owner_id E owner_email no mesmo SELECT.
        // ─────────────────────────────────────────────────────────────────
        // BUG ANTERIOR: a versão antiga só pegava owner_id, e pro sub-usuário
        // tentava descobrir o email do dono via:
        //   1) usuarios_workspace WHERE perfil='Dono' — mas Dono NÃO está nessa
        //      tabela (ela só lista sub-usuários como Atendente/Supervisor/Admin)
        //   2) cadastros WHERE workspace_id=X — mas a coluna workspace_id não
        //      existe em cadastros (essa tabela usa email como chave única)
        // Resultado: ownerEmail virava null pro Fenix/Marcelo/Hélio → módulos
        // todos false → Telefonia some, Roleta some, etc.
        // ─────────────────────────────────────────────────────────────────
        const { data: ws } = await supabase.from("workspaces")
          .select("owner_id, owner_email")
          .eq("username", wsId)
          .maybeSingle();

        if (!ws?.owner_email) {
          if (!cancelado) { setModulos(MODULOS_BLOQUEADOS_DEFAULT); setCarregado(true); }
          return;
        }

        // Email do owner: usa direto da tabela workspaces (funciona pra dono E sub-usuário)
        const ownerEmail = ws.owner_email;

        // 🆕 Workspace do próprio admin Wolf → tudo liberado (inclusive pros
        // sub-usuários dele). O admin não tem linha em `cadastros`, então sem
        // isso os módulos voltariam todos false pro time interno da casa.
        if ((ownerEmail || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          if (!cancelado) {
            setModulos({ vendedor_ia: true, roleta: true, disparos_web: true, validacao_numeros: true, disparos_api: true, voip: true, api_integracao: true, instagram: true, cobranca: true, meta_ads: true,  contratos_assinaturas: true, revisional: true, rh: true, bater_ponto: true, financeiro: true, financeiro_opcoes: FIN_TODAS, plano: "ultra" });
            setCarregado(true);
          }
          return;
        }

        // Busca os módulos liberados no cadastro do dono
        const { data: cad } = await supabase.from("cadastros")
          .select("ia, modulo_roleta, modulo_disparos_web, modulo_validacao_numeros, modulo_disparos_api, modulo_voip, modulo_api_integracao, modulo_instagram, modulo_cobranca, modulo_meta_ads, modulo_contratos_assinaturas, modulo_rh, modulo_bater_ponto, modulo_financeiro, financeiro_opcoes, plano")
          .eq("email", ownerEmail)
          .maybeSingle();
        // Revisional em consulta separada: se a coluna ainda não existir, só ele fica desligado.
        const { data: cadRev } = await supabase.from("cadastros")
          .select("modulo_revisional")
          .eq("email", ownerEmail)
          .maybeSingle();

        if (!cancelado) {
          setModulos({
            vendedor_ia: !!cad?.ia && !['nao','não','false','0'].includes(String(cad.ia).toLowerCase()),
            roleta: !!cad?.modulo_roleta,
            disparos_web: !!cad?.modulo_disparos_web,
            validacao_numeros: !!cad?.modulo_validacao_numeros,
            disparos_api: !!cad?.modulo_disparos_api,
            voip: !!cad?.modulo_voip,
            api_integracao: !!cad?.modulo_api_integracao,
            instagram: !!cad?.modulo_instagram,
            cobranca: !!cad?.modulo_cobranca,
            meta_ads: !!cad?.modulo_meta_ads,

            contratos_assinaturas: !!cad?.modulo_contratos_assinaturas,
            revisional: !!(cadRev as { modulo_revisional?: boolean } | null)?.modulo_revisional,
            rh: !!cad?.modulo_rh,                 // 🆕
            bater_ponto: !!cad?.modulo_bater_ponto, // 🆕
            financeiro: !!cad?.modulo_financeiro,
            financeiro_opcoes: (cad?.financeiro_opcoes as Record<string, boolean>) || {},
            plano: cad?.plano || "basico",
          });
          setCarregado(true);
        }
      } catch (e) {
        console.error("useModulos:", e);
        if (!cancelado) { setModulos(MODULOS_BLOQUEADOS_DEFAULT); setCarregado(true); }
      }
    };

    fetch();
    return () => { cancelado = true; };
  }, [wsId]);

  return { modulos, carregado };
}

// ═══════════════════════════════════════════════════════════════════════
// 🔒 <ModuloBloqueado /> — tela de upsell quando módulo não está liberado
// ═══════════════════════════════════════════════════════════════════════
// Uso:
//   if (!modulos.voip) return <ModuloBloqueado modulo="voip" />;
// ═══════════════════════════════════════════════════════════════════════

type ModuloKey = "roleta" | "disparos_web" | "validacao_numeros" | "disparos_api" | "voip" | "api_integracao" | "instagram" | "cobranca" | "meta_ads"  | "rh" | "bater_ponto";

const INFO_MODULOS: Record<ModuloKey, { icone: string; nome: string; desc: string; planoNecessario: string; cor: string }> = {
  roleta: {
    icone: "🎯",
    nome: "Roleta de Distribuição",
    desc: "Distribua leads automaticamente entre os atendentes de forma balanceada, ranqueada ou aleatória. Respeita fila e horário comercial.",
    planoNecessario: "Intermediário ou Ultra",
    cor: "#3b82f6",
  },
  disparos_web: {
    icone: "📤",
    nome: "Disparos em Massa (Web)",
    desc: "Envie campanhas de WhatsApp para milhares de contatos usando conexão via QR Code.",
    planoNecessario: "Intermediário ou Ultra",
    cor: "#3b82f6",
  },
  validacao_numeros: {
    icone: "\u2705",
    nome: "Valida\u00e7\u00e3o de n\u00fameros",
    desc: "Higienize listas e separe os n\u00fameros que possuem WhatsApp sem enviar mensagens.",
    planoNecessario: "Libera\u00e7\u00e3o comercial",
    cor: "#0891b2",
  },
  disparos_api: {
    icone: "📨",
    nome: "Disparos em Massa (API Oficial)",
    desc: "Dispare templates aprovados pela Meta via API oficial do WhatsApp Business. Alta taxa de entrega, sem risco de ban.",
    planoNecessario: "Ultra",
    cor: "#8b5cf6",
  },
  voip: {
    icone: "📞",
    nome: "Módulo de Ligações VOIP",
    desc: "Faça chamadas de voz direto do CRM pelo navegador. Integração com Twilio e Zenvia. Gravação, DTMF, transferência de chamadas.",
    planoNecessario: "Ultra",
    cor: "#8b5cf6",
  },
  api_integracao: {
    icone: "🔌",
    nome: "API de Integração",
    desc: "Integre o Wolf com outros sistemas via API REST. Webhooks, automações, CRM externo, ERPs.",
    planoNecessario: "Intermediário ou Ultra",
    cor: "#3b82f6",
  },
  instagram: {
    icone: "📸",
    nome: "Instagram Direct",
    desc: "Atendimento unificado no Instagram Direct Messages. Responda mensagens do Instagram pela mesma tela do WhatsApp.",
    planoNecessario: "Ultra",
    cor: "#8b5cf6",
  },
  cobranca: {
    icone: "\uD83D\uDCB0",
    nome: "Cobran\u00e7a",
    desc: "Acompanhe faturas, pagamentos, inadimpl\u00eancia e negocia\u00e7\u00f5es do seu workspace.",
    planoNecessario: "Libera\u00e7\u00e3o comercial",
    cor: "#059669",
  },
  meta_ads: {
    icone: "📊",
    nome: "Central Ads",
    desc: "Acompanhe investimento, leads, formulários, CPC, CPA e resultados dos gerenciadores de anúncios conectados à Wolf.",
    planoNecessario: "Liberação comercial",
    cor: "#7e22ce",
  },

  rh: {
    icone: "🧑‍💼",
    nome: "Recursos Humanos",
    desc: "Gestão completa de pessoas: funcionários, cargos, folha, férias, benefícios, treinamentos, avaliações, documentos e muito mais.",
    planoNecessario: "Intermediário ou Ultra",
    cor: "#4f46e5",
  },
  bater_ponto: {
    icone: "🕐",
    nome: "Bater Ponto",
    desc: "Registro de ponto pelos colaboradores com selfie e geolocalização. Banco de horas e folha de ponto integrados ao RH.",
    planoNecessario: "Intermediário ou Ultra",
    cor: "#0891b2",
  },
};

export function ModuloBloqueado({ modulo }: { modulo: ModuloKey }) {
  const router = useRouter();
  const info = INFO_MODULOS[modulo];

  const solicitarLiberacao = () => {
    const msg = `Olá! Gostaria de solicitar a liberação do módulo *${info.nome}* na minha conta Wolf System.`;
    // Ajuste o número abaixo pro seu WhatsApp comercial
    const numeroComercial = "5562981519991";
    window.open(`https://wa.me/${numeroComercial}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ maxWidth: 520, width: "100%", background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 24px 48px -24px rgba(16,24,40,.28)" }}>
        {/* Faixa esmeralda */}
        <div style={{ position: "relative", overflow: "hidden", padding: "30px 30px 26px", color: "#fff", background: "linear-gradient(130deg, #10B981 0%, #059669 42%, #065F46 100%)" }}>
          <div aria-hidden style={{ position: "absolute", right: -70, top: -90, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.09)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconeEmoji e={info.icone} tamanho={26} />
            </span>
            <div style={{ minWidth: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.16)", borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 700 }}>
                <Icone nome="cadeado" tamanho={13} /> Plano {info.planoNecessario}
              </span>
              <h1 style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>{info.nome}</h1>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 30px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, margin: 0 }}>{info.desc}</p>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#FFF7ED", boxShadow: "inset 0 0 0 1.5px #FED7AA", borderRadius: 14, padding: "13px 15px" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "#FFEDD5", color: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome="alerta" tamanho={16} /></span>
            <p style={{ color: "#7C2D12", fontSize: 13.5, margin: "4px 0 0", lineHeight: 1.5 }}>
              Este módulo <strong>não está disponível no seu plano atual</strong>. Peça a liberação para começar a usar.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={solicitarLiberacao}
              style={{ flex: "1 1 200px", height: 50, borderRadius: 14, border: 0, cursor: "pointer", color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(140deg, #10B981, #059669 60%, #047857)", boxShadow: "0 14px 26px -14px rgba(5,150,105,.8)" }}>
              <Icone nome="whatsapp" tamanho={18} /> Solicitar liberação
            </button>
            <button onClick={() => router.push("/crm/dashboard")}
              style={{ flex: "0 1 140px", height: 50, borderRadius: 14, border: 0, cursor: "pointer", background: "#F3F6F5", color: "#334155", fontSize: 15, fontWeight: 700 }}>
              Voltar
            </button>
          </div>

          <p style={{ color: "#94A3B8", fontSize: 12.5, margin: 0 }}>
            Ao clicar em &quot;Solicitar liberação&quot; você vai para o WhatsApp do suporte.
          </p>
        </div>
      </div>
    </div>
  );
}
