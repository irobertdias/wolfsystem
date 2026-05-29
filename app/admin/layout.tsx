"use client";
import AuthGuard from "../../components/AuthGuard";

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 LAYOUT DO ADMIN — Wolf System
// ───────────────────────────────────────────────────────────────────────────
// Envolve todas as páginas dentro de /admin/* com o AuthGuard
// + flag requireSuperAdmin (só super admins acessam).
//
// Quem não estiver logado é redirecionado pra "/".
// Quem estiver logado mas não for super admin é redirecionado pra "/crm".
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireSuperAdmin>
      {children}
    </AuthGuard>
  );
}