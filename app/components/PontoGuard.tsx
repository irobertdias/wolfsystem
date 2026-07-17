"use client";
import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════
// 🕐 PontoGuard — Trava o acesso ao sistema se o usuário precisa bater ponto
// ───────────────────────────────────────────────────────────────────────────
// CASCADE DE 3 CAMADAS (ordem de avaliação):
//
//   1️⃣  cadastros.modulo_bater_ponto (camada do PLANO — Wolf admin controla)
//       Se FALSE → cliente não comprou o módulo. Trava DESLIGADA pro workspace
//       inteiro, mesmo que algum usuário tenha exige_ponto=true.
//
//   2️⃣  usuarios_workspace.exige_ponto (camada DO DONO do workspace)
//       Se FALSE → esse usuário específico não precisa bater (sócio, gerente,
//       freelancer). Acessa direto.
//
//   3️⃣  vw_ponto_hoje (camada DA EXECUÇÃO)
//       Se já bateu hoje → libera.
//       Se não bateu → BLOQUEIA até bater.
//
// LIBERAÇÕES AUTOMÁTICAS (bypass total — pulam todas as camadas):
//   • Dono do workspace (owner_id) → nunca trava
//   • Admin master Wolf (robert.dias@live.com) → nunca trava
//   • Rotas /bater-ponto, /login, / → nunca trava (senão fica loop)
//
// USO (envolver o layout principal):
//   <PontoGuard>
//     <SoftphoneProvider>
//       {children}
//     </SoftphoneProvider>
//   </PontoGuard>
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

// Rotas que NÃO podem ser bloqueadas (senão vira loop infinito)
const ROTAS_LIVRES = [
  "/",
  "/login",
  "/crm/ponto",
  "/crm/meu-perfil",   // 🆕 usuário precisa acessar perfil mesmo sem bater ponto
  "/redirect",
];

type Status = "verificando" | "liberado" | "bloqueado";

export default function PontoGuard({ children, ativo }: { children: ReactNode; ativo?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("verificando");
  const [info, setInfo] = useState<{ nome: string; email: string } | null>(null);

  useEffect(() => {
    if (ativo == null) {
      setStatus("verificando");
      return;
    }
    if (!ativo) {
      setStatus("liberado");
      return;
    }
    setStatus("verificando");

    // Rota livre? Libera direto sem checar.
    if (ROTAS_LIVRES.some(r => pathname === r || pathname.startsWith(r + "/"))) {
      setStatus("liberado");
      return;
    }

    let cancelado = false;

    const verificar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Sem login → o AuthGuard cuida (não é nosso problema aqui)
        if (!user) {
          if (!cancelado) setStatus("liberado");
          return;
        }

        const email = user.email || "";

        // 🛡️ Admin master Wolf → sempre passa
        if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          if (!cancelado) setStatus("liberado");
          return;
        }

        // 🏢 Dono de algum workspace? → sempre passa (dono nunca bate ponto)
        const { data: ws } = await supabase.from("workspaces")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (ws) {
          if (!cancelado) setStatus("liberado");
          return;
        }

        // 👤 Sub-usuário → checa exige_ponto
        const { data: usr } = await supabase.from("usuarios_workspace")
          .select("nome, email, exige_ponto, workspace_id, user_id")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Sem registro → não trava (não é gerenciado por esse sistema)
        if (!usr) {
          if (!cancelado) setStatus("liberado");
          return;
        }

        // O acesso ao módulo já foi validado pelo layout da Wolf.\r\n\r\n        // ═══ CAMADA 2: Esse usuário específico tem trava? ═══
        if (usr.exige_ponto === false) {
          if (!cancelado) setStatus("liberado");
          return;
        }

        // ═══ CAMADA 3: Já bateu ponto hoje? ═══
        //    Confere diretamente as batidas reais do funcionário no workspace
        const { data: funcionarios, error: erroFuncionarios } = await supabase
          .from("funcionarios")
          .select("nome, email, user_email")
          .eq("workspace_id", usr.workspace_id);
        if (erroFuncionarios) throw erroFuncionarios;

        const emailNormalizado = email.toLowerCase().trim();
        const funcionario = (funcionarios || []).find((item: any) =>
          String(item.user_email || "").toLowerCase().trim() === emailNormalizado ||
          String(item.email || "").toLowerCase().trim() === emailNormalizado
        );

        let bateuHoje = false;
        if (funcionario?.nome) {
          const inicioHoje = new Date();
          inicioHoje.setHours(0, 0, 0, 0);
          const { data: batidas, error: erroBatidas } = await supabase
            .from("ponto_registros")
            .select("id")
            .eq("workspace_id", usr.workspace_id)
            .eq("funcionario", funcionario.nome)
            .gte("data_hora", inicioHoje.toISOString())
            .limit(1);
          if (erroBatidas) throw erroBatidas;
          bateuHoje = !!batidas?.length;
        }

        if (bateuHoje) {
          if (!cancelado) setStatus("liberado");
          return;
        }

        // Não bateu → BLOQUEIA
        if (!cancelado) {
          setInfo({ nome: usr.nome || "Colaborador", email });
          setStatus("bloqueado");
        }
      } catch (e) {
        console.error("[PontoGuard] Erro ao verificar ponto:", e);
        // Em erro, NÃO bloqueia (evita lock-out do sistema por falha de rede)
        if (!cancelado) setStatus("liberado");
      }
    };

    verificar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, ativo]);

  if (status === "verificando") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>⏳ Verificando acesso...</div>
      </div>
    );
  }

  if (status === "bloqueado") {
    const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const dataHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      }}>
        <div style={{
          maxWidth: 480,
          width: "100%",
          background: "#fff",
          borderRadius: 20,
          padding: 40,
          textAlign: "center",
          boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
        }}>
          {/* Ícone do relógio */}
          <div style={{
            width: 96,
            height: 96,
            margin: "0 auto 20px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            boxShadow: "0 10px 30px rgba(219, 39, 119, 0.4)",
          }}>
            🕐
          </div>

          {/* Saudação */}
          <h1 style={{ color: "#0f172a", fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
            Olá, {info?.nome.split(" ")[0]}!
          </h1>

          <p style={{ color: "#64748b", fontSize: 13.5, margin: "0 0 24px", textTransform: "capitalize" }}>
            {dataHoje} · {horaAtual}
          </p>

          {/* Aviso */}
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderLeft: "4px solid #dc2626",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 24,
            textAlign: "left",
          }}>
            <p style={{ color: "#991b1b", fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>
              ⛔ Acesso ao sistema bloqueado
            </p>
            <p style={{ color: "#7f1d1d", fontSize: 12.5, margin: 0, lineHeight: 1.55 }}>
              Você precisa bater o ponto de entrada antes de começar a usar o sistema hoje.
              Vai levar 10 segundos.
            </p>
          </div>

          {/* Botão principal */}
          <button
            onClick={() => router.push("/crm/ponto")}
            style={{
              background: "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(219, 39, 119, 0.4)",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            🕐 Bater Ponto Agora
          </button>

          {/* Sair */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/");
            }}
            style={{
              background: "transparent",
              color: "#64748b",
              border: "none",
              padding: "12px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 8,
              textDecoration: "underline",
            }}
          >
            ou Sair do sistema
          </button>

          {/* Rodapé */}
          <p style={{ color: "#94a3b8", fontSize: 11, margin: "20px 0 0", lineHeight: 1.5 }}>
            Essa exigência foi configurada pelo administrador do seu workspace.
            Se acha que isso é um erro, fale com ele.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
