"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "./useWorkspace";

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
  roleta: boolean;
  disparos_web: boolean;
  disparos_api: boolean;
  voip: boolean;
  api_integracao: boolean;
  instagram: boolean;
  rh: boolean;            // 🆕 Recursos Humanos
  bater_ponto: boolean;   // 🆕 Bater Ponto
  plano: "basico" | "intermediario" | "ultra" | string;
};

const MODULOS_BLOQUEADOS_DEFAULT: Modulos = {
  roleta: false, disparos_web: false, disparos_api: false,
  voip: false, api_integracao: false, instagram: false,
  rh: false, bater_ponto: false,
  plano: "basico",
};

// Se o email do user logado bate com ADMIN_EMAIL, libera tudo (admin Wolf não tem plano)
const ADMIN_EMAIL = "robert.dias@live.com";

export function useModulos() {
  const { wsId, user } = useWorkspace();
  const [modulos, setModulos] = useState<Modulos>(MODULOS_BLOQUEADOS_DEFAULT);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    let cancelado = false;

    const fetch = async () => {
      try {
        // Admin Wolf: tudo liberado sempre
        if (user?.email === ADMIN_EMAIL) {
          if (!cancelado) {
            setModulos({ roleta: true, disparos_web: true, disparos_api: true, voip: true, api_integracao: true, instagram: true, rh: true, bater_ponto: true, plano: "ultra" });
            setCarregado(true);
          }
          return;
        }

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
            setModulos({ roleta: true, disparos_web: true, disparos_api: true, voip: true, api_integracao: true, instagram: true, rh: true, bater_ponto: true, plano: "ultra" });
            setCarregado(true);
          }
          return;
        }

        // Busca os módulos liberados no cadastro do dono
        const { data: cad } = await supabase.from("cadastros")
          .select("modulo_roleta, modulo_disparos_web, modulo_disparos_api, modulo_voip, modulo_api_integracao, modulo_instagram, modulo_rh, modulo_bater_ponto, plano")
          .eq("email", ownerEmail)
          .maybeSingle();

        if (!cancelado) {
          setModulos({
            roleta: !!cad?.modulo_roleta,
            disparos_web: !!cad?.modulo_disparos_web,
            disparos_api: !!cad?.modulo_disparos_api,
            voip: !!cad?.modulo_voip,
            api_integracao: !!cad?.modulo_api_integracao,
            instagram: !!cad?.modulo_instagram,
            rh: !!cad?.modulo_rh,                 // 🆕
            bater_ponto: !!cad?.modulo_bater_ponto, // 🆕
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
  }, [wsId, user?.email, user?.id]);

  return { modulos, carregado };
}

// ═══════════════════════════════════════════════════════════════════════
// 🔒 <ModuloBloqueado /> — tela de upsell quando módulo não está liberado
// ═══════════════════════════════════════════════════════════════════════
// Uso:
//   if (!modulos.voip) return <ModuloBloqueado modulo="voip" />;
// ═══════════════════════════════════════════════════════════════════════

type ModuloKey = "roleta" | "disparos_web" | "disparos_api" | "voip" | "api_integracao" | "instagram" | "rh" | "bater_ponto";

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
    <div style={{
      minHeight: "calc(100vh - 64px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, background: "#0a0a0a",
    }}>
      <div style={{
        maxWidth: 520, width: "100%",
        background: "#111",
        border: `1px solid ${info.cor}44`,
        borderRadius: 16,
        padding: 40,
        textAlign: "center",
        boxShadow: `0 0 60px ${info.cor}22`,
      }}>
        {/* Ícone grande com brilho */}
        <div style={{
          width: 96, height: 96, margin: "0 auto 24px",
          borderRadius: "50%",
          background: `${info.cor}22`,
          border: `2px solid ${info.cor}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 48,
        }}>
          {info.icone}
        </div>

        {/* Badge do plano */}
        <div style={{
          display: "inline-block",
          background: `${info.cor}22`,
          border: `1px solid ${info.cor}44`,
          borderRadius: 20,
          padding: "4px 14px",
          marginBottom: 16,
        }}>
          <span style={{ color: info.cor, fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 }}>
            🔒 Plano {info.planoNecessario}
          </span>
        </div>

        <h1 style={{ color: "white", fontSize: 26, fontWeight: "bold", margin: "0 0 12px" }}>
          {info.nome}
        </h1>

        <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.6, margin: "0 0 32px" }}>
          {info.desc}
        </p>

        {/* Aviso de bloqueio */}
        <div style={{
          background: "#0a0a0a",
          border: "1px solid #1f2937",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 24,
          textAlign: "left",
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <p style={{ color: "#d1d5db", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Este módulo <strong>não está disponível no seu plano atual</strong>.
            Solicite a liberação para o administrador para começar a usar.
          </p>
        </div>

        {/* Botões */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={solicitarLiberacao}
            style={{
              background: info.cor,
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "14px 28px",
              fontSize: 14,
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            💬 Solicitar Liberação
          </button>
          <button
            onClick={() => router.push("/crm/dashboard")}
            style={{
              background: "none",
              color: "#9ca3af",
              border: "1px solid #374151",
              borderRadius: 10,
              padding: "14px 28px",
              fontSize: 14,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            ← Voltar
          </button>
        </div>

        <p style={{ color: "#6b7280", fontSize: 11, margin: "24px 0 0", fontStyle: "italic" }}>
          Ao clicar em "Solicitar Liberação", você será redirecionado para o WhatsApp do suporte.
        </p>
      </div>
    </div>
  );
}