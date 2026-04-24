"use client";
import { SoftphoneProvider } from "../hooks/useSoftphone";
import { Softphone } from "../components/Softphone";

// ═══════════════════════════════════════════════════════════════════════
// 🎧 Layout do Chatbot — envolve todas as páginas em /chatbot/*
// ═══════════════════════════════════════════════════════════════════════
// - Prove o SoftphoneContext pra que o botão "📞 Ligar" no chat funcione
// - Renderiza o <Softphone /> flutuante no canto inferior direito
// ═══════════════════════════════════════════════════════════════════════

export default function ChatbotLayout({ children }: { children: React.ReactNode }) {
  return (
    <SoftphoneProvider>
      {children}
      <Softphone />
    </SoftphoneProvider>
  );
}