"use client";
import AuthGuard from "../components/AuthGuard";

// ═══════════════════════════════════════════════════════════════════════
// 🎧 Layout do Chatbot — envolve todas as páginas em /chatbot/*
// ═══════════════════════════════════════════════════════════════════════
// - 🔒 AuthGuard bloqueia acesso sem login (redireciona pra "/")
// - O layout principal já fornece o SoftphoneContext e o discador flutuante.
// ═══════════════════════════════════════════════════════════════════════

export default function ChatbotLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
    </AuthGuard>
  );
}
