"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 AUTH GUARD — Wolf System
// ───────────────────────────────────────────────────────────────────────────
// Wrapper pra blindar páginas privadas no client. Uso:
//
//   // Layout privado comum (CRM, Chatbot, etc):
//   <AuthGuard>
//     <conteúdo>
//   </AuthGuard>
//
//   // Layout admin (precisa de super admin):
//   <AuthGuard requireSuperAdmin>
//     <conteúdo>
//   </AuthGuard>
//
// Comportamento:
//   1. Mostra "Verificando acesso..." enquanto valida (evita flash de conteúdo)
//   2. Sem sessão → redireciona pra "/"
//   3. Sessão OK mas não é super admin (se requireSuperAdmin) → redireciona "/crm"
//   4. Tudo OK → renderiza children
// ═══════════════════════════════════════════════════════════════════════════

type Props = {
  children: React.ReactNode;
  /** Exige que o usuário seja super admin (pra rotas /admin) */
  requireSuperAdmin?: boolean;
  /** Pra onde redirecionar se não estiver logado (default "/") */
  redirectTo?: string;
};

export default function AuthGuard({
  children,
  requireSuperAdmin = false,
  redirectTo = "/",
}: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<"verificando" | "autorizado" | "negado">("verificando");

  useEffect(() => {
    let cancelado = false;

    const verificar = async () => {
      // 1) Tem sessão?
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelado) return;

      // Login criado pelo administrador: no primeiro acesso o cliente cria a própria senha.
      if (session?.user?.user_metadata?.trocar_senha === true) {
        router.replace("/login/nova-senha?primeiro=1");
        setEstado("negado");
        return;
      }

      // ⚡ O mesmo token já foi validado no servidor há menos de 45 min (o cookie dura 60):
      // libera a tela na hora em vez de repetir a validação a cada página aberta.
      const CHAVE_VALIDACAO = "wolf_sessao_validada";
      if (!requireSuperAdmin && session?.access_token) {
        try {
          const salvo = JSON.parse(sessionStorage.getItem(CHAVE_VALIDACAO) || "null");
          if (salvo?.token === session.access_token && Date.now() - Number(salvo.em) < 45 * 60_000) {
            setEstado("autorizado");
            return;
          }
        } catch {}
      }

      // Valida usuário e registra a sessão no servidor ao mesmo tempo (antes era em sequência).
      const registroServidor = session?.access_token
        ? fetch("/api/session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null)
        : Promise.resolve(null);
      const { data: { user }, error } = await supabase.auth.getUser();
      if (cancelado) return;

      if (error || !user) {
        await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
        // Salva pra onde queria ir, pra voltar depois do login
        const destino = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
        const url = destino && destino !== "/" ? `${redirectTo}?redirect=${encodeURIComponent(destino)}` : redirectTo;
        router.replace(url);
        setEstado("negado");
        return;
      }

      if (!session?.access_token) {
        router.replace(redirectTo);
        setEstado("negado");
        return;
      }
      const sessaoServidor = await registroServidor;
      if (cancelado) return;
      if (!sessaoServidor || !sessaoServidor.ok) {
        router.replace(redirectTo);
        setEstado("negado");
        return;
      }
      try { sessionStorage.setItem(CHAVE_VALIDACAO, JSON.stringify({ token: session.access_token, em: Date.now() })); } catch {}

      // 2) Se exigir super admin, confere
      if (requireSuperAdmin) {
        // 🔧 AJUSTE: troque "super_admins" pelo nome real da sua tabela (se for diferente)
        //    Se vc usa coluna `is_super_admin` em `usuarios_workspace`, troque a query.
        const ehAdmin = await checarSuperAdmin(user.id, user.email || "");
        if (cancelado) return;

        if (!ehAdmin) {
          router.replace("/crm");
          setEstado("negado");
          return;
        }
      }

      setEstado("autorizado");
    };

    verificar();
    return () => { cancelado = true; };
  }, [router, requireSuperAdmin, redirectTo]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session?.access_token) {
        fetch("/api/session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => undefined);
      } else {
        fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  if (estado === "verificando") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#F3F6F5", gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "linear-gradient(135deg, #10B981 0%, #047857 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
        }}>🔒</div>
        <p style={{ color: "#64748B", fontSize: 13, margin: 0, fontWeight: 600 }}>Verificando acesso...</p>
      </div>
    );
  }

  if (estado === "negado") {
    // Já redirecionou — renderiza nada
    return null;
  }

  return <>{children}</>;
}

// ─── Helper: checar se é super admin ──────────────────────────────────────
// Suporta 2 padrões comuns. Ajuste conforme seu schema:
//   A) Tabela dedicada `super_admins` com coluna `auth_user_id` ou `email`
//   B) Coluna booleana `is_super_admin` em `usuarios_workspace`
async function checarSuperAdmin(userId: string, email: string): Promise<boolean> {
  if (email.toLowerCase() === "robert.dias@live.com") return true;
  // Padrão A: tabela super_admins
  try {
    const { data, error } = await supabase
      .from("super_admins")
      .select("id")
      .or(`auth_user_id.eq.${userId},email.eq.${email}`)
      .maybeSingle();
    if (!error && data) return true;
  } catch { /* tabela pode não existir */ }

  // Padrão B: coluna is_super_admin em usuarios_workspace
  try {
    const { data, error } = await supabase
      .from("usuarios_workspace")
      .select("is_super_admin")
      .eq("email", email)
      .eq("is_super_admin", true)
      .maybeSingle();
    if (!error && data) return true;
  } catch { /* coluna pode não existir */ }

  return false;
}