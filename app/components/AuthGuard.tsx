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
      const sessaoServidor = await fetch("/api/session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!sessaoServidor.ok) {
        router.replace(redirectTo);
        setEstado("negado");
        return;
      }

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
        minHeight: "100vh", background: "#f8fafc", gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
        }}>🔒</div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0, fontWeight: 600 }}>Verificando acesso...</p>
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